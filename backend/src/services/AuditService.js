const AuditLog = require('../models/AuditLog');
const AuditEntry = require('./AuditEntry');

/**
 * AuditService
 * Service layer responsible for recording and querying audit trail entries.
 */
class AuditService {
  /**
   * Primary entry point for logging changes.
   * Accepts an AuditEntry instance, a plain object, or a BugService event contract.
   *
   * @param {Object|AuditEntry} entryOrData
   * @returns {Promise<Object>} The persisted AuditLog document
   */
  static async log(entryOrData) {
    const entry = entryOrData instanceof AuditEntry ? entryOrData : new AuditEntry(entryOrData);
    return entry.save();
  }

  /**
   * Alias for AuditService.log()
   */
  static async createLog(entryOrData) {
    return this.log(entryOrData);
  }

  /**
   * Alias for AuditService.log()
   */
  static async recordEntry(entryOrData) {
    return this.log(entryOrData);
  }

  /**
   * Convenience helper to log an individual field change.
   */
  static async logFieldChange({
    bugId,
    changedBy,
    actingUser,
    assignee = 'Unassigned',
    fieldChanged,
    prevValue = null,
    oldValue = null,
    newValue = null,
    action = 'UPDATE',
    details = null,
  }) {
    return this.log({
      bugId,
      actingUser: actingUser || changedBy,
      assignee,
      fieldChanged,
      oldValue: oldValue !== null ? oldValue : prevValue,
      newValue,
      action,
      details,
    });
  }

  /**
   * Convenience helper to log the initial creation of a bug.
   */
  static async logBugCreation({ bug, createdBy }) {
    const user = createdBy || (bug && bug.reporter) || 'Anonymous';
    const bugId = bug ? (bug.ticketId || bug.id) : null;
    return this.log({
      bugId,
      action: 'CREATE',
      actingUser: user,
      assignee: (bug && bug.assignee) || 'Unassigned',
      fieldChanged: 'bug',
      oldValue: null,
      newValue: bug ? (bug.title || 'Created') : 'Created',
      details: bug,
    });
  }

  /**
   * Convenience helper to log lifecycle status transitions (Claim, Resolve, Re-open, Close).
   */
  static async logStatusTransition({
    bugId,
    changedBy,
    actingUser,
    assignee = 'Unassigned',
    prevStatus,
    newStatus,
    action = 'STATUS_CHANGE',
    notes = null,
  }) {
    return this.log({
      bugId,
      action,
      actingUser: actingUser || changedBy,
      assignee,
      fieldChanged: 'status',
      oldValue: prevStatus,
      newValue: newStatus,
      details: notes ? { notes } : null,
    });
  }

  /**
   * Retrieve audit logs for a bug ticket, ordered by timestamp.
   *
   * @param {number|string} bugId - The ticketId of the bug
   * @param {Object} options - Pagination and sorting options
   * @returns {Promise<Array>} Array of audit log entries
   */
  static async getLogsForBug(bugId, { limit, sort = -1 } = {}) {
    const parsedId = Number(bugId);
    if (!parsedId || isNaN(parsedId)) {
      throw new Error('Valid bugId is required.');
    }

    const sortOrder = sort === 'asc' || sort === 1 ? 1 : -1;

    let query = AuditLog.find({ bugId: parsedId }).sort({ timestamp: sortOrder });
    if (limit) {
      query = query.limit(limit);
    }
    return query.lean();
  }
}

module.exports = AuditService;
module.exports.AuditService = AuditService;
module.exports.AuditEntry = AuditEntry;
