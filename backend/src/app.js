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

app.get('/api/health', (req, res) => {
  res.json({ status: 'Bug Tracking System API running', port: process.env.PORT || 3000 });
});

app.use('/api', writeLimiter);
app.use('/api/auth', authRoutes);
app.use('/api/bugs', bugRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/sla',  slaRoutes);
app.use('/api/notifications', notificationRoutes);

module.exports = app;
