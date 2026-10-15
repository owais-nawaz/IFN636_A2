// Service-level tests for the bug state rules (FR-4a), from the state diagram.
// One test per valid move and one per invalid move, with the requirement ID
// in each test name. Covers the claim, resolve and verify actions.
const { expect } = require('chai');
const sinon = require('sinon');

const Bug = require('../src/models/Bug');
const { claim, resolve, verify, BugServiceError } = require('../src/services/bugService');

// Runs the promise and checks it failed with the expected error code.
async function expectError(promise, code) {
  let caught;
  try {
    await promise;
  } catch (err) {
    caught = err;
  }
  expect(caught).to.be.instanceOf(BugServiceError);
  expect(caught.code).to.equal(code);
}

describe('Bug service: claim transitions (FR-4a)', () => {
  afterEach(() => sinon.restore());

  ['Open', 'Re-opened'].forEach((status) => {
    it(`FR-4a: claim is allowed from ${status} and returns In Progress`, async () => {
      sinon.stub(Bug, 'findOne').resolves({ ticketId: 101, status });
      sinon.stub(Bug, 'findOneAndUpdate')
        .resolves({ ticketId: 101, status: 'In Progress', assignee: 'dev_alex' });

      const result = await claim(101, 'dev_alex');

      expect(result.status).to.equal('In Progress');
      expect(result.assignee).to.equal('dev_alex');
    });
  });

  ['In Progress', 'Resolved', 'Closed'].forEach((status) => {
    it(`FR-4a (409): claim is rejected from ${status} and nothing is saved`, async () => {
      sinon.stub(Bug, 'findOne').resolves({ ticketId: 101, status });
      const updateStub = sinon.stub(Bug, 'findOneAndUpdate');

      await expectError(claim(101, 'dev_alex'), 'INVALID_TRANSITION');
      expect(updateStub.called).to.be.false;
    });
  });

  it('FR-4a (404): claim of an unknown bug throws NOT_FOUND', async () => {
    sinon.stub(Bug, 'findOne').resolves(null);
    await expectError(claim(999, 'dev_alex'), 'NOT_FOUND');
  });

  it('FR-4a (409): claim fails if another request changed the bug first', async () => {
    sinon.stub(Bug, 'findOne').resolves({ ticketId: 101, status: 'Open' });
    sinon.stub(Bug, 'findOneAndUpdate').resolves(null); // status changed in between

    await expectError(claim(101, 'dev_alex'), 'INVALID_TRANSITION');
  });
});

describe('Bug service: resolve transitions (FR-4a)', () => {
  afterEach(() => sinon.restore());

  it('FR-4a: resolve is allowed from In Progress and returns Resolved', async () => {
    sinon.stub(Bug, 'findOne').resolves({ ticketId: 101, status: 'In Progress' });
    const updateStub = sinon.stub(Bug, 'findOneAndUpdate')
      .resolves({ ticketId: 101, status: 'Resolved' });

    const result = await resolve(101, 'dev_alex', 'Code Fix', 'Fixed the null check in login.');

    expect(result.status).to.equal('Resolved');
    expect(updateStub.calledOnceWith(
      { ticketId: 101, status: 'In Progress' },
      {
        resolutionType: 'Code Fix',
        resolutionNotes: 'Fixed the null check in login.',
        assignee: 'dev_alex',
        status: 'Resolved',
      },
      { new: true }
    )).to.be.true;
  });

  ['Open', 'Resolved', 'Closed', 'Re-opened'].forEach((status) => {
    it(`FR-4a (409): resolve is rejected from ${status} and nothing is saved`, async () => {
      sinon.stub(Bug, 'findOne').resolves({ ticketId: 101, status });
      const updateStub = sinon.stub(Bug, 'findOneAndUpdate');

      await expectError(resolve(101, 'dev_alex', 'Code Fix', 'Long enough notes here.'), 'INVALID_TRANSITION');
      expect(updateStub.called).to.be.false;
    });
  });

  it('FR-4a (400): resolve with notes under 10 characters throws VALIDATION', async () => {
    const findStub = sinon.stub(Bug, 'findOne');

    await expectError(resolve(101, 'dev_alex', 'Code Fix', 'short'), 'VALIDATION');
    expect(findStub.called).to.be.false;
  });

  it('FR-4a (404): resolve of an unknown bug throws NOT_FOUND', async () => {
    sinon.stub(Bug, 'findOne').resolves(null);
    await expectError(resolve(999, 'dev_alex', 'Code Fix', 'Long enough notes here.'), 'NOT_FOUND');
  });
});

describe('Bug service: verify transitions (FR-4a)', () => {
  afterEach(() => sinon.restore());

  it('FR-4a: verify close is allowed from Resolved and returns Closed', async () => {
    sinon.stub(Bug, 'findOne').resolves({ ticketId: 101, status: 'Resolved' });
    sinon.stub(Bug, 'findOneAndUpdate').resolves({ ticketId: 101, status: 'Closed' });

    const result = await verify(101, 'qa_lead', 'close', null);

    expect(result.status).to.equal('Closed');
  });

  it('FR-4a: verify reopen is allowed from Resolved and returns Re-opened', async () => {
    sinon.stub(Bug, 'findOne').resolves({ ticketId: 101, status: 'Resolved' });
    sinon.stub(Bug, 'findOneAndUpdate').resolves({ ticketId: 101, status: 'Re-opened' });

    const result = await verify(101, 'qa_lead', 'reopen', 'Still crashes on Safari.');

    expect(result.status).to.equal('Re-opened');
  });

  ['Open', 'In Progress', 'Closed', 'Re-opened'].forEach((status) => {
    ['close', 'reopen'].forEach((action) => {
      it(`FR-4a (409): verify ${action} is rejected from ${status} and nothing is saved`, async () => {
        sinon.stub(Bug, 'findOne').resolves({ ticketId: 101, status });
        const updateStub = sinon.stub(Bug, 'findOneAndUpdate');

        await expectError(verify(101, 'qa_lead', action, 'Regression notes.'), 'INVALID_TRANSITION');
        expect(updateStub.called).to.be.false;
      });
    });
  });

  it('FR-4a (400): reopen without notes throws VALIDATION', async () => {
    await expectError(verify(101, 'qa_lead', 'reopen', ''), 'VALIDATION');
  });

  it('FR-4a (400): an action other than close or reopen throws VALIDATION', async () => {
    await expectError(verify(101, 'qa_lead', 'approve', 'Looks fine.'), 'VALIDATION');
  });

  it('FR-4a (404): verify of an unknown bug throws NOT_FOUND', async () => {
    sinon.stub(Bug, 'findOne').resolves(null);
    await expectError(verify(999, 'qa_lead', 'close', null), 'NOT_FOUND');
  });
});
