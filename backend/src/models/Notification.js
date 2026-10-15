const mongoose = require('mongoose');

const NotificationSchema = new mongoose.Schema({
  recipient: { type: String, required: true, index: true }, // username
  bugId:     { type: Number, required: true },              // Bug.ticketId
  eventType: { type: String, required: true },
  message:   { type: String, required: true },
  read:      { type: Boolean, default: false },
  timestamp: { type: Date, default: Date.now },
});

module.exports = mongoose.model('Notification', NotificationSchema);
