const mongoose = require('mongoose');

const BugSchema = new mongoose.Schema({
  ticketId:        { type: Number, required: true, unique: true },
  title:           { type: String, required: true, minlength: 5 },
  module:          { type: String, required: true },
  severity:        { type: String, enum: ['Low','Medium','High','Critical'], default: 'Medium' },
  priority:        { type: String, enum: ['Low','Medium','High','Critical'], default: 'Medium' },
  description:     { type: String, required: true, minlength: 10 },
  status:          { type: String, enum: ['Open','In Progress','Resolved','Closed','Re-opened'], default: 'Open' },
  reporter:        { type: String, default: 'Anonymous' },
  assignee:        { type: String, default: 'Unassigned' },
  resolutionType:  { type: String, default: null },
  resolutionNotes: { type: String, default: null },
  qaNotes:         { type: String, default: null },
  slaBreached:     { type: Boolean, default: false },
  escalatedAt:     { type: Date, default: null },
  resolvedAt:      { type: Date, default: null },
}, { timestamps: true });

module.exports = mongoose.model('Bug', BugSchema);
