/**
 * GPS quality and path sanitation utilities.
 *
 * Filters invalid, duplicate, or known no-fix coordinates before they contaminate
 * session history, route distance, CSV export, and map playback.
 */
import { OFFICIAL_ROUTE_PATH } from "@/lib/transit/buggy-data";
import { haversineMeters } from "@/lib/transit/buggy-route-utils";

type LatLng = {
  lat: number;
  lng: number;
};

export type TimestampedGpsPoint = LatLng & {
  recordedAt?: string;
  tsMs?: number;
  passengers?: number | null;
  heading?: number | null;
  speedKmh?: number | null;
};

export type GpsPathPoint = [number, number, number?, number?];

const MAX_DISTANCE_FROM_ROUTE_METERS = 2_500;
const MAX_SEGMENT_SPEED_KMH = 90;
const MIN_SUSTAINED_JUMP_POINTS = 5;
const DISPLAY_SNAP_DISTANCE_METERS = 120;
const DISPLAY_SUSTAINED_DRIFT_POINTS = 5;
const DISPLAY_MIN_HEADING_DISTANCE_METERS = 3;
const DISPLAY_MIN_HEADING_SPEED_KMH = 2;
const GPS_STUCK_DECIMAL_PRECISION = 6;
const KNOWN_NO_FIX_COORDINATE_KEYS = new Set(["-6.200000:106.816666"]);

type RouteProjection = {
  lat: number;
  lng: number;
  cursor: number;
  distanceMeters: number;
};

export function isFiniteLatLng(point: LatLng): boolean {
  return (
    Number.isFinite(point.lat) &&
    Number.isFinite(point.lng) &&
    point.lat >= -90 &&
    point.lat <= 90 &&
    point.lng >= -180 &&
    point.lng <= 180
  );
}

export function getGpsCoordinateKey(point: LatLng): string {
  return `${point.lat.toFixed(GPS_STUCK_DECIMAL_PRECISION)}:${point.lng.toFixed(GPS_STUCK_DECIMAL_PRECISION)}`;
}

export function isSameGpsCoordinate(a: LatLng, b: LatLng): boolean {
  return getGpsCoordinateKey(a) === getGpsCoordinateKey(b);
}

export function isKnownNoFixCoordinate(point: LatLng): boolean {
  return KNOWN_NO_FIX_COORDINATE_KEYS.has(getGpsCoordinateKey(point));
}

export function getDistanceFromOfficialRouteMeters(point: LatLng): number {
  if (!isFiniteLatLng(point)) return Number.POSITIVE_INFINITY;
  if (OFFICIAL_ROUTE_PATH.length === 0) return 0;

  let nearestDistance = Number.POSITIVE_INFINITY;

  for (const [lat, lng] of OFFICIAL_ROUTE_PATH) {
    const distance = haversineMeters(point, { lat, lng });
    if (distance < nearestDistance) nearestDistance = distance;
  }

  return nearestDistance;
}

function normalizeDegrees(value: number): number {
  return ((value % 360) + 360) % 360;
}

function bearingDegrees(from: LatLng, to: LatLng): number {
  const phi1 = (from.lat * Math.PI) / 180;
  const phi2 = (to.lat * Math.PI) / 180;
  const lambdaDelta = ((to.lng - from.lng) * Math.PI) / 180;
  const y = Math.sin(lambdaDelta) * Math.cos(phi2);
  const x =
    Math.cos(phi1) * Math.sin(phi2) -
    Math.sin(phi1) * Math.cos(phi2) * Math.cos(lambdaDelta);
  return normalizeDegrees((Math.atan2(y, x) * 180) / Math.PI);
}

function headingDifference(a: number, b: number): number {
  const delta = Math.abs(normalizeDegrees(a - b));
  return Math.min(delta, 360 - delta);
}

function normalizeLoopIndex(index: number, length: number): number {
  if (length <= 0) return 0;
  return ((index % length) + length) % length;
}

function projectPointToRouteSegment(
  point: LatLng,
  start: LatLng,
  end: LatLng,
): { lat: number; lng: number; distanceMeters: number; progress: number } {
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
    lat: point.lat + projectedY / metersPerLatitudeDegree,
    lng: point.lng + projectedX / metersPerLongitudeDegree,
    distanceMeters: Math.hypot(projectedX, projectedY),
    progress,
  };
}

function findRouteProjection(
  point: LatLng,
  heading?: number | null,
  previousCursor?: number | null,
): RouteProjection | null {
  if (!isFiniteLatLng(point) || OFFICIAL_ROUTE_PATH.length <= 1) return null;

  const hasHeading = typeof heading === "number" && Number.isFinite(heading);
  const hasPreviousCursor =
    typeof previousCursor === "number" && Number.isFinite(previousCursor);
  const routeLength = OFFICIAL_ROUTE_PATH.length;
  const normalizedPreviousCursor = hasPreviousCursor
    ? normalizeLoopIndex(Math.round(previousCursor), routeLength)
    : 0;
  let bestProjection: RouteProjection | null = null;
  let bestScore = Number.POSITIVE_INFINITY;

  for (let index = 0; index < routeLength; index += 1) {
    const nextIndex = normalizeLoopIndex(index + 1, routeLength);
    const start = {
      lat: OFFICIAL_ROUTE_PATH[index][0],
      lng: OFFICIAL_ROUTE_PATH[index][1],
    };
    const end = {
      lat: OFFICIAL_ROUTE_PATH[nextIndex][0],
      lng: OFFICIAL_ROUTE_PATH[nextIndex][1],
    };
    const projection = projectPointToRouteSegment(point, start, end);
    const candidateCursor =
      projection.progress >= 0.5 ? nextIndex : index;
    let score = projection.distanceMeters;

    if (hasHeading) {
      score += headingDifference(heading, bearingDegrees(start, end)) * 0.8;
    }

    if (hasPreviousCursor) {
      const forwardSteps = normalizeLoopIndex(
        candidateCursor - normalizedPreviousCursor,
        routeLength,
      );
      const backwardSteps = normalizeLoopIndex(
        normalizedPreviousCursor - candidateCursor,
        routeLength,
      );

      if (backwardSteps < forwardSteps) {
        score += 120 + backwardSteps * 10;
      } else if (forwardSteps > 12) {
        score += (forwardSteps - 12) * 5;
      }
    }

    if (score < bestScore) {
      bestScore = score;
      bestProjection = {
        lat: projection.lat,
        lng: projection.lng,
        cursor: candidateCursor,
        distanceMeters: projection.distanceMeters,
      };
    }
  }

  return bestProjection;
}

function getMovementHeading<T extends TimestampedGpsPoint>(
  points: T[],
  index: number,
): number | null {
  const point = points[index];
  if (
    typeof point.heading === "number" &&
    Number.isFinite(point.heading) &&
    (point.speedKmh ?? DISPLAY_MIN_HEADING_SPEED_KMH) >=
      DISPLAY_MIN_HEADING_SPEED_KMH
  ) {
    return point.heading;
  }

  const previous = points[index - 1];
  if (
    previous &&
    haversineMeters(previous, point) >= DISPLAY_MIN_HEADING_DISTANCE_METERS
  ) {
    return bearingDegrees(previous, point);
  }

  const next = points[index + 1];
  if (
    next &&
    haversineMeters(point, next) >= DISPLAY_MIN_HEADING_DISTANCE_METERS
  ) {
    return bearingDegrees(point, next);
  }

  return null;
}

function buildDisplayGpsPoints<T extends TimestampedGpsPoint>(points: T[]): T[] {
  if (OFFICIAL_ROUTE_PATH.length <= 1 || points.length === 0) {
    return points;
  }

  const output: T[] = [];
  let driftCandidates: T[] = [];
  let previousCursor: number | null = null;

  function flushDriftCandidates() {
    if (driftCandidates.length >= DISPLAY_SUSTAINED_DRIFT_POINTS) {
      output.push(...driftCandidates);
    }
    driftCandidates = [];
  }

  for (let index = 0; index < points.length; index += 1) {
    const point = points[index];
    const heading = getMovementHeading(points, index);
    const projection = findRouteProjection(point, heading, previousCursor);

    if (!projection) {
      flushDriftCandidates();
      output.push(point);
      continue;
    }

    if (projection.distanceMeters > DISPLAY_SNAP_DISTANCE_METERS) {
      driftCandidates.push(point);
      continue;
    }

    flushDriftCandidates();
    output.push({
      ...point,
      lat: projection.lat,
      lng: projection.lng,
    });
    previousCursor = projection.cursor;
  }

  flushDriftCandidates();

  return output;
}

export function isPointInsideOperationalArea(point: LatLng): boolean {
  return getDistanceFromOfficialRouteMeters(point) <= MAX_DISTANCE_FROM_ROUTE_METERS;
}

function getPointTimeMs(point: TimestampedGpsPoint): number | null {
  if (!point.recordedAt) return null;
  const time = new Date(point.recordedAt).getTime();
  return Number.isFinite(time) ? time : null;
}

export function sanitizeGpsPoints<T extends TimestampedGpsPoint>(
  points: T[],
): T[] {
  const output: T[] = [];
  let jumpCandidates: T[] = [];

  for (const point of points) {
    if (!isFiniteLatLng(point)) continue;
    if (isKnownNoFixCoordinate(point)) continue;

    const previous = output[output.length - 1];
    if (!previous) {
      output.push(point);
      continue;
    }

    if (isSameGpsCoordinate(previous, point)) {
      jumpCandidates = [];
      continue;
    }

    const currentTime = getPointTimeMs(point);
    const previousTime = getPointTimeMs(previous);
    const canMeasureSpeed =
      currentTime !== null && previousTime !== null && currentTime > previousTime;
    const elapsedHours = canMeasureSpeed
      ? (currentTime - previousTime) / 3_600_000
      : 0;
    const distanceKm = haversineMeters(previous, point) / 1000;
    const segmentSpeedKmh =
      canMeasureSpeed && elapsedHours > 0 ? distanceKm / elapsedHours : 0;
    const isJumpOutlier = canMeasureSpeed && segmentSpeedKmh > MAX_SEGMENT_SPEED_KMH;

    if (!isJumpOutlier) {
      jumpCandidates = [];
      output.push(point);
      continue;
    }

    jumpCandidates.push(point);

    if (jumpCandidates.length >= MIN_SUSTAINED_JUMP_POINTS) {
      output.push(...jumpCandidates);
      jumpCandidates = [];
    }
  }

  return output;
}

export function sanitizePath(path: GpsPathPoint[]): GpsPathPoint[] {
  return buildDisplayGpsPoints(
    sanitizeGpsPoints(
      path.map(([lat, lng, tsMs, passengers]) => ({
        lat,
        lng,
        recordedAt:
          typeof tsMs === "number" && Number.isFinite(tsMs)
            ? new Date(tsMs).toISOString()
            : undefined,
        tsMs:
          typeof tsMs === "number" && Number.isFinite(tsMs)
            ? tsMs
            : undefined,
        passengers:
          typeof passengers === "number" && Number.isFinite(passengers)
            ? passengers
            : undefined,
      })),
    ),
  ).map((point) => {
    const tuple: GpsPathPoint = [point.lat, point.lng];

    if (typeof point.tsMs === "number") {
      tuple[2] = point.tsMs;
    }

    if (typeof point.passengers === "number") {
      tuple[3] = point.passengers;
    }

    return tuple;
  });
}

export function calculatePathDistanceKm(path: GpsPathPoint[]): number {
  let totalDistanceMeters = 0;

  for (let index = 1; index < path.length; index += 1) {
    totalDistanceMeters += haversineMeters(
      { lat: path[index - 1][0], lng: path[index - 1][1] },
      { lat: path[index][0], lng: path[index][1] },
    );
  }

  return totalDistanceMeters / 1000;
}
