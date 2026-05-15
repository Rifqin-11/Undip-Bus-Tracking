"use client";

import Image from "next/image";
import { useTranslation } from "react-i18next";
import type { Buggy } from "@/types/buggy";
import { ChevronRight } from "lucide-react";

type AdminBuggyCardProps = {
  buggy: Buggy;
  activeZones: string[];
  onClick: () => void;
};

export function AdminBuggyCard({
  buggy,
  activeZones,
  onClick,
}: AdminBuggyCardProps) {
  const { t } = useTranslation("admin");
  const isActive = buggy.isActive;

  return (
    <button
      type="button"
      onClick={onClick}
      className="group w-full rounded-[20px] border border-white/60 bg-white/40 backdrop-blur-md py-2.5 px-3 text-left shadow-[0_8px_20px_rgba(15,23,42,0.04)] transition-all hover:bg-white/60 hover:shadow-[0_8px_24px_rgba(15,23,42,0.06)] hover:border-slate-300/50 active:scale-[0.98] outline-none"
    >
      <div className="flex items-center gap-3">
        {/* Image Container */}
        <div
          className={`relative h-[40px] w-[52px] shrink-0 overflow-hidden flex items-center justify-center transition ${
            isActive ? "" : "grayscale-[0.35] opacity-80"
          } group-hover:grayscale-0 group-hover:opacity-100`}
        >
          <Image
            src="/buggy.webp"
            alt="buggy"
            fill
            sizes="52px"
            className="w-full h-full object-contain mix-blend-multiply"
          />
        </div>

        {/* Center: Title + Status */}
        <div className="flex-1 min-w-0">
          {/* Row 1: Name + Active zones */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[16px] font-bold text-slate-800 tracking-tight leading-tight">
              {buggy.name}
            </span>
            {activeZones.map((zone) => (
              <span
                key={zone}
                className="text-[8px] font-bold tracking-wider uppercase text-blue-600 bg-blue-50/80 px-1.5 py-0.5 rounded-md leading-none"
              >
                {zone}
              </span>
            ))}
          </div>

          {/* Row 2: Status line */}
          <div className="mt-1 flex items-center gap-2">
            <div className="flex items-center shrink-0">
              <div
                className={`h-[2px] w-4 bg-linear-to-r from-transparent ${
                  isActive ? "to-emerald-400" : "to-slate-300"
                } rounded-full mr-1`}
              />
              <div
                className={`h-[6px] w-[6px] rounded-full ${
                  isActive
                    ? "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)]"
                    : "bg-slate-300"
                }`}
              />
            </div>
            {isActive ? (
              <p className="text-[10px] font-medium text-slate-600 truncate">
                {t("arrivingIn")}{" "}
                <span className="font-bold text-slate-800">
                  {buggy.etaMinutes} {t("minutesShort")}
                </span>
              </p>
            ) : (
              <p className="text-[10px] font-semibold text-slate-400 italic truncate">
                {t("notOperating")}
              </p>
            )}

            {isActive && (
              <div className="ml-auto flex items-center gap-1 text-[9px] text-slate-400 font-semibold uppercase tracking-wide shrink-0">
                <svg
                  className="w-3 h-3"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2.5}
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                  />
                </svg>
                <span>5 {t("minutesShort")}</span>
              </div>
            )}
          </div>
        </div>

        {/* Right: Chevron */}
        <div className="shrink-0 flex items-center justify-center">
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-100/80 shadow-sm text-slate-400 transition-all group-hover:bg-[#0f1a3b] group-hover:text-white">
            <ChevronRight className="size-4" />
          </div>
        </div>
      </div>
    </button>
  );
}
