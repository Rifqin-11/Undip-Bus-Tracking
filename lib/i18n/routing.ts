import { defaultLocale, isLocale, type Locale } from "@/lib/i18n/config";

const PUBLIC_FILE = /\.(.*)$/;

export function getLocaleFromPath(pathname: string): Locale | null {
  const segment = pathname.split("/").filter(Boolean)[0];
  return isLocale(segment) ? segment : null;
}

export function stripLocaleFromPath(pathname: string): string {
  const locale = getLocaleFromPath(pathname);
  if (!locale) return pathname || "/";
  const stripped = pathname.slice(locale.length + 1);
  return stripped.startsWith("/") ? stripped || "/" : `/${stripped}`;
}

export function localizePath(pathname: string, locale: Locale): string {
  const stripped = stripLocaleFromPath(pathname);
  if (stripped === "/") return `/${locale}`;
  return `/${locale}${stripped}`;
}

export function replaceLocaleInPath(pathname: string, locale: Locale): string {
  return localizePath(pathname, locale);
}

export function pathShouldSkipLocale(pathname: string): boolean {
  return (
    pathname.startsWith("/api/") ||
    pathname === "/api" ||
    pathname.startsWith("/_next/") ||
    pathname.startsWith("/_vercel/") ||
    pathname === "/favicon.ico" ||
    pathname === "/manifest.webmanifest" ||
    pathname === "/manifest.json" ||
    pathname === "/logo.svg" ||
    PUBLIC_FILE.test(pathname)
  );
}

export function ensureLocale(value: string | null | undefined): Locale {
  return isLocale(value) ? value : defaultLocale;
}
