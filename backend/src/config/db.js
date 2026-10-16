const mongoose = require('mongoose');

// "mongodb+srv://user:pass@cluster0.x.mongodb.net/db?opts" -> "cluster0.x.mongodb.net"
function safeHost(url) {
  if (!url) return '(MONGO_URL not set)';
  const match = url.match(/^mongodb(?:\+srv)?:\/\/(?:[^@/]*@)?([^/?]+)/);
  return match ? match[1] : '(unrecognised MONGO_URL)';
}

async function connectDB() {
  const MONGO_URL = process.env.MONGO_URL;
  // Log the host only: the full URL contains the database password, and on
  // EC2 these lines end up in the pm2 logs.
  console.log('Connecting to MongoDB at:', safeHost(MONGO_URL));
  await mongoose.connect(MONGO_URL);
  console.log('MongoDB connected.');
}

module.exports = connectDB;
module.exports.safeHost = safeHost;
