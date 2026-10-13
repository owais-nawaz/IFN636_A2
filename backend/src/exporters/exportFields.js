// Single source of truth for which bug fields appear in exports (CSV columns and JSON keys).
// Edit this list to change both formats at once. _id and __v are deliberately left out.
const EXPORT_FIELDS = [
  'ticketId',
  'title',
  'module',
  'severity',
  'priority',
  'status',
  'reporter',
  'assignee',
  'resolutionType',
  'resolutionNotes',
  'qaNotes',
  'createdAt',
  'updatedAt',
  'resolvedAt', // not on the Bug model yet — exports as empty/null until it is added
];

module.exports = EXPORT_FIELDS;
