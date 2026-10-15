// Summary service (FR-3): counts by status/severity and MTTR (mean time to resolve).
// Pure function, so the tests just pass in fixed bug objects. No stubs, no database.
const { expect } = require('chai');

const { summarise } = require('../src/services/reportSummaryService');

// A bug with sensible defaults; each test overrides only what it cares about
function makeBug(overrides = {}) {
  return {
    ticketId: 101, status: 'Open', severity: 'Medium',
    createdAt: new Date('2026-10-01T09:00:00Z'), resolvedAt: null,
    ...overrides,
  };
}

// Three resolved bugs with whole-hour gaps (used for the hand-calculated MTTR):
//   A: 09:00 -> 17:00 the same day         =  8 hours
//   B: 09:00 on 2 Oct -> 09:00 on 3 Oct    = 24 hours
//   C: 09:00 -> 13:00 the same day         =  4 hours
//   MTTR = (8 + 24 + 4) / 3 = 36 / 3 = 12 hours
const bugA = makeBug({ ticketId: 101, status: 'Resolved',
  createdAt: new Date('2026-10-01T09:00:00Z'), resolvedAt: new Date('2026-10-01T17:00:00Z') });
const bugB = makeBug({ ticketId: 102, status: 'Closed',
  createdAt: new Date('2026-10-02T09:00:00Z'), resolvedAt: new Date('2026-10-03T09:00:00Z') });
const bugC = makeBug({ ticketId: 103, status: 'Resolved',
  createdAt: new Date('2026-10-04T09:00:00Z'), resolvedAt: new Date('2026-10-04T13:00:00Z') });

describe('Report summary (FR-3)', () => {
  it('FR-3 AC1: counts by status and severity, with zeros included', () => {
    const result = summarise([
      makeBug({ status: 'Open', severity: 'High' }),
      makeBug({ status: 'Open', severity: 'Low' }),
      makeBug({ status: 'Resolved', severity: 'High' }),
    ]);

    expect(result.total).to.equal(3);
    expect(result.countsByStatus).to.deep.equal({
      'Open': 2, 'In Progress': 0, 'Resolved': 1, 'Closed': 0, 'Re-opened': 0,
    });
    expect(result.countsBySeverity).to.deep.equal({ Low: 1, Medium: 0, High: 2, Critical: 0 });
  });

  it('FR-3 AC1: an empty array gives zero counts and no MTTR', () => {
    expect(summarise([])).to.deep.equal({
      total: 0,
      countsByStatus: { 'Open': 0, 'In Progress': 0, 'Resolved': 0, 'Closed': 0, 'Re-opened': 0 },
      countsBySeverity: { Low: 0, Medium: 0, High: 0, Critical: 0 },
      mttrHours: null,
      mttrSampleSize: 0,
    });
  });

  it('FR-3 AC1: MTTR is the mean of 8, 24 and 4 hours = 12 hours', () => {
    const result = summarise([bugA, bugB, bugC]);

    expect(result.mttrHours).to.equal(12);
    expect(result.mttrSampleSize).to.equal(3);
  });

  it('FR-3 AC1: MTTR is rounded to 2 decimal places', () => {
    // gaps of 1h, 2h and 2h: 5 / 3 = 1.6666... -> 1.67
    const result = summarise([
      makeBug({ status: 'Resolved', resolvedAt: new Date('2026-10-01T10:00:00Z') }),
      makeBug({ status: 'Resolved', resolvedAt: new Date('2026-10-01T11:00:00Z') }),
      makeBug({ status: 'Closed',   resolvedAt: new Date('2026-10-01T11:00:00Z') }),
    ]);

    expect(result.mttrHours).to.equal(1.67);
  });

  it('FR-3 AC1: bugs without resolvedAt are left out of the average, not counted as zero', () => {
    const result = summarise([
      bugA, // 8 hours
      makeBug({ ticketId: 104, status: 'Resolved', resolvedAt: null }),      // resolved before the field existed
      makeBug({ ticketId: 105, status: 'Closed', resolvedAt: undefined }),   // field missing entirely
    ]);

    expect(result.total).to.equal(3);
    expect(result.mttrHours).to.equal(8);
    expect(result.mttrSampleSize).to.equal(1);
  });

  it('FR-3 AC1: a Re-opened bug with an old resolvedAt is not used for MTTR', () => {
    const reopened = makeBug({ ticketId: 106, status: 'Re-opened',
      createdAt: new Date('2026-10-01T09:00:00Z'), resolvedAt: new Date('2026-10-01T10:00:00Z') });

    const result = summarise([bugA, reopened]);

    expect(result.mttrHours).to.equal(8); // only bugA
    expect(result.mttrSampleSize).to.equal(1);
    expect(result.countsByStatus['Re-opened']).to.equal(1); // still counted by status
  });

  it('FR-3 AC1: In Progress and Open bugs with a leftover resolvedAt are not used either', () => {
    const result = summarise([
      makeBug({ status: 'In Progress', resolvedAt: new Date('2026-10-01T10:00:00Z') }),
      makeBug({ status: 'Open',        resolvedAt: new Date('2026-10-01T10:00:00Z') }),
    ]);

    expect(result.mttrSampleSize).to.equal(0);
  });

  it('FR-3 AC1: no usable bugs gives mttrHours null and sample size 0', () => {
    const result = summarise([
      makeBug({ status: 'Open' }),
      makeBug({ status: 'Resolved', resolvedAt: null }),
    ]);

    expect(result.total).to.equal(2);
    expect(result.mttrHours).to.be.null;
    expect(result.mttrSampleSize).to.equal(0);
  });

  it('FR-3 AC1: a resolvedAt before createdAt is skipped without crashing', () => {
    const backwards = makeBug({ ticketId: 107, status: 'Resolved',
      createdAt: new Date('2026-10-05T09:00:00Z'), resolvedAt: new Date('2026-10-05T08:00:00Z') });

    const result = summarise([bugA, backwards]);

    expect(result.mttrHours).to.equal(8);
    expect(result.mttrSampleSize).to.equal(1);
  });

  it('FR-3 AC1: invalid or missing dates are skipped without crashing', () => {
    const result = summarise([
      bugA,
      makeBug({ status: 'Resolved', resolvedAt: 'not-a-date' }),
      makeBug({ status: 'Resolved', createdAt: 'garbage', resolvedAt: new Date('2026-10-01T10:00:00Z') }),
      makeBug({ status: 'Resolved', createdAt: null, resolvedAt: new Date('2026-10-01T10:00:00Z') }),
    ]);

    expect(result.mttrHours).to.equal(8);
    expect(result.mttrSampleSize).to.equal(1);
  });

  it('FR-3 AC1: dates can be ISO strings or Date objects', () => {
    const result = summarise([
      makeBug({ status: 'Resolved', createdAt: '2026-10-01T09:00:00.000Z', resolvedAt: '2026-10-01T17:00:00.000Z' }), // 8h
      makeBug({ status: 'Closed',   createdAt: new Date('2026-10-04T09:00:00Z'), resolvedAt: '2026-10-04T13:00:00.000Z' }), // 4h
    ]);

    expect(result.mttrHours).to.equal(6); // (8 + 4) / 2
    expect(result.mttrSampleSize).to.equal(2);
  });

  it('FR-3 AC1: a bug resolved at the same moment it was created counts as 0 hours', () => {
    const instant = makeBug({ status: 'Resolved', resolvedAt: new Date('2026-10-01T09:00:00Z') });

    const result = summarise([instant]);

    expect(result.mttrHours).to.equal(0);
    expect(result.mttrSampleSize).to.equal(1);
  });

  it('FR-3 AC1: an unknown status or severity counts in the total but in no bucket', () => {
    const result = summarise([makeBug({ status: 'Archived', severity: 'Urgent' })]);

    expect(result.total).to.equal(1);
    expect(Object.values(result.countsByStatus).every(n => n === 0)).to.be.true;
    expect(Object.values(result.countsBySeverity).every(n => n === 0)).to.be.true;
  });

  it('FR-3 AC1: does not change the bugs it is given', () => {
    const bugs = [bugA, bugB, makeBug({ status: 'Re-opened', resolvedAt: new Date('2026-10-01T10:00:00Z') })];
    const before = JSON.stringify(bugs);

    summarise(bugs);

    expect(JSON.stringify(bugs)).to.equal(before);
  });
});
