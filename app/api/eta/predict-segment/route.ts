import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type EtaPredictSegmentPayload = {
  from_halte: string;
  to_halte: string;
  passengers?: number;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function normalizeHalteCode(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  return /^h\d{2}$/.test(normalized) ? normalized : null;
}

function normalizePassengers(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return 0;
  return Math.max(0, Math.round(value));
}

function getEtaApiUrl() {
  return (process.env.ETA_API_URL ?? "http://127.0.0.1:5000").replace(
    /\/+$/,
    "",
  );
}

export async function POST(request: NextRequest) {
  let body: unknown;

  try {
    body = await request.json();
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

  const fromHalte = normalizeHalteCode(body.from_halte);
  const toHalte = normalizeHalteCode(body.to_halte);

  if (!fromHalte || !toHalte) {
    return NextResponse.json(
      {
        success: false,
        error: "from_halte dan to_halte wajib memakai format kode halte hXX.",
      },
      { status: 400 },
    );
  }

  const payload: EtaPredictSegmentPayload = {
    from_halte: fromHalte,
    to_halte: toHalte,
    passengers: normalizePassengers(body.passengers),
  };

  try {
    const response = await fetch(`${getEtaApiUrl()}/predict_segment`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
      cache: "no-store",
      signal: AbortSignal.timeout(5_000),
    });

    const data: unknown = await response.json().catch(() => null);

    if (!response.ok) {
      return NextResponse.json(
        {
          success: false,
          error: "ETA service returned an error.",
          detail: data,
        },
        { status: response.status },
      );
    }

    return NextResponse.json(data, {
      headers: { "cache-control": "no-store" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";

    return NextResponse.json(
      {
        success: false,
        error: "ETA service is unavailable.",
        detail: message,
      },
      { status: 503 },
    );
  }
}
