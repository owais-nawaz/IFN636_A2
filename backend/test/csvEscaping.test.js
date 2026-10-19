// CSV cell escaping (NFR-3): runs every case from fixtures/csvEscapingCases.js through formatCell.
const { expect } = require('chai');

const { formatCell } = require('../src/exporters/CsvExportStrategy');
const csvEscapingCases = require('./fixtures/csvEscapingCases');

describe('CSV cell escaping (NFR-3)', () => {
  it('NFR-3: the fixture has the quoting cases and the formula cases', () => {
    const names = csvEscapingCases.map(c => c.name);

    expect(names.filter(n => n.startsWith('AC2'))).to.have.length.of.at.least(5);
    expect(names.filter(n => n.startsWith('AC3'))).to.have.length.of.at.least(8);
  });

  csvEscapingCases.forEach(({ name, input, expected }) => {
    it(`NFR-3 ${name}`, () => {
      expect(formatCell(input)).to.equal(expected);
    });
  });
});
