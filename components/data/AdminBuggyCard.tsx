import type { Buggy } from "@/types/buggy";
import { getBuggyStopNameAtOffset } from "@/lib/transit/buggy-route-utils";

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
  const crowdColor =
    buggy.crowdLevel === "PENUH"
      ? "bg-rose-100 text-rose-700"
      : buggy.crowdLevel === "HAMPIR_PENUH"
        ? "bg-amber-100 text-amber-700"
        : "bg-emerald-100 text-emerald-700";

  const crowdLabel =
    buggy.crowdLevel === "PENUH"
      ? "Penuh"
      : buggy.crowdLevel === "HAMPIR_PENUH"
        ? "Hampir Penuh"
        : "Longgar";

  const currentStop = getBuggyStopNameAtOffset(buggy, 0);
  const nextStop = getBuggyStopNameAtOffset(buggy, 1);

  return (
    <button
      type="button"
      onClick={onClick}
      className="group w-full rounded-2xl border border-slate-200 bg-white p-3 text-left transition-all hover:border-[#0f1a3b]/30 hover:shadow-md active:scale-[0.98]"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="shrink-0 rounded-lg bg-[#0f1a3b] px-2 py-0.5 text-[11px] font-bold text-white">
              {buggy.code}
            </span>
            <span className="truncate text-[13px] font-semibold text-slate-800">
              {buggy.name}
            </span>
          </div>
          <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-slate-500">
            {currentStop && (
              <span>
                📍 <span className="text-slate-700">{currentStop}</span>
              </span>
            )}
            {nextStop && (
              <span>
                ▶ <span className="text-slate-600">{nextStop}</span>
              </span>
            )}
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1.5">
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${crowdColor}`}>
            {crowdLabel}
          </span>
          <span className="text-[11px] text-slate-400">{buggy.speedKmh} km/h</span>
        </div>
      </div>

      {activeZones.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {activeZones.map((zone) => (
            <span
              key={zone}
              className="rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-[10px] font-medium text-blue-700"
            >
              📡 {zone}
            </span>
          ))}
        </div>
      )}

      <div className="mt-2 flex items-center justify-end">
        <span className="text-[11px] text-slate-400 transition-transform group-hover:translate-x-0.5">
          Detail →
        </span>
      </div>
    </button>
  );
}
