const nodemailer = require('nodemailer');
const BaseNotifier = require('./BaseNotifier');
const User = require('../models/User');

// Sends one email per recipient through Gmail when GMAIL_USER and
// GMAIL_APP_PASSWORD are set (an app password, not the account password).
// Without them (local development, tests, CI) it logs the email instead.
class EmailNotifier extends BaseNotifier {
  // Tests pass a fake transport; otherwise one is created from the
  // environment on first use.
  constructor({ transport } = {}) {
    super();
    this.transport = transport;
  }

  getTransport() {
    if (this.transport === undefined) {
      const { GMAIL_USER, GMAIL_APP_PASSWORD } = process.env;
      this.transport = GMAIL_USER && GMAIL_APP_PASSWORD
        ? nodemailer.createTransport({ service: 'gmail', auth: { user: GMAIL_USER, pass: GMAIL_APP_PASSWORD } })
        : null;
    }
    return this.transport;
  }

  async send(recipients, event, message) {
    const users = await User.find({ username: { $in: recipients } }, 'username email');
    const subject = `BUG-${event.bugId} update`;
    const transport = this.getTransport();

    if (!transport) {
      users.forEach(user => {
        console.log(`[email] To: ${user.email} | Subject: ${subject} | ${message}`);
      });
      return;
    }

    // One failed address must not stop the others.
    const results = await Promise.allSettled(users.map(user => transport.sendMail({
      from: `Bug Tracking System <${process.env.GMAIL_USER}>`,
      to: user.email,
      subject,
      text: `${message}\n\nYou are receiving this because you are involved in BUG-${event.bugId}.`,
    })));
    results.forEach((result, i) => {
      if (result.status === 'fulfilled') console.log(`[email] Sent to ${users[i].email} | Subject: ${subject}`);
      else console.error(`[email] Failed to send to ${users[i].email}:`, result.reason.message);
    });
  }
}

module.exports = EmailNotifier;
