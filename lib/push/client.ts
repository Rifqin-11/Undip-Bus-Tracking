"use client";

/**
 * Browser Web Push client helpers.
 *
 * Registers the service worker, converts VAPID keys, and talks to subscription
 * APIs while keeping PushManager details out of UI components.
 */
import type { LatLng } from "@/hooks/useUserPosition";

type SubscribeOptions = {
  userPosition?: LatLng | null;
  nearbyAlertRadiusMeters?: number;
};

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, "+")
    .replace(/_/g, "/");
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)));
}

function supportsWebPush() {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

async function getServiceWorkerRegistration() {
  const registration = await navigator.serviceWorker.register("/sw.js");
  await navigator.serviceWorker.ready;
  return registration;
}

export async function subscribeToWebPush({
  userPosition,
  nearbyAlertRadiusMeters,
}: SubscribeOptions) {
  if (!supportsWebPush()) {
    throw new Error("Browser belum mendukung Service Worker dan Push API.");
  }

  const vapidPublicKey = process.env.NEXT_PUBLIC_WEB_PUSH_VAPID_PUBLIC_KEY;
  if (!vapidPublicKey) {
    throw new Error("NEXT_PUBLIC_WEB_PUSH_VAPID_PUBLIC_KEY belum dikonfigurasi.");
  }

  const registration = await getServiceWorkerRegistration();
  const existingSubscription =
    await registration.pushManager.getSubscription();
  const subscription =
    existingSubscription ??
    (await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
    }));

  const response = await fetch("/api/push/subscribe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      subscription,
      userPosition,
      nearbyAlertRadiusMeters,
    }),
  });

  if (!response.ok) {
    const data = (await response.json().catch(() => null)) as
      | { error?: string }
      | null;
    throw new Error(data?.error ?? "Gagal menyimpan push subscription.");
  }

  return subscription;
}

export async function unsubscribeFromWebPush() {
  if (!supportsWebPush()) return;

  const registration = await navigator.serviceWorker.getRegistration("/sw.js");
  const subscription = await registration?.pushManager.getSubscription();
  if (!subscription) return;

  await fetch("/api/push/unsubscribe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ endpoint: subscription.endpoint }),
  }).catch(() => undefined);

  await subscription.unsubscribe();
}
