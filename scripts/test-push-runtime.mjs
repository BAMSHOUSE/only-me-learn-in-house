import {spawn} from "node:child_process";
import {mkdir,writeFile} from "node:fs/promises";
import {fileURLToPath} from "node:url";
await mkdir("outputs",{recursive:true});
await writeFile("outputs/push-runtime.json",JSON.stringify({name:"local-push-runtime-test",main:fileURLToPath(new URL("./fixtures/push-runtime.worker.ts",import.meta.url)),compatibility_date:"2026-05-15",compatibility_flags:["nodejs_compat"]}));
const server=spawn(process.execPath,["--import","./scripts/sites-env.mjs","./node_modules/wrangler/bin/wrangler.js","dev","--config","outputs/push-runtime.json","--local","--ip","127.0.0.1","--port","8795","--inspector-port","0"],{stdio:["ignore","pipe","pipe"],env:{...process.env,WRANGLER_SEND_METRICS:"false"}});
let output="";
for(const stream of [server.stdout,server.stderr])stream.on("data",b=>output+=b);
try{
 for(let i=0;i<100&&!output.includes("Ready on");i++)await new Promise(r=>setTimeout(r,200));
 if(!output.includes("Ready on"))throw Error(output);
 const key=await crypto.subtle.generateKey({name:"ECDSA",namedCurve:"P-256"},true,["sign","verify"]);
 const sub=await crypto.subtle.generateKey({name:"ECDH",namedCurve:"P-256"},true,["deriveBits"]);
 const raw=async k=>Buffer.from(await crypto.subtle.exportKey("raw",k)).toString("base64url");
 const body={subscription:{endpoint:"https://fcm.googleapis.com/fcm/send/test-only",keys:{p256dh:await raw(sub.publicKey),auth:Buffer.from(crypto.getRandomValues(new Uint8Array(16))).toString("base64url")}},vapid:{subject:"https://example.com",publicKey:await raw(key.publicKey),privateKey:(await crypto.subtle.exportKey("jwk",key.privateKey)).d}};
 const result=await (await fetch("http://127.0.0.1:8795",{method:"POST",body:JSON.stringify(body)})).json();
 if(!result.ok)throw Error(JSON.stringify(result));
 console.log(JSON.stringify({ok:true,checks:["Web Push encryption and Request creation in Cloudflare Worker runtime","redirects are not followed"]}));
}catch(error){console.error(error);process.exitCode=1}finally{server.kill()}
