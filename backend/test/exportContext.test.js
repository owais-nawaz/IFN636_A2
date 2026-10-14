// ExportContext picks the right export strategy for a format string (Strategy pattern).
const { expect } = require('chai');

const ExportContext = require('../src/exporters/ExportContext');
const { UnsupportedFormatError } = ExportContext;
const CsvExportStrategy = require('../src/exporters/CsvExportStrategy');
const JsonExportStrategy = require('../src/exporters/JsonExportStrategy');

function catchError(fn) {
  try { fn(); } catch (err) { return err; }
  return null;
}

describe('ExportContext (FR-3)', () => {
  it('FR-3 AC5: picks the CSV strategy for "csv"', () => {
    const ctx = new ExportContext('csv');

    expect(ctx.strategy).to.be.instanceOf(CsvExportStrategy);
    expect(ctx.contentType).to.equal('text/csv');
    expect(ctx.fileExtension).to.equal('csv');
  });

  it('FR-3 AC5: picks the JSON strategy for "json"', () => {
    const ctx = new ExportContext('json');

    expect(ctx.strategy).to.be.instanceOf(JsonExportStrategy);
    expect(ctx.contentType).to.equal('application/json');
    expect(ctx.fileExtension).to.equal('json');
  });

  it('FR-3 AC5: format is case-insensitive and ignores surrounding spaces', () => {
    expect(new ExportContext('CSV').strategy).to.be.instanceOf(CsvExportStrategy);
    expect(new ExportContext(' Json ').strategy).to.be.instanceOf(JsonExportStrategy);
  });

  it('FR-3 AC5: export() delegates to the chosen strategy', () => {
    const csvOutput = new ExportContext('csv').export([]);
    const jsonOutput = new ExportContext('json').export([]);

    expect(csvOutput).to.equal(new CsvExportStrategy().export([]));
    expect(jsonOutput).to.equal('[]');
  });

  it('FR-3 AC4 (400): throws UnsupportedFormatError with statusCode 400 for an unknown format', () => {
    const err = catchError(() => new ExportContext('xml'));

    expect(err).to.be.instanceOf(UnsupportedFormatError);
    expect(err.statusCode).to.equal(400);
    expect(err.message).to.equal('Unsupported export format "xml". Supported formats: csv, json.');
  });

  it('FR-3 AC4 (400): rejects non-string and inherited-property formats', () => {
    [undefined, null, 42, 'constructor', 'toString'].forEach(format => {
      const err = catchError(() => new ExportContext(format));

      expect(err, `format ${String(format)}`).to.be.instanceOf(UnsupportedFormatError);
      expect(err.statusCode).to.equal(400);
    });
  });
});
