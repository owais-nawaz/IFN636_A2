// CsvExportStrategy: header row, RFC 4180 quoting, formula protection, field list.
const { expect } = require('chai');

const CsvExportStrategy = require('../src/exporters/CsvExportStrategy');

const HEADER = 'ticketId,title,module,severity,priority,status,reporter,assignee,'
  + 'resolutionType,resolutionNotes,qaNotes,createdAt,updatedAt,resolvedAt';

// Comma + quotes in the title; includes Mongo's _id/__v, which must not be exported
const commaQuoteBug = {
  _id: 'abc123', __v: 0,
  ticketId: 101, title: 'Login fails, says "invalid"', module: 'Auth',
  severity: 'High', priority: 'High', description: 'Valid credentials rejected',
  status: 'Resolved', reporter: 'tester_sarah', assignee: 'dev_alex',
  resolutionType: 'Fix', resolutionNotes: 'Patched', qaNotes: null,
  createdAt: new Date('2026-10-01T09:00:00Z'), updatedAt: new Date('2026-10-02T10:30:00Z'),
};

// Title starting with "=" and several fields missing entirely
const formulaBug = {
  ticketId: 102, title: '=HYPERLINK("http://example.com")', module: 'Dashboard',
  severity: 'Low', priority: 'Medium', status: 'Open',
  reporter: 'tester_sarah', assignee: 'Unassigned',
  createdAt: new Date('2026-10-03T08:15:00Z'), updatedAt: new Date('2026-10-03T08:15:00Z'),
};

describe('CsvExportStrategy (FR-3)', () => {
  const csv = new CsvExportStrategy();

  it('FR-3 AC2: reports text/csv and the csv extension', () => {
    expect(csv.contentType).to.equal('text/csv');
    expect(csv.fileExtension).to.equal('csv');
  });

  it('FR-3 AC2: first line is the fixed header row', () => {
    const [header] = csv.export([commaQuoteBug]).split('\r\n');

    expect(header).to.equal(HEADER);
  });

  it('FR-3 AC2: exporting no bugs gives just the header row', () => {
    expect(csv.export([])).to.equal(HEADER);
  });

  it('FR-3 AC2: a title with a comma and quotes is wrapped in quotes with inner quotes doubled', () => {
    const [, row] = csv.export([commaQuoteBug]).split('\r\n');

    expect(row).to.equal(
      '101,"Login fails, says ""invalid""",Auth,High,High,Resolved,tester_sarah,dev_alex,'
      + 'Fix,Patched,,2026-10-01T09:00:00.000Z,2026-10-02T10:30:00.000Z,'
    );
  });

  it('FR-3 AC2: a title starting with "=" gets a leading apostrophe', () => {
    const [, row] = csv.export([formulaBug]).split('\r\n');

    expect(row).to.equal(
      `102,"'=HYPERLINK(""http://example.com"")",Dashboard,Low,Medium,Open,tester_sarah,Unassigned,`
      + ',,,2026-10-03T08:15:00.000Z,2026-10-03T08:15:00.000Z,'
    );
  });

  it('FR-3 AC2: +, - and @ prefixes are guarded too, but real numbers are left alone', () => {
    const lines = csv.export([
      { ticketId: -5, title: '+cmd', module: '-cmd', severity: '@cmd' },
    ]).split('\r\n');

    expect(lines[1].startsWith('-5,\'+cmd,\'-cmd,\'@cmd,')).to.be.true;
  });

  it('FR-3 AC2: a value containing a line break is quoted and the break is kept', () => {
    const output = csv.export([{ ticketId: 1, resolutionNotes: 'line1\nline2' }]);
    const [, row] = output.split('\r\n');

    expect(row).to.equal('1,,,,,,,,,"line1\nline2",,,,');
  });

  it('FR-3 AC2: _id and __v are not exported', () => {
    const output = csv.export([commaQuoteBug]);

    expect(output.split('\r\n')[0].split(',')).to.not.include.members(['_id', '__v']);
    expect(output).to.not.include('abc123');
  });

  it('FR-3 AC2: missing, null and undefined values become empty cells', () => {
    const [, row] = csv.export([{ ticketId: 7, qaNotes: null, resolutionType: undefined }]).split('\r\n');

    expect(row).to.equal('7' + ','.repeat(13)); // 14 columns -> 13 commas
  });
});
