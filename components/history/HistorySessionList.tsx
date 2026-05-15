import { ChevronLeftIcon } from "@/components/ui/Icons";
import { useTranslation } from "react-i18next";
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
  const { t } = useTranslation("history");
  const { t: tCommon } = useTranslation("common");
  const downloadCSV = () => {
    if (selectedBuggySessions.length === 0) return;

    const headers = [
      t("csvSession"),
      t("csvDate"),
      t("csvStartTime"),
      t("csvEndTime"),
      t("csvDurationMinutes"),
      t("csvDistanceKm"),
      t("csvAverageSpeed"),
      t("csvBatteryStart"),
      t("csvBatteryEnd")
    ];

    const rows = selectedBuggySessions.map(s => [
      s.sessionNumber,
      s.sessionDate,
      fmtTime(s.startedAt),
      s.endedAt ? fmtTime(s.endedAt) : t("ongoing"),
      s.durationMinutes || 0,
      s.totalDistanceKm || 0,
      s.avgSpeedKmh || 0,
      s.batteryStart || "",
      s.batteryEnd || ""
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map(row => row.join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `History_${selectedBuggy.code.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <section className="space-y-3">
      {/* Header */}
      <div className="rounded-3xl border border-slate-200/80 bg-white/70 p-3">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:border-slate-900 hover:bg-slate-900 hover:text-white active:scale-95"
            aria-label={t("backToFleetList")}
          >
            <ChevronLeftIcon className="h-4 w-4" />
          </button>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">
              {t("sessionHistory")}
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
          <div className="flex shrink-0 items-center gap-1.5">
            <button
              type="button"
              disabled={refreshing || selectedBuggySessions.length === 0}
              onClick={downloadCSV}
              className="rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-[10px] font-semibold text-slate-600 transition hover:border-slate-900 hover:bg-slate-900 hover:text-white disabled:opacity-50"
            >
              {t("downloadCsv")}
            </button>
            <button
              type="button"
              disabled={refreshing}
              onClick={onRefresh}
              className="rounded-xl border border-transparent bg-[#0f1a3b] px-3 py-1.5 text-[10px] font-semibold text-white transition hover:bg-[#0f1a3b]/90 disabled:opacity-50"
            >
              {refreshing ? "…" : t("reload")}
            </button>
          </div>
        </div>
      </div>

      {/* Jumlah sesi */}
      <div className="rounded-3xl border border-slate-200/80 bg-white/70 p-3">
        <p className="text-[12px] text-slate-500">
          {t("sessionFound", { count: selectedBuggySessions.length })}
        </p>
      </div>

      {/* Session cards */}
      {selectedBuggySessions.length === 0 ? (
        <div className="rounded-3xl border border-slate-200/80 bg-white/70 p-6 text-center text-[13px] text-slate-400">
          {t("noCompletedSessionForFleet")}
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
                      {session.isOngoing
                        ? t("ongoingSession")
                        : `${t("session")} ${session.sessionNumber}`}
                    </span>
                    {session.isOngoing && (
                      <span className="flex items-center gap-1 rounded-full bg-emerald-100 px-1.5 py-0.5 text-[9px] font-semibold text-emerald-700">
                        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
                        {t("live")}
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 text-[11px] text-slate-500">
                    {fmtDate(session.startedAt)} · {fmtTime(session.startedAt)}
                    {session.isOngoing ? ` -> ${t("now")}` : ` - ${fmtTime(session.endedAt)}`}
                    {session.durationMinutes !== null ? ` · ${fmtDuration(session.durationMinutes)}` : ""}
                  </p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <span className="text-[11px] text-slate-400">
                    {session.totalDistanceKm !== null ? `${session.totalDistanceKm.toFixed(2)} km` : "—"}
                  </span>
                  <span className="text-[11px] text-slate-400">
                    {session.avgSpeedKmh !== null ? tCommon("kmh", { value: session.avgSpeedKmh.toFixed(1) }) : "—"}
                  </span>
                </div>
              </div>
              <div className="mt-2 flex items-center justify-end">
                <span className="text-[11px] text-slate-400 transition-transform group-hover:translate-x-0.5">
                  {t("detail")} →
                </span>
              </div>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
