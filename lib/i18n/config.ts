/**
 * Internationalization configuration.
 *
 * Defines supported locales, namespaces, and locale normalization rules shared by
 * middleware, server components, and browser helpers.
 */
export const locales = ["id", "en"] as const;

export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = "id";
export const localeCookieName = "NEXT_LOCALE";

export const namespaces = [
  "common",
  "navigation",
  "auth",
  "dashboard",
  "admin",
  "settings",
  "history",
  "notifications",
  "errors",
] as const;

export type I18nNamespace = (typeof namespaces)[number];

export function isLocale(value: string | undefined | null): value is Locale {
  return !!value && (locales as readonly string[]).includes(value);
}

export function normalizeLocale(value: string | undefined | null): Locale {
  if (!value) return defaultLocale;
  const base = value.toLowerCase().split("-")[0];
  return isLocale(base) ? base : defaultLocale;
}
