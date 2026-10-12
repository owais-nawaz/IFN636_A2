// Notifications (FR-2): Observer subject, notifiers and recipient rules.
// Uses fake events in the BugService contract shape (BTS2-48) until the
// service emits real ones.
const { expect } = require('chai');
const sinon = require('sinon');

const Bug = require('../src/models/Bug');
const User = require('../src/models/User');
const Notification = require('../src/models/Notification');
const BugEventSubject = require('../src/notifications/BugEventSubject');
const BaseNotifier = require('../src/notifications/BaseNotifier');
const InAppNotifier = require('../src/notifications/InAppNotifier');
const EmailNotifier = require('../src/notifications/EmailNotifier');
const bugEvents = require('../src/notifications/bugEvents');
const { EVENT_TYPES } = require('../src/notifications/rules');

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
    it('FR-2: logs a simulated email to each recipient instead of sending it', async () => {
      sinon.stub(Bug, 'findOne').resolves(bug);
      const userStub = sinon.stub(User, 'find').resolves([{ username: 'tester_sarah', email: 'sarah@qut.edu.au' }]);
      const logStub = sinon.stub(console, 'log');

      await new EmailNotifier().notify(event(EVENT_TYPES.CLAIMED));

      expect(userStub.calledWith({ username: { $in: ['tester_sarah'] } })).to.be.true;
      expect(logStub.calledOnce).to.be.true;
      expect(logStub.firstCall.args[0]).to.include('To: sarah@qut.edu.au').and.include('BUG-101 was claimed by dev_alex.');
    });
  });
});
