const express = require('express');
const cors    = require('cors');

const authRoutes = require('./routes/authRoutes');
const bugRoutes  = require('./routes/bugRoutes');

const app = express();

app.use(cors());
app.use(express.json());

app.get('/api/health', (req, res) => {
  res.json({ status: 'Bug Tracking System API running', port: process.env.PORT || 3000 });
});

app.use('/api/auth', authRoutes);
app.use('/api/bugs', bugRoutes);

module.exports = app;
