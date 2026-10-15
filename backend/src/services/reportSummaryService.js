// Pure summary maths for the reports feature: no database, no model imports.
// summarise(bugs) takes plain bug objects (e.g. from Bug.find().lean()).
const STATUSES      = ['Open', 'In Progress', 'Resolved', 'Closed', 'Re-opened'];
const SEVERITIES    = ['Low', 'Medium', 'High', 'Critical'];
const MTTR_STATUSES = ['Resolved', 'Closed'];
const MS_PER_HOUR   = 60 * 60 * 1000;

// { Open: 0, 'In Progress': 0, ... } so every key is present, zeros included
function zeroCounts(keys) {
  return Object.fromEntries(keys.map((key) => [key, 0]));
}

// Milliseconds from createdAt to resolvedAt, or null if this bug can't be used for MTTR.
// Re-opening does not clear resolvedAt, so the status check is what keeps old values out.
function resolutionMs(bug) {
  if (!MTTR_STATUSES.includes(bug.status)) return null;
  if (!bug.createdAt || !bug.resolvedAt) return null;

  const created  = new Date(bug.createdAt).getTime(); // accepts Date objects and ISO strings
  const resolved = new Date(bug.resolvedAt).getTime();
  if (Number.isNaN(created) || Number.isNaN(resolved) || resolved < created) return null;

  return resolved - created;
}

function summarise(bugs) {
  const countsByStatus   = zeroCounts(STATUSES);
  const countsBySeverity = zeroCounts(SEVERITIES);
  let totalMs = 0;
  let sampleSize = 0;

  bugs.forEach((bug) => {
    if (Object.hasOwn(countsByStatus, bug.status))     countsByStatus[bug.status] += 1;
    if (Object.hasOwn(countsBySeverity, bug.severity)) countsBySeverity[bug.severity] += 1;

    const ms = resolutionMs(bug);
    if (ms !== null) {
      totalMs += ms;
      sampleSize += 1;
    }
  });

  const mttrHours = sampleSize === 0
    ? null
    : Math.round((totalMs / sampleSize / MS_PER_HOUR) * 100) / 100;

  return {
    total: bugs.length,
    countsByStatus,
    countsBySeverity,
    mttrHours,
    mttrSampleSize: sampleSize,
  };
}

module.exports = { summarise };
