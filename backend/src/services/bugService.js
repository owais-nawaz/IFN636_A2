const Bug = require('../models/Bug');
const BugServiceError = require('./BugServiceError');
const { stateFor } = require('./bugStates');
const bugEvents = require('../notifications/bugEvents');
const { EVENT_TYPES } = require('../notifications/rules');

// Event emitted for each action (contract on BTS2-48).
const EVENT_BY_ACTION = {
  claim:   EVENT_TYPES.CLAIMED,
  resolve: EVENT_TYPES.RESOLVED,
  close:   EVENT_TYPES.CLOSED,
  reopen:  EVENT_TYPES.REOPENED,
};

// Shared by every action: load the bug, ask its state object for the next
// status (throws 409 if the move is not allowed), save, then emit the event.
async function applyTransition(bugId, action, actingUser, fields) {
  const bug = await Bug.findOne({ ticketId: bugId });
  if (!bug) {
    throw new BugServiceError('NOT_FOUND', 'Ticket not found.');
  }

  const nextStatus = stateFor(bug.status)[action]();

  // The filter includes the status we just read, so if another request
  // (or the second server) changed the bug in between, nothing is overwritten.
  const updated = await Bug.findOneAndUpdate(
    { ticketId: bugId, status: bug.status },
    { ...fields, status: nextStatus },
    { new: true }
  );
  if (!updated) {
    throw new BugServiceError(
      'INVALID_TRANSITION',
      'Bug was changed by someone else. Refresh and try again.'
    );
  }

  // Only reached after a successful update, so rejected actions emit nothing.
  await bugEvents.notify({
    type: EVENT_BY_ACTION[action],
    bugId,
    actingUser,
    fieldChanged: 'status',
    oldValue: bug.status,
    newValue: nextStatus,
    timestamp: new Date(),
  });

  return updated;
}

async function claim(bugId, username) {
  return applyTransition(bugId, 'claim', username, { assignee: username });
}

async function resolve(bugId, username, resolutionType, resolutionNotes) {
  if (!resolutionNotes || resolutionNotes.trim().length < 10) {
    throw new BugServiceError('VALIDATION', 'Resolution notes must be at least 10 characters.');
  }

  return applyTransition(bugId, 'resolve', username, {
    resolutionType,
    resolutionNotes: resolutionNotes.trim(),
    assignee: username,
    resolvedAt: new Date(),
  });
}

async function verify(bugId, username, action, qaNotes) {
  if (action !== 'close' && action !== 'reopen') {
    throw new BugServiceError('VALIDATION', 'Action must be "close" or "reopen".');
  }
  if (action === 'reopen' && (!qaNotes || qaNotes.trim().length < 5)) {
    throw new BugServiceError('VALIDATION', 'Regression notes are required to re-open (min. 5 chars).');
  }

  return applyTransition(bugId, action, username, {
    qaNotes: qaNotes ? qaNotes.trim() : null,
  });
}

module.exports = { claim, resolve, verify, BugServiceError };
