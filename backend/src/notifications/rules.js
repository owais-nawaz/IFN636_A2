const User = require('../models/User');

// Event names must match the events BugService emits (BTS2-50).
const EVENT_TYPES = {
  CLAIMED:  'bug.claimed',
  RESOLVED: 'bug.resolved',
  REOPENED: 'bug.reopened',
};

// Recipient rules (FR-2):
//   claim   -> reporter
//   resolve -> reporter + all QA Leads
//   reopen  -> assigned developer
async function getRecipients({ type, bug }) {
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

function buildMessage({ type, bug }) {
  const ticket = `BUG-${bug.ticketId}`;
  if (type === EVENT_TYPES.CLAIMED)  return `${ticket} was claimed by ${bug.assignee}.`;
  if (type === EVENT_TYPES.RESOLVED) return `${ticket} was resolved by ${bug.assignee} and is ready for QA.`;
  if (type === EVENT_TYPES.REOPENED) return `${ticket} was re-opened by QA.`;
  return `${ticket} was updated.`;
}

module.exports = { EVENT_TYPES, getRecipients, buildMessage };
