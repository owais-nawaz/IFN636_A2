const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

async function signup(req, res) {
  try {
    const { username, email, password, role } = req.body;
    const errors = [];
    if (!username || username.trim().length < 3) errors.push('Username must be at least 3 characters.');
    if (!email || !email.includes('@'))          errors.push('Valid email is required.');
    if (!password || password.length < 4)        errors.push('Password must be at least 4 characters.');
    if (errors.length) return res.status(400).json({ success: false, errors });

    const existing = await User.findOne({ $or: [{ username: username.trim() }, { email: email.toLowerCase() }] });
    if (existing) return res.status(400).json({ success: false, errors: ['Username or email already registered.'] });

    const hashed   = await bcrypt.hash(password, 10);
    const userRole = ['Tester', 'Developer', 'QALead'].includes(role) ? role : 'Tester';
    const user     = await User.create({ username: username.trim(), email: email.toLowerCase(), password: hashed, role: userRole });

    const token = jwt.sign({ username: user.username, role: user.role }, process.env.JWT_SECRET, { expiresIn: '2h' });

    res.status(201).json({
      success: true,
      message: `Account created for ${user.username}.`,
      user: { username: user.username, email: user.email, role: user.role },
      token,
    });
  } catch (err) {
    console.error('Signup error:', err.message);
    res.status(500).json({ success: false, errors: ['Server error — check MongoDB connection.'] });
  }
}

async function login(req, res) {
  try {
    const { username, password } = req.body;
    if (!username || !password)
      return res.status(400).json({ success: false, errors: ['Username and password are required.'] });

    const user = await User.findOne({ username: username.trim() });
    if (!user || !(await bcrypt.compare(password, user.password)))
      return res.status(401).json({ success: false, errors: ['Invalid username or password.'] });

    const token = jwt.sign({ username: user.username, role: user.role }, process.env.JWT_SECRET, { expiresIn: '2h' });

    res.json({
      success: true,
      message: `Welcome back, ${user.username}!`,
      user: { username: user.username, email: user.email, role: user.role },
      token,
    });
  } catch (err) {
    console.error('Login error:', err.message);
    res.status(500).json({ success: false, errors: ['Server error — check MongoDB connection.'] });
  }
}

module.exports = { signup, login };
