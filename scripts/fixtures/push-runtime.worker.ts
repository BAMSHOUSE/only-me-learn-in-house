import {buildPushPayload, type PushSubscription, type VapidKeys} from "@block65/webcrypto-web-push";
import {createPushRequest} from "../../lib/push";
export default {async fetch(request: Request) {
  try {
    const {subscription,vapid}=await request.json() as {subscription:PushSubscription;vapid:VapidKeys};
    const payload=await buildPushPayload({data:{title:"Runtime regression",body:"Synthetic data"},options:{ttl:60}},subscription,vapid);
    const outgoing=createPushRequest(subscription.endpoint,payload);
    if(outgoing.redirect!=="manual")throw Error("Push credentials must not follow redirects");
    return Response.json({ok:true,length:payload.body.byteLength});
  } catch(error) {
    return Response.json({ok:false,name:error instanceof Error?error.name:"Unknown",message:error instanceof Error?error.message:"Unknown"});
  }
}};
