import { createLocalFixture } from "./test-fixture.mjs";
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";

const port = 8791;
const token = "local-flow-test";
const url = `http://127.0.0.1:${port}/api/state`;
const server = spawn(process.execPath, [
  "--import", "./scripts/sites-env.mjs", "./node_modules/wrangler/bin/wrangler.js",
  "dev", "--config", "dist/server/wrangler.json", "--local",
  "--persist-to", ".wrangler/state", "--ip", "127.0.0.1",
  "--port", String(port), "--inspector-port", "0", "--var", `DEMO_ACCESS_TOKEN:${token}`,
], {cwd:process.cwd(), env:{...process.env, WRANGLER_SEND_METRICS:"false"}, stdio:["ignore","pipe","pipe"]});
let log = "";
for (const stream of [server.stdout,server.stderr]) stream.on("data",chunk=>{log += chunk.toString();});
const wait = ms => new Promise(resolve=>setTimeout(resolve,ms));
let cookie="";
async function request(body, key=cookie) {
  const response = await fetch(url,{method:body?"POST":"GET",headers:{Cookie:key,Origin:new URL(url).origin,...(body?{"Content-Type":"application/json"}:{})},body:body?JSON.stringify(body):undefined});
  const data = await response.json();
  return {status:response.status,data};
}
function expect(condition,message) { if (!condition) throw new Error(message); }
try {
  for(let i=0;i<80&&!log.includes("Ready on");i++) {expect(server.exitCode===null,`Server exited: ${log.slice(-600)}`);await wait(250);}
  expect(log.includes("Ready on"),`Server not ready: ${log.slice(-800)}`);
  const session=await fetch(new URL("/api/session",url),{method:"POST",headers:{Origin:new URL(url).origin}});
  expect(session.status===200,"Anonymous session should be automatic");
  cookie=session.headers.get("set-cookie").split(";")[0];
  expect((await request(null,"wrong")).status===401,"Missing or invalid token must fail");
  const initial = await request(null);
  expect(initial.status===200,`Initial fetch: ${JSON.stringify(initial).slice(0,600)}`);
  const orderRef = `TEST-${randomUUID().slice(0,8)}`;
  let result = await request({action:"create",actorId:"admin",nickname:"นักเรียนทดสอบ",orderRef,year:2026,month:10,driveRef:"Only Me Learn/ตุลาคม/ทดสอบ",requestKey:randomUUID()});
  expect(result.status===403,"Manual create API must be blocked");
  const jobId = createLocalFixture(orderRef);
  const action = async (name,type,actorId="admin",extra={}) => {
    const body={action:name,jobId,type,actorId,requestKey:randomUUID(),...extra};
    const response=await request(body);
    expect(response.status===200,`${name}/${type} failed: ${JSON.stringify(response)}`);
    return {response,body};
  };
  await action("audio",undefined);
  let state=await request(null);
  const job=state.data.jobs.find(j=>j.id===jobId);
  expect(job?.specialist_id==="ls","Audio must assign Language Specialist");
  await action("start","thai_scenario","ls");
  await action("submit","thai_scenario","ls");
  await action("customer_reject","thai_scenario","admin",{note:"แก้สถานการณ์"});
  await action("submit","thai_scenario","ls");
  expect((await request(null)).data.jobs.find(j=>j.id===jobId).due_at===null,"No deadline before approval");
  const customer=await action("customer_approve","thai_scenario","admin");
  expect((await request(customer.body)).data.duplicate,"Approval retry is idempotent");
  state=await request(null);
  const approval=state.data.events.find(e=>e.job_id===jobId&&e.action==="customer_approve");
  const expectedDue=new Date(Date.parse(approval.created_at)+(14*24+7)*3600000).toISOString().slice(0,10);
  expect(state.data.jobs.find(j=>j.id===jobId).due_at===expectedDue,"Deadline is Bangkok approval date plus 14 days");
  await action("submit","english_script","ls",{assetRef:"script-test.pdf"});
  await action("submit","video_assets","video");
  result=await request({action:"submit",jobId,type:"pdf",actorId:"pdf",requestKey:randomUUID()});
  expect(result.status===409,"PDF waits for vocabulary");
  await action("submit","vocabulary","pdf");
  await action("approve","vocabulary","qa");
  await action("submit","pdf","pdf");
  result=await request({action:"submit",jobId,type:"final_qa",actorId:"qa",requestKey:randomUUID()});
  expect(result.status===400,"Final QA is removed");
  result=await request({action:"submit",jobId,type:"timestamps",actorId:"pdf",requestKey:randomUUID()});
  expect(result.status===409,"Timestamp waits for all outputs");
  for(const type of ["listening","exercise","imitation"]) {
    await action("submit",type,"video");
    if(type==="listening") {
      await action("reject",type,"qa",{note:"แก้เสียง"});
      await action("submit",type,"video");
    }
    await action("approve",type,"qa");
  }
  const submitted=await action("submit","pdf","pdf").catch(()=>null);
  expect(submitted===null,"Duplicate PDF submit must fail");
  await action("approve","pdf","qa");
  const timestamp=await action("submit","timestamps","pdf");
  expect((await request(timestamp.body)).data.duplicate,"Timestamp submission is idempotent");
  const approved=await action("approve","timestamps","pdf");
  expect((await request(approved.body)).data.duplicate,"Final approval retry is idempotent");
  result=await request({action:"deliver",jobId,type:null,actorId:"admin",requestKey:randomUUID()});
  expect(result.status!==200,"Removed delivery action cannot change state");
  state=await request(null);
  const finalJob=state.data.jobs.find(j=>j.id===jobId);
  expect(!finalJob.delivered_at,"Completion no longer needs delivery");
  expect(state.data.items.find(i=>i.job_id===jobId&&i.type==="timestamps")?.status==="approved","Timestamp approval closes job");
  expect(finalJob.due_at===expectedDue,"Deadline survives later work");
  const jobEvents=state.data.events.filter(e=>e.job_id===jobId);
  expect(jobEvents.length>=20,"Audit history must retain actions");
  expect(jobEvents.every(e=>e.actor_name&&e.created_at),"Every event must have actor and time");
  const secondClient=await request(null);
  expect(secondClient.data.jobs.find(j=>j.id===jobId)?.due_at===expectedDue,"Second client must see shared state");
  expect(state.data.items.find(i=>i.job_id===jobId&&i.type==="english_script")?.asset_ref==="script-test.pdf","Asset reference must persist");
  console.log(JSON.stringify({ok:true,orderRef,eventCount:jobEvents.length,checks:["auth","full flow","parallel branches","rework","idempotency","audit","second client"]}));
} catch(error) {
  console.error(error);
  console.error(log.slice(-1400));
  process.exitCode=1;
} finally {
  server.kill();
}
