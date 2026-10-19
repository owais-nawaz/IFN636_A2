// Export throughput (NFR-3 AC1): generating an export of 1,000 bug records takes under 350ms.
// Measures generation only: no database, no HTTP. Data is built without randomness so
// every run does exactly the same work.
const { expect } = require('chai');
const { performance } = require('node:perf_hooks');

const ExportContext = require('../src/exporters/ExportContext');

const RECORD_COUNT = 1000;
const LIMIT_MS     = 350;
const TIMED_RUNS   = 3;

// Titles that force the escaping path: comma, quotes, line break, leading formula character
const TRICKY_TITLES = [
  i => `Login fails, says "invalid" (case ${i})`,
  i => `=HYPERLINK("http://example.com/${i}")`,
  i => `Crash on save\nstack trace follows (case ${i})`,
  i => `+cmd|' /C calc'!A0 (case ${i})`,
];

function buildBugs(count) {
  const bugs = [];
  for (let i = 0; i < count; i += 1) {
    const tricky = i % 3 === 0; // about a third of the records
    bugs.push({
      ticketId: 101 + i,
      title: tricky ? TRICKY_TITLES[Math.floor(i / 3) % TRICKY_TITLES.length](i) : `Ordinary bug number ${i}`,
      module: ['Auth', 'Dashboard', 'Bug Form'][i % 3],
      severity: ['Low', 'Medium', 'High', 'Critical'][i % 4],
      priority: ['Low', 'Medium', 'High', 'Critical'][(i + 1) % 4],
      status: ['Open', 'In Progress', 'Resolved', 'Closed', 'Re-opened'][i % 5],
      reporter: 'tester_sarah',
      assignee: i % 2 === 0 ? 'dev_alex' : 'Unassigned',
      resolutionType: i % 5 === 2 ? 'Code Fix' : null,
      resolutionNotes: tricky ? 'Fixed the check, then re-tested "twice"' : 'Resolved in the next build.',
      qaNotes: i % 7 === 0 ? '-regression found, see notes' : null,
      createdAt: new Date(Date.UTC(2026, 9, 1, 9, 0, 0) + i * 60000),
      updatedAt: new Date(Date.UTC(2026, 9, 2, 9, 0, 0) + i * 60000),
      resolvedAt: i % 5 === 2 ? new Date(Date.UTC(2026, 9, 1, 17, 0, 0) + i * 60000) : null,
    });
  }
  return bugs;
}

// One warm-up run (lets the JIT compile), then the fastest of a few timed runs.
// Returns { ms, output } so the caller can also check the output is real.
function timeExport(format, bugs) {
  const context = new ExportContext(format);
  context.export(bugs); // warm-up, not timed

  let fastest = Infinity;
  let output;
  for (let run = 0; run < TIMED_RUNS; run += 1) {
    const start = performance.now();
    output = context.export(bugs);
    fastest = Math.min(fastest, performance.now() - start);
  }
  return { ms: fastest, output };
}

describe('Export throughput (NFR-3)', () => {
  const bugs = buildBugs(RECORD_COUNT);

  it('NFR-3 AC1: the test data really exercises the escaping path', () => {
    const tricky = bugs.filter(b => /[,"\n]|^[=+\-@]/.test(b.title));

    expect(bugs).to.have.lengthOf(RECORD_COUNT);
    expect(tricky.length).to.be.within(RECORD_COUNT * 0.3, RECORD_COUNT * 0.4);
  });

  it(`NFR-3 AC1: CSV export of ${RECORD_COUNT} bugs completes in under ${LIMIT_MS}ms`, () => {
    const { ms, output } = timeExport('csv', bugs);
    console.log(`      CSV  ${RECORD_COUNT} records: ${ms.toFixed(2)}ms (limit ${LIMIT_MS}ms)`);

    expect(output.split('\r\n').length).to.be.at.least(RECORD_COUNT + 1); // header + rows
    expect(ms).to.be.below(LIMIT_MS);
  });

  it(`NFR-3 AC1: JSON export of ${RECORD_COUNT} bugs completes in under ${LIMIT_MS}ms`, () => {
    const { ms, output } = timeExport('json', bugs);
    console.log(`      JSON ${RECORD_COUNT} records: ${ms.toFixed(2)}ms (limit ${LIMIT_MS}ms)`);

    expect(JSON.parse(output)).to.have.lengthOf(RECORD_COUNT);
    expect(ms).to.be.below(LIMIT_MS);
  });
});
