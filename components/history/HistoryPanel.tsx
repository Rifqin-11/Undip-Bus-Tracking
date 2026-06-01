"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { Buggy } from "@/types/buggy";
import type { BuggySession } from "@/types/buggy-session";
import {
  detectHistoryStopPoints,
  type HistoryStopPoint,
} from "@/lib/history/stop-points";
import { SpinnerIcon } from "@/components/ui/Icons";
import { SkeletonRow } from "@/components/ui/Skeleton";
import { HistoryBuggyList } from "./HistoryBuggyList";
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

function getBuggyNorm(b: Buggy): string {
  const match = b.code.match(/\d+/);
  if (match) {
    return `buggy-${Number.parseInt(match[0], 10)}`;
  }
  return normalizeBuggyId(b.id);
}

function getSessionLastActivityMs(session: BuggySession): number {
  const endedAtMs = new Date(session.endedAt).getTime();
  if (!Number.isNaN(endedAtMs)) return endedAtMs;
  const startedAtMs = new Date(session.startedAt).getTime();
  return Number.isNaN(startedAtMs) ? 0 : startedAtMs;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function HistoryPanel({
  buggies,
  onShowPath,
  readOnly = false,
}: HistoryPanelProps) {
  const { t } = useTranslation("history");
  const [sessions, setSessions] = useState<BuggySession[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [viewMode, setViewMode] = useState<ViewMode>("buggy-list");
  const [selectedBuggyId, setSelectedBuggyId] = useState<string | null>(null);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(
    null,
  );

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Data fetching ──────────────────────────────────────────────────────────

  const load = useCallback(async (silent = false) => {
    if (silent) setRefreshing(true);
    else setLoading(true);

    try {
      const res = await fetch("/api/buggy-sessions?limit=200", {
        cache: "no-store",
      });
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
      setError(
        err instanceof Error ? err.message : t("failedLoad"),
      );
      if (!silent) setSessions([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [t]);

  useEffect(() => {
    void load();
    intervalRef.current = setInterval(() => void load(true), 10_000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [load]);

  // ── Derived data ───────────────────────────────────────────────────────────

  const buggyOptions = useMemo(
    () =>
      buggies
        .map((b) => ({
          id: b.id,
          code: b.code,
          name: b.name,
          norm: getBuggyNorm(b),
          isActive: b.isActive,
        }))
        .sort((a, z) => a.code.localeCompare(z.code, "id-ID")),
    [buggies],
  );

  const sessionsByBuggy = useMemo(() => {
    const map = new Map<string, BuggySession[]>();
    for (const s of sessions) {
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
  }, [sessions]);

  const selectedBuggySessions = useMemo(() => {
    if (!selectedBuggyId) return [];
    const buggy = buggies.find((b) => b.id === selectedBuggyId);
    if (!buggy) return [];
    return sessionsByBuggy.get(getBuggyNorm(buggy)) ?? [];
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

  const goToSessionDetail = (session: BuggySession) => {
    setSelectedSessionId(session.id);
    setViewMode("session-detail");
    const stopPoints = detectHistoryStopPoints(session.path);
    onShowPath(
      session.path.map(([lat, lng]) => [lat, lng] as [number, number]),
      stopPoints,
    );
  };

  const goBackFromDetail = () => {
    setSelectedSessionId(null);
    setViewMode("session-list");
    onShowPath([]);
  };

  // ── Loading / error ────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="rounded-3xl border border-slate-200/80 bg-white/70 p-3">
        <div className="mb-3 flex items-center gap-2 px-1 text-[11px] font-semibold text-slate-400">
          <SpinnerIcon className="h-3 w-3 animate-spin text-slate-400" />
          {t("loadingSessions")}
        </div>
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, idx) => (
            <SkeletonRow key={idx} />
          ))}
        </div>
      </div>
    );
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
        selectedBuggySessions={selectedBuggySessions}
        refreshing={refreshing}
        onRefresh={() => void load(true)}
        onBack={goToBuggyList}
        onSelectSession={goToSessionDetail}
      />
    );
  }

  return (
    <HistoryBuggyList
      buggyOptions={buggyOptions}
      sessionsByBuggy={sessionsByBuggy}
      refreshing={refreshing}
      onRefresh={() => void load(true)}
      onSelectBuggy={goToSessionList}
    />
  );
}
