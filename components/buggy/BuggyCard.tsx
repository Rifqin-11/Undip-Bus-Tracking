"use client";

import type { Buggy } from "@/types/buggy";
import { toCrowdConfig } from "@/lib/presenters/crowd-presenter";

type BuggyCardProps = {
  buggy: Buggy;
  isSelected: boolean;
  onFocus: (id: string) => void;
  onSelect: (id: string) => void;
};

export function BuggyCard({
  buggy,
  isSelected,
  onFocus,
  onSelect,
}: BuggyCardProps) {
  const crowd = toCrowdConfig(buggy.crowdLevel);

  return (
    <article
      role="button"
      tabIndex={0}
      className={`flex w-full min-h-37.5 flex-col rounded-3xl border-2 p-3 text-left transition-all active:scale-[0.98] xl:min-h-35 xl:border xl:p-2.5 ${
        isSelected
          ? "border-[#0f1a3b] bg-slate-50 shadow-md"
          : "border-slate-200 bg-white hover:border-slate-300 active:border-slate-400"
      }`}
      onClick={() => onFocus(buggy.id)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onFocus(buggy.id);
        }
      }}
    >
      {/* Header row */}
      <div className="mb-2 flex items-start justify-between gap-2 xl:mb-1.5">
        <h3 className="text-[15px] font-semibold text-slate-900 xl:text-[14px]">
          {buggy.name}{" "}
          <span className="font-medium text-slate-500">
            → {buggy.routeLabel}
          </span>
        </h3>
        <span
          className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-semibold xl:px-2 xl:py-0.5 ${crowd.badgeClassName}`}
        >
          <span
            className={`h-2 w-2 rounded-full xl:h-1.5 xl:w-1.5 ${crowd.dotClassName}`}
          />
          {crowd.label}
        </span>
      </div>

      {/* Trip ID */}
      <p className="text-[13px] text-slate-500 xl:text-[12px]">
        Trip {buggy.tripId}
      </p>

      {/* Metrics row */}
      <div className="mt-2 flex items-end justify-between xl:mt-1.5">
        <div>
          <p className="text-[16px] font-semibold text-slate-900 xl:text-[14px]">
            ETA {buggy.etaMinutes} min
          </p>
          <p className="text-[13px] text-slate-500 xl:text-[12px]">
            Update {buggy.updatedAt}
          </p>
        </div>
        <p className="text-[15px] font-semibold text-slate-600 xl:text-[13px]">
          {buggy.speedKmh} km/h
        </p>
      </div>

      {/* Action button */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onSelect(buggy.id);
        }}
        className="mt-3 inline-flex w-full items-center justify-center rounded-xl bg-[#0f1a3b] px-4 py-2.5 text-[13px] font-semibold text-white transition-all active:scale-[0.98] active:bg-[#1a2f68] xl:mt-2 xl:py-1.5 xl:text-[11px] xl:hover:bg-[#1a2f68]"
      >
        Lihat detail perjalanan
      </button>
    </article>
  );
}
