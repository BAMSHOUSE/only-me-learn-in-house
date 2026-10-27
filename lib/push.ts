import { env, waitUntil } from "cloudflare:workers";
import { buildPushPayload, type PushSubscription } from "@block65/webcrypto-web-push";
import { actions, names } from "./workflow";

export type Subscription = {endpoint: string; keys: {p256dh: string; auth: string}};
type Row = {endpoint: string; p256dh: string; auth: string};
export type PushNotice = {title: string; body: string; tag: string; url: string};
export const pushConfigured = () => !!(env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY);

export async function pushTable() {
  if (!env.DB) throw new Error("Database unavailable");
  await env.DB.prepare("CREATE TABLE IF NOT EXISTS push_subscriptions (endpoint TEXT PRIMARY KEY, p256dh TEXT NOT NULL, auth TEXT NOT NULL, updated_at TEXT NOT NULL)").run();
  return env.DB;
}
export function validSubscription(value: unknown): value is Subscription {
  if (!value || typeof value !== "object") return false;
  const s = value as Subscription;
  if (typeof s.endpoint !== "string" || s.endpoint.length > 2000) return false;
  try {
    const url = new URL(s.endpoint);
    const host = url.hostname;
    const allowed = host === "fcm.googleapis.com" || host === "updates.push.services.mozilla.com" ||
      host === "web.push.apple.com" || host.endsWith(".notify.windows.com");
    if (!allowed || url.protocol !== "https:" || url.port || url.username || url.password || url.hash) return false;
    const key = (v: unknown, length: number) => typeof v === "string" &&
      /^[A-Za-z0-9_-]+$/.test(v) && atob(v.replace(/-/g, "+").replace(/_/g, "/")).length === length;
    return key(s.keys?.auth, 16) && key(s.keys?.p256dh, 65);
  } catch { return false; }
}
export function createPushRequest(endpoint: string, payload: Awaited<ReturnType<typeof buildPushPayload>>) {
  // Workers supports manual/follow only. Never follow a redirect with push credentials.
  return new Request(endpoint, {...payload, redirect: "manual", signal: AbortSignal.timeout(4000)});
}
export async function sendPush(subscription: Subscription, notice: PushNotice) {
  const payload = await buildPushPayload(
    {data: notice, options: {ttl: 3600, urgency: "normal"}},
    subscription as PushSubscription,
    {subject: "https://only-me-learn-operations.loyal-yak-3926.chatgpt.site",
      publicKey: env.VAPID_PUBLIC_KEY!, privateKey: env.VAPID_PRIVATE_KEY!}
  );
  const response = await fetch(createPushRequest(subscription.endpoint, payload));
  await response.body?.cancel();
  if (response.status === 404 || response.status === 410) {
    await env.DB!.prepare("DELETE FROM push_subscriptions WHERE endpoint=? AND auth=?")
      .bind(subscription.endpoint, subscription.keys.auth).run();
  }
  return response.status;
}
// Only called after a successful transition; duplicate requests do not notify.
export function notifyWork(action: string, job: {id: string; nickname: string}, actor: string, type?: string) {
  if (!pushConfigured() || !["audio", "submit", "approve", "customer_approve"].includes(action)) return;
  const notice: PushNotice = {
    title: actions[action],
    body: actor + " · " + job.nickname + (type ? " · " + names[type] : ""),
    tag: crypto.randomUUID(),
    url: "/?job=" + encodeURIComponent(job.id),
  };
  waitUntil((async () => {
    const db = await pushTable();
    const rows = (await db.prepare("SELECT endpoint,p256dh,auth FROM push_subscriptions LIMIT 100").all<Row>()).results;
    for (let i = 0; i < rows.length; i += 20) {
      await Promise.all(rows.slice(i, i + 20).map(async row => {
        try {
          const status = await sendPush({endpoint: row.endpoint, keys: {p256dh: row.p256dh, auth: row.auth}}, notice);
          if (status < 200 || status >= 300) console.warn("Push provider rejected notification", status);
        } catch { console.warn("Push delivery unavailable"); }
      }));
    }
  })().catch(() => console.warn("Push notification dispatch unavailable")));
}
