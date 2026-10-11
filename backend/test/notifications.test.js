// Notifications (FR-2): Observer subject, notifiers and recipient rules.
// Uses fake events until BugService emits real ones (BTS2-50).
const { expect } = require('chai');
const sinon = require('sinon');

const User = require('../src/models/User');
const Notification = require('../src/models/Notification');
const BugEventSubject = require('../src/notifications/BugEventSubject');
const BaseNotifier = require('../src/notifications/BaseNotifier');
const InAppNotifier = require('../src/notifications/InAppNotifier');
const EmailNotifier = require('../src/notifications/EmailNotifier');
const { EVENT_TYPES } = require('../src/notifications/rules');

const bug = { ticketId: 101, title: 'Login button broken', reporter: 'tester_sarah', assignee: 'dev_alex' };
const event = type => ({ type, bug });

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
  });

  describe('BaseNotifier', () => {
    it('FR-2: cannot be instantiated directly', () => {
      expect(() => new BaseNotifier()).to.throw('abstract');
    });
  });

  describe('InAppNotifier and recipient rules', () => {
    let insertStub;

    beforeEach(() => {
      insertStub = sinon.stub(Notification, 'insertMany').resolves([]);
    });

    const savedRecipients = () => insertStub.firstCall.args[0].map(n => n.recipient);

    it('FR-2: claim notifies the reporter', async () => {
      await new InAppNotifier().notify(event(EVENT_TYPES.CLAIMED));

      expect(insertStub.firstCall.args[0]).to.deep.equal([{
        recipient: 'tester_sarah',
        bugId: 101,
        eventType: EVENT_TYPES.CLAIMED,
        message: 'BUG-101 was claimed by dev_alex.',
      }]);
    });

    it('FR-2: resolve notifies the reporter and all QA Leads', async () => {
      const findStub = sinon.stub(User, 'find').resolves([{ username: 'qa_lead' }, { username: 'qa_lead2' }]);

      await new InAppNotifier().notify(event(EVENT_TYPES.RESOLVED));

      expect(findStub.calledWith({ role: 'QALead' })).to.be.true;
      expect(savedRecipients()).to.deep.equal(['tester_sarah', 'qa_lead', 'qa_lead2']);
    });

    it('FR-2: resolve does not notify a QA Lead twice when they are also the reporter', async () => {
      sinon.stub(User, 'find').resolves([{ username: 'qa_lead' }]);

      await new InAppNotifier().notify({ type: EVENT_TYPES.RESOLVED, bug: { ...bug, reporter: 'qa_lead' } });

      expect(savedRecipients()).to.deep.equal(['qa_lead']);
    });

    it('FR-2: reopen notifies the assigned developer', async () => {
      await new InAppNotifier().notify(event(EVENT_TYPES.REOPENED));

      expect(savedRecipients()).to.deep.equal(['dev_alex']);
    });

    it('FR-2: reopen of an unassigned bug saves nothing', async () => {
      await new InAppNotifier().notify({ type: EVENT_TYPES.REOPENED, bug: { ...bug, assignee: 'Unassigned' } });

      expect(insertStub.called).to.be.false;
    });

    it('FR-2: unknown event types save nothing', async () => {
      await new InAppNotifier().notify(event('bug.created'));

      expect(insertStub.called).to.be.false;
    });
  });

  describe('EmailNotifier', () => {
    it('FR-2: logs a simulated email to each recipient instead of sending it', async () => {
      const findStub = sinon.stub(User, 'find').resolves([{ username: 'tester_sarah', email: 'sarah@qut.edu.au' }]);
      const logStub = sinon.stub(console, 'log');

      await new EmailNotifier().notify(event(EVENT_TYPES.CLAIMED));

      expect(findStub.calledWith({ username: { $in: ['tester_sarah'] } })).to.be.true;
      expect(logStub.calledOnce).to.be.true;
      expect(logStub.firstCall.args[0]).to.include('To: sarah@qut.edu.au').and.include('BUG-101 was claimed by dev_alex.');
    });
  });
});
