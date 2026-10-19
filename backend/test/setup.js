// Loaded before every test file (see the "test" script). Setting NODE_ENV here
// rather than in the script keeps `npm test` working on Windows too.
process.env.NODE_ENV = 'test';

// No test may use a real database (CI has none). With buffering off, a model
// call a test forgot to stub fails straight away instead of hanging for 10 s.
require('mongoose').set('bufferCommands', false);

// Tests must never send real email, even if a developer's shell has these set.
delete process.env.GMAIL_USER;
delete process.env.GMAIL_APP_PASSWORD;
