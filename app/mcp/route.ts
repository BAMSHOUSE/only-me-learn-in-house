import {runSyncTool} from "../../lib/airtable-sync";
export const runtime="edge";
export const dynamic="force-dynamic";
const string={type:"string"};
const properties={recordId:string,name:string,occupation:string,folderId:string,monthFolderId:string,year:{type:"integer"},month:{type:"integer"},sourceCreatedAt:string,claimId:string};
const tools=[
 {name:"sync_status",description:"Read Only Me Learn sync instructions, persisted mappings and pending folder claims. Owner only.",inputSchema:{type:"object",properties:{offset:{type:"integer",minimum:0}},additionalProperties:false}},
 {name:"claim_folder",description:"Atomically reserve a student folder creation. Create only if acquired is true; never retry an uncertain Drive create. Owner only.",inputSchema:{type:"object",properties,required:["recordId","name","monthFolderId","year","month"],additionalProperties:false}},
 {name:"synchronize_student",description:"Idempotently import a verified paid Only Me Learn Airtable student and existing Drive folder; preserves workflow progress. Verify Drive parent under the configured root first. Owner only.",inputSchema:{type:"object",properties,required:["recordId","name","occupation","folderId","monthFolderId","year","month","sourceCreatedAt"],additionalProperties:false}},
 {name:"complete_sync",description:"Record successful full-table sync only after every page and row was reconciled and read back. Owner only.",inputSchema:{type:"object",properties:{},additionalProperties:false}},
 {name:"remove_confirmed_demo_jobs",description:"Delete only the seven demo job IDs explicitly confirmed by the owner, with their events and work items. Preserve real jobs, signers and push subscriptions. Idempotent. Owner only.",inputSchema:{type:"object",properties:{},additionalProperties:false}}
];
export async function POST(request:Request){let body:{id?:string|number;method?:string;params?:{protocolVersion?:string;name?:string;arguments?:Record<string,unknown>}};try{const parsed=await request.json();if(!parsed||typeof parsed!=="object"||Array.isArray(parsed))throw Error("Invalid request");body=parsed as typeof body}catch{return Response.json({error:"Invalid JSON"},{status:400})}const id=body.id??null;const reply=(result:unknown)=>Response.json({jsonrpc:"2.0",id,result},{headers:{"Cache-Control":"no-store"}});
 if(body.method==="server/discover")return reply({supportedVersions:["2026-07-28"],capabilities:{tools:{}}});
 if(body.method==="initialize")return reply({protocolVersion:body.params?.protocolVersion||"2026-07-28",capabilities:{tools:{}},serverInfo:{name:"Only Me Learn sync",version:"1.0.0"}});
 if(body.method?.startsWith("notifications/"))return new Response(null,{status:202});
 if(body.method==="tools/list")return reply({tools});
 if(body.method!=="tools/call")return Response.json({jsonrpc:"2.0",id,error:{code:-32601,message:"Method not found"}});
 if(!request.headers.get("oai-authenticated-user-id")||request.headers.get("oai-authenticated-user-email")?.toLowerCase()!=="owner@example.com")return reply({isError:true,content:[{type:"text",text:"Owner authentication required. Connect this Site plugin with the owner's account."}]});
 try{return reply({content:[{type:"text",text:JSON.stringify(await runSyncTool(String(body.params?.name),body.params?.arguments||{}))}]})}catch(e){return reply({isError:true,content:[{type:"text",text:String(e)}]})}
}
