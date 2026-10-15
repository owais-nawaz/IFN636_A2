const { getRecipients, buildMessage } = require('./rules');

// Abstract observer. notify(event) applies the recipient rules once, then
// hands delivery to the subclass's send(recipients, event, message).
class BaseNotifier {
  constructor() {
    if (new.target === BaseNotifier)
      throw new Error('BaseNotifier is abstract; use InAppNotifier or EmailNotifier.');
  }

  async notify(event) {
    const recipients = await getRecipients(event);
    if (!recipients.length) return;
    await this.send(recipients, event, buildMessage(event));
  }

  async send(recipients, event, message) {
    throw new Error(`${this.constructor.name} must implement send().`);
  }
}

module.exports = BaseNotifier;
