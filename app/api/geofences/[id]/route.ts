import { NextResponse } from "next/server";
import { deleteGeofenceById, patchGeofenceEnabled } from "@/lib/geofence-store";

export const runtime = "nodejs";

type Params = {
  params: Promise<{
    id: string;
  }>;
};

export async function PATCH(request: Request, { params }: Params) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { message: "Payload JSON tidak valid." },
      { status: 400 },
    );
  }

  if (!body || typeof body !== "object" || typeof (body as { enabled?: unknown }).enabled !== "boolean") {
    return NextResponse.json(
      { message: "Field `enabled` wajib boolean." },
      { status: 400 },
    );
  }

  const { id } = await params;
  const updated = await patchGeofenceEnabled(id, (body as { enabled: boolean }).enabled);

  if (!updated) {
    return NextResponse.json(
      { message: "Geofence tidak ditemukan." },
      { status: 404 },
    );
  }

  return NextResponse.json(updated);
}

export async function DELETE(_: Request, { params }: Params) {
  const { id } = await params;
  const removed = await deleteGeofenceById(id);

  if (!removed) {
    return NextResponse.json(
      { message: "Geofence tidak ditemukan." },
      { status: 404 },
    );
  }

  return NextResponse.json({ success: true });
}
