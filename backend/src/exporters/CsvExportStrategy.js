const ReportExporter = require('./ReportExporter');
const EXPORT_FIELDS  = require('./exportFields');

// Excel/Sheets treat cells starting with these characters as formulas
const FORMULA_PREFIX = /^[=+\-@\t\r]/;

function formatCell(value) {
  if (value === null || value === undefined) return '';

  let text = value instanceof Date ? value.toISOString() : String(value);

  // Neutralise spreadsheet formulas — strings only, so numbers (e.g. -5) are untouched
  if (typeof value === 'string' && FORMULA_PREFIX.test(text)) text = `'${text}`;

  // RFC 4180: quote values containing comma, quote or line break; double inner quotes
  if (/[",\r\n]/.test(text)) text = `"${text.replace(/"/g, '""')}"`;

  return text;
}

class CsvExportStrategy extends ReportExporter {
  get contentType()   { return 'text/csv'; }
  get fileExtension() { return 'csv'; }

  export(bugs) {
    const header = EXPORT_FIELDS.join(',');
    const rows   = bugs.map(bug => EXPORT_FIELDS.map(field => formatCell(bug[field])).join(','));
    return [header, ...rows].join('\r\n');
  }
}

module.exports = CsvExportStrategy;
