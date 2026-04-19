/**
 * Realistic buggy movement simulator.
 *
 * Features:
 * - Follows a predefined route sequentially
 * - Smooth interpolation between points
 * - Variable speed (faster on straight, slower on turns)
 * - Time-based updates (default 1-2 seconds)
 * - GPS noise (+/- 3-5 meters by default)
 * - Occasional halte-like pause (3-10 seconds)
 * - Multiple output styles:
 *   1) callback via subscribe()
 *   2) event-based via EventTarget (WebSocket-style)
 *   3) async generator via stream()
 */

const EARTH_RADIUS_METERS = 6_371_000;

export type LatLng = {
  lat: number;
  lng: number;
};

export type BuggySimulatorOptions = {
  minSpeedKmh: number;
  maxSpeedKmh: number;
  minUpdateMs: number;
  maxUpdateMs: number;
  noiseMinMeters: number;
  noiseMaxMeters: number;
  pauseProbability: number;
  minPauseMs: number;
  maxPauseMs: number;
  loopRoute: boolean;
};

export type BuggySimulatorPosition = {
  latitude: number;
  longitude: number;
  timestamp: string;
  speed: number;
  speedKmh: number;
  paused: boolean;
  segmentIndex: number;
};

export const EXAMPLE_ROUTE: LatLng[] = [
  { lat: -6.9731, lng: 107.6301 },
  { lat: -6.9735, lng: 107.6305 },
  { lat: -6.974, lng: 107.631 },
  { lat: -6.9745, lng: 107.6315 },
];

const DEFAULT_OPTIONS: BuggySimulatorOptions = {
  minSpeedKmh: 10,
  maxSpeedKmh: 30,
  minUpdateMs: 1000,
  maxUpdateMs: 2000,
  noiseMinMeters: 3,
  noiseMaxMeters: 5,
  pauseProbability: 0.14,
  minPauseMs: 3000,
  maxPauseMs: 10000,
  loopRoute: true,
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function randomBetween(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

function kmhToMps(kmh: number): number {
  return kmh / 3.6;
}

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

function toDeg(rad: number): number {
  return (rad * 180) / Math.PI;
}

function haversineDistanceMeters(a: LatLng, b: LatLng): number {
  const phi1 = toRad(a.lat);
  const phi2 = toRad(b.lat);
  const dPhi = toRad(b.lat - a.lat);
  const dLambda = toRad(b.lng - a.lng);

  const x =
    Math.sin(dPhi / 2) ** 2 +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(dLambda / 2) ** 2;

  return 2 * EARTH_RADIUS_METERS * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

function interpolateLatLng(start: LatLng, end: LatLng, t: number): LatLng {
  const ratio = clamp(t, 0, 1);
  return {
    lat: start.lat + (end.lat - start.lat) * ratio,
    lng: start.lng + (end.lng - start.lng) * ratio,
  };
}

function bearingDegrees(a: LatLng, b: LatLng): number {
  const phi1 = toRad(a.lat);
  const phi2 = toRad(b.lat);
  const lambda1 = toRad(a.lng);
  const lambda2 = toRad(b.lng);
  const y = Math.sin(lambda2 - lambda1) * Math.cos(phi2);
  const x =
    Math.cos(phi1) * Math.sin(phi2) -
    Math.sin(phi1) * Math.cos(phi2) * Math.cos(lambda2 - lambda1);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

function turnAngleDegrees(prev: LatLng, current: LatLng, next: LatLng): number {
  const b1 = bearingDegrees(prev, current);
  const b2 = bearingDegrees(current, next);
  const diff = Math.abs(b2 - b1);
  return diff > 180 ? 360 - diff : diff;
}

function addGpsNoiseMeters(
  position: LatLng,
  minMeters: number,
  maxMeters: number,
): LatLng {
  const noiseDistance = randomBetween(minMeters, maxMeters);
  const angle = randomBetween(0, 2 * Math.PI);
  const north = Math.cos(angle) * noiseDistance;
  const east = Math.sin(angle) * noiseDistance;
  const latOffset = toDeg(north / EARTH_RADIUS_METERS);
  const cosLat = Math.cos(toRad(position.lat));
  const safeCosLat = Math.abs(cosLat) < 1e-6 ? 1e-6 : cosLat;
  const lngOffset = toDeg(east / (EARTH_RADIUS_METERS * safeCosLat));

  return {
    lat: position.lat + latOffset,
    lng: position.lng + lngOffset,
  };
}

function createCustomEvent<T>(name: string, detail: T): CustomEvent<T> {
  if (typeof CustomEvent === "function") {
    return new CustomEvent<T>(name, { detail });
  }

  const event = new Event(name) as CustomEvent<T>;
  Object.defineProperty(event, "detail", { value: detail });
  return event;
}

export class BuggyMovementSimulator extends EventTarget {
  route: LatLng[];
  options: BuggySimulatorOptions;
  segmentDistances: number[];
  currentSegmentIndex: number;
  distanceInSegment: number;
  currentSpeedKmh: number;
  pauseUntil: number;
  running: boolean;
  timer: ReturnType<typeof setTimeout> | null;
  lastTickMs: number;
  callbacks: Set<(payload: BuggySimulatorPosition) => void>;

  constructor(route: LatLng[], options: Partial<BuggySimulatorOptions> = {}) {
    super();

    if (!Array.isArray(route) || route.length < 2) {
      throw new Error("Route must contain at least 2 coordinates.");
    }

    this.route = route.map((point) => ({
      lat: Number(point.lat),
      lng: Number(point.lng),
    }));
    this.options = { ...DEFAULT_OPTIONS, ...options };
    this.segmentDistances = this.#buildSegmentDistances(this.route);
    this.currentSegmentIndex = 0;
    this.distanceInSegment = 0;
    this.currentSpeedKmh = this.#pickSegmentSpeedKmh(0);
    this.pauseUntil = 0;
    this.running = false;
    this.timer = null;
    this.lastTickMs = 0;
    this.callbacks = new Set();
  }

  /**
   * Start realtime simulation loop.
   */
  start(): void {
    if (this.running) return;

    this.running = true;
    this.lastTickMs = Date.now();
    this.dispatchEvent(
      createCustomEvent("start", { timestamp: this.lastTickMs }),
    );
    this.#emitPosition(0, false);
    this.#scheduleNextTick();
  }

  /**
   * Stop realtime simulation loop.
   */
  stop(): void {
    if (!this.running) return;

    this.running = false;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }

    this.dispatchEvent(createCustomEvent("stop", { timestamp: Date.now() }));
  }

  /**
   * Subscribe to position stream (callback style).
   * Returns an unsubscribe function.
   */
  subscribe(callback: (payload: BuggySimulatorPosition) => void): () => void {
    this.callbacks.add(callback);
    return () => this.callbacks.delete(callback);
  }

  /**
   * Async generator stream.
   * Useful for pull-based consumption in services/tests.
   */
  async *stream({
    autoStart = true,
  }: { autoStart?: boolean } = {}): AsyncGenerator<BuggySimulatorPosition> {
    if (autoStart && !this.running) this.start();

    const queue: BuggySimulatorPosition[] = [];
    let wake: (() => void) | null = null;

    const handler = (event: Event) => {
      const customEvent = event as CustomEvent<BuggySimulatorPosition>;
      queue.push(customEvent.detail);
      if (wake) {
        wake();
        wake = null;
      }
    };

    const stopHandler = () => {
      if (wake) {
        wake();
        wake = null;
      }
    };

    this.addEventListener("position", handler);
    this.addEventListener("stop", stopHandler);

    try {
      while (this.running || queue.length > 0) {
        if (queue.length === 0) {
          await new Promise<void>((resolve) => {
            wake = resolve;
          });
        }

        while (queue.length > 0) {
          const item = queue.shift();
          if (item) {
            yield item;
          }
        }
      }
    } finally {
      this.removeEventListener("position", handler);
      this.removeEventListener("stop", stopHandler);
    }
  }

  /**
   * Returns current exact route position without GPS noise.
   */
  getCurrentRawPosition(): LatLng {
    const start = this.route[this.currentSegmentIndex];
    const end = this.route[this.currentSegmentIndex + 1];
    const segmentDistance =
      this.segmentDistances[this.currentSegmentIndex] || 1;
    const t = this.distanceInSegment / segmentDistance;
    return interpolateLatLng(start, end, t);
  }

  #buildSegmentDistances(route: LatLng[]): number[] {
    const distances: number[] = [];
    for (let i = 0; i < route.length - 1; i += 1) {
      distances.push(haversineDistanceMeters(route[i], route[i + 1]));
    }
    return distances;
  }

  #turnAngleForSegmentEnd(segmentIndex: number): number {
    const endWaypoint = segmentIndex + 1;
    if (endWaypoint <= 0 || endWaypoint >= this.route.length - 1) return 0;

    const prev = this.route[endWaypoint - 1];
    const current = this.route[endWaypoint];
    const next = this.route[endWaypoint + 1];
    return turnAngleDegrees(prev, current, next);
  }

  #pickSegmentSpeedKmh(segmentIndex: number): number {
    const { minSpeedKmh, maxSpeedKmh } = this.options;
    const base = randomBetween(minSpeedKmh, maxSpeedKmh);

    const angle = this.#turnAngleForSegmentEnd(segmentIndex);
    const turnRatio = clamp(angle / 120, 0, 1);
    const slowdown = 1 - 0.55 * turnRatio;
    const jitter = randomBetween(0.92, 1.08);

    const speed = base * slowdown * jitter;
    return clamp(speed, minSpeedKmh * 0.7, maxSpeedKmh);
  }

  #randomUpdateDelayMs(): number {
    const { minUpdateMs, maxUpdateMs } = this.options;
    return Math.round(randomBetween(minUpdateMs, maxUpdateMs));
  }

  #scheduleNextTick(): void {
    if (!this.running) return;
    const delay = this.#randomUpdateDelayMs();
    this.timer = setTimeout(() => this.#tick(), delay);
  }

  #maybePauseAtHalte(): boolean {
    const { pauseProbability, minPauseMs, maxPauseMs } = this.options;

    if (Math.random() > pauseProbability) return false;

    const duration = Math.round(randomBetween(minPauseMs, maxPauseMs));
    this.pauseUntil = Date.now() + duration;
    this.dispatchEvent(
      createCustomEvent("pause-start", {
        durationMs: duration,
        waypointIndex: this.currentSegmentIndex,
        timestamp: Date.now(),
      }),
    );
    return true;
  }

  #advanceSegment(): boolean {
    const next = this.currentSegmentIndex + 1;
    if (next >= this.route.length - 1) {
      if (!this.options.loopRoute) {
        this.stop();
        this.dispatchEvent(createCustomEvent("end", { timestamp: Date.now() }));
        return false;
      }

      this.currentSegmentIndex = 0;
    } else {
      this.currentSegmentIndex = next;
    }

    this.currentSpeedKmh = this.#pickSegmentSpeedKmh(this.currentSegmentIndex);
    this.dispatchEvent(
      createCustomEvent("segment-change", {
        segmentIndex: this.currentSegmentIndex,
        speedKmh: this.currentSpeedKmh,
        timestamp: Date.now(),
      }),
    );
    return true;
  }

  #tick(): void {
    if (!this.running) return;

    const now = Date.now();
    const deltaSeconds = Math.max(0.2, (now - this.lastTickMs) / 1000);
    this.lastTickMs = now;

    if (this.pauseUntil > now) {
      this.#emitPosition(0, true);
      this.#scheduleNextTick();
      return;
    }

    if (this.pauseUntil !== 0 && this.pauseUntil <= now) {
      this.pauseUntil = 0;
      this.dispatchEvent(createCustomEvent("pause-end", { timestamp: now }));
    }

    let travelMeters = kmhToMps(this.currentSpeedKmh) * deltaSeconds;

    while (travelMeters > 0 && this.running) {
      const segmentDistance = this.segmentDistances[this.currentSegmentIndex];
      const remaining = segmentDistance - this.distanceInSegment;

      if (travelMeters < remaining) {
        this.distanceInSegment += travelMeters;
        travelMeters = 0;
        break;
      }

      travelMeters -= remaining;
      this.distanceInSegment = 0;

      if (!this.#advanceSegment()) break;
      if (this.#maybePauseAtHalte()) {
        travelMeters = 0;
      }
    }

    this.#emitPosition(this.currentSpeedKmh, false);
    this.#scheduleNextTick();
  }

  #emitPosition(speedKmh: number, paused: boolean): void {
    const rawPosition = this.getCurrentRawPosition();
    const noisy = addGpsNoiseMeters(
      rawPosition,
      this.options.noiseMinMeters,
      this.options.noiseMaxMeters,
    );

    const payload: BuggySimulatorPosition = {
      latitude: noisy.lat,
      longitude: noisy.lng,
      timestamp: new Date().toISOString(),
      speed: paused ? 0 : Number(speedKmh.toFixed(2)),
      speedKmh: paused ? 0 : Number(speedKmh.toFixed(2)),
      paused,
      segmentIndex: this.currentSegmentIndex,
    };

    for (const callback of this.callbacks) {
      callback(payload);
    }

    this.dispatchEvent(createCustomEvent("position", payload));
  }
}

/**
 * Factory helper for concise usage.
 */
export function createBuggyMovementSimulator(
  route: LatLng[] = EXAMPLE_ROUTE,
  options: Partial<BuggySimulatorOptions> = {},
): BuggyMovementSimulator {
  return new BuggyMovementSimulator(route, options);
}
