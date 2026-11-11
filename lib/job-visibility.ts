// Existing jobs hidden at the owner's request on 2026-10-30.
// Stable IDs keep them hidden after sync; new Airtable students remain eligible.
// Source records, Drive folders and workflow history are retained.
const hiddenJobIds = new Set<string>([
  "airtable-recFixture0001",
  "airtable-recFixture0002",
  "airtable-recFixture0003",
  "airtable-recFixture0004",
  "airtable-recFixture0005",
  "airtable-recFixture0006",
  "airtable-recFixture0007",
  "airtable-recFixture0008",
  "airtable-recFixture0009",
  "airtable-recFixture0010",
  "airtable-recFixture0011",
  "airtable-recFixture0012",
  "airtable-recFixture0013",
  "airtable-recFixture0014",
  "airtable-recFixture0015",
  "airtable-recFixture0016",
  "airtable-recFixture0017",
  "airtable-recFixture0018",
  "airtable-recFixture0019",
  "airtable-recFixture0020",
  "airtable-recFixture0021",
  "airtable-recFixture0022",
  "airtable-recFixture0023",
  "airtable-recFixture0024",
  "airtable-recFixture0025",
  "airtable-recFixture0026",
]);

export function isVisibleJob(jobId: string): boolean {
  return !hiddenJobIds.has(jobId);
}

