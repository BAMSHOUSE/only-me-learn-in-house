import { env } from "cloudflare:workers";
import { sameOrigin, validSession } from "../../../lib/session";
import { pushConfigured, pushTable, sendPush, validSubscription } from "../../../lib/push";
export const runtime = "edge";
export const dynamic = "force-dynamic";
const json = (data: unknown, status = 200) => Response.json(data, {status, headers: {"Cache-Control": "no-store"}});
export async function GET(request: Request) {
  if (!await validSession(request)) return json({error: "กรุณารีเฟรชหน้าเว็บ"}, 401);
  return json({publicKey: env.VAPID_PUBLIC_KEY || null, configured: pushConfigured()});
}
export async function POST(request: Request) {
  if (!sameOrigin(request) || !await validSession(request)) return json({error: "ไม่ได้รับอนุญาต"}, 403);
  try {
    const raw = await request.text();
    if (raw.length > 4000) return json({error: "ข้อมูลมากเกินไป"}, 400);
    const {action, subscription} = JSON.parse(raw);
    if (!validSubscription(subscription)) return json({error: "ข้อมูลการแจ้งเตือนไม่ถูกต้อง"}, 400);
    const db = await pushTable();
    if (action === "unsubscribe") {
      await db.prepare("DELETE FROM push_subscriptions WHERE endpoint=? AND auth=?")
        .bind(subscription.endpoint, subscription.keys.auth).run();
      return json({ok: true});
    }
    if (!pushConfigured()) return json({error: "ระบบแจ้งเตือนยังไม่พร้อม"}, 503);
    if (action === "subscribe") {
      const result = await db.prepare(
        "INSERT INTO push_subscriptions (endpoint,p256dh,auth,updated_at) SELECT ?,?,?,? WHERE (SELECT COUNT(*) FROM push_subscriptions)<100 OR EXISTS(SELECT 1 FROM push_subscriptions WHERE endpoint=?) ON CONFLICT(endpoint) DO UPDATE SET p256dh=excluded.p256dh,updated_at=excluded.updated_at WHERE push_subscriptions.auth=excluded.auth"
      ).bind(subscription.endpoint, subscription.keys.p256dh, subscription.keys.auth, new Date().toISOString(), subscription.endpoint).run();
      if (!result.meta.changes) return json({error: "ลงทะเบียนแจ้งเตือนไม่สำเร็จ กรุณาติดต่อผู้ดูแล"}, 409);
      return json({ok: true});
    }
    if (action === "test") {
      const own = await db.prepare("SELECT endpoint FROM push_subscriptions WHERE endpoint=? AND auth=?")
        .bind(subscription.endpoint, subscription.keys.auth).first();
      if (!own) return json({error: "กรุณาเปิดแจ้งเตือนก่อน"}, 409);
      const status = await sendPush(subscription, {title: "Only Me Learn", body: "รับแจ้งเตือนได้แล้ว · เสียงขึ้นอยู่กับการตั้งค่าคอมพิวเตอร์", tag: "push-test", url: "/"});
      return status >= 200 && status < 300 ? json({ok: true}) : json({error: "ส่งแจ้งเตือนไม่สำเร็จ กรุณาปิดแล้วเปิดแจ้งเตือนอีกครั้ง"}, 502);
    }
    return json({error: "ไม่รู้จักคำขอ"}, 400);
  } catch { return json({error: "เชื่อมต่อระบบแจ้งเตือนไม่สำเร็จ กรุณาลองอีกครั้ง"}, 503); }
}
