import type { ReactNode } from "react";
import type { StatTone } from "@/components/admin/statistics/types";

export function StatTile({
  icon,
  label,
  value,
  helper,
  className = "",
  tone = "slate",
}: {
  icon: ReactNode;
  label: string;
  value: ReactNode;
  helper: string;
  className?: string;
  tone?: StatTone;
}) {
  const toneClass: Record<StatTone, string> = {
    navy: "text-[#0f1a3b]",
    emerald: "text-emerald-500",
    amber: "text-amber-500",
    rose: "text-rose-500",
    slate: "text-slate-400",
  };

  return (
    <div className={`p-3.5 ${className}`}>
      <div className="mb-2 flex items-center gap-1.5">
        <span className={toneClass[tone]}>{icon}</span>
        <p className="min-w-0 text-[9px] font-bold uppercase tracking-widest text-slate-500">
          {label}
        </p>
      </div>
      <p className="text-[20px] font-black leading-none tracking-tight text-[#0f1a3b]">
        {value}
      </p>
      <p className="mt-1.5 text-[10px] font-medium leading-snug text-slate-400">
        {helper}
      </p>
    </div>
  );
}
