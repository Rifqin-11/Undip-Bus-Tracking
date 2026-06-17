/**
 * Route geometry utilities.
 *
 * Provides distance, nearest-path, stop-order, and ETA helpers used by live map
 * positioning, history playback, and route recommendation logic.
 */
import { HALTE_LOCATIONS, OFFICIAL_ROUTE_PATH } from "@/lib/transit/buggy-data";
import { getHalteLocations } from "@/lib/transit/halte-runtime";
import type { Buggy, HaltePoint } from "@/types/buggy";

/** Kecepatan default (km/h) saat buggy stasioner atau speed tidak tersedia. */
const DEFAULT_SPEED_KMH = 15;

/** Kecepatan minimum (km/h) yang digunakan untuk menghindari ETA tak terhingga. */
const MIN_SPEED_KMH = 5;

export type LatLng = {
  lat: number;
  lng: number;
};

const ROUTE_START_NAME = "Rusunawa Undip";
const OPERATIONAL_STOP_ORDER = [
  "Rusunawa Undip",
  "Masjid Hijau Sigawe",
  "Pos Satpam Astina Undip",
  "Student Center",
  "Teknik Arsitektur",
  "Fakultas Hukum & Fisip",
  "Sekolah Vokasi & FIB",
  "Widya Puraya",
  "Teknik Elektro",
  "SA-MWA & FSM Barat",
  "Fakultas Psikologi",
  "Fakultas Ekonomika dan Bisnis",
  "Fakultas Kesehatan Masyarakat",
  "Fakultas Perikanan dan Kelautan",
  "Fakultas Peternakan dan Pertanian",
  "UPT Laboratorium Terpadu",
  "Bundaran Undip",
] as const;

// Anchor mengikuti urutan OFFICIAL_ROUTE_PATH. Rusunawa menjadi halte pertama
// operasional; Psikologi berada di cabang opsional sehingga progres dapat
// langsung bergerak dari SA-MWA ke anchor FEB saat cabang tersebut dilewati.
const OPERATIONAL_STOP_ROUTE_ANCHORS: Record<string, number> = {
  "Rusunawa Undip": 0,
  "Masjid Hijau Sigawe": 6,
  "Pos Satpam Astina Undip": 18,
  "Student Center": 21,
  "Teknik Arsitektur": 27,
  "Fakultas Hukum & Fisip": 32,
  "Sekolah Vokasi & FIB": 37,
  "Widya Puraya": 47,
  "Teknik Elektro": 50,
  "SA-MWA & FSM Barat": 53,
  "Fakultas Psikologi": 68,
  "Fakultas Ekonomika dan Bisnis": 73,
  "Fakultas Kesehatan Masyarakat": 77,
  "Fakultas Perikanan dan Kelautan": 80,
  "Fakultas Peternakan dan Pertanian": 84,
  "UPT Laboratorium Terpadu": 92,
  "Bundaran Undip": 94,
};

function normalizeLoopIndex(index: number, length: number): number {
  if (length <= 0) return 0;
  return ((index % length) + length) % length;
}

export function haversineMeters(a: LatLng, b: LatLng): number {
  const radius = 6_371_000;
  const phi1 = (a.lat * Math.PI) / 180;
  const phi2 = (b.lat * Math.PI) / 180;
  const dPhi = ((b.lat - a.lat) * Math.PI) / 180;
  const dLambda = ((b.lng - a.lng) * Math.PI) / 180;
  const x =
    Math.sin(dPhi / 2) ** 2 +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(dLambda / 2) ** 2;
  return radius * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

export function findNearestPathIndex(
  lat: number,
  lng: number,
  routePath: [number, number][] = OFFICIAL_ROUTE_PATH,
): number {
  let bestIndex = 0;
  let bestDistance = Number.POSITIVE_INFINITY;

  for (let i = 0; i < routePath.length; i += 1) {
    const [pathLat, pathLng] = routePath[i];
    const distance = Math.hypot(pathLat - lat, pathLng - lng);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestIndex = i;
    }
  }

  return bestIndex;
}

function bearingDegrees(from: LatLng, to: LatLng): number {
  const phi1 = (from.lat * Math.PI) / 180;
  const phi2 = (to.lat * Math.PI) / 180;
  const lambdaDelta = ((to.lng - from.lng) * Math.PI) / 180;
  const y = Math.sin(lambdaDelta) * Math.cos(phi2);
  const x =
    Math.cos(phi1) * Math.sin(phi2) -
    Math.sin(phi1) * Math.cos(phi2) * Math.cos(lambdaDelta);
  return normalizeLoopIndex((Math.atan2(y, x) * 180) / Math.PI, 360);
}

function headingDifference(a: number, b: number): number {
  const delta = Math.abs(normalizeLoopIndex(a - b, 360));
  return Math.min(delta, 360 - delta);
}

function projectPointToSegmentMeters(
  point: LatLng,
  start: LatLng,
  end: LatLng,
): { distanceMeters: number; progress: number } {
  const metersPerLatitudeDegree = 111_320;
  const metersPerLongitudeDegree =
    metersPerLatitudeDegree * Math.cos((point.lat * Math.PI) / 180);
  const startX = (start.lng - point.lng) * metersPerLongitudeDegree;
  const startY = (start.lat - point.lat) * metersPerLatitudeDegree;
  const endX = (end.lng - point.lng) * metersPerLongitudeDegree;
  const endY = (end.lat - point.lat) * metersPerLatitudeDegree;
  const segmentX = endX - startX;
  const segmentY = endY - startY;
  const segmentLengthSquared = segmentX ** 2 + segmentY ** 2;
  const progress =
    segmentLengthSquared > 0
      ? Math.max(
          0,
          Math.min(
            1,
            -(startX * segmentX + startY * segmentY) /
              segmentLengthSquared,
          ),
        )
      : 0;
  const projectedX = startX + segmentX * progress;
  const projectedY = startY + segmentY * progress;

  return {
    distanceMeters: Math.hypot(projectedX, projectedY),
    progress,
  };
}

/**
 * Menentukan bagian rute satu arah tanpa mengubah koordinat GPS asli.
 * Heading membedakan ruas yang berdekatan tetapi berlawanan arah, sedangkan
 * cursor sebelumnya mencegah perpindahan mendadak ke cabang rute lain.
 */
export function findHeadingAwarePathIndex(
  lat: number,
  lng: number,
  heading?: number | null,
  previousCursor?: number | null,
  routePath: [number, number][] = OFFICIAL_ROUTE_PATH,
): number {
  if (routePath.length <= 1) return 0;

  const point = { lat, lng };
  const hasHeading = typeof heading === "number" && Number.isFinite(heading);
  const hasPreviousCursor =
    typeof previousCursor === "number" && Number.isFinite(previousCursor);
  const normalizedPreviousCursor = hasPreviousCursor
    ? normalizeLoopIndex(Math.round(previousCursor), routePath.length)
    : 0;
  let bestCursor = findNearestPathIndex(lat, lng, routePath);
  let bestScore = Number.POSITIVE_INFINITY;

  for (let index = 0; index < routePath.length; index += 1) {
    const nextIndex = normalizeLoopIndex(index + 1, routePath.length);
    const start = { lat: routePath[index][0], lng: routePath[index][1] };
    const end = {
      lat: routePath[nextIndex][0],
      lng: routePath[nextIndex][1],
    };
    const projection = projectPointToSegmentMeters(point, start, end);
    const candidateCursor =
      projection.progress >= 0.5 ? nextIndex : index;
    let score = projection.distanceMeters;

    if (hasHeading) {
      const routeHeading = bearingDegrees(start, end);
      score += headingDifference(heading, routeHeading) * 0.8;
    }

    if (hasPreviousCursor) {
      const forwardSteps = normalizeLoopIndex(
        candidateCursor - normalizedPreviousCursor,
        routePath.length,
      );
      const backwardSteps = normalizeLoopIndex(
        normalizedPreviousCursor - candidateCursor,
        routePath.length,
      );

      if (backwardSteps < forwardSteps) {
        score += 90 + backwardSteps * 8;
      } else if (forwardSteps > 12) {
        score += (forwardSteps - 12) * 4;
      }
    }

    if (score < bestScore) {
      bestScore = score;
      bestCursor = candidateCursor;
    }
  }

  return bestCursor;
}

function buildRouteOrderedStopNames(
  haltes: HaltePoint[] = getHalteLocations(),
  routeStartName: string = ROUTE_START_NAME,
): string[] {
  const availableNames = new Set(haltes.map((halte) => halte.name));
  const configuredStops = OPERATIONAL_STOP_ORDER.filter((name) =>
    availableNames.has(name),
  );
  const configuredNames = new Set<string>(configuredStops);
  const unconfiguredStops = haltes
    .map((halte) => halte.name)
    .filter((name) => !configuredNames.has(name));
  const routeStops = [...configuredStops, ...unconfiguredStops];

  const routeStartIndex = routeStops.findIndex(
    (stopName) => stopName === routeStartName,
  );

  if (routeStartIndex < 0) {
    return routeStops;
  }

  return [
    ...routeStops.slice(routeStartIndex),
    ...routeStops.slice(0, routeStartIndex),
  ];
}

export function resolveCurrentHalteIndexFromRouteCursor(
  pathCursor: number,
  haltes: HaltePoint[] = getHalteLocations(),
): number {
  if (haltes.length === 0) return 0;

  const routeLength = Math.max(OFFICIAL_ROUTE_PATH.length, 1);
  const normalizedCursor = normalizeLoopIndex(
    Math.round(pathCursor),
    routeLength,
  );
  const unwrappedCursor =
    normalizedCursor < OPERATIONAL_STOP_ROUTE_ANCHORS[ROUTE_START_NAME]
      ? normalizedCursor + routeLength
      : normalizedCursor;

  let currentName = ROUTE_START_NAME;
  for (const stopName of OPERATIONAL_STOP_ORDER) {
    const anchor = OPERATIONAL_STOP_ROUTE_ANCHORS[stopName];
    if (anchor > unwrappedCursor) break;
    currentName = stopName;
  }

  const currentIndex = haltes.findIndex((halte) => halte.name === currentName);
  return currentIndex >= 0 ? currentIndex : 0;
}

/** Lazy — menggunakan data halte runtime (DB) jika tersedia, fallback ke static */
function getRouteOrderedStopNames(): string[] {
  return buildRouteOrderedStopNames(getHalteLocations());
}


export function getBuggyStopsInRouteOrder(
  buggy: Buggy,
  routeOrderedStops: string[] = getRouteOrderedStopNames(),
): string[] {
  const sourceStops = buggy.stops ?? [];
  if (sourceStops.length === 0) return routeOrderedStops;

  const availableStops = new Set(sourceStops);
  return routeOrderedStops.filter((stopName) => availableStops.has(stopName));
}

export function getBuggyCurrentRouteIndex(
  buggy: Buggy,
  stops: string[],
  haltes: HaltePoint[] = getHalteLocations(),
): number {
  if (stops.length === 0) return -1;

  const halteIndex = normalizeLoopIndex(buggy.currentStopIndex, haltes.length);
  const sourceStops = buggy.stops ?? [];
  const sourceIndex = normalizeLoopIndex(
    buggy.currentStopIndex,
    sourceStops.length,
  );

  const inferredCurrentName =
    (sourceStops[sourceIndex] && stops.includes(sourceStops[sourceIndex])
      ? sourceStops[sourceIndex]
      : null) ??
    (haltes[halteIndex] && stops.includes(haltes[halteIndex].name)
      ? haltes[halteIndex].name
      : null);

  const currentIndex = inferredCurrentName
    ? stops.indexOf(inferredCurrentName)
    : -1;
  return currentIndex >= 0 ? currentIndex : 0;
}

export function getBuggyStopNameAtOffset(buggy: Buggy, offset: number): string {
  const stops = getBuggyStopsInRouteOrder(buggy);
  if (stops.length === 0) return "-";

  const currentIndex = getBuggyCurrentRouteIndex(buggy, stops);
  const stopIndex = normalizeLoopIndex(currentIndex + offset, stops.length);
  return stops[stopIndex] ?? "-";
}

/**
 * Hitung jarak (meter) sepanjang OFFICIAL_ROUTE_PATH dari indeks `fromIdx` ke
 * `toIdx`, mengikuti arah maju rute (forward, wrapping).
 */
export function routeDistanceMeters(
  fromIdx: number,
  toIdx: number,
  routePath: [number, number][] = OFFICIAL_ROUTE_PATH,
): number {
  const total = routePath.length;
  if (total < 2) return 0;

  const normFrom = normalizeLoopIndex(fromIdx, total);
  const normTo = normalizeLoopIndex(toIdx, total);

  let distanceMeters = 0;
  let cursor = normFrom;

  // Maksimum iterasi = panjang rute penuh (mencegah infinite loop)
  for (let steps = 0; steps < total; steps += 1) {
    if (cursor === normTo) break;
    const nextCursor = normalizeLoopIndex(cursor + 1, total);
    const a = { lat: routePath[cursor][0], lng: routePath[cursor][1] };
    const b = { lat: routePath[nextCursor][0], lng: routePath[nextCursor][1] };
    distanceMeters += haversineMeters(a, b);
    cursor = nextCursor;
  }

  return distanceMeters;
}

/**
 * Estimasi menit perjalanan antara dua halte mengikuti jalur rute sebenarnya
 * (bukan garis lurus). Kecepatan di-fallback ke DEFAULT_SPEED_KMH jika 0.
 */
export function estimateMinutesBetweenStops(
  fromStopName: string,
  toStopName: string,
  speedKmh: number,
  haltes?: HaltePoint[],
): number {
  const resolvedHaltes = haltes ?? getHalteLocations();
  const halteByName = new Map(
    resolvedHaltes.map((halte) => [
      halte.name,
      { lat: halte.lat, lng: halte.lng },
    ]),
  );
  const from = halteByName.get(fromStopName);
  const to = halteByName.get(toStopName);
  if (!from || !to) return 2;

  // Gunakan jarak sepanjang rute, bukan haversine lurus
  const fromIdx = findNearestPathIndex(from.lat, from.lng);
  const toIdx = findNearestPathIndex(to.lat, to.lng);
  const distanceMeters = routeDistanceMeters(fromIdx, toIdx);

  const safeSpeed = Math.max(MIN_SPEED_KMH, speedKmh > 0 ? speedKmh : DEFAULT_SPEED_KMH);
  const speedMps = safeSpeed / 3.6;
  const minutes = Math.round(distanceMeters / speedMps / 60);
  return Math.max(1, minutes);
}

/**
 * Hitung ETA (menit) dari posisi buggy saat ini (pathCursor) ke halte tujuan,
 * mengikuti jalur rute sebenarnya.
 *
 * Digunakan oleh server-side GPS ingest untuk menyuntikkan etaMinutes ke live
 * store tanpa perlu menunggu kalkulasi client-side.
 *
 * @param pathCursor   Indeks rute buggy saat ini (dari latest_buggy_telemetry)
 * @param targetHalte  Koordinat halte tujuan
 * @param speedKmh     Kecepatan buggy saat ini; 0 akan menggunakan DEFAULT_SPEED_KMH
 * @param routePath    (Opsional) override rute; default = OFFICIAL_ROUTE_PATH
 */
export function computeEtaToHalteMinutes(
  pathCursor: number,
  targetHalte: { lat: number; lng: number },
  speedKmh: number,
  routePath: [number, number][] = OFFICIAL_ROUTE_PATH,
): number {
  const targetIdx = findNearestPathIndex(targetHalte.lat, targetHalte.lng, routePath);
  const distanceMeters = routeDistanceMeters(pathCursor, targetIdx, routePath);

  const safeSpeed = Math.max(MIN_SPEED_KMH, speedKmh > 0 ? speedKmh : DEFAULT_SPEED_KMH);
  const speedMps = safeSpeed / 3.6;
  const minutes = Math.round(distanceMeters / speedMps / 60);
  return Math.max(0, minutes);
}
