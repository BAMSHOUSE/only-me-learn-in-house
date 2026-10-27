import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
// Local test fixture only. This helper never accesses hosted D1 or the app API.
export function createLocalFixture(orderRef="TEST-"+randomUUID()){
  const id=randomUUID(),now=new Date().toISOString(),q=s=>"'"+String(s).replaceAll("'","''")+"'";
  const types=["thai_scenario","english_script","video_assets","vocabulary","listening","exercise","imitation","pdf","timestamps"];
  const sql=[
    "INSERT INTO jobs (id,order_ref,nickname,year,month,drive_ref,created_at,updated_at) VALUES ("+[id,orderRef,"QA "+id.slice(0,8),2026,10,"Only Me Learn/ทดสอบ",now,now].map(q).join(",")+");",
    ...types.map(type=>"INSERT INTO work_items (id,job_id,type,status,revision,updated_at) VALUES ("+[randomUUID(),id,type,"not_started",0,now].map(q).join(",")+");")
  ].join("\n");
  execFileSync(process.execPath,["--import","./scripts/sites-env.mjs","./node_modules/wrangler/bin/wrangler.js","d1","execute","DB","--config","dist/server/wrangler.json","--local","--persist-to",".wrangler/state","--command",sql],{cwd:process.cwd(),env:{...process.env,WRANGLER_SEND_METRICS:"false"},stdio:"pipe"});
  return id;
}
