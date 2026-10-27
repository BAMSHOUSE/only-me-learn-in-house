export type Job={id:string;order_ref:string;nickname:string;occupation?:string;year:number;month:number;drive_ref:string;due_at:string|null;specialist_id:string|null;audio_received:number;delivered_at:string|null;created_at:string;updated_at:string};
export type Item={id:string;job_id:string;type:string;status:string;revision:number;asset_ref:string;updated_at:string};
export type Member={id:string;name:string;role:string};
export type Event={id:string;job_id:string;item_type:string|null;action:string;from_status:string|null;to_status:string|null;actor_name:string;actor_id:string;note:string;channel:string;created_at:string};
export type State={lastAirtableCheck?:string|null;jobs:Job[];items:Item[];members:Member[];events:Event[]};
export const names:Record<string,string>={audio:"Student Review",thai_scenario:"Draft Thai",customer_approval:"Student Approve",english_script:"Draft English",video_assets:"Gen Voice, Character, Scene",vocabulary:"Gen Vocab, Phrase",pdf:"PDF",listening:"Listening",imitation:"Imitation",exercise:"Role Play",timestamps:"Timestamp",final_qa:"QA ตรวจรวม (เดิม)"};
export const statuses:Record<string,string>={not_started:"ยังไม่เริ่ม",in_progress:"กำลังทำ",submitted:"รอตรวจ",approved:"ผ่าน",rejected:"ต้องแก้ไข",delivered:"เสร็จสิ้น",created:"สร้างงาน",received:"สัมภาษณ์แล้ว",waiting:"รอสัมภาษณ์",ready:"พร้อม"};
export const actions:Record<string,string>={create:"สร้างงานใหม่",audio:"ส่งงาน Student Review",start:"เริ่มทำงาน",submit:"ส่งงาน",approve:"Approve",reject:"ส่งกลับแก้ไข",customer_approve:"Student Approve",customer_reject:"ลูกค้าขอแก้ไข",deliver:"ส่งมอบลูกค้า (เดิม)",demo_seed:"สถานะเริ่มต้นของข้อมูลตัวอย่าง"};
export const roles:Record<string,string>={admin:"Admin",language:"Language Specialist",video:"Video Team",pdf:"PDF Team",qa:"QA",signer:"Signer"};
export const months=["","มกราคม","กุมภาพันธ์","มีนาคม","เมษายน","พฤษภาคม","มิถุนายน","กรกฎาคม","สิงหาคม","กันยายน","ตุลาคม","พฤศจิกายน","ธันวาคม"];
export const tracks=["listening","imitation","exercise","pdf"];
export const types=["thai_scenario","english_script","video_assets","vocabulary",...tracks,"timestamps"];
export const steps=["audio","thai_scenario","customer_approval","english_script","video_assets","vocabulary","pdf","listening","imitation","exercise","timestamps"];
export const dateTime=(s?:string|null)=>s?new Intl.DateTimeFormat("th-TH",{dateStyle:"medium",timeStyle:"short",timeZone:"Asia/Bangkok"}).format(new Date(s)):"—";
export const dateOnly=(s?:string|null)=>s?new Intl.DateTimeFormat("th-TH",{day:"numeric",month:"short",year:"numeric",timeZone:"Asia/Bangkok"}).format(new Date(s)):"—";
export const deadlineAfterApproval=(at:string)=>new Date(Date.parse(at)+(14*24+7)*60*60*1000).toISOString().slice(0,10);
export const mapItems=(items:Item[])=>Object.fromEntries(items.map(i=>[i.type,i]));
export const finished=(job:Job,m:Record<string,Item>)=>!!job.delivered_at||m.timestamps?.status==="approved";
export function stepDone(type:string,job:Job,m:Record<string,Item>){
  if(job.delivered_at)return true;
  if(type==="audio")return !!job.audio_received;
  if(type==="thai_scenario")return ["submitted","approved"].includes(m.thai_scenario?.status);
  if(type==="customer_approval")return m.thai_scenario?.status==="approved";
  return m[type]?.status==="approved";
}
export function completion(job:Job,items:Item[]) {
  const m=mapItems(items),count=steps.filter(t=>stepDone(t,job,m)).length;
  return {count,percent:Math.floor(count/11*100)};
}
export function bucket(job:Job,items:Item[]) {
  const m=mapItems(items);
  if(finished(job,m))return "delivered";
  if(items.some(i=>types.includes(i.type)&&i.status==="rejected"))return "rejected";
  if(items.some(i=>types.includes(i.type)&&i.status==="submitted"))return "submitted";
  return "in_progress";
}
export function phase(job:Job,items:Item[]) {
  const m=mapItems(items);
  if(finished(job,m))return "เสร็จสิ้น";
  const rejected=items.find(i=>types.includes(i.type)&&i.status==="rejected");
  if(rejected)return "ต้องแก้ไข "+names[rejected.type];
  return names[steps.find(t=>!stepDone(t,job,m))||"timestamps"];
}
export function ready(type:string,job:Job,m:Record<string,Item>) {
  if(finished(job,m))return false;
  if(type==="audio")return !job.audio_received;
  if(type==="thai_scenario")return !!job.audio_received;
  if(type==="customer_approval")return m.thai_scenario?.status==="submitted";
  if(type==="english_script")return m.thai_scenario?.status==="approved";
  if(["video_assets","vocabulary"].includes(type))return m.english_script?.status==="approved";
  if(type==="pdf")return m.vocabulary?.status==="approved";
  if(["listening","exercise","imitation"].includes(type))return m.video_assets?.status==="approved";
  return type==="timestamps"&&m.vocabulary?.status==="approved"&&tracks.every(t=>m[t]?.status==="approved");
}

