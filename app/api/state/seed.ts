import { env } from "cloudflare:workers";
export async function seedDemo() {
  const db = env.DB!;
  if (await db.prepare("SELECT id FROM jobs WHERE id='demo-maya'").first()) return;
  const people = [["admin","ธนภัทร","admin"],["ls","อาริยา","language"],["video","พชร","video"],["pdf","วิภา","pdf"],["qa","ชนินทร์","qa"]];
  const types = ["thai_scenario","english_script","video_assets","listening","exercise","imitation","pdf","final_qa","timestamps"];
  const samples = [
    {id:"maya",name:"น้องมายด์",ref:"089",due:"25",status:["approved","approved","approved","rejected","approved","in_progress","approved","not_started","not_started"],note:"ข้อมูลสมมติ: แก้คำแปลช่วงบทสนทนาที่ 4",target:"listening"},
    {id:"gun",name:"น้องกันต์",ref:"092",due:"27",status:["approved","approved","approved","submitted","submitted","in_progress","submitted","not_started","not_started"]},
    {id:"ploy",name:"น้องพลอย",ref:"071",due:"20",status:types.map(()=>"approved"),delivered:true},
    {id:"phu",name:"น้องภูริ",ref:"104",due:"30",status:["in_progress",...Array(8).fill("not_started")]},
    {id:"khaohom",name:"น้องข้าวหอม",ref:"101",due:"28",status:["approved","approved","in_progress","not_started","not_started","not_started","in_progress","not_started","not_started"]},
    {id:"tonnam",name:"น้องต้นน้ำ",ref:"095",due:"26",status:["approved","approved","approved","approved","approved","approved","rejected","not_started","not_started"],note:"ข้อมูลสมมติ: แก้คำสะกดใน PDF หน้า 2",target:"pdf"},
  ];
  const statements = people.map(([id,name,role])=>db.prepare("INSERT OR IGNORE INTO team_members (id,name,role,active) VALUES (?,?,?,1)").bind(id,name,role));
  for (const [index,s] of samples.entries()) {
    const id="demo-"+s.id, time="2026-10-23T"+String(7-index).padStart(2,"0")+":30:00.000Z";
    statements.push(db.prepare("INSERT OR IGNORE INTO jobs (id,order_ref,nickname,year,month,drive_ref,due_at,specialist_id,audio_received,delivered_at,created_at,updated_at) VALUES (?,?,?,2026,10,?,?,'ls',1,?,'2026-10-20T02:00:00.000Z',?)").bind(id,"ORD-202610-"+s.ref,s.name,"Only Me Learn/ตุลาคม/"+s.name,"2026-10-"+s.due,s.delivered?time:null,time));
    for(const [i,type] of types.entries()) statements.push(db.prepare("INSERT OR IGNORE INTO work_items (id,job_id,type,status,revision,updated_at,asset_ref) VALUES (?,?,?,?,0,?,'')").bind(id+"-"+type,id,type,s.status[i],time));
    statements.push(db.prepare("INSERT OR IGNORE INTO events (id,job_id,item_type,action,from_status,to_status,actor_id,actor_name,note,channel,created_at,request_key) VALUES (?,?,?,'demo_seed',NULL,?,'qa','ชนินทร์',?,'ข้อมูลสมมติ',?,?)").bind(id+"-seed",id,s.target||null,s.target?"rejected":"created",s.note||"สร้างตัวอย่างเพื่อทดลองติดตามสถานะงาน",time,id+"-seed"));
  }
  await db.batch(statements);
}
