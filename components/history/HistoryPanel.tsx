"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { Buggy } from "@/types/buggy";
import type { BuggySession } from "@/types/buggy-session";
import {
  detectHistoryStopPoints,
  type HistoryStopPoint,
} from "@/lib/history/stop-points";
import { Skeleton } from "@/components/ui/Skeleton";
import { HistoryDateBuggyList } from "./HistoryDateBuggyList";
import { HistorySessionList } from "./HistorySessionList";
import { HistorySessionDetail } from "./HistorySessionDetail";

// ── Types ─────────────────────────────────────────────────────────────────────

type HistoryPanelProps = {
  buggies: Buggy[];
  onShowPath: (
    path: [number, number][],
    stopPoints?: HistoryStopPoint[],
  ) => void;
  readOnly?: boolean;
  /**
   * Fetch hanya berjalan jika enabled=true.
   * Saat panel history tidak aktif, set ke false agar tidak fetch Supabase.
   */
  enabled?: boolean;
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

function getBuggyNorm(b: Pick<Buggy, "id" | "code">): string {
  const match = b.code.match(/\d+/);
  if (match) {
    return `buggy-${Number.parseInt(match[0], 10)}`;
  }
  return normalizeBuggyId(b.id);
}

function getBuggyHistoryKeys(b: Pick<Buggy, "id" | "code" | "numericId">): string[] {
  const keys = new Set<string>();
  keys.add(normalizeBuggyId(b.id));
  keys.add(getBuggyNorm(b));

  if (typeof b.numericId === "number") {
    keys.add(`buggy-${b.numericId}`);
    keys.add(String(b.numericId));
  }

  if (b.code) {
    keys.add(normalizeBuggyId(b.code));
  }

  return Array.from(keys).filter(Boolean);
}

function getSessionsForBuggy(
  buggy: Pick<Buggy, "id" | "code" | "numericId">,
  sessionsByBuggy: Map<string, BuggySession[]>,
): BuggySession[] {
  const byId = new Map<string, BuggySession>();
  for (const key of getBuggyHistoryKeys(buggy)) {
    for (const session of sessionsByBuggy.get(key) ?? []) {
      byId.set(session.id, session);
    }
  }
  return Array.from(byId.values()).sort(
    (a, b) => getSessionLastActivityMs(b) - getSessionLastActivityMs(a),
  );
}

function getSessionLastActivityMs(session: BuggySession): number {
  const endedAtMs = new Date(session.endedAt).getTime();
  if (!Number.isNaN(endedAtMs)) return endedAtMs;
  const startedAtMs = new Date(session.startedAt).getTime();
  return Number.isNaN(startedAtMs) ? 0 : startedAtMs;
}

function getTodayDateInputValue(): string {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}

function HistoryCalendarSkeleton() {
  return (
    <section className="space-y-3">
      <div className="overflow-hidden rounded-[28px] border border-slate-200/80 bg-white shadow-[0_18px_45px_rgba(15,23,42,0.08)]">
        <div className="border-b border-slate-100 p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 space-y-2">
              <div className="flex items-center gap-2">
                <Skeleton className="h-3.5 w-3.5 rounded-md" />
                <Skeleton className="h-2.5 w-28" />
              </div>
              <Skeleton className="h-6 w-40" />
              <Skeleton className="h-3 w-56 max-w-full" />
            </div>
            <Skeleton className="h-6 w-14 rounded-full" />
          </div>

          <div className="mt-4 rounded-[24px] border border-slate-200 bg-slate-50/80 p-2.5">
            <div className="mb-3 flex items-center justify-between gap-2 px-1">
              <Skeleton className="h-8 w-8 rounded-full" />
              <div className="space-y-1.5">
                <Skeleton className="mx-auto h-3.5 w-24" />
                <Skeleton className="mx-auto h-2.5 w-16" />
              </div>
              <Skeleton className="h-8 w-8 rounded-full" />
            </div>

            <div className="grid grid-cols-7 gap-1">
              {Array.from({ length: 7 }).map((_, index) => (
                <Skeleton key={`weekday-${index}`} className="mx-auto h-2.5 w-5" />
              ))}
              {Array.from({ length: 35 }).map((_, index) => (
                <Skeleton key={`day-${index}`} className="h-10 rounded-2xl" />
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-[28px] border border-slate-200/80 bg-white/85 p-3 shadow-[0_14px_35px_rgba(15,23,42,0.06)]">
        <div className="mb-3 flex items-center justify-between gap-2 px-1">
          <div className="space-y-1.5">
            <Skeleton className="h-3.5 w-36" />
            <Skeleton className="h-2.5 w-20" />
          </div>
          <Skeleton className="h-6 w-20 rounded-full" />
        </div>

        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, index) => (
            <div
              key={index}
              className="rounded-[22px] border border-slate-200/80 bg-white p-2.5"
            >
              <div className="flex items-center justify-between gap-2.5">
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <Skeleton className="h-[52px] w-[70px] shrink-0 rounded-2xl" />
                  <div className="min-w-0 flex-1 space-y-2">
                    <Skeleton className="h-4 w-28" />
                    <Skeleton className="h-2.5 w-20" />
                  </div>
                </div>
                <Skeleton className="h-9 w-9 shrink-0 rounded-full" />
              </div>
              <Skeleton className="mt-2.5 h-9 rounded-2xl" />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

export function HistoryPanel({
  buggies,
  onShowPath,
  readOnly = false,
  enabled = false,
}: HistoryPanelProps) {
  const { t, i18n } = useTranslation("history");
  const [sessions, setSessions] = useState<BuggySession[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detailLoadingId, setDetailLoadingId] = useState<string | null>(null);

  const [viewMode, setViewMode] = useState<ViewMode>("buggy-list");
  const [selectedDate, setSelectedDate] = useState(getTodayDateInputValue);
  const [selectedBuggyId, setSelectedBuggyId] = useState<string | null>(null);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(
    null,
  );

  const hasInitializedDateRef = useRef(false);

  // ── Data fetching ──────────────────────────────────────────────────────────

  const redirectToLogin = useCallback(() => {
    if (typeof window === "undefined") return;
    const locale = i18n.language?.startsWith("en") ? "en" : "id";
    const next = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    window.location.assign(
      `/${locale}/login?next=${encodeURIComponent(next)}`,
    );
  }, [i18n.language]);

  const load = useCallback(async (silent = false, signal?: AbortSignal) => {
    if (silent) setRefreshing(true);
    else setLoading(true);

    try {
      const res = await fetch("/api/buggy-sessions?limit=200", {
        cache: "no-store",
        signal,
      });
      if (res.status === 401 || res.status === 403) {
        redirectToLogin();
        return;
      }
      const payload = (await res.json()) as Partial<BuggySessionApiResponse>;
      if (!res.ok)
        throw new Error(
          typeof payload.error === "string"
            ? payload.error
            : t("failedLoad"),
        );
      setSessions(Array.isArray(payload.sessions) ? payload.sessions : []);
      setError(null);
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      setError(
        err instanceof Error ? err.message : t("failedLoad"),
      );
      if (!silent) setSessions([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [redirectToLogin, t]);

  const loadSessionDetail = useCallback(async (session: BuggySession) => {
    const sessionIds =
      session.sourceSessionIds?.filter(
        (id) => !id.startsWith("synth-") && !id.startsWith("merged-"),
      ) ?? [];

    if (session.path.length > 0 || sessionIds.length === 0) {
      return session;
    }

    setDetailLoadingId(session.id);

    try {
      const res = await fetch(
        `/api/buggy-sessions?ids=${encodeURIComponent(sessionIds.join(","))}`,
        { cache: "no-store" },
      );

      if (res.status === 401 || res.status === 403) {
        redirectToLogin();
        return session;
      }

      const payload = (await res.json()) as Partial<BuggySessionApiResponse>;
      if (!res.ok) {
        throw new Error(
          typeof payload.error === "string"
            ? payload.error
            : t("failedLoad"),
        );
      }

      const detailedSession = Array.isArray(payload.sessions)
        ? payload.sessions[0]
        : null;

      if (!detailedSession) return session;

      setSessions((current) =>
        current.map((item) =>
          item.id === session.id ||
          item.sourceSessionIds?.some((id) => sessionIds.includes(id))
            ? { ...item, ...detailedSession, id: item.id }
            : item,
        ),
      );

      return { ...session, ...detailedSession, id: session.id };
    } finally {
      setDetailLoadingId(null);
    }
  }, [redirectToLogin, t]);

  // Hanya fetch saat panel history benar-benar aktif (enabled=true).
  useEffect(() => {
    if (!enabled) return;

    const controller = new AbortController();
    void load(false, controller.signal);

    return () => {
      controller.abort();
    };
  }, [enabled, load]);

  // ── Derived data ───────────────────────────────────────────────────────────

  const buggyOptions = useMemo(
    () =>
      buggies
        .map((b) => ({
          id: b.id,
          code: b.code,
          name: b.name,
          numericId: b.numericId,
          norm: getBuggyNorm(b),
          isActive: b.isActive,
        }))
        .sort((a, z) => a.code.localeCompare(z.code, "id-ID")),
    [buggies],
  );

  const sessionsByBuggy = useMemo(() => {
    const map = new Map<string, BuggySession[]>();
    for (const s of sessions.filter((session) => session.sessionDate === selectedDate)) {
      const norm = normalizeBuggyId(s.buggyId);
      const arr = map.get(norm) ?? [];
      arr.push(s);
      map.set(norm, arr);
    }
    map.forEach((arr) =>
      arr.sort(
        (a, b) =>
          getSessionLastActivityMs(b) - getSessionLastActivityMs(a),
      ),
    );
    return map;
  }, [selectedDate, sessions]);

  const availableDates = useMemo(() => {
    const dates = Array.from(
      new Set(
        sessions
          .map((session) => session.sessionDate)
          .filter((date): date is string => Boolean(date)),
      ),
    );

    return dates.sort((a, b) => b.localeCompare(a));
  }, [sessions]);

  useEffect(() => {
    if (hasInitializedDateRef.current) return;
    if (availableDates.length === 0) return;

    hasInitializedDateRef.current = true;
    if (!availableDates.includes(selectedDate)) {
      setSelectedDate(availableDates[0]);
    }
  }, [availableDates, selectedDate]);

  const activeBuggySummaries = useMemo(
    () =>
      buggyOptions
        .map((buggy) => ({
          ...buggy,
          sessions: getSessionsForBuggy(buggy, sessionsByBuggy),
        }))
        .filter((buggy) => buggy.sessions.length > 0),
    [buggyOptions, sessionsByBuggy],
  );

  const dailySummary = useMemo(() => {
    const sessionsForDate = activeBuggySummaries.flatMap(
      (buggy) => buggy.sessions,
    );

    return {
      activeBuggyCount: activeBuggySummaries.length,
      sessionCount: sessionsForDate.length,
      totalDistanceKm: sessionsForDate.reduce(
        (total, session) => total + (session.totalDistanceKm ?? 0),
        0,
      ),
      totalDurationMinutes: sessionsForDate.reduce(
        (total, session) => total + (session.durationMinutes ?? 0),
        0,
      ),
    };
  }, [activeBuggySummaries]);

  const selectedBuggySessions = useMemo(() => {
    if (!selectedBuggyId) return [];
    const buggy = buggies.find((b) => b.id === selectedBuggyId);
    if (!buggy) return [];
    return getSessionsForBuggy(buggy, sessionsByBuggy);
  }, [sessionsByBuggy, selectedBuggyId, buggies]);

  const selectedSession = useMemo(
    () => sessions.find((s) => s.id === selectedSessionId) ?? null,
    [sessions, selectedSessionId],
  );

  const selectedBuggy = buggies.find((b) => b.id === selectedBuggyId) ?? null;

  // ── Navigation ─────────────────────────────────────────────────────────────

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

  const handleDateChange = (date: string) => {
    if (!date) return;
    setSelectedDate(date);
    setSelectedBuggyId(null);
    setSelectedSessionId(null);
    setViewMode("buggy-list");
    onShowPath([]);
  };

  const goToSessionDetail = (session: BuggySession) => {
    setSelectedSessionId(session.id);
    setViewMode("session-detail");
    onShowPath([]);

    void loadSessionDetail(session)
      .then((detailedSession) => {
        const stopPoints = detectHistoryStopPoints(detailedSession.path);
        onShowPath(
          detailedSession.path.map(([lat, lng]) => [lat, lng] as [number, number]),
          stopPoints,
        );
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : t("failedLoad"));
      });
  };

  const goBackFromDetail = () => {
    setSelectedSessionId(null);
    setViewMode("session-list");
    onShowPath([]);
  };

  // ── Loading / error ────────────────────────────────────────────────────────

  if (loading) {
    return <HistoryCalendarSkeleton />;
  }

  if (error) {
    return (
      <div className="rounded-3xl border border-rose-200 bg-rose-50 p-4 text-[13px] text-rose-700">
        {error}
        <button
          type="button"
          onClick={() => void load()}
          className="mt-2 block text-[12px] font-semibold underline"
        >
          {t("tryAgain")}
        </button>
      </div>
    );
  }

  // ── VIEWS ──────────────────────────────────────────────────────────────────

  if (viewMode === "session-detail" && selectedSession && selectedBuggy) {
    if (
      detailLoadingId === selectedSession.id &&
      selectedSession.path.length === 0
    ) {
      return <HistoryCalendarSkeleton />;
    }

    return (
      <HistorySessionDetail
        selectedBuggy={selectedBuggy}
        selectedSession={selectedSession}
        onBack={goBackFromDetail}
        onDeleteSuccess={() => {
          void load(true);
          goBackFromDetail();
        }}
        readOnly={readOnly}
      />
    );
  }

  if (viewMode === "session-list" && selectedBuggy) {
    return (
      <HistorySessionList
        selectedBuggy={selectedBuggy}
        selectedDate={selectedDate}
        selectedBuggySessions={selectedBuggySessions}
        refreshing={refreshing}
        onRefresh={() => void load(true)}
        onBack={goToBuggyList}
        onSelectSession={goToSessionDetail}
      />
    );
  }

  return (
    <HistoryDateBuggyList
      selectedDate={selectedDate}
      availableDates={availableDates}
      activeBuggySummaries={activeBuggySummaries}
      dailySummary={dailySummary}
      refreshing={refreshing}
      onDateChange={handleDateChange}
      onSelectBuggy={goToSessionList}
    />
  );
}
