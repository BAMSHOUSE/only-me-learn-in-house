import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createLocalFixture } from "./test-fixture.mjs";
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||"playwright");
const pair=await crypto.subtle.generateKey({name:"ECDSA",namedCurve:"P-256"},true,["sign","verify"]);
const publicKey=Buffer.from(await crypto.subtle.exportKey("raw",pair.publicKey)).toString("base64url");
const privateKey=(await crypto.subtle.exportKey("jwk",pair.privateKey)).d;
const subPair=await crypto.subtle.generateKey({name:"ECDH",namedCurve:"P-256"},true,["deriveBits"]);
const subscription={endpoint:"https://fcm.googleapis.com/fcm/send/local-ui-test-"+crypto.randomUUID(),keys:{
 p256dh:Buffer.from(await crypto.subtle.exportKey("raw",subPair.publicKey)).toString("base64url"),
 auth:Buffer.from(crypto.getRandomValues(new Uint8Array(16))).toString("base64url")}};
const server=spawn(process.execPath,["--import","./scripts/sites-env.mjs","./node_modules/wrangler/bin/wrangler.js","dev","--config","dist/server/wrangler.json","--local","--persist-to",".wrangler/state","--ip","127.0.0.1","--port","8793","--inspector-port","0","--var","DEMO_ACCESS_TOKEN:push-test","--var","VAPID_PUBLIC_KEY:"+publicKey,"--var","VAPID_PRIVATE_KEY:"+privateKey],{stdio:["ignore","pipe","pipe"],env:{...process.env,WRANGLER_SEND_METRICS:"false"}});
let output="",browser;
for(const stream of [server.stdout,server.stderr])stream.on("data",b=>output+=b);
try{
 for(let i=0;i<100&&!output.includes("Ready on");i++)await new Promise(r=>setTimeout(r,200));
 assert(output.includes("Ready on"));
 browser=await chromium.launch({channel:"msedge",headless:true});
 const context=await browser.newContext({permissions:["notifications"]});
 const page=await context.newPage(),errors=[];
 page.on("pageerror",e=>errors.push(String(e)));
 // Mock only subscription creation; API, database and service worker are real.
 await page.addInitScript(sub=>{
  let current=null;
  PushManager.prototype.getSubscription=async()=>current;
  PushManager.prototype.subscribe=async()=>current={toJSON:()=>sub,unsubscribe:async()=>{current=null;return true}};
 },subscription);
 await page.goto("http://127.0.0.1:8793/");
 await page.getByRole("button",{name:"เปิดแจ้งเตือน",exact:true}).waitFor();
 assert.equal(await page.locator("#push-options").count(),0);
 await page.getByRole("button",{name:"เปิดแจ้งเตือน",exact:true}).click();
 await page.getByRole("button",{name:"อนุญาตแจ้งเตือน",exact:true}).click();
 await page.getByRole("button",{name:"แจ้งเตือนเปิดอยู่",exact:true}).waitFor();
 const bad=await page.evaluate(async sub=>{const r=await fetch("/api/push",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"subscribe",subscription:{...sub,endpoint:"https://localhost/private"}})});return r.status},subscription);
 assert.equal(bad,400,"Unsafe endpoints rejected");
 await page.getByRole("button",{name:"ปิดแจ้งเตือน",exact:true}).click();
 await page.getByRole("button",{name:"เปิดแจ้งเตือน",exact:true}).waitFor();
 const after=await page.evaluate(async sub=>{const r=await fetch("/api/push",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"test",subscription:sub})});return r.status},subscription);
 assert.equal(after,409,"Disabled subscription removed from D1");
 await page.setViewportSize({width:390,height:844});
 assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),"No mobile overflow");
 await page.getByRole("button",{name:"ปิดตั้งค่าแจ้งเตือน"}).click();
 const control=await context.newPage();
 const cdp=await context.newCDPSession(control);
 let registrationId;
 cdp.on("ServiceWorker.workerRegistrationUpdated",({registrations})=>{
  registrationId=registrations.find(r=>r.scopeURL==="http://127.0.0.1:8793/")?.registrationId||registrationId;
 });
 await cdp.send("ServiceWorker.enable");
 await page.evaluate(()=>navigator.serviceWorker.ready);
 for(let i=0;i<40&&!registrationId;i++)await new Promise(r=>setTimeout(r,100));
 assert(registrationId,"Service worker registered");
 await page.close();
 await cdp.send("ServiceWorker.deliverPushMessage",{origin:"http://127.0.0.1:8793",registrationId,data:JSON.stringify({title:"Approve",body:"QA · นักเรียนทดสอบ",tag:"closed-tab-test",url:"/?job=test"})});
 await new Promise(r=>setTimeout(r,500));
 const reopened=await context.newPage();
 await reopened.goto("http://127.0.0.1:8793/");
 await reopened.getByRole("button",{name:"เปิดแจ้งเตือน",exact:true}).waitFor();
 const notices=await reopened.evaluate(async()=>{const reg=await navigator.serviceWorker.ready;return (await reg.getNotifications()).map(n=>({title:n.title,tag:n.tag,url:n.data.url}))});
 assert(notices.some(n=>n.tag==="closed-tab-test"&&n.title==="Approve"),"Push shown while app tab closed");
 await reopened.evaluate(async()=>{for(const n of await (await navigator.serviceWorker.ready).getNotifications())n.close()});
 const id=createLocalFixture();
 await reopened.goto("http://127.0.0.1:8793/?job="+id);
 await reopened.locator(".student-steps").waitFor();
 assert.equal(await reopened.locator(".step-row").count(),11,"Notification deep link opens student");
 assert.deepEqual(errors,[]);
 console.log(JSON.stringify({ok:true,checks:["opt-in","subscription persistence","endpoint validation","unsubscribe","mobile","closed-tab push via CDP","student deep link"],limits:"Push provider and hardware sound not exercised by CDP simulation"}));
}catch(e){console.error(e);process.exitCode=1}finally{await browser?.close();server.kill()}
