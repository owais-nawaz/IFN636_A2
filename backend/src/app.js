const fs      = require('fs');
const os      = require('os');
const path    = require('path');
const express = require('express');
const cors    = require('cors');

const authRoutes         = require('./routes/authRoutes');
const bugRoutes          = require('./routes/bugRoutes');
const slaRoutes          = require('./routes/slaRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const reportRoutes       = require('./routes/reportRoutes');
const { writeLimiter }   = require('./middleware/rateLimit');

const app = express();

// Behind the ALB, take the client IP from the one X-Forwarded-For hop it adds.
app.set('trust proxy', 1);

app.use(cors());
app.use(express.json());

// ALB health check. Also says which instance answered (INSTANCE_NAME in each
// server's .env, e.g. EC2-NodeA; the hostname if unset), so a curl loop through
// the ALB shows traffic alternating between instances.
app.get('/api/health', (req, res) => {
  const instance = process.env.INSTANCE_NAME || os.hostname();
  res.set('X-Served-By', instance);
  res.json({ status: 'Bug Tracking System API running', instance, port: process.env.PORT || 3000 });
});

app.use('/api', writeLimiter);
app.use('/api/auth', authRoutes);
app.use('/api/bugs', bugRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/sla',  slaRoutes);
app.use('/api/notifications', notificationRoutes);

// Static files & SPA fallback for the built React frontend
const distPath  = path.join(__dirname, '../../frontend/dist');
const indexPath = path.join(distPath, 'index.html');

app.use(express.static(distPath));

// Unhandled API routes return a JSON 404
app.use('/api', (req, res) => {
  res.status(404).json({ success: false, errors: ['API endpoint not found'] });
});

// SPA fallback: return index.html for any GET request outside /api
app.get('{*path}', (req, res) => {
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.status(404).send('Frontend build not found. Run "npm run build" in frontend directory.');
  }
});

module.exports = app;

