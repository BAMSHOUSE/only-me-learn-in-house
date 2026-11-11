export const spreadsheetId = 'GOOGLE_SHEET_ID';
export const salesTab = 'Transaction Sales';

// Verified mappings at the Transaction Sales cutover preserve historical job IDs.
const historicalOrders: Record<string, string> = {
  "O23": "recFixture0018",
  "O24": "recFixture0015",
  "O25": "recFixture0007",
  "O26": "recFixture0009",
  "O27": "recFixture0011",
  "O28": "recFixture0004",
  "O29": "recFixture0026",
  "O30": "recFixture0017",
  "O31": "recFixture0002",
  "O32": "recFixture0003",
  "O33": "recFixture0010",
  "O34": "recFixture0022",
  "O35": "recFixture0013",
  "O36": "recFixture0005",
  "O37": "recFixture0021",
  "O38": "recFixture0025",
  "O39": "recFixture0019",
  "O41": "recFixture0008",
  "O42": "recFixture0016",
  "O43": "recFixture0023",
  "O44": "recFixture0024",
  "O45": "recFixture0014",
  "O46": "recFixture0001",
  "O47": "recFixture0012",
  "O48": "recFixture0027",
  "O49": "recFixture0028",
  "O50": "recFixture0029"
};

export const sheetsInstructions = `Only Me Learn production sync. Read the latest source returned by sync_status. The authoritative spreadsheet is ${spreadsheetId}, tab Transaction Sales (gid SALES_TAB_GID). Read this sales ledger without editing its cells. Supreme uses its independent schedule.
Use the verified owner connection for owner@example.com. Follow schedule.checkDue. When false, retry only if retryAfterSeconds is positive; otherwise finish quietly. When true:
1. Inspect metadata and trimmed headers. Read all populated product columns (L:P) in bounded ranges through the end of the sheet. Select paid sales for Product ID P005 (Only Me Learn) and P012 (Only Me Learn Plus). Both codes are eligible. Check payment method and positive net amount; exclude cancelled, voided or refunded sales. Report ambiguous payment data. Fetch Date, Customer ID, Pno, Name, Nickname (F) and Occupation (G) for selected rows. Never copy private contact or billing data into jobs.
2. Pno is the stable order key. Trim and uppercase it. For these sales expect O followed by digits. Fail on missing or duplicate order keys before writing. Historical Pno to record ID mappings: ${JSON.stringify(historicalOrders)}. For other Pnos use recordId = 'gs-oml-sale-' plus lowercase Pno. Never use sheet position as identity. Use the existing job and folder from sync_status for a known recordId; apply the nonblank sheet nickname and occupation, preserving the corresponding existing value when its cell is blank. Retain sourceCreatedAt, workflow progress, period and folder number. Trim outer whitespace/remove zero-width formatting in names. If the source name changed substantially for an existing order, report identity conflict before replacing. Keep archived jobs archived; a missing sales row never deletes a job.
3. For a new order, parse Date as day/month/year in Asia/Bangkok. Choose the month by purchase date. Read all children under Only Me Learn Drive root GOOGLE_DRIVE_ROOT_ID. Reuse exactly one matching month-year folder. For a missing month call claim_folder(recordId,name,monthFolderId=root,year,month,existingMaxNumber=0). On acquired:true create exactly monthFolder.folder_name under root, verify parent and confirm with the same arguments plus folderId and claimId=monthFolder.claim_id. Reconcile incomplete claims by exact label and parent; do not repeat an uncertain create.
4. Inspect all children of the month. Reuse an unambiguous matching folder after verifying name and parent; do not bind a folder already mapped to a different order. Otherwise call claim_folder with the student recordId, full name, nickname from F, verified monthFolderId, year, month and observed existingMaxNumber. Create exactly claim.folder_name only on acquired:true. Verify folder metadata before synchronize_student, passing claim.claim_id as claimId when required. Use the established folder label "N. Full Name (Nickname)", omitting the parentheses when there is no nickname. For a mapped folder with a changed nickname, verify its ID and month parent and rename it in place retaining its existing numeric prefix. Occupation belongs in the app only. Pass nickname and occupation to synchronize_student and verify both in the saved profile. If nickname/occupation are absent, leave them blank for new jobs. Store folder and job references in the app. The sales sheet has no writeback columns.
5. Read back every eligible order against sync_status, including paginated mappings, verified folder, job ID and profile. Call complete_sync once only after all eligible sales reconcile. Report new jobs or actionable failures in Thai, keep the schedule enabled and retain existing access settings.`;

