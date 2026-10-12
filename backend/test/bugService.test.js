// Service-level tests for the bug state rules (FR-4a), from the state diagram.
// One test per valid move and one per invalid move, with the requirement ID
// in each test name. Today this covers the claim action.
const { expect } = require('chai');
const sinon = require('sinon');

const Bug = require('../src/models/Bug');
const { claim, BugServiceError } = require('../src/services/bugService');

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