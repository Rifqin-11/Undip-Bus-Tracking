self.addEventListener("push", (event) => {
  let data = {};

  if (event.data) {
    try {
      data = event.data.json();
    } catch {
      data = { title: "SIMOBI", body: event.data.text() };
    }
  }

  const title = data.title || "SIMOBI";
  const options = {
    body: data.body || "Ada pembaruan dari SIMOBI.",
    icon: data.icon || "/logo.svg",
    badge: data.badge || "/logo.svg",
    tag: data.tag || "simobi-notification",
    data: {
      url: data.url || "/",
      ...(data.data || {}),
    },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const targetUrl = event.notification.data?.url || "/";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ("focus" in client) {
          client.navigate(targetUrl);
          return client.focus();
        }
      }

      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }

      return undefined;
    }),
  );
});
