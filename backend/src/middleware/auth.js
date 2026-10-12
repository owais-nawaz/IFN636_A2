const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET;

// Role authorization middleware — verifies a signed JWT, rejects forged/missing roles
function requireRole(allowedRoles) {
  return (req, res, next) => {
    const authHeader = req.headers['authorization'];
    if (!authHeader || !authHeader.startsWith('Bearer '))
      return res.status(401).json({ success: false, errors: ['Authentication required.'] });

    const token = authHeader.split(' ')[1];
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET || JWT_SECRET);
    } catch (err) {
      return res.status(401).json({ success: false, errors: ['Invalid or expired session — please log in again.'] });
    }

    if (!allowedRoles.includes(decoded.role))
      return res.status(403).json({ success: false, errors: [`Role "${decoded.role}" is not authorised for this action.`] });

    req.authenticatedUser = { username: decoded.username, role: decoded.role };
    next();
  };
}

module.exports = { requireRole };
