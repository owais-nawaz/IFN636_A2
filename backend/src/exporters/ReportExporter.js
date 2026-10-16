// Base class (the "Strategy" interface). Subclasses override all three members.
class ReportExporter {
  get contentType() {
    throw new Error('contentType not implemented');
  }

  get fileExtension() {
    throw new Error('fileExtension not implemented');
  }

  export(bugs) { // eslint-disable-line no-unused-vars
    throw new Error('export() not implemented');
  }
}

module.exports = ReportExporter;
