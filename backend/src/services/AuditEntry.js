const AuditLog = require('../models/AuditLog');

/**
 * AuditEntry
 * Value object / entity representing an immutable audit log entry.
 * Uses JavaScript private fields (#) with read-only getters to guarantee
 * that audit entries cannot be modified after instantiation (BTS2-18 / NFR-1).
 */
class AuditEntry {
  #bugId;
  #action;
  #actingUser;
  #assignee;
  #fieldChanged;
  #oldValue;
  #newValue;
  #timestamp;
  #details;

  constructor({
    bugId,
    action,
    type,
    actingUser,
    changedBy,
    user,
    assignee,
    fieldChanged,
    field,
    oldValue,
    prevValue,
    newValue,
    timestamp,
    details,
  } = {}) {
    this.#bugId = bugId !== undefined && bugId !== null ? Number(bugId) : NaN;
    this.#action = action || type;
    this.#actingUser = actingUser || changedBy || user;
    this.#assignee = assignee !== undefined && assignee !== null ? assignee : 'Unassigned';
    this.#fieldChanged = fieldChanged || field;
    this.#oldValue = oldValue !== undefined ? oldValue : (prevValue !== undefined ? prevValue : null);
    this.#newValue = newValue !== undefined ? newValue : null;
    this.#timestamp = timestamp ? new Date(timestamp) : new Date();
    this.#details = details !== undefined ? details : null;
  }

  get bugId() { return this.#bugId; }
  get action() { return this.#action; }
  get actingUser() { return this.#actingUser; }
  get changedBy() { return this.#actingUser; }
  get assignee() { return this.#assignee; }
  get fieldChanged() { return this.#fieldChanged; }
  get oldValue() { return this.#oldValue; }
  get prevValue() { return this.#oldValue; }
  get newValue() { return this.#newValue; }
  get timestamp() { return this.#timestamp; }
  get details() { return this.#details; }

  validate() {
    const errors = [];

    if (!this.#bugId || isNaN(this.#bugId)) {
      errors.push('bugId is required and must be a valid number.');
    }

    if (!this.#actingUser || typeof this.#actingUser !== 'string' || !this.#actingUser.trim()) {
      errors.push('changedBy (or actingUser) is required.');
    }

    if (!this.#fieldChanged || typeof this.#fieldChanged !== 'string') {
      errors.push('fieldChanged is required.');
    } else if (!AuditLog.AUDITABLE_FIELDS.includes(this.#fieldChanged)) {
      errors.push(`Invalid fieldChanged: '${this.#fieldChanged}'. Allowed fields: ${AuditLog.AUDITABLE_FIELDS.join(', ')}.`);
    }

    if (!this.#action || typeof this.#action !== 'string') {
      errors.push('action (or type) is required.');
    } else if (!AuditLog.ACTION_TYPES.includes(this.#action)) {
      errors.push(`Invalid action: '${this.#action}'. Allowed actions: ${AuditLog.ACTION_TYPES.join(', ')}.`);
    }

    if (errors.length) {
      const err = new Error(errors.join(' '));
      err.name = 'AuditEntryValidationError';
      err.errors = errors;
      throw err;
    }

    return true;
  }

  toObject() {
    return {
      bugId: this.#bugId,
      action: this.#action,
      actingUser: this.#actingUser,
      changedBy: this.#actingUser,
      assignee: this.#assignee,
      fieldChanged: this.#fieldChanged,
      oldValue: this.#oldValue,
      prevValue: this.#oldValue,
      newValue: this.#newValue,
      timestamp: this.#timestamp,
      details: this.#details,
    };
  }

  async save() {
    this.validate();
    return AuditLog.create(this.toObject());
  }

  static async create(data) {
    const entry = new AuditEntry(data);
    return entry.save();
  }
}

module.exports = AuditEntry;
module.exports.AuditEntry = AuditEntry;
