const Bug = require('../models/Bug');
const BugServiceError = require('./BugServiceError');
const { stateFor } = require('./bugStates');

async function claim(bugId, username) {
    const bug = await Bug.findOne({ ticketId: bugId });
    if (!bug) {
        throw new BugServiceError('NOT_FOUND', 'Ticket not found.');
    }

    // The state object decides if claim is allowed (throws 409 if not).
    const nextStatus = stateFor(bug.status).claim();

    // The filter includes the status we just read, so if another request
    // (or the second server) changed the bug in between, nothing is overwritten.
    const updated = await Bug.findOneAndUpdate(
        { ticketId: bugId, status: bug.status },
        { assignee: username, status: nextStatus },
        { new: true }
    );
    if (!updated) {
        throw new BugServiceError(
            'INVALID_TRANSITION',
            'Bug was changed by someone else. Refresh and try again.'
        );
    }

    return updated;
}

module.exports = { claim, BugServiceError };