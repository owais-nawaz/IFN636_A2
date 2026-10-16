const defaultBugService = require('./bugService');
const AuditEntry = require('./AuditEntry');
const Bug = require('../models/Bug');

/**
 * AuditedBugService (Decorator Pattern)
 * Holds the real bug service and implements the same methods (claim, resolve, verify).
 * Each method calls the real one first; only if that succeeds does it save an
 * AuditEntry (who, which field, old value, new value, when).
 * A failed action records nothing.
 */
class AuditedBugService {
  #inner;

  constructor(inner = defaultBugService) {
    this.#inner = inner;
  }

  /**
   * Helper to retrieve bug status before transition.
   */
  async #getPreviousStatus(bugId) {
    try {
      const bug = await Bug.findOne({ ticketId: bugId });
      return bug ? bug.status : null;
    } catch {
      return null;
    }
  }

  async #record(bugId, action, username, oldStatus, newStatus) {
    if (!oldStatus) {
      console.error(`Skipping audit entry for bug ${bugId}: previous status could not be determined.`);
      return;
    }
    try {
      const entry = new AuditEntry({
        bugId,
        action,
        actingUser: username,
        fieldChanged: 'status',
        oldValue: oldStatus,
        newValue: newStatus,
        timestamp: new Date(),
      });
      await entry.save();
    } catch (err) {
      console.error(`Failed to record audit entry for bug ${bugId}:`, err.message);
    }
  }

  /**
   * Decorates claim: calls real bugService.claim first, then saves AuditEntry upon success.
   */
  async claim(bugId, username) {
    const oldStatus = await this.#getPreviousStatus(bugId);

    // Call real bug service first. If it fails, error is thrown and nothing is saved.
    const updated = await this.#inner.claim(bugId, username);

    await this.#record(bugId, 'bug.claimed', username, oldStatus, updated ? updated.status : 'In Progress');

    return updated;
  }

  /**
   * Decorates resolve: calls real bugService.resolve first, then saves AuditEntry upon success.
   */
  async resolve(bugId, username, resolutionType, resolutionNotes) {
    const oldStatus = await this.#getPreviousStatus(bugId);

    // Call real bug service first. If it fails, error is thrown and nothing is saved.
    const updated = await this.#inner.resolve(bugId, username, resolutionType, resolutionNotes);

    await this.#record(bugId, 'bug.resolved', username, oldStatus, updated ? updated.status : 'Resolved');

    return updated;
  }

  /**
   * Decorates verify: calls real bugService.verify first, then saves AuditEntry upon success.
   */
  async verify(bugId, username, action, qaNotes) {
    const oldStatus = await this.#getPreviousStatus(bugId);

    // Call real bug service first. If it fails, error is thrown and nothing is saved.
    const updated = await this.#inner.verify(bugId, username, action, qaNotes);

    const actionType = action === 'close' ? 'bug.closed' : 'bug.reopened';
    const fallbackStatus = action === 'close' ? 'Closed' : 'Re-opened';
    await this.#record(bugId, actionType, username, oldStatus, updated ? updated.status : fallbackStatus);

    return updated;
  }
}

module.exports = AuditedBugService;
