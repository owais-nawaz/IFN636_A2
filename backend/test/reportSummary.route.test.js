// HTTP-level tests for GET /api/reports/summary: Supertest against app.js, Bug.find stubbed.
// The maths itself is tested in reportSummary.test.js; this file checks the route, the
// QA Lead restriction and the response shape.
const { expect } = require('chai');
const sinon = require('sinon');
const request = require('supertest');
const jwt = require('jsonwebtoken');

const Bug = require('../src/models/Bug');

const TEST_SECRET = 'test-secret-for-summary-route-tests';

// middleware/auth.js reads JWT_SECRET once when it is first loaded, and other test files may
// have loaded app.js already (with no secret, as in CI). Reload the app modules with our secret.
const RELOADED_MODULES = [
  '../src/app',
  '../src/middleware/auth',
  '../src/routes/bugRoutes',
  '../src/routes/reportRoutes',
];
const purgeModules = () => RELOADED_MODULES.forEach(m => delete require.cache[require.resolve(m)]);

// Fixed fixtures. Expected results, worked out by hand:
//   total 5; MTTR uses only 101 (8h) and 102 (24h) -> (8 + 24) / 2 = 16 hours, sample size 2
//   104 is Re-opened (old resolvedAt ignored) and 105 has no resolvedAt, so neither is used
const bugs = [
  { ticketId: 101, status: 'Resolved',  severity: 'High',
    createdAt: new Date('2026-10-01T09:00:00Z'), resolvedAt: new Date('2026-10-01T17:00:00Z') },
  { ticketId: 102, status: 'Closed',    severity: 'Medium',
    createdAt: new Date('2026-10-02T09:00:00Z'), resolvedAt: new Date('2026-10-03T09:00:00Z') },
  { ticketId: 103, status: 'Open',      severity: 'Low',
    createdAt: new Date('2026-10-04T09:00:00Z'), resolvedAt: null },
  { ticketId: 104, status: 'Re-opened', severity: 'High',
    createdAt: new Date('2026-10-05T09:00:00Z'), resolvedAt: new Date('2026-10-05T10:00:00Z') },
  { ticketId: 105, status: 'Resolved',  severity: 'Critical',
    createdAt: new Date('2026-10-06T09:00:00Z'), resolvedAt: null },
];

const tokenFor = (username, role) => jwt.sign({ username, role }, TEST_SECRET, { expiresIn: '1h' });
const bearer = role => `Bearer ${tokenFor(`${role}_user`, role)}`;

// The controller calls Bug.find().lean()
function stubBugFind(result = bugs) {
  const lean = sinon.stub().resolves(result);
  return sinon.stub(Bug, 'find').returns({ lean });
}

describe('GET /api/reports/summary (FR-3)', () => {
  let app;
  let originalSecret;

  before(() => {
    originalSecret = process.env.JWT_SECRET;
    process.env.JWT_SECRET = TEST_SECRET;
    purgeModules();
    app = require('../src/app');
  });

  after(() => {
    if (originalSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = originalSecret;
    purgeModules(); // later requires get a fresh copy that sees the restored environment
  });

  afterEach(() => sinon.restore());

  it('FR-3 AC1: QA Lead gets 200 with the summary fields', async () => {
    const findStub = stubBugFind();

    const res = await request(app)
      .get('/api/reports/summary')
      .set('Authorization', bearer('QALead'));

    expect(res.status).to.equal(200);
    expect(res.headers['content-type']).to.match(/^application\/json/);
    expect(res.body.success).to.be.true;
    expect(res.body.summary).to.deep.equal({
      total: 5,
      countsByStatus: { 'Open': 1, 'In Progress': 0, 'Resolved': 2, 'Closed': 1, 'Re-opened': 1 },
      countsBySeverity: { Low: 1, Medium: 1, High: 2, Critical: 1 },
      mttrHours: 16,
      mttrSampleSize: 2,
    });
    expect(findStub.calledOnce).to.be.true;
  });

  it('FR-3 AC1: with no bugs the summary has zero counts and a null MTTR', async () => {
    stubBugFind([]);

    const res = await request(app)
      .get('/api/reports/summary')
      .set('Authorization', bearer('QALead'));

    expect(res.status).to.equal(200);
    expect(res.body.summary.total).to.equal(0);
    expect(res.body.summary.mttrHours).to.be.null;
    expect(res.body.summary.mttrSampleSize).to.equal(0);
  });

  it('FR-3 AC1 (401): rejects a request with no token', async () => {
    const findStub = stubBugFind();

    const res = await request(app).get('/api/reports/summary');

    expect(res.status).to.equal(401);
    expect(res.body.success).to.be.false;
    expect(findStub.called).to.be.false;
  });

  ['Developer', 'Tester'].forEach(role => {
    it(`FR-3 AC1 (403): rejects a ${role} token`, async () => {
      const findStub = stubBugFind();

      const res = await request(app)
        .get('/api/reports/summary')
        .set('Authorization', bearer(role));

      expect(res.status).to.equal(403);
      expect(res.body.success).to.be.false;
      expect(findStub.called).to.be.false;
    });
  });

  it('FR-3 AC1 (500): a database failure returns 500 with a generic message', async () => {
    const lean = sinon.stub().rejects(new Error('connection to db-host-1234 refused'));
    sinon.stub(Bug, 'find').returns({ lean });
    sinon.stub(console, 'error'); // the controller logs the real error; keep test output clean

    const res = await request(app)
      .get('/api/reports/summary')
      .set('Authorization', bearer('QALead'));

    expect(res.status).to.equal(500);
    expect(res.body).to.deep.equal({
      success: false,
      errors: ['Server error — could not generate summary.'],
    });
    expect(JSON.stringify(res.body)).to.not.include('db-host-1234'); // no internal details leaked
  });
});
