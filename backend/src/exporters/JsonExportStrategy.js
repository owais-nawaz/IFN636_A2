const ReportExporter = require('./ReportExporter');
const EXPORT_FIELDS  = require('./exportFields');

class JsonExportStrategy extends ReportExporter {
  get contentType()   { return 'application/json'; }
  get fileExtension() { return 'json'; }

  export(bugs) {
    // Keep only the shared export fields; a missing field (e.g. resolvedAt) becomes null
    const rows = bugs.map(bug => {
      const row = {};
      EXPORT_FIELDS.forEach(field => { row[field] = bug[field] ?? null; });
      return row;
    });
    return JSON.stringify(rows, null, 2);
  }
}

module.exports = JsonExportStrategy;
