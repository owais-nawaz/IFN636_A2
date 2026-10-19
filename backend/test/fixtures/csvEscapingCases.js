// Test cases for CSV cell escaping (NFR-3). Not a test file: it only exports data, and
// csvEscaping.test.js runs each case. `expected` is the exact text of the CSV cell, written
// by hand from the acceptance criteria:
//   AC2: a cell containing a comma or double quote is wrapped in double quotes
//        (inner quotes are doubled, the standard CSV rule)
//   AC3: a string starting with =, +, - or @ gets a leading apostrophe
const csvEscapingCases = [
  // AC2: quoting
  { name: 'AC2: a comma wraps the cell in double quotes',
    input: 'Hello, world',            expected: '"Hello, world"' },
  { name: 'AC2: a double quote wraps the cell in double quotes and doubles the quote',
    input: 'say "hi"',                expected: '"say ""hi"""' },
  { name: 'AC2: a comma and a double quote together are both handled',
    input: 'a, "b"',                  expected: '"a, ""b"""' },
  { name: 'AC2: a line break wraps the cell in double quotes and is kept',
    input: 'line1\nline2',            expected: '"line1\nline2"' },
  { name: 'AC2: plain text is left unchanged',
    input: 'Plain text',              expected: 'Plain text' },

  // AC3: formula neutralisation
  { name: 'AC3: a string starting with = gets a leading apostrophe',
    input: '=1+1',                    expected: "'=1+1" },
  { name: 'AC3: a string starting with + gets a leading apostrophe',
    input: '+1+1',                    expected: "'+1+1" },
  { name: 'AC3: a string starting with - gets a leading apostrophe',
    input: '-2+3',                    expected: "'-2+3" },
  { name: 'AC3: a string starting with @ gets a leading apostrophe',
    input: '@SUM(A1)',                expected: "'@SUM(A1)" },
  { name: 'AC3: a string starting with a tab gets a leading apostrophe',
    input: '\tcmd',                   expected: "'\tcmd" },
  { name: 'AC3: a string starting with a carriage return gets a leading apostrophe (and is quoted, being a line break)',
    input: '\rcmd',                   expected: '"\'\rcmd"' },
  { name: 'AC3: a formula containing quotes gets the apostrophe and the quoting',
    input: '=HYPERLINK("http://x")',  expected: '"\'=HYPERLINK(""http://x"")"' },
  { name: 'AC3: a real number such as -5 is left unchanged',
    input: -5,                        expected: '-5' },
];

module.exports = csvEscapingCases;
