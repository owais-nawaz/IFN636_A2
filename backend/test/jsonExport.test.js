// JsonExportStrategy: indented output, same fields as the CSV, values left unchanged.
const { expect } = require('chai');

const JsonExportStrategy = require('../src/exporters/JsonExportStrategy');
const CsvExportStrategy = require('../src/exporters/CsvExportStrategy');

const bugs = [
  {
    _id: 'abc123', __v: 0,
    ticketId: 101, title: 'Login fails, says "invalid"', module: 'Auth',
    severity: 'High', priority: 'High', description: 'Valid credentials rejected',
    status: 'Resolved', reporter: 'tester_sarah', assignee: 'dev_alex',
    resolutionType: 'Fix', resolutionNotes: 'Patched', qaNotes: null,
    createdAt: new Date('2026-10-01T09:00:00Z'), updatedAt: new Date('2026-10-02T10:30:00Z'),
  },
  {
    ticketId: 102, title: '=HYPERLINK("http://example.com")', module: 'Dashboard',
    severity: 'Low', priority: 'Medium', status: 'Open',
    reporter: 'tester_sarah', assignee: 'Unassigned',
    createdAt: new Date('2026-10-03T08:15:00Z'), updatedAt: new Date('2026-10-03T08:15:00Z'),
  },
];

describe('JsonExportStrategy (FR-3)', () => {
  const json = new JsonExportStrategy();

  it('FR-3 AC3: reports application/json and the json extension', () => {
    expect(json.contentType).to.equal('application/json');
    expect(json.fileExtension).to.equal('json');
  });

  it('FR-3 AC3: output is a JSON array indented with 2 spaces', () => {
    const output = json.export(bugs);

    expect(output).to.be.a('string');
    expect(output.startsWith('[\n  {\n    "ticketId": 101,')).to.be.true;
    expect(output).to.equal(JSON.stringify(JSON.parse(output), null, 2));
    expect(JSON.parse(output)).to.have.lengthOf(2);
  });

  it('FR-3 AC3: exporting no bugs gives an empty array', () => {
    expect(json.export([])).to.equal('[]');
  });

  it('FR-3 AC3: every row has the same fields as the CSV header, with no _id or __v', () => {
    const csvHeader = new CsvExportStrategy().export([]).split(',');
    const rows = JSON.parse(json.export(bugs));

    rows.forEach(row => expect(Object.keys(row)).to.deep.equal(csvHeader));
    expect(Object.keys(rows[0])).to.not.include.members(['_id', '__v']);
  });

  it('FR-3 AC3: a title starting with "=" is left unchanged (no apostrophe in JSON)', () => {
    const rows = JSON.parse(json.export(bugs));

    expect(rows[1].title).to.equal('=HYPERLINK("http://example.com")');
    expect(rows[0].title).to.equal('Login fails, says "invalid"');
  });

  it('FR-3 AC3: missing values become null and dates become ISO strings', () => {
    const [first, second] = JSON.parse(json.export(bugs));

    expect(first.qaNotes).to.be.null;
    expect(second.resolutionType).to.be.null;
    expect(second.resolvedAt).to.be.null;
    expect(first.createdAt).to.equal('2026-10-01T09:00:00.000Z');
  });
});
