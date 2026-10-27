import { newSession, sameOrigin } from "../../../lib/session";
export const runtime="edge";
export const dynamic="force-dynamic";
export async function POST(request:Request){
  if(!sameOrigin(request))return Response.json({error:"Cross-origin request denied"},{status:403});
  const secure=new URL(request.url).protocol==="https:"?"; Secure":"";
  return Response.json({ok:true},{headers:{"Cache-Control":"no-store","Set-Cookie":"oml_session="+await newSession()+"; HttpOnly; SameSite=Strict; Path=/; Max-Age=86400"+secure}});
}
