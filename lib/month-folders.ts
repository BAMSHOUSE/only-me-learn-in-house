// Reservations prevent two scheduled attempts from creating the same month folder.
export const driveRoot = "GOOGLE_DRIVE_ROOT_ID";
export async function monthFolderTool(db:D1Database, action:string, a:Record<string,unknown>) {
 const year=Number(a.year), month=Number(a.month);
 if(!Number.isInteger(year)||year<2020||year>2100||!Number.isInteger(month)||month<1||month>12) throw Error("Invalid month/year");
 const key=`${year}-${String(month).padStart(2,"0")}`;
 const label=`${month}. ${new Intl.DateTimeFormat("en",{month:"long",timeZone:"UTC"}).format(new Date(Date.UTC(year,month-1,1)))} ${year}`;
 const folder=a.folderId;
 if(folder!==undefined&&(typeof folder!=="string"||!/^[-\w]{10,200}$/.test(folder)))throw Error("Invalid folder ID");
 if(action==="claim_month_folder") {
  const claimId=crypto.randomUUID();
  const result=await db.prepare("INSERT OR IGNORE INTO month_folders(period,claim_id,folder_name,folder_id) VALUES(?,?,?,?)").bind(key,claimId,label,folder||null).run();
  const saved=await db.prepare("SELECT * FROM month_folders WHERE period=?").bind(key).first<{folder_id:string|null}>();
  if(folder&&saved?.folder_id&&saved.folder_id!==folder)throw Error("Month folder conflicts with saved mapping");
  return {acquired:result.meta.changes===1&&!folder,rootId:driveRoot,monthFolder:saved};
 }
 if(!folder||typeof a.claimId!=="string")throw Error("Folder ID and claim ID required");
 await db.prepare("UPDATE month_folders SET folder_id=? WHERE period=? AND claim_id=? AND (folder_id IS NULL OR folder_id=?)").bind(folder,key,a.claimId,folder).run();
 const saved=await db.prepare("SELECT * FROM month_folders WHERE period=?").bind(key).first<{folder_id:string|null;claim_id:string}>();
 if(!saved||saved.folder_id!==folder||saved.claim_id!==a.claimId)throw Error("Month folder confirmation mismatch");
 return {ok:true,rootId:driveRoot,monthFolder:saved};
}
