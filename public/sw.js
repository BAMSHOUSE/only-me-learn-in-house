/* Notifications only: do not cache application pages or API data. */
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", event => event.waitUntil(self.clients.claim()));
self.addEventListener("push", event => {
  let data = {};
  try { data = event.data?.json() || {}; } catch {}
  const target = new URL(data.url || "/", self.location.origin);
  const url = target.origin === self.location.origin ? target.href : self.location.origin;
  event.waitUntil(self.registration.showNotification(data.title || "Only Me Learn", {
    body: data.body || "มีการอัปเดตงาน",
    icon: "/favicon.svg",
    tag: data.tag || "work-update",
    data: {url},
    silent: false
  }));
});
self.addEventListener("notificationclick", event => {
  event.notification.close();
  const target = new URL(event.notification.data?.url || "/", self.location.origin);
  const url = target.origin === self.location.origin ? target.href : self.location.origin;
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({type: "window", includeUncontrolled: true});
    const existing = windows.find(client => new URL(client.url).origin === self.location.origin);
    if (existing) {
      await existing.navigate(url);
      await existing.focus();
    } else await self.clients.openWindow(url);
  })());
});
