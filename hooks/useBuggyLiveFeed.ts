"use client";

/**
 * Live fleet data hook.
 *
 * Supports both Server-Sent Events and interval polling. The caller receives one
 * normalized state shape so UI panels do not need to know which transport is
 * currently active.
 */
import { useEffect, useMemo, useState } from "react";
import type { Buggy } from "@/types/buggy";

type BuggyFeedMode = "poll" | "sse";
type BuggyLiveSource = "seed" | "ingest_snapshot" | "ingest_telemetry";

type BuggyLiveSnapshot = {
  source: BuggyLiveSource;
  updatedAt: number;
  buggies: Buggy[];
};

type UseBuggyLiveFeedState = {
  mode: BuggyFeedMode;
  source: BuggyLiveSource;
  liveBuggies: Buggy[] | null;
  error: string | null;
  connected: boolean;
};

const BUGGY_POLL_INTERVAL_MS = 5_000;

function resolveFeedMode(): BuggyFeedMode {
  const raw = (process.env.NEXT_PUBLIC_BUGGY_FEED_MODE ?? "sse")
    .trim()
    .toLowerCase();

  return raw === "poll" ? "poll" : "sse";
}

async function fetchSnapshot(signal?: AbortSignal): Promise<BuggyLiveSnapshot> {
  const response = await fetch("/api/buggy", {
    cache: "no-store",
    signal,
  });
  if (!response.ok) {
    throw new Error(`Buggy API failed with status ${response.status}`);
  }
  const data: unknown = await response.json();
  const sourceHeader =
    (response.headers.get("x-buggy-source") as BuggyLiveSource | null) ??
    "seed";
  const updatedAtHeader = Number.parseInt(
    response.headers.get("x-buggy-updated-at") ?? String(Date.now()),
    10,
  );
  return {
    source: sourceHeader,
    updatedAt: Number.isFinite(updatedAtHeader) ? updatedAtHeader : Date.now(),
    buggies: Array.isArray(data) ? (data as Buggy[]) : [],
  };
}

export function useBuggyLiveFeed(): UseBuggyLiveFeedState {
  const requestedMode = useMemo(() => resolveFeedMode(), []);
  const [mode, setMode] = useState<BuggyFeedMode>(requestedMode);
  const [source, setSource] = useState<BuggyLiveSource>("seed");
  const [liveBuggies, setLiveBuggies] = useState<Buggy[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [connected, setConnected] = useState(requestedMode === "poll");

  useEffect(() => {
    let disposed = false;
    const abortController = new AbortController();

    const applySnapshot = (snapshot: BuggyLiveSnapshot) => {
      if (disposed) return;
      setSource(snapshot.source);
      setLiveBuggies(snapshot.buggies);
    };

    const readInitial = async () => {
      try {
        const snapshot = await fetchSnapshot(abortController.signal);
        applySnapshot(snapshot);
      } catch (err) {
        if (disposed) return;
        const message =
          err instanceof Error ? err.message : "Failed to load snapshot";
        setError(message);
      }
    };

    void readInitial();

    if (mode === "poll") {
      const interval = setInterval(async () => {
        try {
          const snapshot = await fetchSnapshot(abortController.signal);
          applySnapshot(snapshot);
          if (!disposed) setError(null);
        } catch (err) {
          if (disposed) return;
          const message =
            err instanceof Error ? err.message : "Polling realtime feed failed";
          setError(message);
        }
      }, BUGGY_POLL_INTERVAL_MS);

      return () => {
        disposed = true;
        abortController.abort();
        clearInterval(interval);
        setConnected(false);
      };
    }

    const eventSource = new EventSource("/api/buggy/stream");
    eventSource.onopen = () => {
      if (disposed) return;
      setConnected(true);
      setError(null);
    };
    eventSource.onmessage = (event) => {
      if (disposed) return;
      try {
        const snapshot = JSON.parse(event.data) as BuggyLiveSnapshot;
        if (!snapshot || !Array.isArray(snapshot.buggies)) return;
        applySnapshot(snapshot);
        setError(null);
      } catch {
        // ignore malformed event payload
      }
    };
    eventSource.onerror = () => {
      if (disposed) return;
      setConnected(false);
      setError("SSE disconnected. Falling back to polling.");
      eventSource.close();
      setMode("poll");
    };

    return () => {
      disposed = true;
      abortController.abort();
      eventSource.close();
      setConnected(false);
    };
  }, [mode]);

  return {
    mode,
    source,
    liveBuggies,
    error,
    connected,
  };
}
