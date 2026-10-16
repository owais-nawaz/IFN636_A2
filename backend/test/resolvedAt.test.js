// resolvedAt: the time a bug became Resolved (used for MTTR and the report export).
// Only resolve() sets it; claim() and verify() leave it alone. Models are stubbed
// with Sinon, so no database is needed.
const { expect } = require('chai');
const sinon = require('sinon');

const Bug = require('../src/models/Bug');
const { claim, resolve, verify } = require('../src/services/bugService');
const bugEvents = require('../src/notifications/bugEvents');

// The update object passed to Bug.findOneAndUpdate (second argument)
const updateArg = (stub) => stub.firstCall.args[1];

describe('resolvedAt timestamp (FR-3)', () => {
  let updateStub;

  beforeEach(() => {
    sinon.stub(bugEvents, 'notify').resolves(); // events are tested in notifications.test.js
    updateStub = sinon.stub(Bug, 'findOneAndUpdate').resolves({ ticketId: 101 });
  });

  afterEach(() => sinon.restore());

  it('FR-3 AC1: the Bug model has a resolvedAt date field that defaults to null', () => {
    const path = Bug.schema.path('resolvedAt');

    expect(path.instance).to.equal('Date');
    expect(path.options.default).to.equal(null);
  });

  it('FR-3 AC1: resolve sets resolvedAt to a Date in the same update as status Resolved', async () => {
    sinon.stub(Bug, 'findOne').resolves({ ticketId: 101, status: 'In Progress' });

    const before = Date.now();
    await resolve(101, 'dev_alex', 'Code Fix', 'Fixed the null check in login.');
    const after = Date.now();

    const update = updateArg(updateStub);
    expect(update.status).to.equal('Resolved');
    expect(update.resolvedAt).to.be.instanceOf(Date);
    expect(update.resolvedAt.getTime()).to.be.within(before, after);
    expect(updateStub.calledOnce).to.be.true; // one save, not a second update
  });

  it('FR-3 AC1: claim does not set resolvedAt', async () => {
    sinon.stub(Bug, 'findOne').resolves({ ticketId: 101, status: 'Open' });

    await claim(101, 'dev_alex');

    expect(updateArg(updateStub)).to.not.have.property('resolvedAt');
  });

  ['close', 'reopen'].forEach((action) => {
    it(`FR-3 AC1: verify ${action} does not set or clear resolvedAt`, async () => {
      sinon.stub(Bug, 'findOne').resolves({ ticketId: 101, status: 'Resolved' });

      await verify(101, 'qa_lead', action, 'Regression notes.');

      expect(updateArg(updateStub)).to.not.have.property('resolvedAt');
    });
  });

  it('FR-3 AC1: resolving again after a re-open stores a newer resolvedAt', async () => {
    const clock = sinon.useFakeTimers(new Date('2026-10-01T09:00:00Z'));
    sinon.stub(Bug, 'findOne').resolves({ ticketId: 101, status: 'In Progress' });

    await resolve(101, 'dev_alex', 'Code Fix', 'First fix attempt notes.');
    clock.tick(24 * 60 * 60 * 1000); // one day later
    await resolve(101, 'dev_alex', 'Code Fix', 'Second fix attempt notes.');

    const first  = updateStub.firstCall.args[1].resolvedAt;
    const second = updateStub.secondCall.args[1].resolvedAt;
    expect(first.toISOString()).to.equal('2026-10-01T09:00:00.000Z');
    expect(second.toISOString()).to.equal('2026-10-02T09:00:00.000Z');
  });
});
