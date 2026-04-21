import { createInitialBuggies, HALTE_LOCATIONS } from "@/lib/transit/buggy-data";
import {
  findNearestPathIndex,
  haversineMeters,
} from "@/lib/transit/buggy-route-utils";
import type { Buggy, CrowdLevel } from "@/types/buggy";

export type BuggyLiveSource = "seed" | "ingest_snapshot" | "ingest_telemetry";

export type BuggyTelemetryInput = {
  id: string | number;
  lat: number;
  lng: number;
  speedKmh?: number;
  passengers?: number;
  capacity?: number;
  etaMinutes?: number;
  currentStopIndex?: number;
  tag?: string;
  timestamp?: string | number;
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
  // eslint-disable-next-line no-var
  var __BUGGY_LIVE_STATE__: BuggyLiveState | undefined;
}

function cloneBuggy(buggy: Buggy): Buggy {
  return {
    ...buggy,
    position: { ...buggy.position },
    stops: [...buggy.stops],
  };
}

function nowMs(): number {
  return Date.now();
}

const HALTE_ARRIVAL_RADIUS_METERS = 10;
// Keep progression directional to avoid jumping to opposite-side nearby haltes.
const MAX_SKIP_AHEAD_STOPS = 0;
const ACTIVE_TELEMETRY_WINDOW_MS = 15_000;
// If the nearest halte (by raw GPS distance) is this many steps OR MORE ahead
// of currentStopIndex in the forward loop, auto-resync instead of staying stuck.
const RESYNC_THRESHOLD_STOPS = 3;

function normalizeLoopIndex(index: number, length: number): number {
  if (length <= 0) return 0;
  return ((index % length) + length) % length;
}

function findArrivedNextHalteIndex(
  lat: number,
  lng: number,
  currentStopIndex: number,
  radiusMeters: number = HALTE_ARRIVAL_RADIUS_METERS,
  maxSkipAheadStops: number = MAX_SKIP_AHEAD_STOPS,
): number | null {
  const halteCount = HALTE_LOCATIONS.length;
  if (halteCount <= 0) return null;

  const current = normalizeLoopIndex(currentStopIndex, halteCount);
  const maxStep = Math.min(halteCount - 1, maxSkipAheadStops + 1);
  let bestIndex: number | null = null;
  let bestStep = Number.POSITIVE_INFINITY;
  let bestDistance = Number.POSITIVE_INFINITY;

  for (let step = 1; step <= maxStep; step += 1) {
    const halteIndex = normalizeLoopIndex(current + step, halteCount);
    const halte = HALTE_LOCATIONS[halteIndex];
    const distance = haversineMeters(
      { lat, lng },
      { lat: halte.lat, lng: halte.lng },
    );

    if (distance > radiusMeters) continue;
    if (step < bestStep || (step === bestStep && distance < bestDistance)) {
      bestStep = step;
      bestDistance = distance;
      bestIndex = halteIndex;
    }
  }

  return bestIndex;
}

function resolveCurrentStopIndexFromPosition(
  lat: number,
  lng: number,
  existingStopIndex: number,
): number {
  const halteCount = HALTE_LOCATIONS.length;
  if (halteCount <= 0) return 0;

  // 1. Normal case: buggy arrived within radius of the next halte
  const arrivedIndex = findArrivedNextHalteIndex(lat, lng, existingStopIndex);
  if (arrivedIndex !== null) return arrivedIndex;

  // 2. Resync case: find the globally nearest halte by raw GPS distance
  const current = normalizeLoopIndex(existingStopIndex, halteCount);
  let nearestIndex = current;
  let nearestDistance = Number.POSITIVE_INFINITY;

  for (let i = 0; i < halteCount; i++) {
    const halte = HALTE_LOCATIONS[i];
    const distance = haversineMeters({ lat, lng }, { lat: halte.lat, lng: halte.lng });
    if (distance < nearestDistance) {
      nearestDistance = distance;
      nearestIndex = i;
    }
  }

  // Calculate how many forward steps from current to nearestIndex in the loop.
  // If forwardSteps > halteCount/2, the halte is actually BEHIND us (just expressed
  // as a large forward number due to loop wrap). Never resync backwards.
  const forwardSteps =
    ((nearestIndex - current) % halteCount + halteCount) % halteCount;
  const maxForwardResync = Math.floor(halteCount / 2);

  if (forwardSteps >= RESYNC_THRESHOLD_STOPS && forwardSteps <= maxForwardResync) {
    return nearestIndex;
  }

  // 3. Default: stay at current stop index (buggy is between haltes or behind us)
  return current;

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
  let date: Date;
  if (typeof timestamp === "number") {
    date = new Date(timestamp);
  } else if (typeof timestamp === "string") {
    date = new Date(timestamp);
  } else {
    date = new Date();
  }
  if (Number.isNaN(date.getTime())) date = new Date();
  return date.toLocaleTimeString("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
  });
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
  if (!isFiniteNumber(value.position.lat) || !isFiniteNumber(value.position.lng)) {
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
      passengers: isFiniteNumber(item.passengers) ? item.passengers : undefined,
      capacity: isFiniteNumber(item.capacity) ? item.capacity : undefined,
      etaMinutes: isFiniteNumber(item.etaMinutes) ? item.etaMinutes : undefined,
      currentStopIndex: isFiniteNumber(item.currentStopIndex)
        ? item.currentStopIndex
        : undefined,
      tag: typeof item.tag === "string" ? item.tag : undefined,
      timestamp:
        typeof item.timestamp === "string" || typeof item.timestamp === "number"
          ? item.timestamp
          : undefined,
    });
  }

  return output.length > 0 ? output : null;
}

function getMutableState(): BuggyLiveState {
  if (!globalThis.__BUGGY_LIVE_STATE__) {
    globalThis.__BUGGY_LIVE_STATE__ = {
      source: "seed",
      updatedAt: nowMs(),
      buggies: createInitialBuggies(),
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
  const state = getMutableState();
  const now = nowMs();
  return {
    source: state.source,
    updatedAt: state.updatedAt,
    buggies: state.buggies.map((buggy) => {
      const cloned = cloneBuggy(buggy);
      const lastSeen = state.telemetryLastSeenById[buggy.id] ?? 0;
      const isActive =
        lastSeen > 0 && now - lastSeen <= ACTIVE_TELEMETRY_WINDOW_MS;
      return {
        ...cloned,
        isActive,
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

function ingestTelemetry(telemetry: BuggyTelemetryInput[]): BuggyIngestResult | null {
  const current = getMutableState();
  const byId = new Map(current.buggies.map((buggy) => [buggy.id, cloneBuggy(buggy)]));
  const telemetryLastSeenById = { ...current.telemetryLastSeenById };
  let accepted = 0;

  for (const point of telemetry) {
    const buggyId = normalizeBuggyId(point.id);
    const existing = byId.get(buggyId);
    if (!existing) continue;

    const capacity = Math.max(1, point.capacity ?? existing.capacity);
    const passengers = Math.max(
      0,
      Math.min(capacity, point.passengers ?? existing.passengers),
    );
    const speedKmh = Math.max(0, point.speedKmh ?? existing.speedKmh);
    const etaMinutes = Math.max(1, point.etaMinutes ?? existing.etaMinutes);
    const nextCurrentStopIndex = Number.isFinite(point.currentStopIndex)
      ? normalizeLoopIndex(
          Math.max(0, Math.round(point.currentStopIndex as number)),
          HALTE_LOCATIONS.length,
        )
      : resolveCurrentStopIndexFromPosition(
          point.lat,
          point.lng,
          existing.currentStopIndex,
        );

    byId.set(buggyId, {
      ...existing,
      isActive: true,
      position: { lat: point.lat, lng: point.lng },
      pathCursor: findNearestPathIndex(point.lat, point.lng),
      speedKmh,
      passengers,
      capacity,
      crowdLevel: resolveCrowdLevel(passengers, capacity),
      etaMinutes,
      currentStopIndex: nextCurrentStopIndex,
      tag: point.tag ?? existing.tag,
      updatedAt: timestampToUpdatedAt(point.timestamp),
    });
    telemetryLastSeenById[buggyId] = nowMs();
    accepted += 1;
  }

  if (accepted <= 0) return null;

  const updatedAt = nowMs();
  setState({
    source: "ingest_telemetry",
    updatedAt,
    buggies: current.buggies.map((buggy) => byId.get(buggy.id) ?? buggy),
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
