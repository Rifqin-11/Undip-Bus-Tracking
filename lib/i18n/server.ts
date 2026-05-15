import { createInstance } from "i18next";
import { defaultLocale, namespaces, type I18nNamespace, type Locale } from "@/lib/i18n/config";
import { resources } from "@/lib/i18n/resources";

export async function getServerT(locale: Locale, ns: I18nNamespace = "common") {
  const instance = createInstance();
  await instance.init({
    resources,
    lng: locale,
    fallbackLng: defaultLocale,
    supportedLngs: ["id", "en"],
    ns: namespaces,
    defaultNS: "common",
    interpolation: { escapeValue: false },
  });

  return instance.getFixedT(locale, ns);
}
