// SLA escalation (FR-4b, Jira BTS2-13): escalation service with Bug stubbed,
// plus the POST /api/sla/run route through Supertest.
const { expect } = require('chai');
const sinon = require('sinon');
const request = require('supertest');
const jwt = require('jsonwebtoken');

const Bug = require('../src/models/Bug');
const slaService = require('../src/services/slaService');
const { runEscalation, nextPriority } = slaService;
const app = require('../src/app');

const NOW = new Date('2026-10-12T12:00:00Z');
const hoursAgo = h => new Date(NOW - h * 60 * 60 * 1000);

const makeBug = (overrides = {}) => ({
  _id: 'abc123',
  ticketId: 101,
  status: 'Open',
  priority: 'Medium',
  createdAt: hoursAgo(25), // Medium window is 24 h, so overdue
  escalatedAt: null,
  slaBreached: false,
  ...overrides,
});

// Bug.find returns `found` (the bugs as they were read); findOneAndUpdate
// applies the update to the bug in `stored` only while it still matches the
// filter's escalatedAt and status, like MongoDB would.
function stubBugs(stored, found = stored) {
  sinon.stub(Bug, 'find').resolves(found);
  return sinon.stub(Bug, 'findOneAndUpdate').callsFake(async (filter, update) => {
    const bug = stored.find(b => b._id === filter._id
      && b.escalatedAt === filter.escalatedAt
      && filter.status.$in.includes(b.status));
    if (!bug) return null;
    Object.assign(bug, update);
    return bug;
  });
}

describe('SLA escalation (FR-4b)', () => {
  afterEach(() => sinon.restore());

  describe('escalation service', () => {
    it('FR-4b: an overdue bug is flagged and its priority raised one level', async () => {
      const bug = makeBug();
      const updateStub = stubBugs([bug]);

      const result = await runEscalation(NOW);

      expect(updateStub.calledOnce).to.be.true;
      expect(updateStub.firstCall.args[0]).to.deep.equal({
        _id: 'abc123', escalatedAt: null, status: { $in: ['Open', 'In Progress', 'Re-opened'] },
      });
      expect(bug).to.include({ slaBreached: true, priority: 'High', escalatedAt: NOW });
      expect(result.escalated).to.deep.equal([{ ticketId: 101, from: 'Medium', to: 'High' }]);
    });

    it('FR-4b: running twice changes nothing the second time', async () => {
      const bug = makeBug();
      const updateStub = stubBugs([bug]);

      await runEscalation(NOW);
      const second = await runEscalation(new Date(NOW.getTime() + 60 * 60 * 1000));

      expect(updateStub.calledOnce).to.be.true;
      expect(bug.priority).to.equal('High');
      expect(bug.escalatedAt).to.equal(NOW);
      expect(second.escalated).to.deep.equal([]);
    });

    it('FR-4b: a Critical bug is flagged but stays Critical', async () => {
      const bug = makeBug({ priority: 'Critical', createdAt: hoursAgo(5) });
      stubBugs([bug]);

      await runEscalation(NOW);

      expect(bug).to.include({ slaBreached: true, priority: 'Critical' });
    });

    it('FR-4b: a Closed bug is ignored even when it is past its window', async () => {
      const bug = makeBug({ status: 'Closed', createdAt: hoursAgo(500) });
      const updateStub = stubBugs([bug]);

      await runEscalation(NOW);

      expect(updateStub.called).to.be.false;
      expect(bug).to.include({ slaBreached: false, priority: 'Medium' });
    });

    it('FR-4b: a bug still inside its window is not escalated', async () => {
      const bug = makeBug({ priority: 'Low', createdAt: hoursAgo(71) });
      const updateStub = stubBugs([bug]);

      await runEscalation(NOW);

      expect(updateStub.called).to.be.false;
    });

    it('FR-4b: In Progress and Re-opened bugs are escalated too', async () => {
      const inProgress = makeBug({ _id: 'a', ticketId: 1, status: 'In Progress', priority: 'High', createdAt: hoursAgo(13) });
      const reopened = makeBug({ _id: 'b', ticketId: 2, status: 'Re-opened', priority: 'Low', createdAt: hoursAgo(73) });
      stubBugs([inProgress, reopened]);

      const result = await runEscalation(NOW);

      expect(result.escalated.map(e => e.ticketId)).to.deep.equal([1, 2]);
      expect(inProgress.priority).to.equal('Critical');
      expect(reopened.priority).to.equal('Medium');
    });

    it('FR-4b: the query only loads active, not-yet-escalated bugs', async () => {
      stubBugs([]);

      await runEscalation(NOW);

      const filter = Bug.find.firstCall.args[0];
      expect(filter.status).to.deep.equal({ $in: ['Open', 'In Progress', 'Re-opened'] });
      expect(filter.escalatedAt).to.equal(null);
    });

    it('FR-4b: a bug escalated by the other server in between is not counted', async () => {
      sinon.stub(Bug, 'find').resolves([makeBug()]);
      sinon.stub(Bug, 'findOneAndUpdate').resolves(null);

      const result = await runEscalation(NOW);

      expect(result.escalated).to.deep.equal([]);
    });

    it('FR-4b: a bug resolved between the read and the update is not escalated', async () => {
      const stored = makeBug({ status: 'Resolved' });  // resolved by a developer in between
      const asRead = makeBug({ status: 'In Progress' }); // what the escalation run loaded
      const updateStub = stubBugs([stored], [asRead]);

      const result = await runEscalation(NOW);

      expect(updateStub.calledOnce).to.be.true;
      expect(stored).to.include({ slaBreached: false, priority: 'Medium', escalatedAt: null });
      expect(result.escalated).to.deep.equal([]);
    });

    it('FR-4b: the timer runs once at startup and then every 15 minutes', async () => {
      const clock = sinon.useFakeTimers();
      const findStub = sinon.stub(Bug, 'find').resolves([]);

      const timer = slaService.startSlaTimer();
      expect(findStub.callCount).to.equal(1);

      await clock.tickAsync(15 * 60 * 1000);
      expect(findStub.callCount).to.equal(2);

      clearInterval(timer);
    });

    it('FR-4b: priorities go up one level and stop at Critical', () => {
      expect(['Low', 'Medium', 'High', 'Critical'].map(nextPriority))
        .to.deep.equal(['Medium', 'High', 'Critical', 'Critical']);
    });
  });

  describe('POST /api/sla/run', () => {
    // middleware/auth.js reads JWT_SECRET at load time (unset in CI), so
    // stub verify to return the role each test needs.
    const asRole = role => sinon.stub(jwt, 'verify').returns({ username: `${role}_user`, role });

    it('FR-4b (401): rejects a request without a token', async () => {
      const res = await request(app).post('/api/sla/run');

      expect(res.status).to.equal(401);
    });

    ['Tester', 'Developer'].forEach((role) => {
      it(`FR-4b (403): rejects a ${role}`, async () => {
        asRole(role);
        const runStub = sinon.stub(slaService, 'runEscalation');

        const res = await request(app).post('/api/sla/run').set('Authorization', 'Bearer token');

        expect(res.status).to.equal(403);
        expect(runStub.called).to.be.false;
      });
    });

    it('FR-4b: a QA Lead runs the escalation and gets the result', async () => {
      asRole('QALead');
      sinon.stub(slaService, 'runEscalation').resolves({
        checked: 3, escalated: [{ ticketId: 101, from: 'Medium', to: 'High' }],
      });

      const res = await request(app).post('/api/sla/run').set('Authorization', 'Bearer token');

      expect(res.status).to.equal(200);
      expect(res.body).to.deep.include({ success: true, message: '1 bug(s) escalated.', checked: 3 });
      expect(res.body.escalated).to.have.length(1);
    });

    it('FR-4b (500): reports a failed run without crashing', async () => {
      asRole('QALead');
      sinon.stub(console, 'error');
      sinon.stub(slaService, 'runEscalation').rejects(new Error('db down'));

      const res = await request(app).post('/api/sla/run').set('Authorization', 'Bearer token');

      expect(res.status).to.equal(500);
      expect(res.body.success).to.be.false;
    });
  });
});
