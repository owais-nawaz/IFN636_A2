const { expect } = require('chai');
const sinon = require('sinon');

const Bug = require('../src/models/Bug');
const AuditLog = require('../src/models/AuditLog');
const AuditEntry = require('../src/services/AuditEntry');
const AuditedBugService = require('../src/services/AuditedBugService');
const BugServiceError = require('../src/services/BugServiceError');

describe('AuditedBugService (Decorator Pattern)', () => {
  let mockInner;
  let auditedService;
  let auditCreateStub;
  let bugFindStub;

  beforeEach(() => {
    mockInner = {
      claim: sinon.stub(),
      resolve: sinon.stub(),
      verify: sinon.stub(),
    };
    auditedService = new AuditedBugService(mockInner);
    auditCreateStub = sinon.stub(AuditLog, 'create').resolves({});
    bugFindStub = sinon.stub(Bug, 'findOne').resolves(null);
  });

  afterEach(() => sinon.restore());

  describe('claim decoration', () => {
    it('calls inner claim first and saves AuditEntry with who, field, old, new, and when on success', async () => {
      bugFindStub.resolves({ ticketId: 101, status: 'Open' });
      const updatedBug = { ticketId: 101, status: 'In Progress', assignee: 'dev_alex' };
      mockInner.claim.resolves(updatedBug);

      const result = await auditedService.claim(101, 'dev_alex');

      expect(mockInner.claim.calledOnceWith(101, 'dev_alex')).to.be.true;
      expect(result).to.deep.equal(updatedBug);
      expect(auditCreateStub.calledOnce).to.be.true;

      const savedEntry = auditCreateStub.firstCall.args[0];
      expect(savedEntry.bugId).to.equal(101);
      expect(savedEntry.action).to.equal('bug.claimed');
      expect(savedEntry.actingUser).to.equal('dev_alex');
      expect(savedEntry.fieldChanged).to.equal('status');
      expect(savedEntry.oldValue).to.equal('Open');
      expect(savedEntry.newValue).to.equal('In Progress');
      expect(savedEntry.timestamp).to.be.instanceOf(Date);
    });

    it('records nothing if inner claim fails (a failed action records nothing)', async () => {
      bugFindStub.resolves({ ticketId: 101, status: 'Closed' });
      mockInner.claim.rejects(new BugServiceError('INVALID_TRANSITION', 'Cannot claim Closed bug.'));

      try {
        await auditedService.claim(101, 'dev_alex');
        expect.fail('Should have thrown');
      } catch (err) {
        expect(err).to.be.instanceOf(BugServiceError);
        expect(err.code).to.equal('INVALID_TRANSITION');
      }

      expect(auditCreateStub.called).to.be.false;
    });

    it('skips saving AuditEntry if previous status could not be determined', async () => {
      bugFindStub.resolves(null);
      const updatedBug = { ticketId: 101, status: 'In Progress' };
      mockInner.claim.resolves(updatedBug);

      const result = await auditedService.claim(101, 'dev_alex');

      expect(mockInner.claim.calledOnceWith(101, 'dev_alex')).to.be.true;
      expect(result).to.deep.equal(updatedBug);
      expect(auditCreateStub.called).to.be.false;
    });

    it('still returns updated bug even if saving AuditEntry throws an error', async () => {
      bugFindStub.resolves({ ticketId: 101, status: 'Open' });
      const updatedBug = { ticketId: 101, status: 'In Progress' };
      mockInner.claim.resolves(updatedBug);
      auditCreateStub.rejects(new Error('Database write error'));

      const result = await auditedService.claim(101, 'dev_alex');

      expect(result).to.deep.equal(updatedBug);
      expect(auditCreateStub.calledOnce).to.be.true;
    });
  });

  describe('resolve decoration', () => {
    it('calls inner resolve first and saves AuditEntry on success', async () => {
      bugFindStub.resolves({ ticketId: 101, status: 'In Progress' });
      const updatedBug = { ticketId: 101, status: 'Resolved', assignee: 'dev_alex' };
      mockInner.resolve.resolves(updatedBug);

      const result = await auditedService.resolve(101, 'dev_alex', 'Code Fix', 'Fixed null pointer exception.');

      expect(mockInner.resolve.calledOnceWith(101, 'dev_alex', 'Code Fix', 'Fixed null pointer exception.')).to.be.true;
      expect(result).to.deep.equal(updatedBug);
      expect(auditCreateStub.calledOnce).to.be.true;

      const savedEntry = auditCreateStub.firstCall.args[0];
      expect(savedEntry.bugId).to.equal(101);
      expect(savedEntry.action).to.equal('bug.resolved');
      expect(savedEntry.actingUser).to.equal('dev_alex');
      expect(savedEntry.fieldChanged).to.equal('status');
      expect(savedEntry.oldValue).to.equal('In Progress');
      expect(savedEntry.newValue).to.equal('Resolved');
      expect(savedEntry.timestamp).to.be.instanceOf(Date);
    });

    it('records nothing if inner resolve fails with validation error', async () => {
      mockInner.resolve.rejects(new BugServiceError('VALIDATION', 'Notes too short'));

      try {
        await auditedService.resolve(101, 'dev_alex', 'Code Fix', 'short');
        expect.fail('Should have thrown');
      } catch (err) {
        expect(err).to.be.instanceOf(BugServiceError);
        expect(err.code).to.equal('VALIDATION');
      }

      expect(auditCreateStub.called).to.be.false;
    });
  });

  describe('verify decoration', () => {
    it('calls inner verify for close and saves AuditEntry with bug.closed', async () => {
      bugFindStub.resolves({ ticketId: 101, status: 'Resolved' });
      const updatedBug = { ticketId: 101, status: 'Closed' };
      mockInner.verify.resolves(updatedBug);

      const result = await auditedService.verify(101, 'qa_lead', 'close', null);

      expect(mockInner.verify.calledOnceWith(101, 'qa_lead', 'close', null)).to.be.true;
      expect(result).to.deep.equal(updatedBug);
      expect(auditCreateStub.calledOnce).to.be.true;

      const savedEntry = auditCreateStub.firstCall.args[0];
      expect(savedEntry.bugId).to.equal(101);
      expect(savedEntry.action).to.equal('bug.closed');
      expect(savedEntry.actingUser).to.equal('qa_lead');
      expect(savedEntry.fieldChanged).to.equal('status');
      expect(savedEntry.oldValue).to.equal('Resolved');
      expect(savedEntry.newValue).to.equal('Closed');
    });

    it('calls inner verify for reopen and saves AuditEntry with bug.reopened', async () => {
      bugFindStub.resolves({ ticketId: 101, status: 'Resolved' });
      const updatedBug = { ticketId: 101, status: 'Re-opened' };
      mockInner.verify.resolves(updatedBug);

      const result = await auditedService.verify(101, 'qa_lead', 'reopen', 'Found regression on mobile.');

      expect(mockInner.verify.calledOnceWith(101, 'qa_lead', 'reopen', 'Found regression on mobile.')).to.be.true;
      expect(result).to.deep.equal(updatedBug);
      expect(auditCreateStub.calledOnce).to.be.true;

      const savedEntry = auditCreateStub.firstCall.args[0];
      expect(savedEntry.bugId).to.equal(101);
      expect(savedEntry.action).to.equal('bug.reopened');
      expect(savedEntry.actingUser).to.equal('qa_lead');
      expect(savedEntry.fieldChanged).to.equal('status');
      expect(savedEntry.oldValue).to.equal('Resolved');
      expect(savedEntry.newValue).to.equal('Re-opened');
    });

    it('records nothing if inner verify fails', async () => {
      bugFindStub.resolves({ ticketId: 101, status: 'Open' });
      mockInner.verify.rejects(new BugServiceError('INVALID_TRANSITION', 'Cannot verify Open ticket'));

      try {
        await auditedService.verify(101, 'qa_lead', 'close', null);
        expect.fail('Should have thrown');
      } catch (err) {
        expect(err).to.be.instanceOf(BugServiceError);
      }

      expect(auditCreateStub.called).to.be.false;
    });
  });

  describe('AuditEntry Private Fields (NFR-1 / BTS2-18)', () => {
    it('uses JS private fields with read-only getters preventing modification', () => {
      const entry = new AuditEntry({
        bugId: 101,
        action: 'bug.claimed',
        actingUser: 'dev_alex',
        fieldChanged: 'status',
        oldValue: 'Open',
        newValue: 'In Progress',
      });

      expect(entry.bugId).to.equal(101);
      expect(entry.action).to.equal('bug.claimed');
      expect(entry.actingUser).to.equal('dev_alex');
      expect(entry.fieldChanged).to.equal('status');
      expect(entry.oldValue).to.equal('Open');
      expect(entry.newValue).to.equal('In Progress');
      expect(entry.timestamp).to.be.instanceOf(Date);

      // Attempting to modify read-only getter properties throws or has no effect
      try {
        entry.bugId = 999;
      } catch {
        // Strict mode throws TypeError
      }
      expect(entry.bugId).to.equal(101);
    });
  });
});
