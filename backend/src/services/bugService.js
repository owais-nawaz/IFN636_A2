const Bug = require('../models/Bug');

// Carries a code so the controller can pick the HTTP status.
// The service itself knows nothing about HTTP.
class BugServiceError extends Error {
    constructor(code, message) {
        super(message);
        this.name = 'BugServiceError';
        this.code = code;
    }
}

const CLAIMABLE_STATUSES = ['Open', 'Re-opened'];

async function claim(bugId, username) {
    const bug = await Bug.findOne({ ticketId: bugId });
    if (!bug) {
        throw new BugServiceError('NOT_FOUND', 'Ticket not found.');
    }

    if (!CLAIMABLE_STATUSES.includes(bug.status)) {
        throw new BugServiceError(
            'INVALID_TRANSITION',
            `Cannot claim a bug that is ${bug.status}.`
        );
    }

    // The status is checked again inside the update, so if another request
    // (or the second server) claimed it a moment ago, nothing is overwritten.
    const updated = await Bug.findOneAndUpdate(
        { ticketId: bugId, status: { $in: CLAIMABLE_STATUSES } },
        { assignee: username, status: 'In Progress' },
        { new: true }
    );
    if (!updated) {
        throw new BugServiceError('INVALID_TRANSITION', 'Bug was changed by someone else. Refresh and try again.');
    }

    return updated;
}

module.exports = { claim, BugServiceError };