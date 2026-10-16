const mongoose = require('mongoose');

const ACTION_TYPES = [
  'CREATE',
  'UPDATE',
  'CLAIM',
  'RESOLVE',
  'CLOSE',
  'REOPEN',
  'ASSIGN',
  'STATUS_CHANGE',
  'bug.created',
  'bug.claimed',
  'bug.resolved',
  'bug.reopened',
  'bug.closed',
  'bug.updated',
];

const AUDITABLE_FIELDS = [
  'status',
  'assignee',
  'priority',
  'severity',
  'title',
  'description',
  'module',
  'resolutionType',
  'resolutionNotes',
  'qaNotes',
  'bug',
];

const AuditLogSchema = new mongoose.Schema({
  bugId:        { type: Number, required: true },
  action:       { type: String, required: true, enum: ACTION_TYPES },
  changedBy:    { type: String, required: true },
  assignee:     { type: String, default: 'Unassigned' },
  fieldChanged: { type: String, required: true, enum: AUDITABLE_FIELDS },
  oldValue:     { type: mongoose.Schema.Types.Mixed, default: null },
  newValue:     { type: mongoose.Schema.Types.Mixed, default: null },
  timestamp:    { type: Date, default: Date.now },
  details:      { type: mongoose.Schema.Types.Mixed, default: null },
}, {
  toJSON: { virtuals: true },
  toObject: { virtuals: true },
});

AuditLogSchema.pre('validate', function () {
  if (this.actingUser && !this.changedBy) this.changedBy = this.actingUser;
  if (this.changedBy && !this.actingUser) this.actingUser = this.changedBy;
});

AuditLogSchema.virtual('id').get(function () {
  return this._id ? this._id.toHexString() : undefined;
});

AuditLogSchema.virtual('prevValue')
  .get(function () {
    return this.oldValue;
  })
  .set(function (val) {
    this.oldValue = val;
  });

AuditLogSchema.virtual('actingUser')
  .get(function () {
    return this.changedBy;
  })
  .set(function (val) {
    this.changedBy = val;
  });

AuditLogSchema.index({ bugId: 1, timestamp: -1 });

const AuditLog = mongoose.model('AuditLog', AuditLogSchema);
AuditLog.ACTION_TYPES = ACTION_TYPES;
AuditLog.AUDITABLE_FIELDS = AUDITABLE_FIELDS;

module.exports = AuditLog;
