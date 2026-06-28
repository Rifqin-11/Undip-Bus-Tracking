import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const FSM = {
  lat: -7.047569654368096,
  lng: 110.44101030995277,
};

const PSIKOLOGI = {
  lat: -7.055973568692425,
  lng: 110.43939589722012,
};

const MAX_DISTANCE_FROM_FSM_M = 150;
const HEADING_TOLERANCE_DEG = 35;

type PredictRouteBody = {
  buggy_id?: string;
  start_halte?: string;
  passengers?: unknown;
  include_psikologi?: boolean;
  currentLat?: unknown;
  currentLng?: unknown;
  heading?: unknown;
  timestamp?: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function toNumber(value: unknown): number | null {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : null;
}

function normalizePassengers(value: unknown): number {
  if (value === undefined || value === null) return 0;
  const passengers = Number(value);
  return Number.isFinite(passengers) ? Math.max(0, Math.round(passengers)) : 0;
}

function getEtaApiUrl() {
  return (process.env.ETA_API_URL ?? "http://127.0.0.1:5000").replace(
    /\/+$/,
    "",
  );
}

function toRadians(deg: number) {
  return (deg * Math.PI) / 180;
}

function toDegrees(rad: number) {
  return (rad * 180) / Math.PI;
}

function calculateBearing(
  fromLat: number,
  fromLng: number,
  toLat: number,
  toLng: number,
) {
  const lat1 = toRadians(fromLat);
  const lat2 = toRadians(toLat);
  const deltaLng = toRadians(toLng - fromLng);

  const y = Math.sin(deltaLng) * Math.cos(lat2);
  const x =
    Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(deltaLng);

  return (toDegrees(Math.atan2(y, x)) + 360) % 360;
}

function angleDiff(a: number, b: number) {
  return Math.abs(((a - b + 540) % 360) - 180);
}

function distanceMeters(
  fromLat: number,
  fromLng: number,
  toLat: number,
  toLng: number,
) {
  const earthRadius = 6371000;

  const dLat = toRadians(toLat - fromLat);
  const dLng = toRadians(toLng - fromLng);

  const lat1 = toRadians(fromLat);
  const lat2 = toRadians(toLat);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;

  return 2 * earthRadius * Math.asin(Math.sqrt(a));
}

function shouldIncludePsikologi(
  currentLat: number | null,
  currentLng: number | null,
  heading: number | null,
) {
  if (currentLat === null || currentLng === null || heading === null) {
    return false;
  }

  const distanceToFsm = distanceMeters(
    currentLat,
    currentLng,
    FSM.lat,
    FSM.lng,
  );

  const isNearFsm = distanceToFsm <= MAX_DISTANCE_FROM_FSM_M;

  const bearingToPsikologi = calculateBearing(
    FSM.lat,
    FSM.lng,
    PSIKOLOGI.lat,
    PSIKOLOGI.lng,
  );

  const diff = angleDiff(heading, bearingToPsikologi);

  return isNearFsm && diff <= HEADING_TOLERANCE_DEG;
}

export async function POST(req: NextRequest) {
  let body: unknown;

  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { success: false, error: "Invalid JSON body." },
      { status: 400 },
    );
  }

  if (!isRecord(body)) {
    return NextResponse.json(
      { success: false, error: "Request body must be an object." },
      { status: 400 },
    );
  }

  try {
    const requestBody = body as PredictRouteBody;

    if (
      typeof requestBody.start_halte !== "string" ||
      !requestBody.start_halte.trim()
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "start_halte wajib diisi",
        },
        { status: 400 },
      );
    }

    const currentLat = toNumber(requestBody.currentLat);
    const currentLng = toNumber(requestBody.currentLng);
    const heading = toNumber(requestBody.heading);

    const includePsikologi =
      typeof requestBody.include_psikologi === "boolean"
        ? requestBody.include_psikologi
        : shouldIncludePsikologi(currentLat, currentLng, heading);

    const payload = {
      buggy_id:
        typeof requestBody.buggy_id === "string" && requestBody.buggy_id.trim()
          ? requestBody.buggy_id
          : "buggy_1",
      start_halte: requestBody.start_halte.trim(),
      passengers: normalizePassengers(requestBody.passengers),
      include_psikologi: includePsikologi,
      ...(typeof requestBody.timestamp === "string" && requestBody.timestamp
        ? { timestamp: requestBody.timestamp }
        : {}),
    };

    const response = await fetch(`${getEtaApiUrl()}/predict_route`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      cache: "no-store",
    });

    const text = await response.text();

    let data: unknown;

    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      data = {
        success: false,
        error: text,
      };
    }

    return NextResponse.json(
      {
        ...(typeof data === "object" && data !== null ? data : { data }),
        include_psikologi_computed: includePsikologi,
        debug_direction: {
          currentLat,
          currentLng,
          heading,
          distance_to_fsm_m:
            currentLat !== null && currentLng !== null
              ? Math.round(
                  distanceMeters(currentLat, currentLng, FSM.lat, FSM.lng),
                )
              : null,
          bearing_to_psikologi: Math.round(
            calculateBearing(FSM.lat, FSM.lng, PSIKOLOGI.lat, PSIKOLOGI.lng),
          ),
        },
      },
      {
        status: response.status,
        headers: { "cache-control": "no-store" },
      },
    );
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
