const BugServiceError = require('./BugServiceError');

// Base class: every action is rejected by default.
// Each concrete state overrides only the actions it allows (inheritance),
// and returns the status the bug moves to.
class BugState {
    get name() {
        throw new Error('A BugState subclass must define its name.');
    }

    claim() { return this.reject('claim'); }
    resolve() { return this.reject('resolve'); }
    close() { return this.reject('close'); }
    reopen() { return this.reject('reopen'); }

    reject(action) {
        throw new BugServiceError(
            'INVALID_TRANSITION',
            `Cannot ${action} a bug that is ${this.name}.`
        );
    }
}

class OpenState extends BugState {
    get name() { return 'Open'; }
    claim() { return 'In Progress'; }
}

class InProgressState extends BugState {
    get name() { return 'In Progress'; }
    resolve() { return 'Resolved'; }
}

class ResolvedState extends BugState {
    get name() { return 'Resolved'; }
    close() { return 'Closed'; }
    reopen() { return 'Re-opened'; }
}

// Final state: allows nothing, so every action is rejected.
class ClosedState extends BugState {
    get name() { return 'Closed'; }
}

class ReopenedState extends BugState {
    get name() { return 'Re-opened'; }
    claim() { return 'In Progress'; }
}

const STATES = {
    'Open': OpenState,
    'In Progress': InProgressState,
    'Resolved': ResolvedState,
    'Closed': ClosedState,
    'Re-opened': ReopenedState,
};

// Rebuilds the state object from the status stored in the database.
function stateFor(status) {
    const StateClass = STATES[status];
    if (!StateClass) {
        throw new BugServiceError('INVALID_TRANSITION', `Unknown bug status "${status}".`);
    }
    return new StateClass();
}

module.exports = {
    BugState,
    OpenState,
    InProgressState,
    ResolvedState,
    ClosedState,
    ReopenedState,
    stateFor,
};