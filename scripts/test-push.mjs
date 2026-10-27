import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import ts from "typescript";
const encode = bytes => Buffer.from(bytes).toString("base64url");
const key = await crypto.subtle.generateKey({name:"ECDSA",namedCurve:"P-256"},true,["sign","verify"]);
const publicKey = encode(await crypto.subtle.exportKey("raw",key.publicKey));
const privateKey = (await crypto.subtle.exportKey("jwk",key.privateKey)).d;
const subscriber = await crypto.subtle.generateKey({name:"ECDH",namedCurve:"P-256"},true,["deriveBits"]);
const subscription = {endpoint:"https://fcm.googleapis.com/fcm/send/test-only",keys:{
  p256dh:encode(await crypto.subtle.exportKey("raw",subscriber.publicKey)),auth:encode(crypto.getRandomValues(new Uint8Array(16)))}};
const requests=[], pending=[], deleted=[];
let providerStatus=201;
let rows=[{endpoint:subscription.endpoint,...subscription.keys}];
globalThis.__pushTest={
 env:{VAPID_PUBLIC_KEY:publicKey,VAPID_PRIVATE_KEY:privateKey,DB:{prepare(sql){return {
  bind(...args){this.args=args;return this},
  async run(){if(sql.startsWith("DELETE"))deleted.push(this.args);return {meta:{changes:1}}},
  async all(){return {results:rows}}
 }}}},
 waitUntil(promise){pending.push(promise)}
};
const originalFetch=globalThis.fetch;
globalThis.fetch=async(request)=>{requests.push({endpoint:request.url,init:{headers:Object.fromEntries(request.headers),body:new Uint8Array(await request.arrayBuffer()),redirect:request.redirect}});if(providerStatus==="throw")throw Error("Network unavailable");return new Response(null,{status:providerStatus})};
const compile = source => ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const url = source => "data:text/javascript;base64,"+Buffer.from(source).toString("base64");
const workflow=url(compile(await readFile("lib/workflow.ts","utf8")));
const source=(await readFile("lib/push.ts","utf8"))
 .replace('import { env, waitUntil } from "cloudflare:workers";','const {env,waitUntil}=globalThis.__pushTest;')
 .replace('"@block65/webcrypto-web-push"',JSON.stringify(import.meta.resolve("@block65/webcrypto-web-push")))
 .replace('"./workflow"',JSON.stringify(workflow));
const {validSubscription,sendPush,notifyWork}=await import(url(compile(source)));
try {
 assert(validSubscription(subscription));
 for(const endpoint of ["http://fcm.googleapis.com/a","https://fcm.googleapis.com.evil.test/a","https://localhost/a","https://127.0.0.1/a","https://user@fcm.googleapis.com/a","https://fcm.googleapis.com:8443/a"]){
  assert.equal(validSubscription({...subscription,endpoint}),false,endpoint);
 }
 assert.equal(validSubscription({...subscription,keys:{auth:"bad",p256dh:"bad"}}),false);
 await sendPush(subscription,{title:"ทดสอบ",body:"ข้อความส่วนตัว",tag:"test",url:"/?job=test"});
 assert.equal(requests[0].init.headers["content-encoding"],"aes128gcm");
 assert.match(requests[0].init.headers.authorization,/vapid /i);
 assert(!Buffer.from(requests[0].init.body).includes(Buffer.from("ข้อความส่วนตัว")));
 assert.equal(requests[0].init.redirect,"manual","Push credentials must not follow redirects");
 requests.length=0;
 for(const action of ["audio","submit","approve","customer_approve","start","reject","demo_seed"]){
  notifyWork(action,{id:"test-job",nickname:"นักเรียนทดสอบ"},"QA","listening");
 }
 await Promise.all(pending.splice(0));
 assert.equal(requests.length,4,"Only new submissions and approvals notify");
 providerStatus=410;
 await sendPush(subscription,{title:"test",body:"",tag:"",url:"/"});
 assert.equal(deleted.length,1,"Expired subscriptions removed");
 providerStatus="throw";
 notifyWork("approve",{id:"test",nickname:"ทดสอบ"},"QA","pdf");
 await Promise.all(pending.splice(0)); // Provider failures are contained.
 console.log(JSON.stringify({ok:true,checks:["endpoint validation","encrypted aes128gcm","VAPID","action filtering","expired subscription cleanup","provider failure isolation"]}));
} finally {globalThis.fetch=originalFetch;delete globalThis.__pushTest}
