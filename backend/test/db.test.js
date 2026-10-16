// The startup log must never contain the database password (it ends up in
// the pm2 logs on EC2): only the MongoDB host is printed.
const { expect } = require('chai');

const { safeHost } = require('../src/config/db');

describe('MongoDB startup log (bug fix)', () => {
  it('logs only the host of an Atlas mongodb+srv URL, never the password', () => {
    const host = safeHost('mongodb+srv://bugtracker_user:s3cret@cluster0.abc12.mongodb.net/?appName=Cluster0');

    expect(host).to.equal('cluster0.abc12.mongodb.net');
    expect(host).to.not.include('s3cret');
  });

  it('handles a local mongodb URL without credentials', () => {
    expect(safeHost('mongodb://localhost:27017/bugtracker')).to.equal('localhost:27017');
  });

  it('says so when MONGO_URL is missing or not a MongoDB URL', () => {
    expect(safeHost(undefined)).to.equal('(MONGO_URL not set)');
    expect(safeHost('user:pass@somewhere')).to.equal('(unrecognised MONGO_URL)');
  });
});
