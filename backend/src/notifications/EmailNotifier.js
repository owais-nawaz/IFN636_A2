const BaseNotifier = require('./BaseNotifier');
const User = require('../models/User');

// Simulated email: looks up each recipient's address and logs the email
// instead of sending it.
class EmailNotifier extends BaseNotifier {
  async send(recipients, event, message) {
    const users = await User.find({ username: { $in: recipients } }, 'username email');
    users.forEach(user => {
      console.log(`[email] To: ${user.email} | Subject: BUG-${event.bug.ticketId} update | ${message}`);
    });
  }
}

module.exports = EmailNotifier;
