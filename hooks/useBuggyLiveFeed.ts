"use client";

/**
 * Live fleet data hook.
 *
 * SSE is the primary transport. Fallback polling only activates when SSE fails
 * repeatedly. Connection status (online / signal_unstable / connection_lost /
 * offline) is recomputed locally every STATUS_TICK_MS so the UI ages correctly
 * without any network call.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import type { Buggy } from "@/types/buggy";
import { resolveBuggyConnectionStatus } from "@/lib/buggy/connection-status";

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

// ── Constants ────────────────────────────────────────────────────────────────

const BUGGY_POLL_INTERVAL_MS = 5_000;

/**
 * Local status tick: recompute connection status from lastSeenAt in state.
 * No network call — purely client-side aging.
 */
const STATUS_TICK_MS = 2_000;

/**
 * SSE retry: attempt to reconnect SSE before giving up and switching to poll.
 * After SSE_MAX_RETRIES failures, switches to poll mode. Poll will attempt SSE
 * once every SSE_POLL_RETRY_INTERVAL_MS to recover.
 */
const SSE_INITIAL_BACKOFF_MS = 2_000;
const SSE_MAX_RETRIES = 3;
const SSE_POLL_RETRY_INTERVAL_TICKS = 12; // ~60 seconds at 5s poll interval

// ── Helpers ───────────────────────────────────────────────────────────────────

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

/**
 * Recompute connectionStatus for each buggy based on lastSeenAt.
 * Does NOT mutate the original array — returns a new array only when at least
 * one status has changed to avoid unnecessary re-renders.
 */
function recomputeConnectionStatuses(buggies: Buggy[]): Buggy[] | null {
  const now = Date.now();
  let changed = false;

  const next = buggies.map((buggy) => {
    const lastSeenMs = buggy.lastSeenAt ? new Date(buggy.lastSeenAt).getTime() : 0;
    const secondsAgo =
      lastSeenMs > 0 ? Math.max(0, Math.floor((now - lastSeenMs) / 1000)) : undefined;
    const newStatus = resolveBuggyConnectionStatus(secondsAgo);

    if (newStatus !== buggy.connectionStatus) {
      changed = true;
      return {
        ...buggy,
        connectionStatus: newStatus,
        lastSeenSecondsAgo: secondsAgo,
        isActive:
          lastSeenMs > 0 && now - lastSeenMs <= 15_000,
      };
    }
    return buggy;
  });

  return changed ? next : null;
}

// ── Hook ─────────────────────────────────────────────────────────────────────

export function useBuggyLiveFeed(): UseBuggyLiveFeedState {
  const requestedMode = useMemo(() => resolveFeedMode(), []);
  const [mode, setMode] = useState<BuggyFeedMode>(requestedMode);
  const [source, setSource] = useState<BuggyLiveSource>("seed");
  const [liveBuggies, setLiveBuggies] = useState<Buggy[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [connected, setConnected] = useState(requestedMode === "poll");

  // Track SSE retry count so we don't hammer the server on repeated failures.
  const sseRetryCountRef = useRef(0);
  // Track how many poll ticks have elapsed since last SSE attempt (for recovery).
  const pollTicksSinceLastSseAttemptRef = useRef(0);

  useEffect(() => {
    let disposed = false;

    // ── Polling mode ──────────────────────────────────────────────────────────
    if (mode === "poll") {
      let pollTickCount = 0;

      const doFetch = async (signal: AbortSignal) => {
        try {
          const snapshot = await fetchSnapshot(signal);
          if (disposed) return;
          setSource(snapshot.source);
          setLiveBuggies(snapshot.buggies);
          setError(null);
        } catch (err) {
          if (disposed) return;
          const message =
            err instanceof Error ? err.message : "Polling realtime feed failed";
          setError(message);
        }
      };

      const abortController = new AbortController();

      // Fetch immediately on entering poll mode.
      void doFetch(abortController.signal);

      const interval = setInterval(async () => {
        pollTickCount += 1;
        pollTicksSinceLastSseAttemptRef.current += 1;

        // Periodically try to recover SSE after extended polling.
        if (
          pollTicksSinceLastSseAttemptRef.current >= SSE_POLL_RETRY_INTERVAL_TICKS
        ) {
          pollTicksSinceLastSseAttemptRef.current = 0;
          sseRetryCountRef.current = 0;
          if (!disposed) setMode("sse");
          return;
        }

        await doFetch(abortController.signal);
      }, BUGGY_POLL_INTERVAL_MS);

      // Local status aging while in poll mode.
      const statusTick = setInterval(() => {
        if (disposed) return;
        setLiveBuggies((prev) => {
          if (!prev) return prev;
          return recomputeConnectionStatuses(prev) ?? prev;
        });
      }, STATUS_TICK_MS);

      return () => {
        disposed = true;
        abortController.abort();
        clearInterval(interval);
        clearInterval(statusTick);
        setConnected(false);
      };
    }

    // ── SSE mode ──────────────────────────────────────────────────────────────

    let retryTimeout: ReturnType<typeof setTimeout> | null = null;

    const connect = () => {
      if (disposed) return;

      const eventSource = new EventSource("/api/buggy/stream");

      eventSource.onopen = () => {
        if (disposed) {
          eventSource.close();
          return;
        }
        // SSE connected — reset retry counter and mark as connected.
        sseRetryCountRef.current = 0;
        pollTicksSinceLastSseAttemptRef.current = 0;
        setConnected(true);
        setError(null);
      };

      eventSource.onmessage = (event) => {
        if (disposed) return;
        try {
          const snapshot = JSON.parse(event.data) as BuggyLiveSnapshot;
          if (!snapshot || !Array.isArray(snapshot.buggies)) return;
          setSource(snapshot.source);
          setLiveBuggies(snapshot.buggies);
          setError(null);
        } catch {
          // ignore malformed event payload
        }
      };

      eventSource.onerror = () => {
        eventSource.close();
        if (disposed) return;

        setConnected(false);

        const retryCount = sseRetryCountRef.current;
        if (retryCount < SSE_MAX_RETRIES) {
          // Exponential backoff retry before switching to poll.
          const delay = SSE_INITIAL_BACKOFF_MS * Math.pow(2, retryCount);
          sseRetryCountRef.current += 1;
          setError(`SSE disconnected. Retry ${retryCount + 1}/${SSE_MAX_RETRIES}…`);

          retryTimeout = setTimeout(() => {
            if (!disposed) connect();
          }, delay);
        } else {
          // All retries exhausted — switch to fallback polling.
          setError("SSE unavailable. Falling back to polling.");
          sseRetryCountRef.current = 0;
          if (!disposed) setMode("poll");
        }
      };

      return eventSource;
    };

    const eventSource = connect();

    // Local status aging while in SSE mode (no network call).
    const statusTick = setInterval(() => {
      if (disposed) return;
      setLiveBuggies((prev) => {
        if (!prev) return prev;
        return recomputeConnectionStatuses(prev) ?? prev;
      });
    }, STATUS_TICK_MS);

    return () => {
      disposed = true;
      if (retryTimeout) clearTimeout(retryTimeout);
      eventSource?.close();
      clearInterval(statusTick);
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
