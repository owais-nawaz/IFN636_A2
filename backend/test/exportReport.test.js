// HTTP-level tests for GET /api/reports/export: Supertest against app.js, Bug.find stubbed.
const { expect } = require('chai');
const sinon = require('sinon');
const request = require('supertest');
const jwt = require('jsonwebtoken');

const Bug = require('../src/models/Bug');

const TEST_SECRET = 'test-secret-for-export-route-tests';

// middleware/auth.js reads JWT_SECRET once when it is first loaded, and other test files may
// have loaded app.js already (with no secret, as in CI). Reload the app modules with our secret.
const RELOADED_MODULES = [
  '../src/app',
  '../src/middleware/auth',
  '../src/routes/bugRoutes',
  '../src/routes/reportRoutes',
];
const purgeModules = () => RELOADED_MODULES.forEach(m => delete require.cache[require.resolve(m)]);

const bugs = [
  {
    ticketId: 101, title: 'Login fails, says "invalid"', module: 'Auth',
    severity: 'High', priority: 'High', status: 'Resolved', reporter: 'tester_sarah',
    assignee: 'dev_alex', createdAt: new Date('2026-10-01T09:00:00Z'), updatedAt: new Date('2026-10-02T10:30:00Z'),
  },
  {
    ticketId: 102, title: '=HYPERLINK("http://example.com")', module: 'Dashboard',
    severity: 'Low', priority: 'Medium', status: 'Open', reporter: 'tester_sarah',
    assignee: 'Unassigned', createdAt: new Date('2026-10-03T08:15:00Z'), updatedAt: new Date('2026-10-03T08:15:00Z'),
  },
];

const tokenFor = (username, role) => jwt.sign({ username, role }, TEST_SECRET, { expiresIn: '1h' });
const bearer = role => `Bearer ${tokenFor(`${role}_user`, role)}`;

// The controller calls Bug.find().sort(...).lean()
function stubBugFind(result = bugs) {
  const lean = sinon.stub().resolves(result);
  const sort = sinon.stub().returns({ lean });
  return sinon.stub(Bug, 'find').returns({ sort });
}

describe('GET /api/reports/export (FR-3)', () => {
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

  it('FR-3 AC2: QA Lead gets a CSV download with the right headers and content', async () => {
    const findStub = stubBugFind();

    const res = await request(app)
      .get('/api/reports/export?format=csv')
      .set('Authorization', bearer('QALead'));

    expect(res.status).to.equal(200);
    expect(res.headers['content-type']).to.match(/^text\/csv/);
    expect(res.headers['content-disposition'])
      .to.match(/^attachment; filename="bugs-report-\d{4}-\d{2}-\d{2}\.csv"$/);
    const lines = res.text.split('\r\n');
    expect(lines[0].startsWith('ticketId,title,module,')).to.be.true;
    expect(lines).to.have.lengthOf(3); // header + 2 bugs
    expect(lines[1]).to.include('"Login fails, says ""invalid"""');
    expect(lines[2]).to.include(`"'=HYPERLINK(`);
    expect(findStub.calledOnce).to.be.true;
  });

  it('FR-3 AC3: QA Lead gets a JSON download with the right headers and content', async () => {
    stubBugFind();

    const res = await request(app)
      .get('/api/reports/export?format=json')
      .set('Authorization', bearer('QALead'));

    expect(res.status).to.equal(200);
    expect(res.headers['content-type']).to.match(/^application\/json/);
    expect(res.headers['content-disposition'])
      .to.match(/^attachment; filename="bugs-report-\d{4}-\d{2}-\d{2}\.json"$/);
    const rows = JSON.parse(res.text);
    expect(rows).to.have.lengthOf(2);
    expect(rows[0]).to.include({ ticketId: 101, title: 'Login fails, says "invalid"' });
    expect(rows[1].title).to.equal('=HYPERLINK("http://example.com")');
  });

  it('FR-3 AC6 (401): rejects a request with no token', async () => {
    const findStub = stubBugFind();

    const res = await request(app).get('/api/reports/export?format=csv');

    expect(res.status).to.equal(401);
    expect(res.body.success).to.be.false;
    expect(findStub.called).to.be.false;
  });

  it('FR-3 AC6 (401): rejects a token that is invalid', async () => {
    const findStub = stubBugFind();

    const res = await request(app)
      .get('/api/reports/export?format=csv')
      .set('Authorization', 'Bearer not-a-real-token');

    expect(res.status).to.equal(401);
    expect(findStub.called).to.be.false;
  });

  ['Developer', 'Tester'].forEach(role => {
    it(`FR-3 AC6 (403): rejects a ${role} token`, async () => {
      const findStub = stubBugFind();

      const res = await request(app)
        .get('/api/reports/export?format=csv')
        .set('Authorization', bearer(role));

      expect(res.status).to.equal(403);
      expect(res.body.success).to.be.false;
      expect(findStub.called).to.be.false;
    });
  });

  it('FR-3 AC4 (400): returns 400 for an unsupported format', async () => {
    const findStub = stubBugFind();

    const res = await request(app)
      .get('/api/reports/export?format=xml')
      .set('Authorization', bearer('QALead'));

    expect(res.status).to.equal(400);
    expect(res.body).to.deep.equal({
      success: false,
      errors: ['Unsupported export format "xml". Supported formats: csv, json.'],
    });
    expect(findStub.called).to.be.false; // fails fast, before touching the database
  });

  it('FR-3 AC4 (400): returns 400 when the format is missing', async () => {
    const findStub = stubBugFind();

    const res = await request(app)
      .get('/api/reports/export')
      .set('Authorization', bearer('QALead'));

    expect(res.status).to.equal(400);
    expect(res.body).to.deep.equal({
      success: false,
      errors: ['Export format is required. Supported formats: csv, json.'],
    });
    expect(findStub.called).to.be.false;
  });
});
