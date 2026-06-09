/**
 * Process-local live fleet store.
 *
 * Holds the latest in-memory buggy state for map snapshots and SSE responses.
 * Durable history still lives in Supabase; this store optimizes realtime reads.
 */
import { getHalteLocations } from "@/lib/transit/halte-runtime";
import {
  findHeadingAwarePathIndex,
  findNearestPathIndex,
  resolveCurrentHalteIndexFromRouteCursor,
} from "@/lib/transit/buggy-route-utils";
import { normalizeGsmStatus } from "@/lib/buggy/gsm-status";
import { resolveBuggyConnectionStatus } from "@/lib/buggy/connection-status";
import { fmtTime } from "@/lib/utils/format-time";
import type { Buggy, CrowdLevel } from "@/types/buggy";

export type BuggyLiveSource = "seed" | "ingest_snapshot" | "ingest_telemetry";

export type BuggyTelemetryInput = {
  id: string | number;
  lat: number;
  lng: number;
  speedKmh?: number;
  heading?: number;
  passengers?: number;
  capacity?: number;
  etaMinutes?: number;
  currentStopIndex?: number;
  forceResync?: boolean;
  tag?: string;
  timestamp?: string | number;
  gsm?: Buggy["gsm"];
};

type BuggyLiveState = {
  source: BuggyLiveSource;
  updatedAt: number;
  buggies: Buggy[];
  telemetryLastSeenById: Record<string, number>;
};

export type BuggyLiveSnapshot = {
  source: BuggyLiveSource;
  updatedAt: number;
  buggies: Buggy[];
};

export type BuggyIngestResult = {
  mode: "snapshot" | "telemetry";
  accepted: number;
  source: BuggyLiveSource;
  updatedAt: number;
};

declare global {
  var __BUGGY_LIVE_STATE__: BuggyLiveState | undefined;
}

function cloneBuggy(buggy: Buggy): Buggy {
  return {
    ...buggy,
    position: { ...buggy.position },
    stops: [...buggy.stops],
    gsm: buggy.gsm ? { ...buggy.gsm } : undefined,
  };
}

function nowMs(): number {
  return Date.now();
}

const ACTIVE_TELEMETRY_WINDOW_MS = 15_000;

function normalizeLoopIndex(index: number, length: number): number {
  if (length <= 0) return 0;
  return ((index % length) + length) % length;
}

function resolveCrowdLevel(passengers: number, capacity: number): CrowdLevel {
  const ratio = capacity > 0 ? passengers / capacity : 0;
  if (ratio >= 0.875) return "PENUH";
  if (ratio >= 0.375) return "HAMPIR_PENUH";
  return "LONGGAR";
}

function normalizeBuggyId(id: string | number): string {
  if (typeof id === "number") return `buggy-${id}`;
  const text = id.trim();
  if (text.startsWith("buggy-")) return text;
  const parsed = Number.parseInt(text, 10);
  if (!Number.isNaN(parsed) && String(parsed) === text) {
    return `buggy-${parsed}`;
  }
  return text;
}

function timestampToUpdatedAt(timestamp: string | number | undefined): string {
  const date =
    typeof timestamp === "number" || typeof timestamp === "string"
      ? new Date(timestamp)
      : new Date();

  return fmtTime(
    Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString(),
  );
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isBuggyLike(value: unknown): value is Buggy {
  if (!isRecord(value)) return false;
  if (typeof value.id !== "string") return false;
  if (typeof value.code !== "string") return false;
  if (typeof value.name !== "string") return false;
  if (!isRecord(value.position)) return false;
  if (
    !isFiniteNumber(value.position.lat) ||
    !isFiniteNumber(value.position.lng)
  ) {
    return false;
  }
  return true;
}

function parseSnapshotPayload(payload: unknown): Buggy[] | null {
  const candidate = Array.isArray(payload)
    ? payload
    : isRecord(payload) && Array.isArray(payload.buggies)
      ? payload.buggies
      : null;

  if (!candidate || candidate.length === 0) return null;
  if (!candidate.every((item) => isBuggyLike(item))) return null;
  return candidate as Buggy[];
}

function parseTelemetryPayload(payload: unknown): BuggyTelemetryInput[] | null {
  const candidate =
    isRecord(payload) && Array.isArray(payload.telemetry)
      ? payload.telemetry
      : null;
  if (!candidate || candidate.length === 0) return null;

  const output: BuggyTelemetryInput[] = [];
  for (const item of candidate) {
    if (!isRecord(item)) continue;
    const id = item.id;
    if (!(typeof id === "string" || typeof id === "number")) continue;
    if (!isFiniteNumber(item.lat) || !isFiniteNumber(item.lng)) continue;
    output.push({
      id,
      lat: item.lat,
      lng: item.lng,
      speedKmh: isFiniteNumber(item.speedKmh) ? item.speedKmh : undefined,
      heading: isFiniteNumber(item.heading) ? item.heading : undefined,
      passengers: isFiniteNumber(item.passengers) ? item.passengers : undefined,
      capacity: isFiniteNumber(item.capacity) ? item.capacity : undefined,
      etaMinutes: isFiniteNumber(item.etaMinutes) ? item.etaMinutes : undefined,
      currentStopIndex: isFiniteNumber(item.currentStopIndex)
        ? item.currentStopIndex
        : undefined,
      forceResync: item.forceResync === true,
      tag: typeof item.tag === "string" ? item.tag : undefined,
      timestamp:
        typeof item.timestamp === "string" || typeof item.timestamp === "number"
          ? item.timestamp
          : undefined,
      gsm: normalizeGsmStatus(item.gsm),
    });
  }

  return output.length > 0 ? output : null;
}

function getMutableState(): BuggyLiveState {
  if (!globalThis.__BUGGY_LIVE_STATE__) {
    globalThis.__BUGGY_LIVE_STATE__ = {
      source: "seed",
      updatedAt: nowMs(),
      // Mulai kosong — data diisi dari Supabase via data-loader (tidak ada fallback seed)
      buggies: [],
      telemetryLastSeenById: {},
    };
  }
  return globalThis.__BUGGY_LIVE_STATE__;
}

function setState(next: BuggyLiveState): BuggyLiveSnapshot {
  globalThis.__BUGGY_LIVE_STATE__ = next;
  return getBuggyLiveSnapshot();
}

export function getBuggyLiveSnapshot(): BuggyLiveSnapshot {
  // The live map is intentionally backed by a process-local cache so SSE
  // responses are fast. Supabase remains the durable source for reloads/history.
  const state = getMutableState();
  const now = nowMs();
  return {
    source: state.source,
    updatedAt: state.updatedAt,
    buggies: state.buggies.map((buggy) => {
      const cloned = cloneBuggy(buggy);
      const lastSeen = state.telemetryLastSeenById[buggy.id] ?? 0;
      const lastSeenSecondsAgo =
        lastSeen > 0
          ? Math.max(0, Math.floor((now - lastSeen) / 1000))
          : undefined;
      const connectionStatus =
        resolveBuggyConnectionStatus(lastSeenSecondsAgo);
      const isActive =
        lastSeen > 0 && now - lastSeen <= ACTIVE_TELEMETRY_WINDOW_MS;
      return {
        ...cloned,
        isActive,
        connectionStatus,
        lastSeenAt: lastSeen > 0 ? new Date(lastSeen).toISOString() : undefined,
        lastSeenSecondsAgo,
      };
    }),
  };
}

function ingestSnapshot(buggies: Buggy[]): BuggyIngestResult {
  const sanitized = buggies.map((item) => ({
    ...item,
    isActive: true,
    position: { ...item.position },
    stops: Array.isArray(item.stops) ? [...item.stops] : [],
    pathCursor: findNearestPathIndex(item.position.lat, item.position.lng),
  }));
  const updatedAt = nowMs();
  const telemetryLastSeenById = Object.fromEntries(
    sanitized.map((buggy) => [buggy.id, updatedAt]),
  );

  setState({
    source: "ingest_snapshot",
    updatedAt,
    buggies: sanitized,
    telemetryLastSeenById,
  });

  return {
    mode: "snapshot",
    accepted: sanitized.length,
    source: "ingest_snapshot",
    updatedAt,
  };
}

function autoRegisterBuggy(buggyId: string, point: BuggyTelemetryInput): Buggy {
  const numericMatch = buggyId.match(/(\d+)$/);
  const num = numericMatch ? parseInt(numericMatch[1], 10) : 99;
  const code = `B${String(num).padStart(2, "0")}`;
  const haltes = getHalteLocations();
  const usableHeading =
    (point.speedKmh ?? 0) >= 2 ? point.heading : undefined;
  const pathCursor = findHeadingAwarePathIndex(
    point.lat,
    point.lng,
    usableHeading,
  );
  const stopIndex = resolveCurrentHalteIndexFromRouteCursor(
    pathCursor,
    haltes,
  );

  return {
    id: buggyId,
    code,
    name: `Buggy ${String(num).padStart(2, "0")}`,
    isActive: true,
    routeLabel: "Rute Kampus Undip",
    tripId: `TRIP-2026-${String(num).padStart(3, "0")}`,
    etaMinutes: point.etaMinutes ?? 5,
    speedKmh: point.speedKmh ?? 0,
    crowdLevel: resolveCrowdLevel(point.passengers ?? 0, point.capacity ?? 8),
    passengers: point.passengers ?? 0,
    capacity: point.capacity ?? 8,
    tag: point.tag ?? "GPS Nyata",
    updatedAt: timestampToUpdatedAt(point.timestamp),
    currentStopIndex: stopIndex,
    stops: haltes.map((h) => h.name),
    pathCursor,
    position: { lat: point.lat, lng: point.lng },
    gsm: point.gsm,
  };
}

function ingestTelemetry(
  telemetry: BuggyTelemetryInput[],
): BuggyIngestResult | null {
  // Telemetry requests are stateless. Each point refreshes position, passenger
  // load, GSM metadata, and the last-seen clock used to mark buggy offline.
  const current = getMutableState();
  const byId = new Map(
    current.buggies.map((buggy) => [buggy.id, cloneBuggy(buggy)]),
  );
  const telemetryLastSeenById = { ...current.telemetryLastSeenById };
  const now = nowMs();
  let accepted = 0;
  const newBuggies: Buggy[] = [];

  for (const point of telemetry) {
    const buggyId = normalizeBuggyId(point.id);
    let existing = byId.get(buggyId);

    // Auto-register unknown buggy on first GPS ping
    if (!existing) {
      existing = autoRegisterBuggy(buggyId, point);
      newBuggies.push(existing);
      byId.set(buggyId, existing);
      telemetryLastSeenById[buggyId] = nowMs();
      accepted += 1;
      continue;
    }

    // Capacity is configured from admin master data. Telemetry can carry stale
    // capacity values from devices/simulators, so only use it for auto-register.
    const capacity = Math.max(1, existing.capacity);
    const passengers = Math.max(
      0,
      Math.min(capacity, point.passengers ?? existing.passengers),
    );
    const speedKmh = Math.max(0, point.speedKmh ?? existing.speedKmh);
    const etaMinutes = Math.max(1, point.etaMinutes ?? existing.etaMinutes);
    const shouldForceResync = point.forceResync === true;
    const usableHeading = speedKmh >= 2 ? point.heading : undefined;
    const nextPathCursor = findHeadingAwarePathIndex(
      point.lat,
      point.lng,
      usableHeading,
      shouldForceResync ? undefined : existing.pathCursor,
    );
    const nextCurrentStopIndex = Number.isFinite(point.currentStopIndex)
      ? normalizeLoopIndex(
          Math.max(0, Math.round(point.currentStopIndex as number)),
          getHalteLocations().length,
        )
      : resolveCurrentHalteIndexFromRouteCursor(
          nextPathCursor,
          getHalteLocations(),
        );

    byId.set(buggyId, {
      ...existing,
      isActive: true,
      position: { lat: point.lat, lng: point.lng },
      pathCursor: nextPathCursor,
      speedKmh,
      passengers,
      capacity,
      crowdLevel: resolveCrowdLevel(passengers, capacity),
      etaMinutes,
      currentStopIndex: nextCurrentStopIndex,
      tag: point.tag ?? existing.tag,
      updatedAt: timestampToUpdatedAt(point.timestamp),
      gsm: point.gsm ?? existing.gsm,
    });
    telemetryLastSeenById[buggyId] = now;
    accepted += 1;
  }

  if (accepted <= 0) return null;

  const updatedAt = nowMs();
  // Merge: existing buggies (updated) + newly registered buggies
  const updatedBuggies = current.buggies.map(
    (buggy) => byId.get(buggy.id) ?? buggy,
  );
  for (const nb of newBuggies) {
    if (!updatedBuggies.find((b) => b.id === nb.id)) {
      updatedBuggies.push(nb);
    }
  }

  setState({
    source: "ingest_telemetry",
    updatedAt,
    buggies: updatedBuggies,
    telemetryLastSeenById,
  });

  return {
    mode: "telemetry",
    accepted,
    source: "ingest_telemetry",
    updatedAt,
  };
}

export function ingestBuggyPayload(payload: unknown): BuggyIngestResult | null {
  const snapshot = parseSnapshotPayload(payload);
  if (snapshot) return ingestSnapshot(snapshot);

  const telemetry = parseTelemetryPayload(payload);
  if (telemetry) return ingestTelemetry(telemetry);

  return null;
}

export function adminAddBuggyToStore(buggy: Buggy): void {
  const current = getMutableState();
  const exists = current.buggies.some((b) => b.id === buggy.id || b.code === buggy.code);
  if (!exists) {
    setState({
      ...current,
      buggies: [...current.buggies, buggy],
    });
  }
}

export function adminUpdateBuggyInStore(buggyId: string, updates: Partial<Buggy>): void {
  const current = getMutableState();
  let updated = false;
  const nextBuggies = current.buggies.map((b) => {
    if (b.id === buggyId) {
      updated = true;
      return { ...b, ...updates };
    }
    return b;
  });

  if (updated) {
    setState({
      ...current,
      buggies: nextBuggies,
    });
  }
}

export function adminRemoveBuggyFromStore(buggyId: string): void {
  const current = getMutableState();
  setState({
    ...current,
    buggies: current.buggies.filter((b) => b.id !== buggyId),
  });
}

/**
 * Tandai buggy sebagai tidak aktif secara instan dengan menghapus
 * entri telemetryLastSeenById. Dipanggil saat sessionEnd dari GPS tracker.
 */
export function adminDeactivateBuggyInStore(buggyId: string): void {
  const current = getMutableState();
  if (!(buggyId in current.telemetryLastSeenById)) return;
  const rest = { ...current.telemetryLastSeenById };
  delete rest[buggyId];
  setState({
    ...current,
    updatedAt: nowMs(),
    telemetryLastSeenById: rest,
  });
}

/**
 * Cari buggy berdasarkan numericId (dari GPS beacon).
 * Mengembalikan buggy dan UUID-nya jika ditemukan.
 */
export function getBuggyByNumericId(numericId: number): Buggy | undefined {
  return getMutableState().buggies.find((b) => b.numericId === numericId);
}
