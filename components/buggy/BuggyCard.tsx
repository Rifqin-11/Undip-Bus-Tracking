"use client";

import type { Buggy } from "@/types/buggy";
import { getBuggyStopNameAtOffset } from "@/lib/transit/buggy-route-utils";

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
  const currentStop = getBuggyStopNameAtOffset(buggy, 0) || "Sedang di jalan";

  return (
    <article
      role="button"
      tabIndex={0}
      className={`group relative flex w-full flex-col justify-between overflow-hidden rounded-[20px] border border-slate-200/80 p-2.5 text-left transition-all hover:bg-slate-50 active:scale-[0.98] ${
        isSelected
          ? "border-[#0f1a3b]/60 bg-slate-50 shadow-sm ring-1 ring-[#0f1a3b]/10"
          : "bg-white/80"
      }`}
      onClick={() => onFocus(buggy.id)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onFocus(buggy.id);
        }
      }}
    >
      {/* Background Vehicle Image */}
      <div className="absolute -right-4 top-1 w-[140px] opacity-90 transition-transform duration-500 group-hover:-translate-x-1">
        <img
          src="/buggy.webp"
          alt="Buggy EV"
          className="w-full h-full object-contain mix-blend-multiply drop-shadow-sm"
        />
      </div>

      {/* Top Left: ETA Info */}
      <div className="relative z-10 max-w-[65%] mb-5">
        <span className="mb-1.5 inline-flex shrink-0 items-center justify-center gap-1.5 rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[8px] font-bold text-slate-500 shadow-sm uppercase tracking-wide">
           <span className={`h-1.5 w-1.5 rounded-full ${buggy.isActive ? 'bg-emerald-500' : 'bg-slate-400'}`} />
           {buggy.isActive ? 'Aktif' : 'Non-aktif'}
        </span>

        <div>
          {buggy.isActive ? (
            <h3 className="text-[22px] font-black leading-tight tracking-tight text-[#0f1a3b]">
              <span className="text-[10px] font-semibold text-slate-400 tracking-normal mr-1 block -mb-1">Tiba dlm</span>
              {buggy.etaMinutes} <span className="text-[12px] font-bold text-slate-400 tracking-normal">mnt</span>
            </h3>
          ) : (
             <h3 className="text-[17px] font-black leading-tight tracking-tight text-slate-400 mt-1">
               Offline<span className="text-[14px]"> 💤</span>
             </h3>
          )}
        </div>
      </div>

      {/* Bottom Route Info Box */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onSelect(buggy.id);
        }}
        className="relative z-5 mt-auto flex w-full items-center justify-between rounded-2xl border border-slate-200/60 bg-gray-300/40 p-2 backdrop-blur-md shadow-[0_2px_8px_rgba(0,0,0,0.03)] transition-all hover:bg-gray-300/60 hover:shadow-sm"
      >
        <div className="flex min-w-0 flex-1 items-center gap-2">
          {/* Subtle Icon Box */}
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] bg-slate-50/80 text-slate-500 border border-slate-200/50 shadow-[0_2px_4px_rgba(0,0,0,0.02)]">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>

          <div className="min-w-0 text-left">
             <p className="truncate text-[8px] font-bold text-slate-500 uppercase tracking-widest">
               {buggy.code} • {buggy.name}
             </p>
             <h4 className="truncate text-[12px] font-bold text-slate-800 leading-tight mt-0.5">
               {currentStop}
             </h4>
          </div>
        </div>

        {/* Action Arrow */}
        <div className="ml-1.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/80 text-slate-500 shadow-sm transition-colors group-hover:bg-[#0f1a3b] group-hover:text-white">
          <svg className="h-3 w-3 ml-[1px]" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </div>
      </button>
    </article>
  );
}
