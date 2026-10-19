// Notifications (FR-2): Observer subject, notifiers, recipient rules, the
// events BugService emits (contract on BTS2-48), and the notifications API.
const { expect } = require('chai');
const sinon = require('sinon');
const nodemailer = require('nodemailer');

const Bug = require('../src/models/Bug');
const User = require('../src/models/User');
const Notification = require('../src/models/Notification');
const BugEventSubject = require('../src/notifications/BugEventSubject');
const BaseNotifier = require('../src/notifications/BaseNotifier');
const InAppNotifier = require('../src/notifications/InAppNotifier');
const EmailNotifier = require('../src/notifications/EmailNotifier');
const bugEvents = require('../src/notifications/bugEvents');
const { EVENT_TYPES } = require('../src/notifications/rules');
const bugService = require('../src/services/bugService');
const request = require('supertest');
const app = require('../src/app');
const { getNotifications, markRead } = require('../src/controllers/notificationController');

const bug = { ticketId: 101, reporter: 'tester_sarah', assignee: 'dev_alex' };

const event = (type, actingUser = 'dev_alex') => ({
  type,
  bugId: 101,
  actingUser,
  fieldChanged: 'status',
  oldValue: 'Open',
  newValue: 'In Progress',
  timestamp: new Date('2026-10-12T00:00:00Z'),
});

describe('Notifications (FR-2)', () => {
  afterEach(() => sinon.restore());

  describe('BugEventSubject', () => {
    it('FR-2: passes each event to every subscribed observer', async () => {
      const subject = new BugEventSubject();
      const first = { notify: sinon.stub().resolves() };
      const second = { notify: sinon.stub().resolves() };
      subject.subscribe(first);
      subject.subscribe(second);

      const claimed = event(EVENT_TYPES.CLAIMED);
      await subject.notify(claimed);

      expect(first.notify.calledOnceWith(claimed)).to.be.true;
      expect(second.notify.calledOnceWith(claimed)).to.be.true;
    });

    it('FR-2: keeps notifying other observers when one fails', async () => {
      sinon.stub(console, 'error');
      const subject = new BugEventSubject();
      const working = { notify: sinon.stub().resolves() };
      subject.subscribe({ notify: sinon.stub().rejects(new Error('SMTP down')) });
      subject.subscribe(working);

      await subject.notify(event(EVENT_TYPES.CLAIMED));

      expect(working.notify.calledOnce).to.be.true;
      expect(console.error.calledOnce).to.be.true;
    });

    it('FR-2: rejects observers without a notify method', () => {
      expect(() => new BugEventSubject().subscribe({})).to.throw('notify(event)');
    });

    it('FR-2: the shared bugEvents subject has the in-app and email notifiers subscribed', () => {
      expect(bugEvents).to.be.instanceOf(BugEventSubject);
      expect(bugEvents.observers.map(o => o.constructor)).to.deep.equal([InAppNotifier, EmailNotifier]);
    });
  });

  describe('BaseNotifier', () => {
    it('FR-2: cannot be instantiated directly', () => {
      expect(() => new BaseNotifier()).to.throw('abstract');
    });
  });

  describe('InAppNotifier and recipient rules', () => {
    let insertStub;
    let bugStub;

    beforeEach(() => {
      insertStub = sinon.stub(Notification, 'insertMany').resolves([]);
      bugStub = sinon.stub(Bug, 'findOne').resolves(bug);
    });

    const savedRecipients = () => insertStub.firstCall.args[0].map(n => n.recipient);

    it('FR-2: claim notifies the reporter', async () => {
      await new InAppNotifier().notify(event(EVENT_TYPES.CLAIMED));

      expect(bugStub.calledWith({ ticketId: 101 })).to.be.true;
      expect(insertStub.firstCall.args[0]).to.deep.equal([{
        recipient: 'tester_sarah',
        bugId: 101,
        eventType: EVENT_TYPES.CLAIMED,
        message: 'BUG-101 was claimed by dev_alex.',
        timestamp: new Date('2026-10-12T00:00:00Z'),
      }]);
    });

    it('FR-2: resolve notifies the reporter and all QA Leads', async () => {
      const userStub = sinon.stub(User, 'find').resolves([{ username: 'qa_lead' }, { username: 'qa_lead2' }]);

      await new InAppNotifier().notify(event(EVENT_TYPES.RESOLVED));

      expect(userStub.calledWith({ role: 'QALead' })).to.be.true;
      expect(savedRecipients()).to.deep.equal(['tester_sarah', 'qa_lead', 'qa_lead2']);
    });

    it('FR-2: resolve does not notify a QA Lead twice when they are also the reporter', async () => {
      bugStub.resolves({ ...bug, reporter: 'qa_lead' });
      sinon.stub(User, 'find').resolves([{ username: 'qa_lead' }]);

      await new InAppNotifier().notify(event(EVENT_TYPES.RESOLVED));

      expect(savedRecipients()).to.deep.equal(['qa_lead']);
    });

    it('FR-2: reopen notifies the assigned developer', async () => {
      await new InAppNotifier().notify(event(EVENT_TYPES.REOPENED, 'qa_lead'));

      expect(savedRecipients()).to.deep.equal(['dev_alex']);
      expect(insertStub.firstCall.args[0][0].message).to.equal('BUG-101 was re-opened by qa_lead.');
    });

    it('FR-2: reopen of an unassigned bug saves nothing', async () => {
      bugStub.resolves({ ...bug, assignee: 'Unassigned' });

      await new InAppNotifier().notify(event(EVENT_TYPES.REOPENED, 'qa_lead'));

      expect(insertStub.called).to.be.false;
    });

    it('FR-2: close notifies nobody and skips the bug lookup', async () => {
      await new InAppNotifier().notify(event(EVENT_TYPES.CLOSED, 'qa_lead'));

      expect(bugStub.called).to.be.false;
      expect(insertStub.called).to.be.false;
    });

    it('FR-2: an event for a bug that no longer exists saves nothing', async () => {
      bugStub.resolves(null);

      await new InAppNotifier().notify(event(EVENT_TYPES.CLAIMED));

      expect(insertStub.called).to.be.false;
    });

    it('FR-2: unknown event types save nothing', async () => {
      await new InAppNotifier().notify(event('bug.created'));

      expect(insertStub.called).to.be.false;
    });
  });

  describe('EmailNotifier', () => {
    const users = [
      { username: 'tester_sarah', email: 'sarah@qut.edu.au' },
      { username: 'qa_lead', email: 'qa@qut.edu.au' },
    ];

    it('FR-2: without Gmail settings, logs the email instead of sending it', async () => {
      sinon.stub(Bug, 'findOne').resolves(bug);
      const userStub = sinon.stub(User, 'find').resolves([users[0]]);
      const createStub = sinon.stub(nodemailer, 'createTransport');
      const logStub = sinon.stub(console, 'log');

      await new EmailNotifier().notify(event(EVENT_TYPES.CLAIMED));

      expect(userStub.calledWith({ username: { $in: ['tester_sarah'] } })).to.be.true;
      expect(createStub.called).to.be.false;
      expect(logStub.calledOnce).to.be.true;
      expect(logStub.firstCall.args[0]).to.include('To: sarah@qut.edu.au').and.include('BUG-101 was claimed by dev_alex.');
    });

    it('FR-2: sends one email per recipient through the mail transport', async () => {
      sinon.stub(User, 'find').resolves(users);
      sinon.stub(console, 'log');
      const transport = { sendMail: sinon.stub().resolves({}) };

      await new EmailNotifier({ transport }).send(['tester_sarah', 'qa_lead'], event(EVENT_TYPES.RESOLVED), 'BUG-101 was resolved.');

      expect(transport.sendMail.callCount).to.equal(2);
      const mail = transport.sendMail.firstCall.args[0];
      expect(mail.to).to.equal('sarah@qut.edu.au');
      expect(mail.subject).to.equal('BUG-101 update');
      expect(mail.text).to.include('BUG-101 was resolved.');
      expect(transport.sendMail.secondCall.args[0].to).to.equal('qa@qut.edu.au');
    });

    it('FR-2: a failed address is logged and does not stop the other emails', async () => {
      sinon.stub(User, 'find').resolves(users);
      sinon.stub(console, 'log');
      const errorStub = sinon.stub(console, 'error');
      const transport = { sendMail: sinon.stub() };
      transport.sendMail.onFirstCall().rejects(new Error('Invalid recipient'));
      transport.sendMail.onSecondCall().resolves({});

      await new EmailNotifier({ transport }).send(['tester_sarah', 'qa_lead'], event(EVENT_TYPES.RESOLVED), 'BUG-101 was resolved.');

      expect(transport.sendMail.callCount).to.equal(2);
      expect(errorStub.calledOnce).to.be.true;
      expect(errorStub.firstCall.args[0]).to.include('sarah@qut.edu.au');
    });

    it('FR-2: with Gmail settings, creates one Gmail transport and reuses it', async () => {
      sinon.stub(process, 'env').value({ ...process.env, GMAIL_USER: 'bts@gmail.com', GMAIL_APP_PASSWORD: 'app-password' });
      sinon.stub(User, 'find').resolves([users[0]]);
      sinon.stub(console, 'log');
      const transport = { sendMail: sinon.stub().resolves({}) };
      const createStub = sinon.stub(nodemailer, 'createTransport').returns(transport);
      const notifier = new EmailNotifier();

      await notifier.send(['tester_sarah'], event(EVENT_TYPES.CLAIMED), 'one');
      await notifier.send(['tester_sarah'], event(EVENT_TYPES.CLAIMED), 'two');

      expect(createStub.calledOnce).to.be.true;
      expect(createStub.firstCall.args[0]).to.deep.equal({ service: 'gmail', auth: { user: 'bts@gmail.com', pass: 'app-password' } });
      expect(transport.sendMail.firstCall.args[0].from).to.include('bts@gmail.com');
      expect(transport.sendMail.callCount).to.equal(2);
    });
  });

  describe('BugService emits events', () => {
    let notifyStub;

    beforeEach(() => {
      notifyStub = sinon.stub(bugEvents, 'notify').resolves();
      sinon.stub(Bug, 'findOneAndUpdate').resolves({ ticketId: 101 });
    });

    const emitted = [
      ['claim',  'Open',        () => bugService.claim(101, 'dev_alex'),                                    EVENT_TYPES.CLAIMED,  'dev_alex', 'In Progress'],
      ['resolve', 'In Progress', () => bugService.resolve(101, 'dev_alex', 'Code Fix', 'Fixed the null check.'), EVENT_TYPES.RESOLVED, 'dev_alex', 'Resolved'],
      ['close',  'Resolved',    () => bugService.verify(101, 'qa_lead', 'close', null),                     EVENT_TYPES.CLOSED,   'qa_lead',  'Closed'],
      ['reopen', 'Resolved',    () => bugService.verify(101, 'qa_lead', 'reopen', 'Still crashes.'),        EVENT_TYPES.REOPENED, 'qa_lead',  'Re-opened'],
    ];

    emitted.forEach(([action, from, run, type, actingUser, to]) => {
      it(`FR-2: ${action} emits ${type} with the contract fields`, async () => {
        Bug.findOneAndUpdate.resetHistory();
        sinon.stub(Bug, 'findOne').resolves({ ticketId: 101, status: from });

        await run();

        expect(notifyStub.calledOnce).to.be.true;
        const sent = notifyStub.firstCall.args[0];
        expect(sent).to.include({ type, bugId: 101, actingUser, fieldChanged: 'status', oldValue: from, newValue: to });
        expect(sent.timestamp).to.be.instanceOf(Date);
        expect(notifyStub.calledAfter(Bug.findOneAndUpdate)).to.be.true;
      });
    });

    it('FR-2 (409): an invalid transition emits nothing', async () => {
      sinon.stub(Bug, 'findOne').resolves({ ticketId: 101, status: 'Closed' });

      try { await bugService.claim(101, 'dev_alex'); } catch (err) { /* expected 409 */ }

      expect(notifyStub.called).to.be.false;
    });

    it('FR-2 (409): a bug changed by someone else in between emits nothing', async () => {
      sinon.stub(Bug, 'findOne').resolves({ ticketId: 101, status: 'Open' });
      Bug.findOneAndUpdate.resolves(null);

      try { await bugService.claim(101, 'dev_alex'); } catch (err) { /* expected 409 */ }

      expect(notifyStub.called).to.be.false;
    });

    it('FR-2 (404): an unknown bug emits nothing', async () => {
      sinon.stub(Bug, 'findOne').resolves(null);

      try { await bugService.claim(999, 'dev_alex'); } catch (err) { /* expected 404 */ }

      expect(notifyStub.called).to.be.false;
    });

    it('FR-2 (400): a validation error emits nothing', async () => {
      try { await bugService.verify(101, 'qa_lead', 'reopen', ''); } catch (err) { /* expected 400 */ }

      expect(notifyStub.called).to.be.false;
    });
  });

  describe('Notifications API', () => {
    const ID = '670a00010000000000000001';
    let res;

    beforeEach(() => {
      res = { status: sinon.stub().returnsThis(), json: sinon.spy() };
    });

    // Notification.find(...).sort(...).limit(...).lean() resolving to the given
    // list, and countDocuments resolving to the given unread count.
    const stubFind = (list, unread = 0) => {
      const query = { sort: sinon.stub(), limit: sinon.stub(), lean: sinon.stub().resolves(list) };
      query.sort.returns(query);
      query.limit.returns(query);
      sinon.stub(Notification, 'countDocuments').resolves(unread);
      return { findStub: sinon.stub(Notification, 'find').returns(query), query };
    };

    it('FR-2: lists only the logged-in user\'s notifications with the unread count', async () => {
      const { findStub } = stubFind([
        { _id: ID, recipient: 'tester_sarah', read: false },
        { _id: '670a00010000000000000002', recipient: 'tester_sarah', read: true },
      ], 1);

      await getNotifications({ authenticatedUser: { username: 'tester_sarah' } }, res);

      expect(findStub.calledOnceWith({ recipient: 'tester_sarah' })).to.be.true;
      expect(Notification.countDocuments.calledOnceWith({ recipient: 'tester_sarah', read: false })).to.be.true;
      expect(res.json.firstCall.args[0]).to.include({ success: true, count: 2, unread: 1 });
    });

    it('FR-2: lists the newest 50 notifications first', async () => {
      const { query } = stubFind([]);

      await getNotifications({ authenticatedUser: { username: 'tester_sarah' } }, res);

      expect(query.sort.calledWith({ timestamp: -1 })).to.be.true;
      expect(query.limit.calledWith(50)).to.be.true;
    });

    it('FR-2: the unread count covers notifications beyond the 50 listed', async () => {
      stubFind([{ _id: ID, recipient: 'tester_sarah', read: true }], 72);

      await getNotifications({ authenticatedUser: { username: 'tester_sarah' } }, res);

      expect(res.json.firstCall.args[0]).to.include({ count: 1, unread: 72 });
    });

    it('FR-2: marks the user\'s own notification as read', async () => {
      const updateStub = sinon.stub(Notification, 'findOneAndUpdate').resolves({ _id: ID, read: true });

      await markRead({ params: { id: ID }, authenticatedUser: { username: 'tester_sarah' } }, res);

      expect(updateStub.calledOnceWith({ _id: ID, recipient: 'tester_sarah' }, { read: true }, { new: true })).to.be.true;
      expect(res.status.called).to.be.false; // default 200
      expect(res.json.firstCall.args[0].notification.read).to.be.true;
    });

    it('FR-2 (404): marking someone else\'s notification returns 404 and changes nothing', async () => {
      // The filter includes the recipient, so another user's notification never matches.
      sinon.stub(Notification, 'findOneAndUpdate').resolves(null);

      await markRead({ params: { id: ID }, authenticatedUser: { username: 'dev_alex' } }, res);

      expect(Notification.findOneAndUpdate.firstCall.args[0]).to.deep.equal({ _id: ID, recipient: 'dev_alex' });
      expect(res.status.calledWith(404)).to.be.true;
    });

    it('FR-2 (404): an unknown notification ID returns 404', async () => {
      sinon.stub(Notification, 'findOneAndUpdate').resolves(null);

      await markRead({ params: { id: '670a000100000000000000ff' }, authenticatedUser: { username: 'tester_sarah' } }, res);

      expect(res.status.calledWith(404)).to.be.true;
      expect(res.json.calledWith({ success: false, errors: ['Notification not found.'] })).to.be.true;
    });

    it('FR-2 (404): a malformed ID returns 404 without querying the database', async () => {
      const updateStub = sinon.stub(Notification, 'findOneAndUpdate');

      await markRead({ params: { id: 'not-an-id' }, authenticatedUser: { username: 'tester_sarah' } }, res);

      expect(res.status.calledWith(404)).to.be.true;
      expect(updateStub.called).to.be.false;
    });

    it('FR-2 (401): both endpoints require a login', async () => {
      const list = await request(app).get('/api/notifications');
      const mark = await request(app).patch(`/api/notifications/${ID}/read`);

      expect(list.status).to.equal(401);
      expect(mark.status).to.equal(401);
    });
  });
});
