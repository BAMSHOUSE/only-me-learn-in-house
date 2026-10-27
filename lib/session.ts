import { env } from "cloudflare:workers";
export function sameOrigin(request:Request) {
  return request.headers.get("Origin")===new URL(request.url).origin;
}
async function key(){
  if(!env.DEMO_ACCESS_TOKEN)throw new Error("Session signing secret missing");
  return crypto.subtle.importKey("raw",new TextEncoder().encode(env.DEMO_ACCESS_TOKEN),{name:"HMAC",hash:"SHA-256"},false,["sign","verify"]);
}
export async function newSession(){
  const payload=String(Date.now()+86400000)+"."+crypto.randomUUID();
  const signature=await crypto.subtle.sign("HMAC",await key(),new TextEncoder().encode(payload));
  return payload+"."+Array.from(new Uint8Array(signature),b=>b.toString(16).padStart(2,"0")).join("");
}
export async function validSession(request:Request){
  const value=request.headers.get("Cookie")?.split(";").map(s=>s.trim()).find(s=>s.startsWith("oml_session="))?.slice(12);
  if(!value)return false;
  const [expires,nonce,signature,...extra]=value.split(".");
  if(extra.length||!nonce||!/^\d+$/.test(expires)||Number(expires)<Date.now()||!signature||!/^[a-f0-9]{64}$/.test(signature))return false;
  const bytes=Uint8Array.from(signature.match(/../g)!,v=>parseInt(v,16));
  return crypto.subtle.verify("HMAC",await key(),bytes,new TextEncoder().encode(expires+"."+nonce));
}
