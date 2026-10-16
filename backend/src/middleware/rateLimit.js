const rateLimit = require('express-rate-limit');

const WRITE_METHODS = ['POST', 'PATCH', 'PUT'];

// Under `npm test` the limiter is off, so tests that send many write requests
// from the same local IP don't start getting 429s. The rate-limit tests turn
// it back on with RATE_LIMIT_IN_TESTS=1.
function disabledForTests() {
  return process.env.NODE_ENV === 'test' && process.env.RATE_LIMIT_IN_TESTS !== '1';
}

// NFR-2: at most 60 write requests per minute per client IP. Reads are not
// limited. Counts are kept in memory, so each EC2 instance has its own
// window (about 120 per minute across two instances, a documented limitation).
const writeLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 60,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  skip: req => !WRITE_METHODS.includes(req.method) || disabledForTests(),
  handler: (req, res) => res.status(429).json({
    success: false,
    errors: ['Too many requests, please try again in a minute.'],
  }),
});

module.exports = { writeLimiter };
