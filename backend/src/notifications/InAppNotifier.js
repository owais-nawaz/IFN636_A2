const BaseNotifier = require('./BaseNotifier');
const Notification = require('../models/Notification');

// Saves one Notification document per recipient in MongoDB.
class InAppNotifier extends BaseNotifier {
  async send(recipients, event, message) {
    await Notification.insertMany(recipients.map(recipient => ({
      recipient,
      bugId: event.bugId,
      eventType: event.type,
      message,
      timestamp: event.timestamp, // same time as the event and the audit entry
    })));
  }
}

module.exports = InAppNotifier;
