import { signers } from "./signers";
import { env } from "cloudflare:workers";
// Add the new task without resetting existing work or deleting historical QA/delivery events.
export async function ensureWorkflow() {
  const db=env.DB!;
  const deadline="(SELECT date(COALESCE((SELECT MAX(e.created_at) FROM events e WHERE e.job_id=jobs.id AND e.action='customer_approve'),w.updated_at),'+7 hours','+14 days') FROM work_items w WHERE w.job_id=jobs.id AND w.type='thai_scenario' AND w.status='approved')";
  await db.batch([
    ...signers.map(member=>db.prepare("INSERT OR IGNORE INTO team_members (id,name,role,active) VALUES (?,?,'signer',1)").bind(member.id,member.name)),
    db.prepare("INSERT OR IGNORE INTO work_items (id,job_id,type,status,revision,updated_at,asset_ref) SELECT id||'-vocabulary',id,'vocabulary',CASE WHEN delivered_at IS NOT NULL OR EXISTS(SELECT 1 FROM work_items w WHERE w.job_id=jobs.id AND w.type='timestamps' AND w.status='approved') THEN 'approved' ELSE 'not_started' END,0,updated_at,'' FROM jobs"),
    db.prepare("UPDATE jobs SET due_at="+deadline+" WHERE due_at IS NOT "+deadline),
  ]);
}
