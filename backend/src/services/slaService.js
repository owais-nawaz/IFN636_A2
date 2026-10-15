const Bug = require('../models/Bug');

// SLA window per priority, in hours, counted from when the bug was reported.
const SLA_HOURS = { Critical: 4, High: 12, Medium: 24, Low: 72 };
const PRIORITIES = ['Low', 'Medium', 'High', 'Critical'];
const ACTIVE_STATUSES = ['Open', 'In Progress', 'Re-opened'];
const HOUR_MS = 60 * 60 * 1000;
const RUN_EVERY_MS = 15 * 60 * 1000;

// One level up; Critical stays Critical.
function nextPriority(priority) {
  const i = PRIORITIES.indexOf(priority);
  return PRIORITIES[Math.min(i + 1, PRIORITIES.length - 1)];
}

// A bug is escalated at most once: anything with escalatedAt set is skipped.
function isOverdue(bug, now) {
  if (!ACTIVE_STATUSES.includes(bug.status) || bug.escalatedAt) return false;
  const hours = SLA_HOURS[bug.priority];
  if (hours === undefined) return false;
  return now - new Date(bug.createdAt) > hours * HOUR_MS;
}

// Flags every overdue active bug and raises its priority one level.
// Safe to run repeatedly and on both servers at once: the update only
// matches while escalatedAt is still empty, so a bug is changed only once,
// and only while the bug is still active (it may be resolved in between).
async function runEscalation(now = new Date()) {
  const shortestWindow = Math.min(...Object.values(SLA_HOURS)) * HOUR_MS;
  const candidates = await Bug.find({
    status: { $in: ACTIVE_STATUSES },
    escalatedAt: null,
    createdAt: { $lte: new Date(now - shortestWindow) },
  });

  const escalated = [];
  for (const bug of candidates.filter(b => isOverdue(b, now))) {
    const from = bug.priority;
    const to = nextPriority(from);
    const updated = await Bug.findOneAndUpdate(
      { _id: bug._id, escalatedAt: null, status: { $in: ACTIVE_STATUSES } },
      { slaBreached: true, escalatedAt: now, priority: to },
      { new: true }
    );
    if (updated) escalated.push({ ticketId: bug.ticketId, from, to });
  }

  return { checked: candidates.length, escalated };
}

// Runs the escalation once straight away (catching bugs that went overdue
// while the server was down), then every 15 minutes. Errors are logged,
// never thrown, so a failed run cannot crash the server.
function startSlaTimer() {
  const tick = () => runEscalation()
    .then(({ escalated }) => {
      if (escalated.length) console.log(`[sla] escalated ${escalated.map(e => `BUG-${e.ticketId}`).join(', ')}`);
    })
    .catch(err => console.error('[sla] escalation run failed:', err.message));

  tick();
  return setInterval(tick, RUN_EVERY_MS);
}

module.exports = { SLA_HOURS, nextPriority, isOverdue, runEscalation, startSlaTimer, RUN_EVERY_MS };
