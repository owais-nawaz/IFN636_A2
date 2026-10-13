// Carries a code so the controller can pick the HTTP status.
// The service and the state classes know nothing about HTTP.
class BugServiceError extends Error {
    constructor(code, message) {
        super(message);
        this.name = 'BugServiceError';
        this.code = code;
    }
}

module.exports = BugServiceError;