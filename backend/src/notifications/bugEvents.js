const BugEventSubject = require('./BugEventSubject');
const InAppNotifier   = require('./InAppNotifier');
const EmailNotifier   = require('./EmailNotifier');

// Shared subject for the whole app. BugService calls
// `await bugEvents.notify(event)` after each successful status change.
const bugEvents = new BugEventSubject();
bugEvents.subscribe(new InAppNotifier());
bugEvents.subscribe(new EmailNotifier());

module.exports = bugEvents;
