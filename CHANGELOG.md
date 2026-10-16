# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to Semantic Versioning.

## [Unreleased]

### Added
- **Audit Trail & Bug History (BTS2-6, FR-1, BTS2-17, BTS2-18, BTS2-23)**:
  - Added `AuditLog` MongoDB schema and model (`backend/src/models/AuditLog.js`) with immutable fields, indexed queries, and compound index `{ bugId: 1, timestamp: -1 }`.
  - Added `AuditEntry` domain model (`backend/src/services/AuditEntry.js`) with JavaScript private fields (`#bugId`, `#action`, `#actingUser`, `#fieldChanged`, `#oldValue`, `#newValue`, `#timestamp`) and read-only getters ensuring strict immutability (NFR-1 / BTS2-18).
  - Added `AuditService` (`backend/src/services/AuditService.js`) with static logging methods and query helper `getLogsForBug(bugId, options)` supporting oldest-first ascending sorts.
  - Implemented `AuditedBugService` decorator pattern (`backend/src/services/AuditedBugService.js`) wrapping `bugService` for `claim`, `resolve`, and `verify` (both close and reopen) with centralized `#record` helper and safe error handling.
  - Connected `AuditedBugService` into `bugController.js` so all client-initiated status transitions are automatically audited.
  - Added `GET /api/bugs/:id/history` endpoint with role-based authentication (`Tester`, `Developer`, `QALead`), 404 validation, and chronological oldest-first sorting.
  - Added React frontend `BugHistory` modal and drawer component (`frontend/src/components/bugs/BugHistory.jsx`) on `BugCard.jsx` displaying timestamped audit events with user avatars and change diffs.
  - Added Postman test collections and environments for automated audit history testing (`backend/postman/bts2-6-audit-history.postman_collection.json`).
  - Added end-to-end HTTP state-machine transition tests (`backend/test/auditedTransitions.test.js` & `backend/test/claim.test.js`) verifying valid transitions record exactly one entry and invalid (409) transitions record nothing.

### Architectural Decisions
- **SLA Escalation Priority Change Auditing (Agreed with Alvin - BTS2-13 / BTS2-6)**:
  - **Context**: The automated SLA escalation engine (`backend/src/services/slaService.js` / BTS2-13) flags overdue active bugs and increments their priority level directly via MongoDB queries without passing through `AuditedBugService` or emitting state-transition events.
  - **Decision**: In agreement with Alvin (`@alvin355`), automated SLA priority escalations are **not** audited in the current release. The audit history strictly tracks user-initiated status transitions (claim, resolve, close, reopen).
  - **Follow-up**: Auditing automated SLA priority escalations (via a `bug.escalated` event contract or direct `AuditLog` entry) is agreed to be handled in a follow-up ticket so that reports and documentation accurately reflect the system's behavior.
