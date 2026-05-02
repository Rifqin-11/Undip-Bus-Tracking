import { SpinnerIcon } from "@/components/ui/Icons";
import { fmtDate, fmtTime } from "@/lib/utils/format-time";
import type { BuggySession } from "@/types/buggy-session";
import { ChevronRight } from "lucide-react";

type HistoryBuggyListProps = {
  buggyOptions: {
    id: string;
    code: string;
    name: string;
    norm: string;
    isActive: boolean;
  }[];
  sessionsByBuggy: Map<string, BuggySession[]>;
  refreshing: boolean;
  onRefresh: () => void;
  onSelectBuggy: (buggyId: string) => void;
};

export function HistoryBuggyList({
  buggyOptions,
  sessionsByBuggy,
  refreshing,
  onRefresh,
  onSelectBuggy,
}: HistoryBuggyListProps) {
  return (
    <section className="space-y-3">
      <div className="rounded-3xl border border-slate-200/80 bg-white/70 p-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-[17px] font-semibold text-slate-900">
            History Sesi
          </h2>
          <div className="flex items-center gap-2">
            {refreshing && (
              <SpinnerIcon className="h-3.5 w-3.5 text-slate-400" />
            )}
            <span className="rounded-full bg-[#0f1a3b] px-2.5 py-1 text-[10px] font-semibold text-white">
              {buggyOptions.length} armada
            </span>
          </div>
        </div>
      </div>
      <div className="rounded-3xl border border-slate-200/80 bg-white/70 p-3">
        {buggyOptions.length === 0 ? (
          <p className="py-4 text-center text-[12px] text-slate-400">
            Tidak ada armada terdaftar.
          </p>
        ) : (
          <div className="space-y-2">
            {buggyOptions.map((opt) => {
              const sessionsForBuggy = sessionsByBuggy.get(opt.norm) ?? [];
              const latestSession = sessionsForBuggy[0];

              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => onSelectBuggy(opt.id)}
                  className="group w-full rounded-[20px] border border-slate-200/80 bg-white py-2.5 px-3 text-left transition-all hover:bg-slate-50 hover:shadow-sm hover:border-[#0f1a3b]/20 active:scale-[0.98] outline-none"
                >
                  <div className="flex items-center justify-between gap-2.5">
                    {/* Left: Image & Titles */}
                    <div className="flex flex-1 items-center gap-3">
                      {/* Image Container */}
                      <div className="h-[36px] w-[54px] shrink-0 overflow-hidden flex items-center justify-center grayscale-[0.2] transition group-hover:grayscale-0">
                        <img
                          src="/buggy.webp"
                          alt="buggy"
                          className="w-full h-full object-contain mix-blend-multiply opacity-90"
                        />
                      </div>

                      {/* Titles */}
                      <div className="flex flex-col justify-center">
                        <div className="flex items-baseline gap-1.5">
                          <span className="text-[17px] font-bold text-slate-800 tracking-tight leading-none">
                            {opt.name}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Right: Detail Button */}
                    <div className="shrink-0 self-start mt-0.5">
                      <span className="flex items-center gap-1 rounded-full border-[1.5px] border-slate-200/80 bg-slate-100/50 backdrop-blur-md px-3 py-1 text-[10px] font-bold text-slate-700 shadow-sm transition-all group-hover:border-slate-900 group-hover:bg-slate-900 group-hover:text-white">
                        View
                        <ChevronRight className="w-3 h-3 text-slate-500 group-hover:text-white" />
                      </span>
                    </div>
                  </div>

                  {/* Bottom Line Info */}
                  <div className="mt-2.5 flex flex-wrap items-center gap-x-2 gap-y-1.5 pr-1">
                    {/* Data Text */}
                    {latestSession ? (
                      <p className="text-[10px] font-medium text-slate-600">
                        <span className="font-bold text-slate-800">
                          {sessionsForBuggy.length} sesi
                        </span>{" "}
                        · trkhr {fmtDate(latestSession.startedAt)}{" "}
                        {fmtTime(latestSession.startedAt)}
                      </p>
                    ) : (
                      <p className="text-[10px] font-medium text-slate-400 italic">
                        Belum ada sesi selesai
                      </p>
                    )}

                    {/* Live Badge */}
                    <div className="ml-auto flex items-center shrink-0">
                      {latestSession?.isOngoing && (
                        <span className="flex items-center gap-1 rounded-full bg-blue-50/80 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-blue-600 border border-blue-100">
                          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-blue-500" />
                          LIVE
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
