import webPush, { type PushSubscription } from "web-push";

let configured = false;

export function getVapidPublicKey() {
  return process.env.NEXT_PUBLIC_WEB_PUSH_VAPID_PUBLIC_KEY?.trim() ?? "";
}

export function hasWebPushConfig() {
  return Boolean(
    getVapidPublicKey() &&
      process.env.WEB_PUSH_VAPID_PRIVATE_KEY?.trim() &&
      process.env.WEB_PUSH_VAPID_SUBJECT?.trim(),
  );
}

export function configureWebPush() {
  if (configured) return true;

  const publicKey = getVapidPublicKey();
  const privateKey = process.env.WEB_PUSH_VAPID_PRIVATE_KEY?.trim();
  const subject = process.env.WEB_PUSH_VAPID_SUBJECT?.trim();

  if (!publicKey || !privateKey || !subject) return false;

  webPush.setVapidDetails(subject, publicKey, privateKey);
  configured = true;
  return true;
}

export type WebPushSubscriptionPayload = PushSubscription;

export async function sendWebPush(
  subscription: WebPushSubscriptionPayload,
  payload: unknown,
) {
  if (!configureWebPush()) {
    throw new Error(
      "Web Push env belum lengkap. Set NEXT_PUBLIC_WEB_PUSH_VAPID_PUBLIC_KEY, WEB_PUSH_VAPID_PRIVATE_KEY, dan WEB_PUSH_VAPID_SUBJECT.",
    );
  }

  return webPush.sendNotification(subscription, JSON.stringify(payload));
}
