const Bug = require('../models/Bug');
const bugService = require('../services/bugService');
const AuditService = require('../services/AuditService');
const { BugServiceError } = bugService;

// Maps service error codes to HTTP status codes.
const STATUS_BY_CODE = {
  VALIDATION: 400,
  NOT_FOUND: 404,
  INVALID_TRANSITION: 409,
};

// Turns a service error into an HTTP response; anything else is rethrown.
function sendServiceError(res, err) {
  if (err instanceof BugServiceError) {
    const status = STATUS_BY_CODE[err.code] || 500;
    return res.status(status).json({ success: false, errors: [err.message] });
  }
  throw err;
}

async function createBug(req, res) {
  const { title, module, severity, priority, description } = req.body;
  const reporter = req.authenticatedUser.username;

  const errors = [];
  if (!title || title.trim().length < 5)               errors.push('Title must be at least 5 characters.');
  if (!module || module.trim() === '')                  errors.push('Module is required.');
  if (!description || description.trim().length < 10)  errors.push('Description must be at least 10 characters.');
  if (!['Low', 'Medium', 'High', 'Critical'].includes(severity)) errors.push('Valid severity is required.');
  if (!['Low', 'Medium', 'High', 'Critical'].includes(priority)) errors.push('Valid priority is required.');
  if (errors.length) return res.status(400).json({ success: false, errors });

  const lastBug = await Bug.findOne().sort({ ticketId: -1 });
  const ticketId = lastBug ? lastBug.ticketId + 1 : 101;

  const newBug = await Bug.create({
    ticketId, title: title.trim(), module: module.trim(),
    severity, priority, description: description.trim(),
    status: 'Open', reporter, assignee: 'Unassigned',
  });

  res.status(201).json({ success: true, message: `BUG-${ticketId} created.`,
    bug: { ...newBug.toObject(), id: ticketId } });
}

async function getBugs(req, res) {
  const { status, priority, search } = req.query;

  const match = {};
  if (status && status !== 'All')     match.status   = new RegExp(`^${status}$`, 'i');
  if (priority && priority !== 'All') match.priority = new RegExp(`^${priority}$`, 'i');

  let bugs;

  if (search) {
    const trimmed = search.trim();
    const cleanedId = trimmed.replace(/^bug-?/i, '');

    const orConditions = [
      { title:       { $regex: trimmed, $options: 'i' } },
      { description: { $regex: trimmed, $options: 'i' } },
    ];
    if (cleanedId) {
      orConditions.push({ ticketIdStr: { $regex: cleanedId, $options: 'i' } });
    }

    bugs = await Bug.aggregate([
      { $match: match },
      { $addFields: { ticketIdStr: { $toString: '$ticketId' } } }, // convert Number → String so regex works
      { $match: { $or: orConditions } },
      { $sort: { updatedAt: -1 } },
    ]);
  } else {
    bugs = await Bug.find(match).sort({ updatedAt: -1 }).lean();
  }

  res.json({ success: true, count: bugs.length, bugs: bugs.map(b => ({ ...b, id: b.ticketId })) });
}

async function claimBug(req, res) {
  const bugId    = parseInt(req.params.id, 10);
  const assignee = req.authenticatedUser.username;

  try {
    const updated = await bugService.claim(bugId, assignee);
    res.json({ success: true, message: `BUG-${bugId} claimed by ${assignee}.`,
      bug: { ...updated.toObject(), id: updated.ticketId } });
  } catch (err) {
    sendServiceError(res, err);
  }
}

async function resolveBug(req, res) {
  const bugId = parseInt(req.params.id, 10);
  const { resolutionType, resolutionNotes } = req.body;
  const developer = req.authenticatedUser.username;

  try {
    const updated = await bugService.resolve(bugId, developer, resolutionType, resolutionNotes);
    res.json({ success: true, message: `BUG-${bugId} resolved by ${developer}.`,
      bug: { ...updated.toObject(), id: updated.ticketId } });
  } catch (err) {
    sendServiceError(res, err);
  }
}

async function verifyBug(req, res) {
  const bugId = parseInt(req.params.id, 10);
  const { action, qaNotes } = req.body;
  const qaUser = req.authenticatedUser.username;

  try {
    const updated = await bugService.verify(bugId, qaUser, action, qaNotes);
    res.json({ success: true, message: `BUG-${bugId} → ${updated.status}.`,
      bug: { ...updated.toObject(), id: updated.ticketId } });
  } catch (err) {
    sendServiceError(res, err);
  }
}

async function getBugHistory(req, res) {
  const bugId = parseInt(req.params.id, 10);
  if (isNaN(bugId)) return res.status(404).json({ success: false, errors: ['Ticket not found.'] });

  const bug = await Bug.findOne({ ticketId: bugId });
  if (!bug) return res.status(404).json({ success: false, errors: ['Ticket not found.'] });

  const logs = await AuditService.getLogsForBug(bugId, { sort: 'asc' });
  const history = logs.map(entry => ({
    ...entry,
    id: entry.id || (entry._id ? entry._id.toString() : undefined),
  }));

  res.json({ success: true, count: history.length, history });
}

module.exports = { createBug, getBugs, claimBug, resolveBug, verifyBug, getBugHistory };
