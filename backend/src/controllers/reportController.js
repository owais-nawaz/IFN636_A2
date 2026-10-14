const Bug = require('../models/Bug');
const ExportContext = require('../exporters/ExportContext');
const { UnsupportedFormatError } = ExportContext;

async function exportReport(req, res) {
  try {
    const { format } = req.query;
    if (!format)
      return res.status(400).json({ success: false, errors: ['Export format is required. Supported formats: csv, json.'] });

    // Built before the DB query so an unsupported format fails fast (throws UnsupportedFormatError)
    const exporter = new ExportContext(format);

    const bugs = await Bug.find().sort({ ticketId: 1 }).lean();

    const date = new Date().toISOString().slice(0, 10); // YYYY-MM-DD (UTC)
    res.setHeader('Content-Type', exporter.contentType);
    res.setHeader('Content-Disposition', `attachment; filename="bugs-report-${date}.${exporter.fileExtension}"`);
    res.send(exporter.export(bugs));
  } catch (err) {
    if (err instanceof UnsupportedFormatError)
      return res.status(err.statusCode).json({ success: false, errors: [err.message] });

    console.error('Export error:', err.message);
    res.status(500).json({ success: false, errors: ['Server error — could not generate report.'] });
  }
}

module.exports = { exportReport };
