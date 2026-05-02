import { ChevronLeftIcon } from "@/components/ui/Icons";
import { fmtDate, fmtTime, fmtDuration } from "@/lib/utils/format-time";
import type { Buggy } from "@/types/buggy";
import type { BuggySession } from "@/types/buggy-session";

type HistorySessionListProps = {
  selectedBuggy: Buggy;
  selectedBuggySessions: BuggySession[];
  refreshing: boolean;
  onRefresh: () => void;
  onBack: () => void;
  onSelectSession: (session: BuggySession) => void;
};

export function HistorySessionList({
  selectedBuggy,
  selectedBuggySessions,
  refreshing,
  onRefresh,
  onBack,
  onSelectSession,
}: HistorySessionListProps) {
  return (
    <section className="space-y-3">
      {/* Header */}
      <div className="rounded-3xl border border-slate-200/80 bg-white/70 p-3">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:border-slate-900 hover:bg-slate-900 hover:text-white active:scale-95"
            aria-label="Kembali ke daftar armada"
          >
            <ChevronLeftIcon className="h-4 w-4" />
          </button>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">
              Riwayat Sesi
            </p>
            <div className="flex items-center gap-2">
              <span className="rounded-lg bg-[#0f1a3b] px-2 py-0.5 text-[11px] font-bold text-white">
                {selectedBuggy.code}
              </span>
              <h2 className="truncate text-[15px] font-bold text-slate-900">
                {selectedBuggy.name}
              </h2>
            </div>
          </div>
          <button
            type="button"
            disabled={refreshing}
            onClick={onRefresh}
            className="shrink-0 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-medium text-slate-600 transition hover:border-slate-900 hover:bg-slate-900 hover:text-white disabled:opacity-50"
          >
            {refreshing ? "…" : "Refresh"}
          </button>
        </div>
      </div>

      {/* Jumlah sesi */}
      <div className="rounded-3xl border border-slate-200/80 bg-white/70 p-3">
        <p className="text-[12px] text-slate-500">
          <span className="font-semibold text-slate-800">{selectedBuggySessions.length}</span> sesi ditemukan
        </p>
      </div>

      {/* Session cards */}
      {selectedBuggySessions.length === 0 ? (
        <div className="rounded-3xl border border-slate-200/80 bg-white/70 p-6 text-center text-[13px] text-slate-400">
          Belum ada sesi selesai untuk armada ini.
        </div>
      ) : (
        <div className="space-y-2">
          {selectedBuggySessions.map((session) => (
            <button
              key={session.id}
              type="button"
              onClick={() => onSelectSession(session)}
              className="group w-full rounded-2xl border border-slate-200 bg-white p-3 text-left transition-all hover:border-[#0f1a3b]/30 hover:shadow-md active:scale-[0.98]"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[13px] font-semibold text-slate-800">
                      {session.isOngoing ? "Sesi Berlangsung" : `Sesi ${session.sessionNumber}`}
                    </span>
                    {session.isOngoing && (
                      <span className="flex items-center gap-1 rounded-full bg-emerald-100 px-1.5 py-0.5 text-[9px] font-semibold text-emerald-700">
                        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
                        Live
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 text-[11px] text-slate-500">
                    {fmtDate(session.startedAt)} · {fmtTime(session.startedAt)}
                    {session.isOngoing ? " → sekarang" : ` — ${fmtTime(session.endedAt)}`}
                    {session.durationMinutes !== null ? ` · ${fmtDuration(session.durationMinutes)}` : ""}
                  </p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <span className="text-[11px] text-slate-400">
                    {session.totalDistanceKm !== null ? `${session.totalDistanceKm.toFixed(2)} km` : "—"}
                  </span>
                  <span className="text-[11px] text-slate-400">
                    {session.avgSpeedKmh !== null ? `${session.avgSpeedKmh.toFixed(1)} km/h` : "—"}
                  </span>
                </div>
              </div>
              <div className="mt-2 flex items-center justify-end">
                <span className="text-[11px] text-slate-400 transition-transform group-hover:translate-x-0.5">
                  Detail →
                </span>
              </div>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
