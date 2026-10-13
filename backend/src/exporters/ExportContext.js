const CsvExportStrategy  = require('./CsvExportStrategy');
const JsonExportStrategy = require('./JsonExportStrategy');

const STRATEGIES = {
  csv:  CsvExportStrategy,
  json: JsonExportStrategy,
};

// Thrown for unknown formats — a controller can answer with err.statusCode (400)
class UnsupportedFormatError extends Error {
  constructor(format) {
    super(`Unsupported export format "${format}". Supported formats: ${Object.keys(STRATEGIES).join(', ')}.`);
    this.name = 'UnsupportedFormatError';
    this.statusCode = 400;
  }
}

class ExportContext {
  constructor(format) {
    const key = typeof format === 'string' ? format.trim().toLowerCase() : '';
    const Strategy = Object.hasOwn(STRATEGIES, key) ? STRATEGIES[key] : null;
    if (!Strategy) throw new UnsupportedFormatError(format);
    this.strategy = new Strategy();
  }

  get contentType()   { return this.strategy.contentType; }
  get fileExtension() { return this.strategy.fileExtension; }

  export(bugs) {
    return this.strategy.export(bugs);
  }
}

module.exports = ExportContext;
module.exports.UnsupportedFormatError = UnsupportedFormatError;
