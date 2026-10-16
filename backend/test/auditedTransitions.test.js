// State machine + audit decorator end to end (FR-4a, FR-1): every invalid
// move goes route -> controller -> AuditedBugService -> bugService -> state
// machine, and the 409 must reach the client unchanged with nothing recorded.
const { expect } = require('chai');
const sinon = require('sinon');
const request = require('supertest');
const jwt = require('jsonwebtoken');

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test_jwt_secret_for_audited_transitions';

const app = require('../src/app');
const Bug = require('../src/models/Bug');
const AuditLog = require('../src/models/AuditLog');
const bugEvents = require('../src/notifications/bugEvents');

const bearer = (role, username) => `Bearer ${jwt.sign({ username, role }, process.env.JWT_SECRET, { expiresIn: '1h' })}`;
const DEV = bearer('Developer', 'dev_alex');
const QA = bearer('QALead', 'qa_lead');

// How each action is sent over HTTP.
const ACTIONS = {
  claim:   { path: 'claim',   token: DEV, body: {} },
  resolve: { path: 'resolve', token: DEV, body: { resolutionType: 'Code Fix', resolutionNotes: 'Fixed the null check.' } },
  close:   { path: 'verify',  token: QA,  body: { action: 'close' } },
  reopen:  { path: 'verify',  token: QA,  body: { action: 'reopen', qaNotes: 'Still crashes.' } },
};

const STATUSES = ['Open', 'In Progress', 'Resolved', 'Closed', 'Re-opened'];
const VALID = {
  'Open:claim': 'In Progress',
  'In Progress:resolve': 'Resolved',
  'Resolved:close': 'Closed',
  'Resolved:reopen': 'Re-opened',
  'Re-opened:claim': 'In Progress',
};

describe('State machine through the audit decorator (FR-4a, FR-1)', () => {
  let updateStub;
  let auditStub;
  let notifyStub;

  beforeEach(() => {
    updateStub = sinon.stub(Bug, 'findOneAndUpdate');
    auditStub = sinon.stub(AuditLog, 'create').resolves({});
    notifyStub = sinon.stub(bugEvents, 'notify').resolves();
  });

  afterEach(() => sinon.restore());

  const send = (action) => {
    const { path, token, body } = ACTIONS[action];
    return request(app).patch(`/api/bugs/101/${path}`).set('Authorization', token).send(body);
  };

  STATUSES.forEach((status) => {
    Object.keys(ACTIONS).forEach((action) => {
      const next = VALID[`${status}:${action}`];

      if (next) {
        it(`FR-4a: ${status} + ${action} -> ${next} is saved and audited once`, async () => {
          sinon.stub(Bug, 'findOne').resolves({ ticketId: 101, status });
          const saved = { ticketId: 101, status: next, assignee: 'dev_alex' };
          updateStub.resolves({ ...saved, toObject: () => saved });

          const res = await send(action);

          expect(res.status).to.equal(200);
          expect(res.body.bug.status).to.equal(next);
          expect(auditStub.calledOnce).to.be.true;
          expect(auditStub.firstCall.args[0]).to.include({ bugId: 101, oldValue: status, newValue: next });
        });
      } else {
        it(`FR-4a (409): ${status} + ${action} reaches the client unchanged and records nothing`, async () => {
          sinon.stub(Bug, 'findOne').resolves({ ticketId: 101, status });

          const res = await send(action);

          expect(res.status).to.equal(409);
          expect(res.body).to.deep.equal({
            success: false,
            errors: [`Cannot ${action} a bug that is ${status}.`],
          });
          expect(updateStub.called, 'bug saved').to.be.false;
          expect(auditStub.called, 'audit entry saved').to.be.false;
          expect(notifyStub.called, 'event emitted').to.be.false;
        });
      }
    });
  });

  it('FR-4a (409): a bug changed by someone else between read and write is not audited', async () => {
    sinon.stub(Bug, 'findOne').resolves({ ticketId: 101, status: 'Open' });
    updateStub.resolves(null);

    const res = await send('claim');

    expect(res.status).to.equal(409);
    expect(auditStub.called).to.be.false;
    expect(notifyStub.called).to.be.false;
  });
});
