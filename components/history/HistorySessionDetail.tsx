import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Download } from "lucide-react";
import { ChevronLeftIcon, TrashIcon } from "@/components/ui/Icons";
import { DeleteConfirmModal } from "@/components/ui/DeleteConfirmModal";
import { fmtDate, fmtTime, fmtTimestamp, fmtDuration } from "@/lib/utils/format-time";
import { getErrorMessage } from "@/lib/utils/error-message";
import { detectHistoryStopPoints } from "@/lib/history/stop-points";
import type { Buggy } from "@/types/buggy";
import type { BuggySession } from "@/types/buggy-session";

type HistorySessionDetailProps = {
  selectedBuggy: Buggy;
  selectedSession: BuggySession;
  onBack: () => void;
  onDeleteSuccess?: () => void;
  readOnly?: boolean;
};

type CsvValue = string | number | null | undefined;

function escapeCsvValue(value: CsvValue) {
  const text = value === null || value === undefined ? "" : String(value);

  if (/[",\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }

  return text;
}

function sanitizeCsvFilename(value: string) {
  return value.trim().replace(/[^\w.-]+/g, "_").replace(/^_+|_+$/g, "");
}

function toIsoTimestamp(value: string | number | null | undefined) {
  if (value === null || value === undefined || value === "") return "";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  return date.toISOString();
}

function toCsvNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : "";
}

export function HistorySessionDetail({
  selectedBuggy,
  selectedSession: s,
  onBack,
  onDeleteSuccess,
  readOnly = false,
}: HistorySessionDetailProps) {
  const { t, i18n } = useTranslation("history");
  const { t: tCommon } = useTranslation("common");
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const halteStopPoints = detectHistoryStopPoints(s.path);

  async function handleDelete() {
    setIsDeleting(true);
    try {
      const res = await fetch("/api/buggy-sessions/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: s.id,
          sourceSessionIds: s.sourceSessionIds,
          buggyId: s.buggyId,
          startedAt: s.startedAt,
          endedAt: s.endedAt,
          path: s.path,
        }),
      });

      if (res.status === 401 || res.status === 403) {
        const locale = i18n.language?.startsWith("en") ? "en" : "id";
        const next = `${window.location.pathname}${window.location.search}${window.location.hash}`;
        window.location.assign(
          `/${locale}/login?next=${encodeURIComponent(next)}`,
        );
        return;
      }

      if (!res.ok) {
        const payload = await res.json();
        throw new Error(payload.error || t("failedDelete"));
      }

      setShowDeleteModal(false);
      onDeleteSuccess?.();
    } catch (err) {
      alert(getErrorMessage(err, t("failedDelete")));
    } finally {
      setIsDeleting(false);
    }
  }

  function downloadSessionCsv() {
    const sessionLabel = s.isOngoing
      ? t("ongoingSession")
      : `${t("session")} ${s.sessionNumber}`;
    const statusLabel = s.isOngoing ? t("ongoing") : t("completed");
    const gpsPointCount = s.path.length;
    const baseIdentityValues = [
      selectedBuggy.code,
      selectedBuggy.name,
      sessionLabel,
      statusLabel,
      s.sessionDate,
      toIsoTimestamp(s.startedAt),
      s.isOngoing ? "" : toIsoTimestamp(s.endedAt),
    ];
    const sessionMetricValues = [
      s.durationMinutes ?? "",
      s.totalDistanceKm ?? "",
      s.avgSpeedKmh ?? "",
      gpsPointCount,
    ];

    const headers = [
      t("csvNo"),
      t("csvRowType"),
      t("csvBuggyCode"),
      t("csvBuggyName"),
      t("csvSession"),
      t("csvStatus"),
      t("csvDate"),
      t("csvStartTime"),
      t("csvEndTime"),
      t("csvDurationMinutes"),
      t("csvDistanceKm"),
      t("csvAverageSpeed"),
      t("csvGpsPointCount"),
      t("csvPointIndex"),
      t("csvPointTime"),
      t("csvLatitude"),
      t("csvLongitude"),
      t("csvPointPassengers"),
      t("csvStopHalteName"),
      t("csvStopStartedAt"),
      t("csvStopEndedAt"),
      t("csvStopDurationSeconds"),
      t("csvStopPointCount"),
      t("csvStopDistanceMeters"),
    ];

    const summaryRow = [
      1,
      t("csvSummary"),
      ...baseIdentityValues,
      ...sessionMetricValues,
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
    ];

    const routeRows = s.path.map(([lat, lng, tsMs, passengers], idx) => [
      idx + 2,
      t("csvGpsPoint"),
      ...baseIdentityValues,
      "",
      "",
      "",
      "",
      idx + 1,
      toIsoTimestamp(tsMs ?? s.startedAt),
      lat,
      lng,
      toCsvNumber(passengers),
      "",
      "",
      "",
      "",
      "",
      "",
    ]);

    const stopRows = halteStopPoints.map((stop, idx) => [
      routeRows.length + idx + 2,
      t("csvStopHalte"),
      ...baseIdentityValues,
      "",
      "",
      "",
      "",
      "",
      "",
      stop.lat,
      stop.lng,
      "",
      stop.halteName,
      toIsoTimestamp(stop.startedAtMs),
      toIsoTimestamp(stop.endedAtMs),
      stop.durationSeconds ?? "",
      stop.pointCount,
      stop.distanceMeters ?? "",
    ]);

    const csvContent = [
      headers,
      summaryRow,
      ...routeRows,
      ...stopRows,
    ]
      .map((row) => row.map(escapeCsvValue).join(","))
      .join("\n");

    const blob = new Blob([`\uFEFF${csvContent}`], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const sessionPart = s.isOngoing ? "ongoing" : `session_${s.sessionNumber}`;
    const filename = sanitizeCsvFilename(
      `Session_Detail_${selectedBuggy.code}_${sessionPart}_${s.sessionDate}.csv`,
    );

    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  const StatistikData =
  [
    { label: t("duration"), value: fmtDuration(s.durationMinutes) },
    { label: t("gpsPoints"), value: `${s.pointCount} ${t("point")}` },
    { label: t("distance"), value: s.totalDistanceKm !== null ? `${s.totalDistanceKm.toFixed(2)} km` : "—" },
    { label: t("averageSpeed"), value: s.avgSpeedKmh !== null ? tCommon("kmh", { value: s.avgSpeedKmh.toFixed(1) }) : "—" },
    {
      label: t("averagePassengers"),
      value:
        typeof s.passengerAvg === "number" && s.passengerAvg > 0
          ? `${s.passengerAvg.toFixed(1)} ${t("passengers")}`
          : "—",
    },
    {
      label: t("peakPassengers"),
      value:
        typeof s.passengerPeak === "number" && s.passengerPeak > 0
          ? `${s.passengerPeak} ${t("passengers")}`
          : "—",
    },
    {
      label: t("passengerSamples"),
      value:
        typeof s.passengerSamples === "number" && s.passengerSamples > 0
          ? `${s.passengerSamples} ${t("point")}`
          : "—",
    },
  ]

  return (
    <section className="space-y-3 relative">
      {/* Header */}
      <div className="flex items-center gap-3 rounded-3xl border border-slate-200/80 bg-white/70 p-3">
        <button
          type="button"
          onClick={onBack}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:border-slate-900 hover:bg-slate-900 hover:text-white active:scale-95"
          aria-label={t("backToSessionList")}
        >
          <ChevronLeftIcon className="h-4 w-4" />
        </button>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">
            {t("sessionDetail")}
          </p>
          <div className="flex items-center gap-2">
            <span className="rounded-lg bg-[#0f1a3b] px-2 py-0.5 text-[11px] font-bold text-white">
              {selectedBuggy.code}
            </span>
            <h2 className="truncate text-[15px] font-bold text-slate-900">
              {s.isOngoing ? t("ongoingSession") : `${t("session")} ${s.sessionNumber}`}
            </h2>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {s.isOngoing ? (
            <span className="flex items-center gap-1.5 rounded-full bg-emerald-100 px-2.5 py-0.5 text-[10px] font-semibold text-emerald-700">
              <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
              {t("live")}
            </span>
          ) : (
            <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[10px] font-semibold text-slate-500">
              {t("completed")}
            </span>
          )}
          <button
            type="button"
            onClick={downloadSessionCsv}
            className="flex h-7 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 text-[10px] font-semibold text-slate-600 transition hover:border-slate-900 hover:bg-slate-900 hover:text-white active:scale-95"
            aria-label={t("downloadCsv")}
          >
            <Download className="h-3.5 w-3.5" />
          </button>
          {!s.isOngoing && !readOnly && (
            <button
              onClick={() => setShowDeleteModal(true)}
              className="flex h-7 w-7 items-center justify-center rounded-lg border border-rose-100/50 bg-rose-50 text-rose-500 transition hover:bg-rose-100 hover:text-rose-600 active:scale-95"
              aria-label={t("deleteSession")}
            >
              <TrashIcon className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Waktu mulai & selesai */}
      <div className="rounded-3xl border border-slate-200/80 bg-white/70 p-3">
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-slate-400">
          {t("time")}
        </p>
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-2xl bg-slate-50 p-2.5 text-center">
            <p className="text-[15px] font-bold tabular-nums text-slate-900">{fmtTimestamp(s.startedAt)}</p>
            <p className="text-[10px] text-slate-400">
              {fmtDate(s.startedAt)} · {t("start")}
            </p>
          </div>
          <div className="rounded-2xl bg-slate-50 p-2.5 text-center">
            {s.isOngoing ? (
              <p className="text-[15px] font-bold text-emerald-600">
                {t("ongoing")}
              </p>
            ) : (
              <p className="text-[15px] font-bold tabular-nums text-slate-900">{fmtTimestamp(s.endedAt)}</p>
            )}
            <p className="text-[10px] text-slate-400">
              {s.isOngoing ? "" : `${fmtDate(s.endedAt)} · `}
              {t("completed")}
            </p>
          </div>
        </div>
      </div>

      {/* Statistik */}
      <div className="rounded-3xl border border-slate-200/80 bg-white/70">
        {StatistikData.map((row, idx, arr) => (
          <div
            key={row.label}
            className={`flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 px-4 py-3 text-[12px] ${
              idx < arr.length - 1 ? "border-b border-slate-100" : ""
            }`}
          >
            <span className="shrink-0 font-medium text-slate-500">{row.label}</span>
            <span className="text-right font-medium text-slate-800">{row.value}</span>
          </div>
        ))}
      </div>

      {halteStopPoints.length > 0 && (
        <div className="rounded-3xl border border-slate-200/80 bg-white/70 p-3">
          <p className="mb-3 text-[10px] font-semibold uppercase tracking-widest text-slate-400">
            Stop Halte
          </p>
          <div className="space-y-0">
            {halteStopPoints.map((stop, index) => {
              const isLast = index === halteStopPoints.length - 1;
              const timeValue = stop.startedAtMs ?? stop.endedAtMs;

              return (
                <div
                  key={`${stop.halteId}-${index}-${timeValue ?? "no-time"}`}
                  className="grid grid-cols-[52px_20px_1fr] gap-2"
                >
                  <span className="pt-0.5 text-[10px] font-semibold tabular-nums text-slate-500">
                    {typeof timeValue === "number" ? fmtTimestamp(timeValue) : "--:--"}
                  </span>
                  <span className="relative flex justify-center">
                    <span className="mt-1.5 h-3 w-3 rounded-full border-2 border-white bg-blue-600 shadow-sm" />
                    {!isLast && (
                      <span className="absolute top-5 h-[calc(100%-10px)] w-px bg-slate-200" />
                    )}
                  </span>
                  <div className={`pb-3 ${isLast ? "" : "border-b border-slate-100"}`}>
                    <p className="text-[12px] font-bold text-slate-800">
                      {stop.halteName}
                    </p>
                    <p className="mt-0.5 text-[10px] text-slate-400">
                      {stop.pointCount} {t("point")}
                      {typeof stop.distanceMeters === "number"
                        ? ` · ${stop.distanceMeters} m dari halte`
                        : ""}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Jalur GPS */}
      {s.path.length > 0 && (
        <div className="rounded-3xl border border-slate-200/80 bg-white/70 p-3">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-slate-400">
            {t("gpsRoute")} · {s.path.length} {t("point")}
          </p>
          <div className="max-h-65 space-y-1 overflow-y-auto pr-1">
            {s.path.map(([lat, lng, tsMs], idx) => (
              <div
                key={`${lat}-${lng}-${idx}`}
                className="grid grid-cols-[auto_auto_1fr] items-center gap-x-3 rounded-xl border border-slate-100 bg-white px-3 py-1.5"
              >
                <span className="shrink-0 text-[9px] tabular-nums text-slate-300">#{idx + 1}</span>
                <span className="shrink-0 text-[10px] font-semibold tabular-nums text-slate-500">
                  {tsMs !== undefined ? fmtTimestamp(tsMs) : fmtTime(s.startedAt)}
                </span>
                <span className="text-right text-[11px] tabular-nums text-slate-700">
                  {lat.toFixed(6)}, {lng.toFixed(6)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <DeleteConfirmModal
        open={showDeleteModal}
        title={t("deleteSessionHistory")}
        description={t("deleteSessionDescription")}
        confirmLabel={t("confirmDeleteSession")}
        loadingLabel={tCommon("deleting")}
        isLoading={isDeleting}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={handleDelete}
      />
    </section>
  );
}
