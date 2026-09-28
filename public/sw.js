// Service worker. Only two jobs: show notifications (mobile Chrome has no
// `new Notification()`, only registration.showNotification) and bring the app
// to the front on a tap, opening that chat. Nothing is cached on purpose, so
// deploys are picked up immediately.

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const data = event.notification.data || {};
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      const client = windows.find((c) => new URL(c.url).origin === self.location.origin);
      if (client) {
        await client.focus();
        client.postMessage({ type: "open-chat", chatId: data.chatId, kind: data.kind });
        return;
      }
      const query = data.chatId ? `?chat=${encodeURIComponent(data.chatId)}&kind=${encodeURIComponent(data.kind || "contact")}` : "";
      await self.clients.openWindow("/" + query);
    })()
  );
});
