import {
  getBuggyApiSnapshot,
  invalidateBuggyApiSnapshotCache,
  type BuggyApiSnapshot,
} from "@/lib/realtime/buggy-api-snapshot";

type SseClient = {
  id: string;
  controller: ReadableStreamDefaultController<Uint8Array>;
};

const encoder = new TextEncoder();
const STATUS_REFRESH_INTERVAL_MS = 30_000;

declare global {
  var __BUGGY_SSE_CLIENTS__: Set<SseClient> | undefined;
  var __BUGGY_SSE_BROADCAST_IN_FLIGHT__: Promise<void> | undefined;
  var __BUGGY_SSE_STATUS_REFRESH_INTERVAL__: ReturnType<typeof setInterval> | undefined;
}

function getClients(): Set<SseClient> {
  if (!globalThis.__BUGGY_SSE_CLIENTS__) {
    globalThis.__BUGGY_SSE_CLIENTS__ = new Set();
  }

  return globalThis.__BUGGY_SSE_CLIENTS__;
}

function formatSseMessage(data: unknown): Uint8Array {
  return encoder.encode(`data: ${JSON.stringify(data)}\n\n`);
}

function formatSseEvent(event: string, data: unknown): Uint8Array {
  return encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

function sendToClient(client: SseClient, chunk: Uint8Array): boolean {
  try {
    client.controller.enqueue(chunk);
    return true;
  } catch {
    getClients().delete(client);
    return false;
  }
}

function ensureStatusRefreshTimer(): void {
  if (globalThis.__BUGGY_SSE_STATUS_REFRESH_INTERVAL__) return;

  globalThis.__BUGGY_SSE_STATUS_REFRESH_INTERVAL__ = setInterval(() => {
    if (getClients().size === 0) {
      stopStatusRefreshTimer();
      return;
    }

    broadcastBuggySnapshot({ forceRefresh: true, reason: "status-aging" });
  }, STATUS_REFRESH_INTERVAL_MS);
}

function stopStatusRefreshTimer(): void {
  if (!globalThis.__BUGGY_SSE_STATUS_REFRESH_INTERVAL__) return;

  clearInterval(globalThis.__BUGGY_SSE_STATUS_REFRESH_INTERVAL__);
  globalThis.__BUGGY_SSE_STATUS_REFRESH_INTERVAL__ = undefined;
}

export async function sendBuggySnapshotToClient(
  client: SseClient,
  options: { forceRefresh?: boolean; durableOverlay?: boolean } = {},
): Promise<void> {
  try {
    const snapshot = await getBuggyApiSnapshot(options);
    sendToClient(client, formatSseMessage(snapshot));
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to build buggy stream";
    sendToClient(client, formatSseEvent("error", { message }));
  }
}

export function addBuggySseClient(
  controller: ReadableStreamDefaultController<Uint8Array>,
): SseClient {
  const client = {
    id: crypto.randomUUID(),
    controller,
  };
  getClients().add(client);
  ensureStatusRefreshTimer();
  return client;
}

export function removeBuggySseClient(client: SseClient): void {
  const clients = getClients();
  clients.delete(client);
  if (clients.size === 0) {
    stopStatusRefreshTimer();
  }
}

export function sendBuggySsePing(client: SseClient): void {
  sendToClient(client, formatSseEvent("ping", { ts: Date.now() }));
}

export function getBuggySseClientCount(): number {
  return getClients().size;
}

export function broadcastBuggySnapshot(
  options: {
    forceRefresh?: boolean;
    reason?: string;
    durableOverlay?: boolean;
  } = {},
): void {
  const clients = getClients();
  if (clients.size === 0) return;

  if (options.forceRefresh) {
    invalidateBuggyApiSnapshotCache();
  }

  if (globalThis.__BUGGY_SSE_BROADCAST_IN_FLIGHT__) return;

  globalThis.__BUGGY_SSE_BROADCAST_IN_FLIGHT__ = (async () => {
    try {
      const snapshot: BuggyApiSnapshot = await getBuggyApiSnapshot({
        forceRefresh: options.forceRefresh,
        durableOverlay: options.durableOverlay,
      });
      const chunk = formatSseMessage(snapshot);

      for (const client of [...clients]) {
        sendToClient(client, chunk);
      }
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to broadcast buggy stream";
      const chunk = formatSseEvent("error", {
        message,
        reason: options.reason ?? "broadcast",
      });

      for (const client of [...clients]) {
        sendToClient(client, chunk);
      }
    } finally {
      globalThis.__BUGGY_SSE_BROADCAST_IN_FLIGHT__ = undefined;
    }
  })();
}
