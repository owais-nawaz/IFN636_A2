// Smoke test for the app/server split: app.js can be loaded and hit with
// Supertest without connecting to MongoDB or calling app.listen.
const { expect } = require('chai');
const request = require('supertest');

const app = require('../src/app');

describe('App setup (BTS2-15)', () => {
  it('BTS2-15: GET /api/health responds without a running server', async () => {
    const res = await request(app).get('/api/health');

    expect(res.status).to.equal(200);
    expect(res.body.status).to.equal('Bug Tracking System API running');
  });

  it('BTS2-15 (401): protected bug routes reject requests without a token', async () => {
    const res = await request(app).post('/api/bugs').send({});

    expect(res.status).to.equal(401);
  });

  it('returns 404 JSON for unmatched /api routes', async () => {
    const res = await request(app).get('/api/does-not-exist');

    expect(res.status).to.equal(404);
    expect(res.body).to.deep.equal({ success: false, errors: ['API endpoint not found'] });
  });

  it('serves frontend index.html for non-API client routes', async () => {
    const res = await request(app).get('/login');

    // If frontend is built, returns 200 with HTML; if not built, returns 404 with notice
    if (res.status === 200) {
      expect(res.headers['content-type']).to.include('text/html');
    } else {
      expect(res.status).to.equal(404);
      expect(res.text).to.include('Frontend build not found');
    }
  });
});

