"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Buggy } from "@/types/buggy";
import type { BuggySession } from "@/types/buggy-session";
import { HistoryIcon, SpinnerIcon, ChevronLeftIcon } from "@/components/ui/Icons";

// ── Types ─────────────────────────────────────────────────────────────────────

type HistoryPanelProps = {
  buggies: Buggy[];
  onShowPath: (path: [number, number][]) => void;
};

type ViewMode = "buggy-list" | "session-list" | "session-detail";

type BuggySessionApiResponse = {
  sessions: BuggySession[];
  count: number;
  error?: string;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function normalizeBuggyId(value: string): string {
  const text = value.trim();
  if (!text) return "";
  if (text.startsWith("buggy-")) return text;
  const n = Number.parseInt(text, 10);
  if (!Number.isNaN(n) && String(n) === text) return `buggy-${n}`;
  return text;
}

function fmtDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" });
}

function fmtTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleTimeString("id-ID", { hour12: false, hour: "2-digit", minute: "2-digit" });
}

/** Full HH:MM:SS from ISO string or unix ms */
function fmtTimestamp(value: string | number): string {
  const d = typeof value === "number" ? new Date(value) : new Date(value);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleTimeString("id-ID", { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function fmtDuration(minutes: number | null): string {
  if (minutes === null) return "-";
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  if (h === 0) return `${m}m`;
  return `${h}j ${m}m`;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function HistoryPanel({ buggies, onShowPath }: HistoryPanelProps) {
  const [sessions, setSessions] = useState<BuggySession[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [viewMode, setViewMode] = useState<ViewMode>("buggy-list");
  const [selectedBuggyId, setSelectedBuggyId] = useState<string | null>(null);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Data fetching ──────────────────────────────────────────────────────────

  const load = useCallback(async (silent = false) => {
    if (silent) setRefreshing(true);
    else setLoading(true);

    try {
      const res = await fetch("/api/buggy-sessions?limit=200", { cache: "no-store" });
      const payload = (await res.json()) as Partial<BuggySessionApiResponse>;
      if (!res.ok) throw new Error(typeof payload.error === "string" ? payload.error : "Gagal memuat history sesi.");
      setSessions(Array.isArray(payload.sessions) ? payload.sessions : []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal memuat history sesi.");
      if (!silent) setSessions([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
    // Poll more frequently (10s) so ongoing sessions update their stats live
    intervalRef.current = setInterval(() => void load(true), 10_000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [load]);

  // ── Derived data ───────────────────────────────────────────────────────────

  const buggyOptions = useMemo(
    () =>
      buggies
        .map((b) => ({
          id: b.id,
          code: b.code,
          name: b.name,
          norm: normalizeBuggyId(b.id),
          isActive: b.isActive,
        }))
        .sort((a, z) => a.code.localeCompare(z.code, "id-ID")),
    [buggies],
  );

  /** sessions keyed by normalized buggy id, sorted newest → oldest */
  const sessionsByBuggy = useMemo(() => {
    const map = new Map<string, BuggySession[]>();
    for (const s of sessions) {
      const norm = normalizeBuggyId(s.buggyId);
      const arr = map.get(norm) ?? [];
      arr.push(s);
      map.set(norm, arr);
    }
    // each group is already newest-first from the API ORDER BY started_at DESC,
    // but ensure it anyway
    map.forEach((arr) =>
      arr.sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()),
    );
    return map;
  }, [sessions]);

  const selectedBuggySessions = useMemo(
    () =>
      selectedBuggyId
        ? (sessionsByBuggy.get(normalizeBuggyId(selectedBuggyId)) ?? [])
        : [],
    [sessionsByBuggy, selectedBuggyId],
  );

  const selectedSession = useMemo(
    () => sessions.find((s) => s.id === selectedSessionId) ?? null,
    [sessions, selectedSessionId],
  );

  const selectedBuggy = buggies.find((b) => b.id === selectedBuggyId) ?? null;

  // ── Navigation handlers ────────────────────────────────────────────────────

  const goToBuggyList = () => {
    setViewMode("buggy-list");
    setSelectedBuggyId(null);
    setSelectedSessionId(null);
    onShowPath([]);
  };

  const goToSessionList = (buggyId: string) => {
    setSelectedBuggyId(buggyId);
    setSelectedSessionId(null);
    setViewMode("session-list");
    onShowPath([]);
  };

  const goToSessionDetail = (session: BuggySession) => {
    setSelectedSessionId(session.id);
    setViewMode("session-detail");
    // Strip 3rd element (timestamp) before passing to MapCanvas which expects [number, number][]
    onShowPath(session.path.map(([lat, lng]) => [lat, lng] as [number, number]));
  };

  const goBackFromDetail = () => {
    setSelectedSessionId(null);
    setViewMode("session-list");
    onShowPath([]);
  };

  // ── Loading / error states ─────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 rounded-3xl border border-slate-200/80 bg-white/70 p-8 text-[13px] text-slate-500">
        <SpinnerIcon className="h-4 w-4 text-slate-400" />
        Memuat history sesi…
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-3xl border border-rose-200 bg-rose-50 p-4 text-[13px] text-rose-700">
        {error}
        <button type="button" onClick={() => void load()} className="mt-2 block text-[12px] font-semibold underline">
          Coba lagi
        </button>
      </div>
    );
  }

  // ── VIEW: SESSION-DETAIL ───────────────────────────────────────────────────

  if (viewMode === "session-detail" && selectedSession && selectedBuggy) {
    const s = selectedSession;
    return (
      <section className="space-y-3">
        {/* Header */}
        <div className="rounded-3xl border border-slate-200/80 bg-white/70 p-4">
          <div className="mb-3 flex items-center gap-3">
            <button
              type="button"
              onClick={goBackFromDetail}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-slate-100 text-slate-600 transition hover:bg-slate-200"
            >
              <ChevronLeftIcon className="h-5 w-5" />
            </button>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[15px] font-semibold text-slate-900">
                {selectedBuggy.code} · {s.isOngoing ? "Sesi Berlangsung" : `Sesi ${s.sessionNumber}`}
              </p>
              <p className="text-[11px] text-slate-500">
                {fmtDate(s.startedAt)} · {fmtTime(s.startedAt)}{s.isOngoing ? " → sekarang" : ` — ${fmtTime(s.endedAt)}`}
              </p>
            </div>
            {s.isOngoing ? (
              <span className="flex shrink-0 items-center gap-1.5 rounded-full bg-emerald-100 px-2.5 py-1 text-[10px] font-semibold text-emerald-700">
                <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
                On Going
              </span>
            ) : (
              <span className="shrink-0 rounded-full bg-rose-100 px-2.5 py-1 text-[10px] font-semibold text-rose-600">
                Peta aktif
              </span>
            )}
          </div>

          {/* Row 0: Jam mulai & selesai */}
          <div className="mb-2 grid grid-cols-2 gap-2">
            <div className="rounded-2xl bg-slate-50 p-2.5 text-center">
              <p className="text-[15px] font-bold tabular-nums text-slate-900">{fmtTimestamp(s.startedAt)}</p>
              <p className="text-[10px] text-slate-500">Mulai</p>
            </div>
            <div className="rounded-2xl bg-slate-50 p-2.5 text-center">
              <p className="text-[15px] font-bold tabular-nums text-slate-900">
                {s.isOngoing ? (
                  <span className="text-emerald-600">Berlangsung</span>
                ) : (
                  fmtTimestamp(s.endedAt)
                )}
              </p>
              <p className="text-[10px] text-slate-500">Selesai</p>
            </div>
          </div>

          {/* Row 1: GPS points, duration, date */}
          <div className="mb-2 grid grid-cols-3 gap-2">
            <StatBox value={String(s.pointCount)} label="Titik GPS" color="slate" />
            <StatBox value={fmtDuration(s.durationMinutes)} label="Durasi" color="slate" />
            <StatBox value={`Sesi ${s.sessionNumber}`} label={fmtDate(s.sessionDate)} color="slate" />
          </div>

          {/* Row 2: Distance, avg speed, battery */}
          <div className="grid grid-cols-3 gap-2">
            <StatBox
              value={s.totalDistanceKm !== null ? `${s.totalDistanceKm.toFixed(2)} km` : "—"}
              label="Jarak Total"
              color="blue"
            />
            <StatBox
              value={s.avgSpeedKmh !== null ? `${s.avgSpeedKmh.toFixed(1)} km/h` : "—"}
              label="Kec. Rata‑rata"
              color="emerald"
            />
            <StatBox
              value={
                s.batteryUsed !== null
                  ? `${s.batteryUsed > 0 ? "-" : "+"}${Math.abs(s.batteryUsed)}%`
                  : "—"
              }
              subValue={
                s.batteryStart !== null && s.batteryEnd !== null
                  ? `${s.batteryStart}% → ${s.batteryEnd}%`
                  : undefined
              }
              label="Baterai"
              color={
                s.batteryUsed === null ? "slate" : s.batteryUsed > 20 ? "rose" : s.batteryUsed > 5 ? "amber" : "slate"
              }
            />
          </div>
        </div>

        {/* Path coordinates preview */}
        {s.path.length > 0 && (
          <div className="rounded-3xl border border-slate-200/80 bg-white/70 p-3">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-slate-400">
              Jalur GPS ({s.path.length} titik)
            </p>
            <div className="max-h-[280px] space-y-1 overflow-y-auto pr-1">
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
      </section>
    );
  }

  // ── VIEW: SESSION-LIST ─────────────────────────────────────────────────────

  if (viewMode === "session-list" && selectedBuggy) {
    return (
      <section className="space-y-3">
        {/* Header */}
        <div className="rounded-3xl border border-slate-200/80 bg-white/70 p-4">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={goToBuggyList}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-slate-100 text-slate-600 transition hover:bg-slate-200"
            >
              <ChevronLeftIcon className="h-5 w-5" />
            </button>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[15px] font-semibold text-slate-900">
                {selectedBuggy.code} · {selectedBuggy.name}
              </p>
              <p className="text-[11px] text-slate-500">
                {selectedBuggySessions.length} sesi selesai
                {refreshing ? " · menyegarkan…" : ""}
              </p>
            </div>
            <button
              type="button"
              disabled={refreshing}
              onClick={() => void load(true)}
              className="h-8 rounded-xl border border-slate-200 bg-white px-3 text-[12px] font-medium text-slate-600 transition hover:bg-slate-50 disabled:opacity-60"
            >
              {refreshing ? "…" : "Refresh"}
            </button>
          </div>
        </div>

        {/* Session cards */}
        {selectedBuggySessions.length === 0 ? (
          <div className="rounded-3xl border border-slate-200/80 bg-white/70 p-6 text-center text-[13px] text-slate-500">
            Belum ada sesi selesai untuk armada ini.
          </div>
        ) : (
          <div className="space-y-2">
            {selectedBuggySessions.map((session) => (
              <button
                key={session.id}
                type="button"
                onClick={() => goToSessionDetail(session)}
                className="w-full rounded-3xl border border-slate-200/80 bg-white/70 p-4 text-left transition hover:border-rose-200 hover:bg-rose-50/40 active:scale-[0.99]"
              >
                <div className="mb-2 flex items-start justify-between gap-2">
                  <div>
                    <p className="text-[13px] font-semibold text-slate-900">
                      {session.isOngoing ? "Sesi Berlangsung" : `Sesi ${session.sessionNumber}`} · {fmtDate(session.startedAt)}
                    </p>
                    <p className="text-[11px] text-slate-500">
                      {fmtTime(session.startedAt)}{session.isOngoing ? " → sekarang" : ` → ${fmtTime(session.endedAt)}`}
                      {session.durationMinutes !== null ? ` · ${fmtDuration(session.durationMinutes)}` : ""}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    {session.isOngoing && (
                      <span className="flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
                        On Going
                      </span>
                    )}
                    <svg className="h-4 w-4 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="m9 18 6-6-6-6" />
                    </svg>
                  </div>
                </div>

                {/* Mini stats row */}
                <div className="grid grid-cols-3 gap-1.5 text-center">
                  <MiniStat
                    value={session.totalDistanceKm !== null ? `${session.totalDistanceKm.toFixed(2)} km` : "—"}
                    label="Jarak"
                    color="blue"
                  />
                  <MiniStat
                    value={session.avgSpeedKmh !== null ? `${session.avgSpeedKmh.toFixed(1)} km/h` : "—"}
                    label="Kec. Rata"
                    color="emerald"
                  />
                  <MiniStat
                    value={session.batteryUsed !== null ? `${session.batteryUsed > 0 ? "-" : ""}${Math.abs(session.batteryUsed)}%` : "—"}
                    label="Baterai"
                    color={session.batteryUsed !== null && session.batteryUsed > 10 ? "rose" : "slate"}
                  />
                </div>
              </button>
            ))}
          </div>
        )}
      </section>
    );
  }

  // ── VIEW: BUGGY-LIST ───────────────────────────────────────────────────────

  return (
    <section className="space-y-3">
      {/* Header */}
      <div className="rounded-3xl border border-slate-200/80 bg-white/70 p-4">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-rose-100 text-rose-600">
              <HistoryIcon className="h-5 w-5" />
            </span>
            <div>
              <h2 className="text-[16px] font-semibold text-slate-900">History Sesi</h2>
              <p className="text-[11px] text-slate-500">
                {sessions.length} sesi selesai · {buggyOptions.length} armada
              </p>
            </div>
          </div>
          <button
            type="button"
            disabled={refreshing}
            onClick={() => void load(true)}
            className="flex h-8 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-[12px] font-medium text-slate-600 transition hover:bg-slate-50 disabled:opacity-60"
          >
            {refreshing ? <SpinnerIcon className="h-3.5 w-3.5 text-slate-400" /> : null}
            {refreshing ? "…" : "Refresh"}
          </button>
        </div>
      </div>

      {/* Buggy cards */}
      {buggyOptions.length === 0 ? (
        <div className="rounded-3xl border border-slate-200/80 bg-white/70 p-6 text-center text-[13px] text-slate-500">
          Tidak ada armada terdaftar.
        </div>
      ) : (
        <div className="space-y-2">
          {buggyOptions.map((opt) => {
            const norm = normalizeBuggyId(opt.id);
            const sessionsForBuggy = sessionsByBuggy.get(norm) ?? [];
            const latestSession = sessionsForBuggy[0];

            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => goToSessionList(opt.id)}
                className="w-full rounded-3xl border border-slate-200/80 bg-white/70 p-4 text-left transition hover:border-rose-200 hover:bg-rose-50/40 active:scale-[0.99]"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#0f1a3b] text-white">
                    <span className="text-[12px] font-bold">{opt.code}</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[14px] font-semibold text-slate-900">{opt.name}</p>
                    {latestSession ? (
                      <p className="text-[11px] text-slate-500">
                        {sessionsForBuggy.length} sesi · terakhir{" "}
                        {fmtDate(latestSession.startedAt)} {fmtTime(latestSession.startedAt)}
                      </p>
                    ) : (
                      <p className="text-[11px] text-slate-400">Belum ada sesi selesai</p>
                    )}
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {latestSession?.isOngoing && (
                      <span className="flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
                        On Going
                      </span>
                    )}
                    {opt.isActive && !latestSession?.isOngoing && (
                      <span className="rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-semibold text-sky-700">
                        Aktif
                      </span>
                    )}
                    <svg className="h-4 w-4 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="m9 18 6-6-6-6" />
                    </svg>
                  </div>
                </div>

                {/* Session count bar */}
                {sessionsForBuggy.length > 0 && (
                  <div className="mt-3 h-1 w-full overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full bg-rose-400 transition-all"
                      style={{
                        width: `${Math.min(100, (sessionsForBuggy.length / Math.max(sessions.length, 1)) * 100 * buggyOptions.length)}%`,
                      }}
                    />
                  </div>
                )}
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────

type Color = "slate" | "blue" | "emerald" | "rose" | "amber";

const colorMap: Record<Color, { bg: string; value: string; label: string }> = {
  slate: { bg: "bg-slate-50", value: "text-slate-800", label: "text-slate-500" },
  blue: { bg: "bg-blue-50", value: "text-blue-700", label: "text-blue-400" },
  emerald: { bg: "bg-emerald-50", value: "text-emerald-700", label: "text-emerald-500" },
  rose: { bg: "bg-rose-50", value: "text-rose-600", label: "text-rose-400" },
  amber: { bg: "bg-amber-50", value: "text-amber-600", label: "text-amber-500" },
};

function StatBox({
  value,
  subValue,
  label,
  color,
}: {
  value: string;
  subValue?: string;
  label: string;
  color: Color;
}) {
  const c = colorMap[color];
  return (
    <div className={`rounded-2xl ${c.bg} p-2.5 text-center`}>
      <p className={`text-[14px] font-bold tabular-nums ${c.value}`}>{value}</p>
      {subValue && <p className="text-[9px] text-slate-400">{subValue}</p>}
      <p className={`text-[10px] ${c.label}`}>{label}</p>
    </div>
  );
}

function MiniStat({
  value,
  label,
  color,
}: {
  value: string;
  label: string;
  color: Color;
}) {
  const c = colorMap[color];
  return (
    <div className={`rounded-xl ${c.bg} px-2 py-1.5`}>
      <p className={`text-[11px] font-semibold tabular-nums ${c.value}`}>{value}</p>
      <p className={`text-[9px] ${c.label}`}>{label}</p>
    </div>
  );
}
