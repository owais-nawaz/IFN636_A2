// Observer pattern subject: notifiers subscribe, and every bug event is
// passed to each of them.
class BugEventSubject {
  constructor() {
    this.observers = [];
  }

  subscribe(observer) {
    if (typeof observer.notify !== 'function')
      throw new Error('Observer must implement notify(event).');
    this.observers.push(observer);
  }

  // One failing notifier must not stop the others or break the bug workflow.
  async notify(event) {
    const results = await Promise.allSettled(this.observers.map(o => o.notify(event)));
    results
      .filter(r => r.status === 'rejected')
      .forEach(r => console.error(`Notifier failed for ${event.type}:`, r.reason.message));
  }
}

module.exports = BugEventSubject;
