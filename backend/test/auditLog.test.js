const { expect } = require('chai');
const sinon = require('sinon');
const mongoose = require('mongoose');

const AuditLog = require('../src/models/AuditLog');

describe('AuditLog Model (BTS2-17)', () => {
  afterEach(() => sinon.restore());

  it('BTS2-17: validates successfully when all required fields are provided', async () => {
    const validData = {
      bugId: 101,
      action: 'CLAIM',
      changedBy: 'dev_alex',
      assignee: 'dev_alex',
      fieldChanged: 'status',
      prevValue: 'Open',
      newValue: 'In Progress',
    };

    const doc = new AuditLog(validData);
    let error;
    try {
      await doc.validate();
    } catch (err) {
      error = err;
    }

    expect(error).to.be.undefined;
    expect(doc.bugId).to.equal(101);
    expect(doc.action).to.equal('CLAIM');
    expect(doc.changedBy).to.equal('dev_alex');
    expect(doc.assignee).to.equal('dev_alex');
    expect(doc.fieldChanged).to.equal('status');
    expect(doc.prevValue).to.equal('Open');
    expect(doc.newValue).to.equal('In Progress');
    expect(doc.timestamp).to.be.instanceOf(Date);
  });

  it('BTS2-17 (validation): rejects when required fields are missing', async () => {
    const emptyDoc = new AuditLog({});
    let error;
    try {
      await emptyDoc.validate();
    } catch (err) {
      error = err;
    }

    expect(error).to.exist;
    expect(error.errors.bugId).to.exist;
    expect(error.errors.action).to.exist;
    expect(error.errors.changedBy).to.exist;
    expect(error.errors.fieldChanged).to.exist;
  });

  it('BTS2-17 (enum): rejects an invalid action value', async () => {
    const doc = new AuditLog({
      bugId: 101,
      action: 'INVALID_ACTION',
      changedBy: 'dev_alex',
      fieldChanged: 'status',
    });
    let error;
    try {
      await doc.validate();
    } catch (err) {
      error = err;
    }

    expect(error).to.exist;
    expect(error.errors.action).to.exist;
    expect(error.errors.action.message).to.include('is not a valid enum value');
  });

  it('BTS2-17 (enum): accepts team event contracts as action values', async () => {
    const doc = new AuditLog({
      bugId: 101,
      action: 'bug.claimed',
      changedBy: 'dev_alex',
      fieldChanged: 'status',
    });
    let error;
    try {
      await doc.validate();
    } catch (err) {
      error = err;
    }

    expect(error).to.be.undefined;
  });

  it('BTS2-17 (enum): rejects an invalid fieldChanged value', async () => {
    const doc = new AuditLog({
      bugId: 101,
      action: 'UPDATE',
      changedBy: 'dev_alex',
      fieldChanged: 'nonExistentField',
    });
    let error;
    try {
      await doc.validate();
    } catch (err) {
      error = err;
    }

    expect(error).to.exist;
    expect(error.errors.fieldChanged).to.exist;
  });

  it('BTS2-17 (defaults): defaults assignee to "Unassigned"', () => {
    const doc = new AuditLog({
      bugId: 102,
      action: 'CREATE',
      changedBy: 'tester_sarah',
      fieldChanged: 'bug',
    });

    expect(doc.assignee).to.equal('Unassigned');
    expect(doc.timestamp).to.be.instanceOf(Date);
  });

  it('BTS2-17 (virtuals): exposes id virtual matching hex string of _id', () => {
    const objectId = new mongoose.Types.ObjectId();
    const doc = new AuditLog({
      _id: objectId,
      bugId: 101,
      action: 'CLAIM',
      changedBy: 'dev_alex',
      fieldChanged: 'status',
    });

    expect(doc.id).to.equal(objectId.toHexString());
    const json = doc.toJSON();
    expect(json.id).to.equal(objectId.toHexString());
  });

  it('BTS2-17 (virtuals): exposes actingUser getter and setter aliased to changedBy', () => {
    const doc = new AuditLog({
      bugId: 101,
      action: 'CLAIM',
      changedBy: 'dev_alex',
      fieldChanged: 'status',
    });

    expect(doc.actingUser).to.equal('dev_alex');
    doc.actingUser = 'tester_sarah';
    expect(doc.changedBy).to.equal('tester_sarah');
  });

  it('BTS2-17 (indexes): defines compound index on bugId and timestamp', () => {
    const indexes = AuditLog.schema.indexes();
    const hasBugTimestampIndex = indexes.some(
      ([spec]) => spec.bugId === 1 && spec.timestamp === -1
    );
    expect(hasBugTimestampIndex).to.be.true;
  });
});
