// Health endpoint for the ALB (BTS2-14): reports which instance served the
// request, in the body and in the X-Served-By header.
const { expect } = require('chai');
const os = require('os');
const request = require('supertest');

const app = require('../src/app');

describe('Health endpoint (BTS2-14)', () => {
  const original = process.env.INSTANCE_NAME;
  afterEach(() => {
    if (original === undefined) delete process.env.INSTANCE_NAME;
    else process.env.INSTANCE_NAME = original;
  });

  it('BTS2-14: returns 200 with the instance name in the body and X-Served-By header', async () => {
    process.env.INSTANCE_NAME = 'EC2-NodeA';

    const res = await request(app).get('/api/health');

    expect(res.status).to.equal(200);
    expect(res.body).to.include({ status: 'Bug Tracking System API running', instance: 'EC2-NodeA' });
    expect(res.headers['x-served-by']).to.equal('EC2-NodeA');
  });

  it('BTS2-14: falls back to the hostname when INSTANCE_NAME is not set', async () => {
    delete process.env.INSTANCE_NAME;

    const res = await request(app).get('/api/health');

    expect(res.body.instance).to.equal(os.hostname());
    expect(res.headers['x-served-by']).to.equal(os.hostname());
  });

  it('BTS2-14: needs no login, so the ALB health check can reach it', async () => {
    const res = await request(app).get('/api/health');

    expect(res.status).to.equal(200);
  });
});
