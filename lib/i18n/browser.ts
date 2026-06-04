"use client";

/**
 * Browser-side locale cookie helper.
 *
 * Used when the user changes language so middleware can keep future requests on
 * the selected `/id` or `/en` route prefix.
 */
import { localeCookieName, type Locale } from "@/lib/i18n/config";

export function setLocaleCookie(locale: Locale) {
  document.cookie = `${localeCookieName}=${locale}; path=/; max-age=31536000; samesite=lax`;
}
