"use strict";
// BIA's ingestion contract, not a representation of any vendor API.
// Implement read({from,to}) in a server-side adapter after receiving its contract.
class MockAdapter {
  async read({ from = "2026-09-01" } = {}) {
    return [
      {
        site_id: "marzin",
        code: "trs",
        period: from,
        value: 82,
        target: 85,
        definition: "EXEMPLE FICTIF — temps utile / temps requis, site entier",
        source: "MOCK SEQUOIA — aucune connexion",
        entry_mode: "import",
      },
    ];
  }
}
function toCSV(rows) {
  const columns = [
    "site_id",
    "workshop_id",
    "code",
    "period",
    "value",
    "target",
    "definition",
    "source",
  ];
  const cell = (value) => '"' + String(value ?? "").replaceAll('"', '""') + '"';
  return (
    [
      columns.join(","),
      ...rows.map((row) => columns.map((key) => cell(row[key])).join(",")),
    ].join("\n") + "\n"
  );
}
module.exports = { MockAdapter, toCSV };
if (require.main === module)
  new MockAdapter()
    .read({ from: process.argv[2] })
    .then((rows) => process.stdout.write(toCSV(rows)))
    .catch((error) => {
      console.error(error.message);
      process.exitCode = 1;
    });
