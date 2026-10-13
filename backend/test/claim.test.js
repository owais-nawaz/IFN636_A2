// Controller-level tests for claim (Tutorial 10 pattern): stub the model with
// Sinon, call the controller with fake req/res objects, check the response.
// Updated for BTS2-12: the controller now calls bugService, which looks the
// bug up first (findOne) and then updates it (findOneAndUpdate).
const { expect } = require('chai');
const sinon = require('sinon');

const Bug = require('../src/models/Bug');
const { claimBug } = require('../src/controllers/bugController');

describe('Claim ticket (FR-4a)', () => {
  let res;

  beforeEach(() => {
    res = {
      status: sinon.stub().returnsThis(),
      json: sinon.spy(),
    };
  });

  afterEach(() => sinon.restore());

  it('FR-4a: claims an Open ticket and sets it to In Progress', async () => {
    const claimed = { ticketId: 101, assignee: 'dev_mike', status: 'In Progress' };
    sinon.stub(Bug, 'findOne').resolves({ ticketId: 101, status: 'Open' });
    const updateStub = sinon.stub(Bug, 'findOneAndUpdate')
      .resolves({ ...claimed, toObject: () => claimed });

    const req = { params: { id: '101' }, authenticatedUser: { username: 'dev_mike' } };
    await claimBug(req, res);

    expect(updateStub.calledOnceWith(
      { ticketId: 101, status: 'Open' },
      { assignee: 'dev_mike', status: 'In Progress' },
      { new: true }
    )).to.be.true;
    expect(res.status.called).to.be.false; // default 200
    const body = res.json.firstCall.args[0];
    expect(body.success).to.be.true;
    expect(body.bug).to.include({ id: 101, assignee: 'dev_mike', status: 'In Progress' });
  });

  it('FR-4a (404): returns 404 when the ticket does not exist', async () => {
    sinon.stub(Bug, 'findOne').resolves(null);

    const req = { params: { id: '999' }, authenticatedUser: { username: 'dev_mike' } };
    await claimBug(req, res);

    expect(res.status.calledWith(404)).to.be.true;
    expect(res.json.calledWith({ success: false, errors: ['Ticket not found.'] })).to.be.true;
  });

  it('FR-4a (409): returns 409 and saves nothing when the ticket is Closed', async () => {
    sinon.stub(Bug, 'findOne').resolves({ ticketId: 101, status: 'Closed' });
    const updateStub = sinon.stub(Bug, 'findOneAndUpdate');

    const req = { params: { id: '101' }, authenticatedUser: { username: 'dev_mike' } };
    await claimBug(req, res);

    expect(res.status.calledWith(409)).to.be.true;
    expect(res.json.firstCall.args[0].success).to.be.false;
    expect(updateStub.called).to.be.false;
  });
});