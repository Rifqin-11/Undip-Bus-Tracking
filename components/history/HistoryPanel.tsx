"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Buggy } from "@/types/buggy";
import type { BuggySession } from "@/types/buggy-session";
import { SpinnerIcon } from "@/components/ui/Icons";
import { HistoryBuggyList } from "./HistoryBuggyList";
import { HistorySessionList } from "./HistorySessionList";
import { HistorySessionDetail } from "./HistorySessionDetail";

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

  const sessionsByBuggy = useMemo(() => {
    const map = new Map<string, BuggySession[]>();
    for (const s of sessions) {
      const norm = normalizeBuggyId(s.buggyId);
      const arr = map.get(norm) ?? [];
      arr.push(s);
      map.set(norm, arr);
    }
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
    onShowPath(session.path.map(([lat, lng]) => [lat, lng] as [number, number]));
  };

  const goBackFromDetail = () => {
    setSelectedSessionId(null);
    setViewMode("session-list");
    onShowPath([]);
  };

  // ── Loading / error ────────────────────────────────────────────────────────

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
