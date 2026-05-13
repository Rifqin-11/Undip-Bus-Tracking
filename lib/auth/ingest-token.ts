import { NextResponse, type NextRequest } from "next/server";

export function requireIngestToken(request: NextRequest) {
  const requiredToken = process.env.BUGGY_INGEST_TOKEN?.trim();

  if (!requiredToken) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "BUGGY_INGEST_TOKEN belum dikonfigurasi. Set env ini sebelum menerima request ingest.",
      },
      { status: 500 },
    );
  }

  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${requiredToken}`) {
    return NextResponse.json(
      { ok: false, message: "Unauthorized ingest request." },
      { status: 401 },
    );
  }

  return null;
}
