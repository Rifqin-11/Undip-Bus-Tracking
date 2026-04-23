import { SpinnerIcon } from "@/components/ui/Icons";
import { fmtDate, fmtTime } from "@/lib/utils/format-time";
import type { BuggySession } from "@/types/buggy-session";

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
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="text-[17px] font-semibold text-slate-900">History Sesi</h2>
          <div className="flex items-center gap-2">
            {refreshing && <SpinnerIcon className="h-3.5 w-3.5 text-slate-400" />}
            <span className="rounded-full bg-[#0f1a3b] px-2.5 py-1 text-[10px] font-semibold text-white">
              {buggyOptions.length} armada
            </span>
          </div>
        </div>

        {buggyOptions.length === 0 ? (
          <p className="py-4 text-center text-[12px] text-slate-400">Tidak ada armada terdaftar.</p>
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
                  className="group w-full rounded-2xl border border-slate-200 bg-white p-3 text-left transition-all hover:border-[#0f1a3b]/30 hover:shadow-md active:scale-[0.98]"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="shrink-0 rounded-lg bg-[#0f1a3b] px-2 py-0.5 text-[11px] font-bold text-white">
                          {opt.code}
                        </span>
                        <span className="truncate text-[13px] font-semibold text-slate-800">
                          {opt.name}
                        </span>
                      </div>
                      <p className="mt-1.5 text-[11px] text-slate-500">
                        {latestSession
                          ? `${sessionsForBuggy.length} sesi · terakhir ${fmtDate(latestSession.startedAt)} ${fmtTime(latestSession.startedAt)}`
                          : "Belum ada sesi selesai"}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1.5">
                      {latestSession?.isOngoing ? (
                        <span className="flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
                          Live
                        </span>
                      ) : opt.isActive ? (
                        <span className="rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-semibold text-sky-600">
                          Aktif
                        </span>
                      ) : (
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-400">
                          {sessionsForBuggy.length} sesi
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="mt-2 flex items-center justify-end">
                    <span className="text-[11px] text-slate-400 transition-transform group-hover:translate-x-0.5">
                      Lihat sesi →
                    </span>
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
