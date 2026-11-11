import {env} from "cloudflare:workers";
import {types} from "./workflow";
import {monthFolderTool, driveRoot} from "./month-folders";
import {sheetsInstructions, spreadsheetId, salesTab} from "./sheets-instructions";
export const syncInstructions = sheetsInstructions;
export function syncSchedule(now:Date,lastSuccess?:string){
 const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Bangkok',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).formatToParts(now);
 const value=(type:string)=>parts.find(p=>p.type===type)!.value;
 const hours=[7,9,11,13,15,17,19,21],hour=Number(value('hour')),minute=Number(value('minute'));
 // A scheduler may wake just before its nominal slot. Accept that same slot
 // up to ten minutes early during daytime; catch up missed slots until 23:00.
 const early=hour>=7&&minute>=50&&hours.includes(hour+1);
 const allowed=hour>=7&&hour<23;
 const slotHour=early?hour+1:([...hours].reverse().find(h=>h<=hour)??7);
 const start=Date.parse(value('year')+'-'+value('month')+'-'+value('day')+'T'+String(slotHour).padStart(2,'0')+':00:00+07:00');
 const consumedSince=start-(slotHour===7?0:600000);
 const retryAfterSeconds=hour===6&&minute>=50?3600-minute*60-Number(value('second')):null;
 return {timeZone:'Asia/Bangkok',hours,slotStartsAt:allowed?new Date(start).toISOString():null,earlyToleranceSeconds:600,retryAfterSeconds,checkDue:allowed&&(!lastSuccess||Date.parse(lastSuccess)<consumedSince)};
}
export async function ensureSync(){const db=env.DB!;await db.batch([
 db.prepare("CREATE TABLE IF NOT EXISTS month_folders (period TEXT PRIMARY KEY,claim_id TEXT NOT NULL UNIQUE,folder_name TEXT NOT NULL,folder_id TEXT UNIQUE)"),
 db.prepare("CREATE TABLE IF NOT EXISTS airtable_records (record_id TEXT PRIMARY KEY, job_id TEXT NOT NULL UNIQUE, occupation TEXT NOT NULL DEFAULT '', folder_id TEXT NOT NULL UNIQUE, month_folder_id TEXT NOT NULL, source_created_at TEXT NOT NULL, synced_at TEXT NOT NULL)"),
 db.prepare("CREATE TABLE IF NOT EXISTS folder_claims (record_id TEXT PRIMARY KEY, claim_id TEXT NOT NULL UNIQUE, parent_id TEXT NOT NULL, folder_name TEXT NOT NULL, year INTEGER NOT NULL, month INTEGER NOT NULL, created_at TEXT NOT NULL, completed_at TEXT)"),
 db.prepare("CREATE TABLE IF NOT EXISTS folder_numbers (record_id TEXT PRIMARY KEY, parent_id TEXT NOT NULL, number INTEGER NOT NULL CHECK(number>0), UNIQUE(parent_id,number))"),
 db.prepare("CREATE TABLE IF NOT EXISTS student_nicknames (record_id TEXT PRIMARY KEY, nickname TEXT NOT NULL)"),
 db.prepare("INSERT OR IGNORE INTO student_nicknames(record_id,nickname) SELECT record_id,CASE record_id WHEN 'recFixture0027' THEN 'Alpha' WHEN 'recFixture0028' THEN 'Beta' WHEN 'recFixture0029' THEN 'Gamma' WHEN 'recFixture0030' THEN 'Delta' END FROM airtable_records WHERE record_id IN ('recFixture0027','recFixture0028','recFixture0029','recFixture0030')"),
 db.prepare("CREATE TABLE IF NOT EXISTS integration_meta (key TEXT PRIMARY KEY, value TEXT NOT NULL)")]);
 // Apply this verified Airtable correction once, without overwriting later syncs.
 const correctionKey = "student_profile_correction_20261103";
 const studentId = "recFixture0029";
 if (!await db.prepare("SELECT 1 FROM integration_meta WHERE key=?").bind(correctionKey).first()) {
   await db.batch([
     db.prepare("UPDATE student_nicknames SET nickname=? WHERE record_id=? AND nickname=? AND NOT EXISTS (SELECT 1 FROM integration_meta WHERE key=?)")
       .bind("Gamma", studentId, "OldGamma", correctionKey),
     db.prepare("UPDATE airtable_records SET occupation=? WHERE record_id=? AND occupation='' AND NOT EXISTS (SELECT 1 FROM integration_meta WHERE key=?)")
       .bind("Example occupation", studentId, correctionKey),
     db.prepare("INSERT OR IGNORE INTO integration_meta(key,value) SELECT ?,? FROM airtable_records WHERE record_id=?")
       .bind(correctionKey, new Date().toISOString(), studentId)
   ]);
 }
 // Owner-confirmed existing October students; Aon is an unnumbered example.
 for(const [recordId,folderId,number] of [
 ["recFixture0027","FixtureFolderOne",1],
 ["recFixture0028","FixtureFolderTwo",2],
 ["recFixture0029","FixtureFolderThree",3]
 ] as const) await db.prepare("INSERT OR IGNORE INTO folder_numbers(record_id,parent_id,number) SELECT record_id,month_folder_id,? FROM airtable_records WHERE record_id=? AND folder_id=? AND month_folder_id=?").bind(number,recordId,folderId,"FixtureMonthFolder").run();
}
function str(v:unknown,max=300){if(typeof v!=="string"||!v.trim()||v.length>max)throw Error("Invalid text field");return v.trim()}
function rid(v:unknown){const s=str(v,100);if(!/^(rec[a-zA-Z0-9]+|gs-[a-zA-Z0-9-]{8,80})$/.test(s))throw Error("Invalid source record ID");return s}
function fid(v:unknown){const s=str(v,200);if(!/^[a-zA-Z0-9_-]{10,200}$/.test(s))throw Error("Invalid Drive folder ID");return s}
function period(a:Record<string,unknown>){if(!Number.isInteger(a.year)||Number(a.year)<2020||Number(a.year)>2100||!Number.isInteger(a.month)||Number(a.month)<1||Number(a.month)>12)throw Error("Invalid year/month");return [Number(a.year),Number(a.month)]}
export async function runSyncTool(name:string,a:Record<string,unknown>){await ensureSync();const db=env.DB!,now=new Date().toISOString();
 if(name==="claim_month_folder"||name==="confirm_month_folder")return monthFolderTool(db,name,a);
 if(name==="remove_migration_test_job"){
 const recordId="gs-oml-migration-20261105-auto",id="sheets-"+recordId;
 const job=await db.prepare("SELECT nickname FROM jobs WHERE id=?").bind(id).first<{nickname:string}>();
 if(job&&!job.nickname.startsWith("MIGRATION TEST"))throw Error("Test identity mismatch");
 const results=await db.batch([
 db.prepare("DELETE FROM events WHERE job_id=?").bind(id),db.prepare("DELETE FROM work_items WHERE job_id=?").bind(id),
 db.prepare("DELETE FROM jobs WHERE id=?").bind(id),db.prepare("DELETE FROM airtable_records WHERE record_id=?").bind(recordId),
 db.prepare("DELETE FROM student_nicknames WHERE record_id=?").bind(recordId),db.prepare("DELETE FROM folder_claims WHERE record_id=?").bind(recordId),
 db.prepare("DELETE FROM folder_numbers WHERE record_id=?").bind(recordId)]);
 return {ok:true,deletedJobs:results[2].meta.changes};
 }
 if(name==="sync_status"){const offset=Number(a.offset||0);if(!Number.isInteger(offset)||offset<0)throw Error("Invalid offset");const records=await db.prepare("SELECT r.*,j.nickname,j.nickname AS name,sn.nickname AS short_name,j.year,j.month,j.drive_ref,n.number AS folder_number FROM airtable_records r JOIN jobs j ON j.id=r.job_id LEFT JOIN student_nicknames sn ON sn.record_id=r.record_id LEFT JOIN folder_numbers n ON n.record_id=r.record_id ORDER BY r.record_id LIMIT 101 OFFSET ?").bind(offset).all();const claims=await db.prepare("SELECT * FROM folder_claims WHERE completed_at IS NULL ORDER BY created_at LIMIT 100").all();const meta=(await db.prepare("SELECT * FROM integration_meta").all<{key:string;value:string}>()).results;return {source:{type:"google_sheets",spreadsheetId,sheetName:salesTab},instructions:syncInstructions,schedule:syncSchedule(new Date(now),meta.find(x=>x.key==="last_success")?.value),records:records.results.slice(0,100),nextOffset:records.results.length>100?offset+100:null,pendingClaims:claims.results,meta};}
 if(name==="claim_folder"){
 // Backward-compatible folder reservation for clients with the original tool list.
 // Only the configured root selects month reservations; student parents are unchanged.
 if(a.monthFolderId===driveRoot){
 rid(a.recordId); str(a.name); period(a);
 const result=await monthFolderTool(db,a.folderId&&a.claimId?"confirm_month_folder":"claim_month_folder",a);
 return {kind:"month",...result};
 }
 const recordId=rid(a.recordId),parentId=fid(a.monthFolderId),student=str(a.name),[year,month]=period(a),claimId=crypto.randomUUID();
 const known=await db.prepare("SELECT * FROM airtable_records WHERE record_id=?").bind(recordId).first();if(known)return {acquired:false,existing:known};
 const prior=await db.prepare("SELECT * FROM folder_claims WHERE record_id=?").bind(recordId).first();if(prior)return {acquired:false,claim:prior};
 const nickname = typeof a.nickname === "string" ? a.nickname.trim().replace(/^\(([^()]*)\)$/u, "$1").trim() : "";
 const suffix = nickname ? " (" + nickname + ")" : "";
 const folderLabel = student.endsWith(suffix) ? student : student + suffix;
 const observedMax=a.existingMaxNumber;
 if(!Number.isSafeInteger(observedMax)||Number(observedMax)<0||Number(observedMax)>1000000)throw Error("Read all month folder children and supply existingMaxNumber (0 if no numbered folders)");
 const results=await db.batch([
 db.prepare("INSERT OR IGNORE INTO folder_numbers(record_id,parent_id,number) SELECT ?,?,MAX(COALESCE((SELECT MAX(number) FROM folder_numbers WHERE parent_id=?),0),?)+1").bind(recordId,parentId,parentId,observedMax),
 db.prepare("INSERT OR IGNORE INTO folder_claims(record_id,claim_id,parent_id,folder_name,year,month,created_at) SELECT ?,?,?,CAST(number AS TEXT)||'. '||?,?,?,? FROM folder_numbers WHERE record_id=? AND parent_id=?").bind(recordId,claimId,parentId,folderLabel,year,month,now,recordId,parentId)
 ]);
 return {acquired:results[1].meta.changes===1,claim:await db.prepare("SELECT * FROM folder_claims WHERE record_id=?").bind(recordId).first()};}
 if(name==="synchronize_student"){
 const recordId=rid(a.recordId),student=str(a.name),occupation=typeof a.occupation==="string"?a.occupation.trim():"";if(occupation.length>500)throw Error("Occupation too long");const folderId=fid(a.folderId),parentId=fid(a.monthFolderId),[year,month]=period(a),created=str(a.sourceCreatedAt,40);if(!Number.isFinite(Date.parse(created)))throw Error("Invalid created time");const id=(recordId.startsWith("rec")?"airtable-":"sheets-")+recordId,drive="https://drive.google.com/drive/folders/"+folderId;
 const claim=await db.prepare("SELECT * FROM folder_claims WHERE record_id=? AND completed_at IS NULL").bind(recordId).first<{claim_id:string;parent_id:string}>();if(claim&&(a.claimId!==claim.claim_id||parentId!==claim.parent_id))throw Error("Pending folder claim must be reconciled first");
 const existing=await db.prepare("SELECT * FROM airtable_records WHERE record_id=?").bind(recordId).first();
 const statements=[db.prepare("INSERT INTO jobs (id,order_ref,nickname,year,month,drive_ref,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET nickname=excluded.nickname,year=excluded.year,month=excluded.month,drive_ref=excluded.drive_ref,updated_at=excluded.updated_at WHERE jobs.nickname IS NOT excluded.nickname OR jobs.year IS NOT excluded.year OR jobs.month IS NOT excluded.month OR jobs.drive_ref IS NOT excluded.drive_ref").bind(id,recordId,student,year,month,drive,created,now),
 db.prepare("INSERT INTO airtable_records (record_id,job_id,occupation,folder_id,month_folder_id,source_created_at,synced_at) VALUES (?,?,?,?,?,?,?) ON CONFLICT(record_id) DO UPDATE SET occupation=excluded.occupation,folder_id=excluded.folder_id,month_folder_id=excluded.month_folder_id,synced_at=excluded.synced_at WHERE airtable_records.occupation IS NOT excluded.occupation OR airtable_records.folder_id IS NOT excluded.folder_id OR airtable_records.month_folder_id IS NOT excluded.month_folder_id").bind(recordId,id,occupation,folderId,parentId,created,now),
 ...types.map(t=>db.prepare("INSERT OR IGNORE INTO work_items (id,job_id,type,status,revision,updated_at,asset_ref) VALUES (?,?,?,'not_started',0,?,'')").bind(id+"-"+t,id,t,now)),
 db.prepare("INSERT OR IGNORE INTO events (id,job_id,action,to_status,actor_id,actor_name,note,created_at,request_key) VALUES (?,?,'source_import','created','sheets-sync','Google Sheets','Imported paid student',?,?)").bind(id+"-import",id,now,id+"-import"),
 ...(typeof a.nickname === "string" ? [db.prepare("INSERT INTO student_nicknames(record_id,nickname) VALUES (?,?) ON CONFLICT(record_id) DO UPDATE SET nickname=excluded.nickname WHERE nickname IS NOT excluded.nickname").bind(recordId,a.nickname.trim().replace(/^\(([^()]*)\)$/u,"$1").trim())] : []),
 db.prepare("UPDATE folder_claims SET completed_at=? WHERE record_id=? AND completed_at IS NULL").bind(now,recordId)];await db.batch(statements);return {ok:true,created:!existing,record:await db.prepare("SELECT r.*,j.nickname,j.year,j.month FROM airtable_records r JOIN jobs j ON j.id=r.job_id WHERE record_id=?").bind(recordId).first()};}
 if(name==="synchronize_supreme_customer"){
 const recordId=str(a.recordId,100),token=env.SUPREME_CUSTOMER_SYNC_TOKEN;
 if(!/^TXN-\d{6}$/.test(recordId))throw Error("Invalid Supreme Transaction ID");
 if(!token)throw Error("Supreme sync credential unavailable");
 const response=await fetch("https://svlwhnqgodesuquolkcd.supabase.co/functions/v1/supreme-customer-sync",{
 method:"POST",headers:{"Content-Type":"application/json","x-sync-token":token},
 body:JSON.stringify({action:"upsert",record_id:recordId,phone:a.phone,name:a.name,customer_code:a.customerCode,email:a.email}),signal:AbortSignal.timeout(15000)
 });
 if(!response.ok)throw Error("Supreme sync failed: HTTP "+response.status);
 return await response.json();
 }
 if(name==="complete_sync"){await db.batch(["last_success","last_google_sheets_success"].map(key=>db.prepare("INSERT INTO integration_meta(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").bind(key,now)));return {ok:true,lastSuccess:now,source:"google_sheets"};}
 if(name==="remove_confirmed_demo_jobs"){await runSyncTool("remove_migration_test_job",{});const ids=["demo-gun","demo-khaohom","demo-maya","demo-phu","demo-ploy","demo-tonnam","31e27efe-05de-4e86-84c7-c81a9bd69716","airtable-recFixture0031"];const p=ids.map(()=>"?").join(",");const results=await db.batch([db.prepare("DELETE FROM events WHERE job_id IN ("+p+")").bind(...ids),db.prepare("DELETE FROM work_items WHERE job_id IN ("+p+")").bind(...ids),db.prepare("DELETE FROM jobs WHERE id IN ("+p+")").bind(...ids),db.prepare("DELETE FROM airtable_records WHERE record_id=?").bind("recFixture0031"),db.prepare("DELETE FROM folder_claims WHERE record_id=?").bind("recFixture0031")]);return {ok:true,deletedJobs:results[2].meta.changes};}
 throw Error("Unknown tool");
}

// One-time, owner-provisioned migration. No request body or browser input can supply records.
// The completion marker prevents stale bootstrap data from overwriting later Airtable changes.
export async function applyInitialImport() {
  if (!env.AIRTABLE_INITIAL_IMPORT) return;
  await ensureSync();
  const db = env.DB!;
  const key = "initial_paid_import_20261026";
  if (await db.prepare("SELECT value FROM integration_meta WHERE key=?").bind(key).first()) return;
  const payload: unknown = JSON.parse(env.AIRTABLE_INITIAL_IMPORT);
  if (!Array.isArray(payload) || payload.length === 0 || payload.length > 100) throw Error("Invalid initial import configuration");
  const ids = new Set<string>();
  for (const row of payload) {
    if (!row || typeof row !== "object" || Array.isArray(row)) throw Error("Invalid initial student record");
    const id = rid(row.recordId);
    if (ids.has(id)) throw Error("Duplicate initial record ID");
    ids.add(id);
  }
  for (const row of payload) await runSyncTool("synchronize_student", row);
  // Read back every mapping before removing the explicitly approved test jobs.
  for (const row of payload) {
    const saved = await db.prepare("SELECT r.record_id,r.folder_id,j.nickname FROM airtable_records r JOIN jobs j ON j.id=r.job_id WHERE r.record_id=?").bind(row.recordId).first<{record_id:string;folder_id:string;nickname:string}>();
    if (!saved || saved.folder_id !== row.folderId || saved.nickname !== row.name.trim()) throw Error("Initial import readback failed");
  }
  await runSyncTool("remove_confirmed_demo_jobs", {});
  await db.prepare("INSERT OR IGNORE INTO integration_meta(key,value) VALUES (?,?)").bind(key,new Date().toISOString()).run();
}

