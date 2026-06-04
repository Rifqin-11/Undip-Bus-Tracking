"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, Home, MapPin } from "lucide-react";
import { useTranslation } from "react-i18next";
import logo from "@/public/logo.svg";
import { useLocale } from "@/lib/i18n/client";
import { localizePath } from "@/lib/i18n/routing";

export default function NotFound() {
  const locale = useLocale();
  const { t } = useTranslation("navigation");
  const { t: tCommon } = useTranslation("common");
  const quickLinks = [
    {
      href: localizePath("/", locale),
      label: t("openMap"),
      description: t("mapDescription"),
      icon: MapPin,
    },
  ];

  return (
    <main className="relative min-h-svh overflow-hidden bg-linear-to-b from-slate-200 to-slate-100 px-4 py-5 text-slate-900 sm:px-6">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.72),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(148,163,184,0.24),transparent_32%)]" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-52 bg-linear-to-b from-white/70 to-transparent" />

      <section className="relative z-10 mx-auto flex min-h-[calc(100svh-2.5rem)] w-full max-w-5xl items-center justify-center">
        <div className="grid w-full gap-4 rounded-[30px] border border-white/50 bg-white/60 p-4 shadow-[0_18px_60px_rgba(15,23,42,0.14)] backdrop-blur-xl sm:p-5 lg:grid-cols-[1fr_0.9fr] lg:items-stretch">
          <div className="flex min-h-[420px] flex-col justify-between rounded-[24px] bg-[#0f1a3b] p-5 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.16)] sm:p-6">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="flex h-11 w-11 overflow-hidden rounded-full bg-white">
                  <Image
                    src={logo.src}
                    alt="SIMOBI"
                    width={44}
                    height={44}
                    className="h-11 w-11 rounded-full object-cover"
                    priority
                  />
                </span>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/55">
                    {tCommon("brandTagline")}
                  </p>
                  <p className="text-lg font-bold leading-tight">SIMOBI</p>
                </div>
              </div>
              <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-semibold text-white/75">
                404
              </span>
            </div>

            <div className="py-10">
              <p className="mb-3 text-sm font-semibold text-emerald-200">
                {t("pageNotFound")}
              </p>
              <h1 className="max-w-xl text-4xl font-bold leading-[1.02] tracking-tight sm:text-5xl">
                {t("routeUnavailable")}
              </h1>
              <p className="mt-4 max-w-lg text-sm leading-6 text-slate-200 sm:text-base">
                {t("missingRouteDescription")}
              </p>
            </div>

            <Link
              href={localizePath("/", locale)}
              className="inline-flex h-11 w-fit items-center gap-2 rounded-2xl bg-white px-4 text-sm font-semibold text-[#0f1a3b] transition hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
            >
              <ArrowLeft className="h-4 w-4" />
              {t("backToMap")}
            </Link>
          </div>

          <div className="flex flex-col justify-between gap-4 p-1 sm:p-2">
            <div className="rounded-[24px] border border-slate-200/80 bg-white/75 p-4">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                    {t("quickNavigation")}
                  </p>
                  <h2 className="text-xl font-bold leading-tight text-slate-950">
                    {t("chooseDestination")}
                  </h2>
                </div>
                <span className="grid h-10 w-10 place-items-center rounded-2xl bg-slate-100 text-slate-600">
                  <Home className="h-5 w-5" />
                </span>
              </div>

              <div className="grid gap-2">
                {quickLinks.map((item) => {
                  const Icon = item.icon;

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className="group flex items-center gap-3 rounded-[20px] border border-slate-200 bg-white p-3 text-left transition hover:border-slate-300 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300"
                    >
                      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-slate-100 text-slate-600 transition group-hover:bg-[#0f1a3b] group-hover:text-white">
                        <Icon className="h-5 w-5" />
                      </span>
                      <span className="min-w-0">
                        <span className="block text-sm font-semibold text-slate-950">
                          {item.label}
                        </span>
                        <span className="block text-xs leading-5 text-slate-500">
                          {item.description}
                        </span>
                      </span>
                    </Link>
                  );
                })}
              </div>
            </div>

            <div className="rounded-[24px] border border-white/70 bg-slate-50/80 p-4">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                {t("systemStatus")}
              </p>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <div className="rounded-[18px] border border-slate-200 bg-white p-3">
                  <p className="text-xs text-slate-500">{t("map")}</p>
                  <p className="mt-1 text-sm font-bold text-emerald-700">
                    {tCommon("active")}
                  </p>
                </div>
                <div className="rounded-[18px] border border-slate-200 bg-white p-3">
                  <p className="text-xs text-slate-500">Monitoring</p>
                  <p className="mt-1 text-sm font-bold text-emerald-700">
                    {tCommon("realtime")}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
