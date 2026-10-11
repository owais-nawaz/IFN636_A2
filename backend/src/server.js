require('dotenv').config();

const app           = require('./app');
const connectDB     = require('./config/db');
const seedDemoUsers = require('./utils/seed');

const PORT = process.env.PORT || 3000;

connectDB()
  .then(() => seedDemoUsers())
  .catch(err => console.error('MongoDB connection failed:', err.message));

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
