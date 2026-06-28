import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
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

  const buggyId =
    typeof body.buggy_id === "string" && body.buggy_id.trim()
      ? body.buggy_id
      : "buggy_1";

  try {
    const response = await fetch(`${getEtaApiUrl()}/reset_buggy`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ buggy_id: buggyId }),
      cache: "no-store",
    });

    const text = await response.text();
    let data: unknown;

    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      data = { success: false, error: text };
    }

    return NextResponse.json(
      typeof data === "object" && data !== null ? data : { data },
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
