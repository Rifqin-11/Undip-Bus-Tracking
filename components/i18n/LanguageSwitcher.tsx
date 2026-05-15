"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Languages } from "lucide-react";
import { useTranslation } from "react-i18next";
import { locales, type Locale } from "@/lib/i18n/config";
import { setLocaleCookie } from "@/lib/i18n/browser";
import { replaceLocaleInPath } from "@/lib/i18n/routing";
import { useLocale } from "@/lib/i18n/client";

export function LanguageSwitcher({
  compact = false,
  variant = "segmented",
}: {
  compact?: boolean;
  variant?: "segmented" | "switch";
}) {
  const locale = useLocale();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { t } = useTranslation("common");

  const handleChange = (nextLocale: Locale) => {
    if (nextLocale === locale) return;
    setLocaleCookie(nextLocale);
    const query = searchParams.toString();
    const nextPath = replaceLocaleInPath(pathname, nextLocale);
    router.replace(query ? `${nextPath}?${query}` : nextPath);
    router.refresh();
  };

  if (variant === "switch") {
    const nextLocale = locale === "id" ? "en" : "id";

    return (
      <button
        type="button"
        role="switch"
        aria-checked={locale === "en"}
        aria-label={t("language")}
        title={locale === "id" ? t("indonesian") : t("english")}
        onClick={() => handleChange(nextLocale)}
        className={`relative inline-flex h-6 w-12 shrink-0 items-center rounded-full transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300 ${
          locale === "en" ? "bg-[#0f1a3b]" : "bg-slate-300"
        }`}
      >
        <span
          aria-hidden="true"
          className={`absolute text-[8px] font-black uppercase transition ${
            locale === "en" ? "left-1.5 text-white/70" : "right-1.5 text-slate-500"
          }`}
        >
          {locale === "en" ? "ID" : "EN"}
        </span>
        <span
          aria-hidden="true"
          className={`grid h-5 w-5 place-items-center rounded-full bg-white text-[8px] font-black uppercase text-[#0f1a3b] shadow-sm transition ${
            locale === "en" ? "translate-x-6" : "translate-x-0.5"
          }`}
        >
          {locale}
        </span>
      </button>
    );
  }

  return (
    <div
      className={`flex items-center gap-2 ${
        compact
          ? "rounded-full border border-slate-200 bg-white/85 px-2 py-1"
          : "rounded-2xl border border-slate-200 bg-white px-3 py-2"
      }`}
    >
      <Languages className="size-4 text-slate-500" aria-hidden="true" />
      <span className={compact ? "sr-only" : "text-[12px] font-bold text-slate-700"}>
        {t("language")}
      </span>
      <div className="flex rounded-full bg-slate-100 p-0.5">
        {locales.map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => handleChange(item)}
            className={`rounded-full px-2.5 py-1 text-[11px] font-black uppercase transition ${
              item === locale ? "bg-[#0f1a3b] text-white" : "text-slate-500 hover:text-slate-900"
            }`}
            aria-pressed={item === locale}
          >
            {item}
          </button>
        ))}
      </div>
    </div>
  );
}
