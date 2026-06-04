"use client";

/**
 * Client-side i18n provider.
 *
 * Creates one i18next instance per rendered provider and syncs it with the route
 * locale so components can use `useTranslation()` consistently.
 */
import { createContext, useContext, useEffect, useMemo, type ReactNode } from "react";
import i18next, { type i18n as I18nInstance } from "i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import { I18nextProvider, initReactI18next } from "react-i18next";
import { defaultLocale, localeCookieName, namespaces, type Locale } from "@/lib/i18n/config";
import { resources } from "@/lib/i18n/resources";

const LocaleContext = createContext<Locale>(defaultLocale);

let initialized = false;

function initI18next(locale: Locale): I18nInstance {
  if (!initialized) {
    i18next
      .use(LanguageDetector)
      .use(initReactI18next)
      .init({
        resources,
        lng: locale,
        fallbackLng: defaultLocale,
        supportedLngs: ["id", "en"],
        ns: namespaces,
        defaultNS: "common",
        interpolation: { escapeValue: false },
        react: { useSuspense: false },
        detection: {
          order: ["path", "cookie", "navigator"],
          lookupCookie: localeCookieName,
          caches: ["cookie"],
        },
      });
    initialized = true;
    return i18next;
  }

  if (i18next.language !== locale) {
    void i18next.changeLanguage(locale);
  }
  return i18next;
}

export function I18nProvider({
  locale,
  children,
}: {
  locale: Locale;
  children: ReactNode;
}) {
  const instance = useMemo(() => initI18next(locale), [locale]);

  useEffect(() => {
    document.cookie = `${localeCookieName}=${locale}; path=/; max-age=31536000; samesite=lax`;
    document.documentElement.lang = locale;
    if (instance.language !== locale) void instance.changeLanguage(locale);
  }, [instance, locale]);

  return (
    <LocaleContext.Provider value={locale}>
      <I18nextProvider i18n={instance}>{children}</I18nextProvider>
    </LocaleContext.Provider>
  );
}

export function useLocale() {
  return useContext(LocaleContext);
}
