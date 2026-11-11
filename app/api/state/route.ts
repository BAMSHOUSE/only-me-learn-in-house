import { env } from "cloudflare:workers";
import { isVisibleJob } from "../../../lib/job-visibility";
import { validSession, sameOrigin } from "../../../lib/session";
import { ensureSync, applyInitialImport } from "../../../lib/airtable-sync";
import { notifyWork } from "../../../lib/push";
import { ensureWorkflow } from "../../../lib/ensure-workflow";
import { ready, deadlineAfterApproval, type Job, type Item } from "../../../lib/workflow";

export const runtime = "edge";
export const dynamic = "force-dynamic";

const TYPES = ["thai_scenario","english_script","video_assets","vocabulary","listening","exercise","imitation","pdf","timestamps","admin_send"] as const;
type ItemType = typeof TYPES[number];
type Action = "create" | "audio" | "start" | "submit" | "approve" | "reject" | "customer_approve" | "customer_reject" | "deliver";
const json = (body: unknown, status = 200) => Response.json(body, {status, headers: {"Cache-Control":"no-store"}});
const db = () => {
  if (!env.DB) throw new Error("D1 binding is missing");
  return env.DB;
};
const unauthorized = () => json({error:"กรุณาเชื่อมต่อระบบอีกครั้ง"}, 401);

export async function GET(request: Request) {
  if (!await validSession(request)) return unauthorized();
  try {
    await ensureSync();
    await applyInitialImport();
    await ensureWorkflow();
    const database = db();
    const [jobs,items,members,events,airtableCheck] = await Promise.all([
      database.prepare("SELECT jobs.*,student_nicknames.nickname AS short_name,airtable_records.occupation,folder_numbers.number AS folder_number FROM jobs LEFT JOIN airtable_records ON airtable_records.job_id=jobs.id LEFT JOIN student_nicknames ON student_nicknames.record_id=airtable_records.record_id LEFT JOIN folder_numbers ON folder_numbers.record_id=airtable_records.record_id ORDER BY jobs.year DESC,jobs.month DESC,COALESCE(folder_numbers.number,2147483647),jobs.created_at,jobs.id").all(),
      database.prepare("SELECT * FROM work_items WHERE type!='final_qa'").all(),
      database.prepare("SELECT * FROM team_members WHERE active=1 ORDER BY role,name").all(),
      database.prepare("SELECT * FROM events ORDER BY created_at DESC LIMIT 500").all(),
      database.prepare("SELECT value FROM integration_meta WHERE key='last_google_sheets_success'").first<{value:string}>(),
    ]);
    return json({jobs:jobs.results.filter(job=>isVisibleJob(String(job.id))).map(job=>{
      const fullName = String(job.nickname);
      const suffix = job.short_name ? " (" + job.short_name + ")" : "";
      return {...job,nickname:fullName.endsWith(suffix) ? fullName : fullName + suffix};
    }),items:items.results.filter(item=>isVisibleJob(String(item.job_id))),members:members.results,events:events.results.filter(event=>isVisibleJob(String(event.job_id))),lastAirtableCheck:airtableCheck?.value??null});
  } catch (error) { return json({error:String(error)},500); }
}

export async function POST(request: Request) {
  if (!sameOrigin(request)) return json({error:"Cross-origin request denied"},403);
  if (!await validSession(request)) return unauthorized();
  let data: Record<string,unknown>;
  try { data = await request.json() as Record<string,unknown>; }
  catch { return json({error:"ข้อมูลไม่ถูกต้อง"},400); }
  try {
    await ensureSync();
    await ensureWorkflow();
    const database = db(), action = String(data.action || "") as Action;
    const actorId = String(data.actorId || "");
    const actor = await database.prepare("SELECT id,name,role FROM team_members WHERE id=? AND active=1").bind(actorId).first<{id:string;name:string;role:string}>();
    if (!actor) return json({error:"กรุณาเลือกชื่อผู้กด"},400);
    if (action === "create") return json({error:"ระบบรับงานจาก Google Sheets เท่านั้น ไม่รองรับการสร้างงานด้วยมือ"},403);
    const jobId = String(data.jobId || "");
    if (!isVisibleJob(jobId)) return json({error:"Job is archived"},404);
    const job = await database.prepare("SELECT * FROM jobs WHERE id=?").bind(jobId).first<Record<string,unknown>>();
    if (!job) return json({error:"ไม่พบงาน"},404);
    const itemsResult = await database.prepare("SELECT * FROM work_items WHERE job_id=?").bind(jobId).all<Record<string,unknown>>();
    const items = Object.fromEntries(itemsResult.results.map(item => [String(item.type),item]));
    const type = String(data.type || "") as ItemType;
    const item = items[type];
    const note = String(data.note || "").trim().slice(0,1000), channel = String(data.channel || "").trim().slice(0,100);
    const assetRef = String(data.assetRef || "").trim().slice(0,1000);
    const requestKey = String(data.requestKey || "");
    if (!requestKey || requestKey.length > 100) return json({error:"คำขอไม่มีรหัสป้องกันการกดซ้ำ"},400);
    const duplicate = await database.prepare("SELECT id FROM events WHERE request_key=?").bind(requestKey).first();
    if (duplicate) return json({ok:true,duplicate:true});
    if (job.delivered_at || items.admin_send?.status === "approved") return json({error:"งานนี้เสร็จสิ้นแล้ว"},409);
    const now = new Date().toISOString();
    if (action === "audio") {
      if (job.audio_received) return json({error:"บันทึกไฟล์เสียงแล้ว กรุณารีเฟรช"},409);
      const specialist = await database.prepare("SELECT id FROM team_members WHERE role='language' AND active=1 ORDER BY id LIMIT 1").first<{id:string}>();
      if (!specialist) return json({error:"ไม่มี Language Specialist ในทีม"},400);
      const result = await database.batch([
        database.prepare("UPDATE jobs SET audio_received=1,specialist_id=?,updated_at=? WHERE id=? AND audio_received=0").bind(specialist.id,now,jobId),
        database.prepare("INSERT INTO events (id,job_id,item_type,action,from_status,to_status,actor_id,actor_name,note,channel,created_at,request_key) SELECT ?,?,NULL,'audio','waiting','received',?,?,?,'',?,? WHERE changes()=1").bind(crypto.randomUUID(),jobId,actor.id,actor.name,note,now,requestKey),
      ]);
      if (result[0].meta.changes) notifyWork(action, {id:jobId,nickname:String(job.nickname)}, actor.name);
      return result[0].meta.changes ? json({ok:true}) : json({error:"สถานะเปลี่ยนแล้ว กรุณารีเฟรช"},409);
    }
    if (action === "deliver") return json({error:"ไม่มีขั้นตอนส่งมอบใน Flow นี้"},400);
    if (!item || !TYPES.includes(type)) return json({error:"ไม่พบขั้นงาน"},400);
    const current = String(item.status);
    let next = "";
    if (action === "submit" || action === "start") {
      if (!(action==="start"?["not_started","rejected"]:["not_started","in_progress","rejected"]).includes(current)) return json({error:"สถานะเปลี่ยนแล้ว กรุณารีเฟรช"},409);
      if (!ready(type,job as unknown as Job,items as unknown as Record<string,Item>)) return json({error:"รอขั้นตอนก่อนหน้าผ่านก่อน"},409);
      next = action==="start" ? "in_progress" : ["english_script","video_assets","vocabulary","admin_send"].includes(type) ? "approved" : "submitted";
    } else if (action === "customer_approve" || action === "customer_reject") {
      if (type !== "thai_scenario" || current !== "submitted") return json({error:"บันทึกผลลูกค้าหลังส่งสถานการณ์ไทย"},409);
      if (action === "customer_reject" && !note) return json({error:"กรุณาระบุสิ่งที่ลูกค้าต้องการแก้ไข"},400);
      next = action === "customer_approve" ? "approved" : "rejected";
    } else if (action === "approve" || action === "reject") {
      if (current !== "submitted" || ["thai_scenario","english_script","video_assets","vocabulary","admin_send"].includes(type)) return json({error:"ขั้นนี้ยังไม่พร้อมตรวจ"},409);
      if (action === "reject" && !note) return json({error:"กรุณาระบุสิ่งที่ต้องแก้ไข"},400);
      if (!ready(type,job as unknown as Job,items as unknown as Record<string,Item>)) return json({error:"รอขั้นตอนก่อนหน้าผ่านก่อน"},409);
      next = action === "approve" ? "approved" : "rejected";
    } else return json({error:"ไม่รู้จักการดำเนินการ"},400);
    const statements = [
      database.prepare("UPDATE work_items SET status=?,revision=revision+1,updated_at=?,asset_ref=? WHERE id=? AND status=? AND revision=?").bind(next,now,assetRef||item.asset_ref||"",item.id,current,item.revision),
      database.prepare("INSERT INTO events (id,job_id,item_type,action,from_status,to_status,actor_id,actor_name,note,channel,created_at,request_key) SELECT ?,?,?,?,?,?,?,?,?,?,?,? WHERE changes()=1").bind(crypto.randomUUID(),jobId,type,action,current,next,actor.id,actor.name,note,channel,now,requestKey),
      database.prepare("UPDATE jobs SET updated_at=?,due_at=CASE WHEN ?='customer_approve' THEN ? ELSE due_at END WHERE id=? AND EXISTS (SELECT 1 FROM events WHERE request_key=?)").bind(now,action,deadlineAfterApproval(now),jobId,requestKey),
    ];
    const result = await database.batch(statements);
    if (result[0].meta.changes) notifyWork(action, {id:jobId,nickname:String(job.nickname)}, actor.name, type);
    return result[0].meta.changes ? json({ok:true}) : json({error:"สถานะเปลี่ยนแล้ว กรุณารีเฟรช"},409);
  } catch (error) { return json({error:String(error)},500); }
}
