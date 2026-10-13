// State transition tests (FR-4a), derived from the state diagram (BTS2-47).
// One test per valid move and one per invalid move.
const { expect } = require('chai');
const { stateFor } = require('../src/services/bugStates');
const BugServiceError = require('../src/services/BugServiceError');

const statuses = ['Open', 'In Progress', 'Resolved', 'Closed', 'Re-opened'];
const actions = ['claim', 'resolve', 'close', 'reopen'];

// [from status, action, next status]
const validMoves = [
    ['Open', 'claim', 'In Progress'],
    ['In Progress', 'resolve', 'Resolved'],
    ['Resolved', 'close', 'Closed'],
    ['Resolved', 'reopen', 'Re-opened'],
    ['Re-opened', 'claim', 'In Progress'],
];

const isValid = (status, action) =>
    validMoves.some(([from, act]) => from === status && act === action);

describe('Bug state machine (FR-4a)', () => {
    validMoves.forEach(([from, action, next]) => {
        it(`FR-4a: ${from} + ${action} moves to ${next}`, () => {
            expect(stateFor(from)[action]()).to.equal(next);
        });
    });

    statuses.forEach((status) => {
        actions.forEach((action) => {
            if (isValid(status, action)) return;

            it(`FR-4a (409): ${status} rejects ${action}`, () => {
                let caught;
                try {
                    stateFor(status)[action]();
                } catch (err) {
                    caught = err;
                }
                expect(caught).to.be.instanceOf(BugServiceError);
                expect(caught.code).to.equal('INVALID_TRANSITION');
            });
        });
    });

    it('FR-4a (409): an unknown status is rejected', () => {
        expect(() => stateFor('Banana')).to.throw(BugServiceError);
    });
});