const AuditLog = require('../models/AuditLog');

/**
 * AuditEntry
 * Represents and validates a single audit record before persisting to the database.
 */
class AuditEntry {
  constructor({
    bugId,
    action,
    type,
    changedBy,
    actingUser,
    user,
    assignee,
    fieldChanged,
    field,
    prevValue,
    oldValue,
    newValue,
    timestamp,
    details,
  } = {}) {
    this.bugId = Number(bugId);
    this.action = action || type || 'UPDATE';
    this.changedBy = changedBy || actingUser || user;
    this.assignee = assignee !== undefined && assignee !== null ? assignee : 'Unassigned';
    this.fieldChanged = fieldChanged || field || 'status';
    this.prevValue = prevValue !== undefined ? prevValue : (oldValue !== undefined ? oldValue : null);
    this.newValue = newValue !== undefined ? newValue : null;
    this.timestamp = timestamp ? new Date(timestamp) : new Date();
    this.details = details !== undefined ? details : null;
  }

  /**
   * Validate the audit entry fields against required criteria and schema enums.
   */
  validate() {
    const errors = [];

    if (!this.bugId || isNaN(this.bugId)) {
      errors.push('bugId is required and must be a valid number.');
    }

    if (!this.changedBy || typeof this.changedBy !== 'string' || !this.changedBy.trim()) {
      errors.push('changedBy (or actingUser) is required.');
    }

    if (!this.fieldChanged || typeof this.fieldChanged !== 'string') {
      errors.push('fieldChanged is required.');
    } else if (!AuditLog.AUDITABLE_FIELDS.includes(this.fieldChanged)) {
      errors.push(`Invalid fieldChanged: '${this.fieldChanged}'. Allowed fields: ${AuditLog.AUDITABLE_FIELDS.join(', ')}.`);
    }

    if (!this.action || typeof this.action !== 'string') {
      errors.push('action (or type) is required.');
    } else if (!AuditLog.ACTION_TYPES.includes(this.action)) {
      errors.push(`Invalid action: '${this.action}'. Allowed actions: ${AuditLog.ACTION_TYPES.join(', ')}.`);
    }

    if (errors.length) {
      const err = new Error(errors.join(' '));
      err.name = 'AuditEntryValidationError';
      err.errors = errors;
      throw err;
    }

    return true;
  }

  /**
   * Convert to plain object representation for MongoDB insertion.
   */
  toObject() {
    return {
      bugId: this.bugId,
      action: this.action,
      changedBy: this.changedBy,
      assignee: this.assignee,
      fieldChanged: this.fieldChanged,
      prevValue: this.prevValue,
      newValue: this.newValue,
      timestamp: this.timestamp,
      details: this.details,
    };
  }

  /**
   * Directly save this entry to the database via AuditLog.
   */
  async save() {
    this.validate();
    return AuditLog.create(this.toObject());
  }

  /**
   * Factory / static creation method.
   */
  static async create(data) {
    const entry = new AuditEntry(data);
    return entry.save();
  }
}

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
    newValue = null,
    action = 'UPDATE',
    details = null,
  }) {
    return this.log({
      bugId,
      changedBy: changedBy || actingUser,
      assignee,
      fieldChanged,
      prevValue,
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
      changedBy: user,
      assignee: (bug && bug.assignee) || 'Unassigned',
      fieldChanged: 'bug',
      prevValue: null,
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
      changedBy: changedBy || actingUser,
      assignee,
      fieldChanged: 'status',
      prevValue: prevStatus,
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
