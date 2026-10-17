// Rate limiting (NFR-2): 60 write requests per minute per client IP.
// Each test uses its own X-Forwarded-For IP, so counters don't leak between
// tests, and the limit being per forwarded IP shows 'trust proxy' works.
const { expect } = require('chai');
const sinon = require('sinon');
const request = require('supertest');

const app = require('../src/app');
const Bug = require('../src/models/Bug');

// 60 unauthenticated POSTs: each is rejected with 401 by auth, but still counts.
async function useUpLimit(ip) {
  for (let i = 0; i < 60; i++) {
    const res = await request(app).post('/api/bugs').set('X-Forwarded-For', ip).send({});
    expect(res.status, `request ${i + 1}`).to.equal(401);
  }
}

describe('Rate limiting (NFR-2)', () => {
  // The limiter is off under npm test (see middleware/rateLimit.js); these
  // tests are the one place it is switched back on.
  before(() => { process.env.RATE_LIMIT_IN_TESTS = '1'; });
  after(() => { delete process.env.RATE_LIMIT_IN_TESTS; });
  afterEach(() => sinon.restore());

  it('NFR-2 (429): the 61st write request in a minute is rejected', async () => {
    await useUpLimit('203.0.113.1');

    const res = await request(app).post('/api/bugs').set('X-Forwarded-For', '203.0.113.1').send({});

    expect(res.status).to.equal(429);
    expect(res.body).to.deep.equal({
      success: false,
      errors: ['Too many requests, please try again in a minute.'],
    });
  });

  it('NFR-2 (429): PATCH requests share the same write limit', async () => {
    await useUpLimit('203.0.113.2');

    const res = await request(app).patch('/api/bugs/101/claim').set('X-Forwarded-For', '203.0.113.2');

    expect(res.status).to.equal(429);
  });

  it('NFR-2: the limit is counted per client IP', async () => {
    await useUpLimit('203.0.113.3');

    const other = await request(app).post('/api/bugs').set('X-Forwarded-For', '198.51.100.3').send({});

    expect(other.status).to.equal(401); // reaches auth, not limited
  });

  it('NFR-2: reads (GET /api/bugs) are not limited', async () => {
    sinon.stub(Bug, 'find').returns({ sort: () => ({ lean: () => Promise.resolve([]) }) });
    await useUpLimit('203.0.113.4');

    const res = await request(app).get('/api/bugs').set('X-Forwarded-For', '203.0.113.4');

    expect(res.status).to.equal(200);
  });

  it('NFR-2: responses include the standard RateLimit headers', async () => {
    const res = await request(app).post('/api/bugs').set('X-Forwarded-For', '203.0.113.5').send({});

    expect(res.headers).to.have.property('ratelimit-policy');
    expect(res.headers.ratelimit).to.include('r=59'); // 59 requests left in this window
  });

  it('NFR-2: the limiter is skipped in other tests (NODE_ENV=test)', async () => {
    delete process.env.RATE_LIMIT_IN_TESTS;
    await useUpLimit('203.0.113.6');

    const res = await request(app).post('/api/bugs').set('X-Forwarded-For', '203.0.113.6').send({});

    expect(res.status).to.equal(401); // reached auth: no 429 even after 60 writes
    process.env.RATE_LIMIT_IN_TESTS = '1';
  });
});
