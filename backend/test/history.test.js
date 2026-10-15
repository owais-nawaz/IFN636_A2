const { expect } = require('chai');
const sinon = require('sinon');
const request = require('supertest');
const jwt = require('jsonwebtoken');

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test_jwt_secret_for_history';

const app = require('../src/app');
const Bug = require('../src/models/Bug');
const AuditService = require('../src/services/AuditService');
const { getBugHistory } = require('../src/controllers/bugController');

function createToken(role = 'Tester', username = 'tester_sarah') {
  return jwt.sign({ username, role }, process.env.JWT_SECRET, { expiresIn: '1h' });
}

describe('Bug History (FR-1)', () => {
  afterEach(() => sinon.restore());

  describe('HTTP Integration (GET /api/bugs/:id/history)', () => {
    it('FR-1 (401): rejects requests without an authorization token', async () => {
      const res = await request(app).get('/api/bugs/101/history');

      expect(res.status).to.equal(401);
      expect(res.body.success).to.be.false;
      expect(res.body.errors).to.include('Authentication required.');
    });

    it('FR-1 (401): rejects requests with an invalid token', async () => {
      const res = await request(app)
        .get('/api/bugs/101/history')
        .set('Authorization', 'Bearer invalid.token.value');

      expect(res.status).to.equal(401);
      expect(res.body.success).to.be.false;
    });

    it('FR-1 (404): returns 404 when the ticket does not exist', async () => {
      sinon.stub(Bug, 'findOne').resolves(null);

      const token = createToken('Developer', 'dev_alex');
      const res = await request(app)
        .get('/api/bugs/999/history')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).to.equal(404);
      expect(res.body.success).to.be.false;
      expect(res.body.errors).to.include('Ticket not found.');
    });

    it('FR-1 (200): allows any logged-in role (Tester, Developer, QALead)', async () => {
      const bug = { ticketId: 101, title: 'Crash on login' };
      sinon.stub(Bug, 'findOne').resolves(bug);
      sinon.stub(AuditService, 'getLogsForBug').resolves([]);

      for (const role of ['Tester', 'Developer', 'QALead']) {
        const token = createToken(role, `user_${role.toLowerCase()}`);
        const res = await request(app)
          .get('/api/bugs/101/history')
          .set('Authorization', `Bearer ${token}`);

        expect(res.status).to.equal(200);
        expect(res.body.success).to.be.true;
        expect(res.body.history).to.be.an('array');
      }
    });

    it('FR-1 (200): returns history entries ordered oldest first', async () => {
      const bug = { ticketId: 101, title: 'Search filter broken' };
      sinon.stub(Bug, 'findOne').resolves(bug);

      const entry1 = {
        _id: '670a00010000000000000001',
        bugId: 101,
        action: 'CREATE',
        changedBy: 'tester_sarah',
        assignee: 'Unassigned',
        fieldChanged: 'bug',
        prevValue: null,
        newValue: 'Search filter broken',
        timestamp: new Date('2026-10-10T09:00:00Z'),
      };
      const entry2 = {
        _id: '670a00010000000000000002',
        bugId: 101,
        action: 'CLAIM',
        changedBy: 'dev_alex',
        assignee: 'dev_alex',
        fieldChanged: 'status',
        prevValue: 'Open',
        newValue: 'In Progress',
        timestamp: new Date('2026-10-10T11:00:00Z'),
      };
      const entry3 = {
        _id: '670a00010000000000000003',
        bugId: 101,
        action: 'RESOLVE',
        changedBy: 'dev_alex',
        assignee: 'dev_alex',
        fieldChanged: 'status',
        prevValue: 'In Progress',
        newValue: 'Resolved',
        timestamp: new Date('2026-10-10T15:30:00Z'),
      };

      const getLogsStub = sinon.stub(AuditService, 'getLogsForBug').resolves([entry1, entry2, entry3]);

      const token = createToken('Tester', 'tester_sarah');
      const res = await request(app)
        .get('/api/bugs/101/history')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).to.equal(200);
      expect(res.body.success).to.be.true;
      expect(res.body.count).to.equal(3);
      expect(res.body.history).to.have.lengthOf(3);

      // Verify AuditService was called with ascending sort (oldest first)
      expect(getLogsStub.calledWith(101, { sort: 'asc' })).to.be.true;

      // Verify entry properties
      const first = res.body.history[0];
      expect(first.id).to.equal('670a00010000000000000001');
      expect(first.bugId).to.equal(101);
      expect(first.action).to.equal('CREATE');
      expect(first.changedBy).to.equal('tester_sarah');
      expect(first.assignee).to.equal('Unassigned');
      expect(first.fieldChanged).to.equal('bug');
      expect(first.prevValue).to.be.null;
      expect(first.newValue).to.equal('Search filter broken');
    });
  });

  describe('Controller Unit (getBugHistory)', () => {
    let res;

    beforeEach(() => {
      res = {
        status: sinon.stub().returnsThis(),
        json: sinon.spy(),
      };
    });

    it('FR-1 (404): returns 404 when bugId is non-numeric', async () => {
      const req = { params: { id: 'abc' } };
      await getBugHistory(req, res);

      expect(res.status.calledWith(404)).to.be.true;
      expect(res.json.calledWith({ success: false, errors: ['Ticket not found.'] })).to.be.true;
    });

    it('FR-1 (404): returns 404 when bug does not exist', async () => {
      sinon.stub(Bug, 'findOne').resolves(null);

      const req = { params: { id: '555' } };
      await getBugHistory(req, res);

      expect(res.status.calledWith(404)).to.be.true;
      expect(res.json.calledWith({ success: false, errors: ['Ticket not found.'] })).to.be.true;
    });

    it('FR-1 (200): returns 200 with history when bug exists', async () => {
      sinon.stub(Bug, 'findOne').resolves({ ticketId: 101 });
      sinon.stub(AuditService, 'getLogsForBug').resolves([
        { _id: 'abc', bugId: 101, action: 'CREATE' },
      ]);

      const req = { params: { id: '101' } };
      await getBugHistory(req, res);

      expect(res.json.calledOnce).to.be.true;
      const body = res.json.firstCall.args[0];
      expect(body.success).to.be.true;
      expect(body.count).to.equal(1);
      expect(body.history[0].id).to.equal('abc');
    });
  });
});
