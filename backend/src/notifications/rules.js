const Bug = require('../models/Bug');
const User = require('../models/User');

// Event contract agreed with BugService (BTS2-48): each event is
// { type, bugId, actingUser, fieldChanged, oldValue, newValue, timestamp }
// and is emitted only after the database change succeeded.
const EVENT_TYPES = {
  CLAIMED:  'bug.claimed',
  RESOLVED: 'bug.resolved',
  REOPENED: 'bug.reopened',
  CLOSED:   'bug.closed',
};

// Recipient rules (FR-2):
//   claim   -> reporter
//   resolve -> reporter + all QA Leads
//   reopen  -> assigned developer
//   close   -> nobody
async function getRecipients({ type, bugId }) {
  const notifiable = [EVENT_TYPES.CLAIMED, EVENT_TYPES.RESOLVED, EVENT_TYPES.REOPENED];
  if (!notifiable.includes(type)) return [];

  // Events carry only bugId, so look up who reported and owns the bug.
  const bug = await Bug.findOne({ ticketId: bugId }, 'reporter assignee');
  if (!bug) return [];

  let recipients = [];
  if (type === EVENT_TYPES.CLAIMED) {
    recipients = [bug.reporter];
  } else if (type === EVENT_TYPES.RESOLVED) {
    const qaLeads = await User.find({ role: 'QALead' }, 'username');
    recipients = [bug.reporter, ...qaLeads.map(u => u.username)];
  } else if (type === EVENT_TYPES.REOPENED) {
    recipients = [bug.assignee];
  }

  return [...new Set(recipients)].filter(r => r && r !== 'Unassigned');
}

function buildMessage({ type, bugId, actingUser }) {
  const ticket = `BUG-${bugId}`;
  if (type === EVENT_TYPES.CLAIMED)  return `${ticket} was claimed by ${actingUser}.`;
  if (type === EVENT_TYPES.RESOLVED) return `${ticket} was resolved by ${actingUser} and is ready for QA.`;
  if (type === EVENT_TYPES.REOPENED) return `${ticket} was re-opened by ${actingUser}.`;
  return `${ticket} was updated.`;
}

module.exports = { EVENT_TYPES, getRecipients, buildMessage };
