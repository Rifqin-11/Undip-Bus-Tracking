import type { Locale } from "@/lib/i18n/config";
import { enResources } from "@/lib/i18n/locales/en";
import { idResources } from "@/lib/i18n/locales/id";

/**
 * Application translation resources composed from per-locale modules.
 */
export const resources = {
  id: idResources,
  en: enResources,
} as const;

export type I18nResources = (typeof resources)[Locale];
