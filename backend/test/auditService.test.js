const { expect } = require('chai');
const sinon = require('sinon');

const AuditLog = require('../src/models/AuditLog');
const { AuditService, AuditEntry } = require('../src/services/AuditService');

describe('AuditService and AuditEntry (BTS2-18)', () => {
  afterEach(() => sinon.restore());

  describe('AuditEntry Class', () => {
    it('BTS2-18: normalizes aliases (actingUser, oldValue, type, field)', () => {
      const timestamp = new Date('2026-10-12T10:00:00Z');
      const entry = new AuditEntry({
        bugId: '101',
        type: 'bug.claimed',
        actingUser: 'dev_alex',
        field: 'status',
        oldValue: 'Open',
        newValue: 'In Progress',
        assignee: 'dev_alex',
        timestamp,
      });

      expect(entry.bugId).to.equal(101);
      expect(entry.action).to.equal('bug.claimed');
      expect(entry.changedBy).to.equal('dev_alex');
      expect(entry.fieldChanged).to.equal('status');
      expect(entry.prevValue).to.equal('Open');
      expect(entry.newValue).to.equal('In Progress');
      expect(entry.assignee).to.equal('dev_alex');
      expect(entry.timestamp.toISOString()).to.equal(timestamp.toISOString());
    });

    it('BTS2-18 (validation): rejects missing bugId or invalid number', () => {
      const entry = new AuditEntry({
        bugId: 'not-a-number',
        action: 'UPDATE',
        changedBy: 'dev_alex',
        fieldChanged: 'status',
      });

      expect(() => entry.validate()).to.throw('bugId is required and must be a valid number.');
    });

    it('BTS2-18 (validation): rejects missing changedBy / actingUser', () => {
      const entry = new AuditEntry({
        bugId: 101,
        action: 'UPDATE',
        fieldChanged: 'status',
      });

      expect(() => entry.validate()).to.throw('changedBy (or actingUser) is required.');
    });

    it('BTS2-18 (validation): rejects unknown fieldChanged', () => {
      const entry = new AuditEntry({
        bugId: 101,
        action: 'UPDATE',
        changedBy: 'dev_alex',
        fieldChanged: 'unknown_prop',
      });

      expect(() => entry.validate()).to.throw("Invalid fieldChanged: 'unknown_prop'");
    });

    it('BTS2-18 (validation): rejects unknown action', () => {
      const entry = new AuditEntry({
        bugId: 101,
        action: 'FORBIDDEN_ACTION',
        changedBy: 'dev_alex',
        fieldChanged: 'status',
      });

      expect(() => entry.validate()).to.throw("Invalid action: 'FORBIDDEN_ACTION'");
    });
  });

  describe('AuditService Methods', () => {
    it('BTS2-18: AuditService.log saves an entry via AuditLog.create', async () => {
      const fakeCreated = {
        _id: '507f1f77bcf86cd799439011',
        bugId: 101,
        action: 'CLAIM',
        changedBy: 'dev_alex',
        assignee: 'dev_alex',
        fieldChanged: 'status',
        prevValue: 'Open',
        newValue: 'In Progress',
      };
      const createStub = sinon.stub(AuditLog, 'create').resolves(fakeCreated);

      const result = await AuditService.log({
        bugId: 101,
        action: 'CLAIM',
        changedBy: 'dev_alex',
        assignee: 'dev_alex',
        fieldChanged: 'status',
        prevValue: 'Open',
        newValue: 'In Progress',
      });

      expect(createStub.calledOnce).to.be.true;
      const payload = createStub.firstCall.args[0];
      expect(payload.bugId).to.equal(101);
      expect(payload.action).to.equal('CLAIM');
      expect(payload.changedBy).to.equal('dev_alex');
      expect(result).to.deep.equal(fakeCreated);
    });

    it('BTS2-18: AuditService.log handles team event contract shape directly', async () => {
      const event = {
        type: 'bug.claimed',
        bugId: 105,
        actingUser: 'dev_mike',
        fieldChanged: 'status',
        oldValue: 'Open',
        newValue: 'In Progress',
        timestamp: new Date('2026-10-12T00:00:00Z'),
      };
      const createStub = sinon.stub(AuditLog, 'create').resolves({});

      await AuditService.log(event);

      expect(createStub.calledOnce).to.be.true;
      const saved = createStub.firstCall.args[0];
      expect(saved.bugId).to.equal(105);
      expect(saved.action).to.equal('bug.claimed');
      expect(saved.changedBy).to.equal('dev_mike');
      expect(saved.fieldChanged).to.equal('status');
      expect(saved.prevValue).to.equal('Open');
      expect(saved.newValue).to.equal('In Progress');
      expect(saved.assignee).to.equal('Unassigned');
    });

    it('BTS2-18: AuditService.logFieldChange logs single field change', async () => {
      const createStub = sinon.stub(AuditLog, 'create').resolves({});

      await AuditService.logFieldChange({
        bugId: 101,
        actingUser: 'dev_alex',
        fieldChanged: 'priority',
        prevValue: 'Medium',
        newValue: 'High',
      });

      expect(createStub.calledOnce).to.be.true;
      const saved = createStub.firstCall.args[0];
      expect(saved.bugId).to.equal(101);
      expect(saved.action).to.equal('UPDATE');
      expect(saved.changedBy).to.equal('dev_alex');
      expect(saved.fieldChanged).to.equal('priority');
      expect(saved.prevValue).to.equal('Medium');
      expect(saved.newValue).to.equal('High');
    });

    it('BTS2-18: AuditService.logBugCreation logs initial ticket creation', async () => {
      const createStub = sinon.stub(AuditLog, 'create').resolves({});
      const bug = {
        ticketId: 110,
        title: 'Authentication crash on null payload',
        reporter: 'tester_sarah',
        assignee: 'Unassigned',
      };

      await AuditService.logBugCreation({ bug });

      expect(createStub.calledOnce).to.be.true;
      const saved = createStub.firstCall.args[0];
      expect(saved.bugId).to.equal(110);
      expect(saved.action).to.equal('CREATE');
      expect(saved.changedBy).to.equal('tester_sarah');
      expect(saved.fieldChanged).to.equal('bug');
      expect(saved.prevValue).to.be.null;
      expect(saved.newValue).to.equal('Authentication crash on null payload');
      expect(saved.details).to.deep.equal(bug);
    });

    it('BTS2-18: AuditService.logStatusTransition logs status change with optional notes', async () => {
      const createStub = sinon.stub(AuditLog, 'create').resolves({});

      await AuditService.logStatusTransition({
        bugId: 101,
        actingUser: 'dev_alex',
        assignee: 'dev_alex',
        prevStatus: 'In Progress',
        newStatus: 'Resolved',
        action: 'RESOLVE',
        notes: 'Fixed typo in regex',
      });

      expect(createStub.calledOnce).to.be.true;
      const saved = createStub.firstCall.args[0];
      expect(saved.bugId).to.equal(101);
      expect(saved.action).to.equal('RESOLVE');
      expect(saved.changedBy).to.equal('dev_alex');
      expect(saved.fieldChanged).to.equal('status');
      expect(saved.prevValue).to.equal('In Progress');
      expect(saved.newValue).to.equal('Resolved');
      expect(saved.details).to.deep.equal({ notes: 'Fixed typo in regex' });
    });

    it('BTS2-18: AuditService.getLogsForBug queries and sorts audit logs', async () => {
      const fakeLogs = [{ bugId: 101, action: 'CLAIM' }, { bugId: 101, action: 'CREATE' }];
      const queryMock = {
        sort: sinon.stub().returnsThis(),
        limit: sinon.stub().returnsThis(),
        lean: sinon.stub().resolves(fakeLogs),
      };
      const findStub = sinon.stub(AuditLog, 'find').returns(queryMock);

      const logs = await AuditService.getLogsForBug(101, { limit: 10, sort: 'desc' });

      expect(findStub.calledWith({ bugId: 101 })).to.be.true;
      expect(queryMock.sort.calledWith({ timestamp: -1 })).to.be.true;
      expect(queryMock.limit.calledWith(10)).to.be.true;
      expect(logs).to.deep.equal(fakeLogs);
    });

    it('BTS2-18: AuditService.getLogsForBug rejects invalid bugId', async () => {
      try {
        await AuditService.getLogsForBug('invalid');
        expect.fail('Should have thrown an error');
      } catch (err) {
        expect(err.message).to.equal('Valid bugId is required.');
      }
    });

    it('BTS2-18: AuditEntry.create static helper creates and saves entry', async () => {
      const createStub = sinon.stub(AuditLog, 'create').resolves({ id: 'abc' });

      await AuditEntry.create({
        bugId: 101,
        action: 'CLAIM',
        changedBy: 'dev_alex',
        fieldChanged: 'status',
      });

      expect(createStub.calledOnce).to.be.true;
    });
  });
});
