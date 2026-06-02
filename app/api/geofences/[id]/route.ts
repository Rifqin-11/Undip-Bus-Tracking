import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/admin-guard";
import { deleteGeofenceById, updateGeofenceById } from "@/lib/geofence-store";

export const runtime = "nodejs";

type Params = {
  params: Promise<{
    id: string;
  }>;
};

export async function PATCH(request: Request, { params }: Params) {
  const adminGuard = await requireAdmin();
  if (!adminGuard.authorized) return adminGuard.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { message: "Payload JSON tidak valid." },
      { status: 400 },
    );
  }

  if (!body || typeof body !== "object") {
    return NextResponse.json(
      { message: "Payload geofence tidak valid." },
      { status: 400 },
    );
  }

  const { id } = await params;
  const payload = body as {
    name?: unknown;
    center?: unknown;
    radiusMeters?: unknown;
    enabled?: unknown;
  };

  if (payload.enabled !== undefined && typeof payload.enabled !== "boolean") {
    return NextResponse.json(
      { message: "Field `enabled` wajib boolean." },
      { status: 400 },
    );
  }

  if (payload.name !== undefined && typeof payload.name !== "string") {
    return NextResponse.json(
      { message: "Nama geofence tidak valid." },
      { status: 400 },
    );
  }

  if (payload.radiusMeters !== undefined && typeof payload.radiusMeters !== "number") {
    return NextResponse.json(
      { message: "Radius geofence tidak valid." },
      { status: 400 },
    );
  }

  if (
    payload.center !== undefined &&
    (!payload.center ||
      typeof payload.center !== "object" ||
      typeof (payload.center as { lat?: unknown }).lat !== "number" ||
      typeof (payload.center as { lng?: unknown }).lng !== "number")
  ) {
    return NextResponse.json(
      { message: "Koordinat geofence tidak valid." },
      { status: 400 },
    );
  }

  let updated;
  try {
    updated = await updateGeofenceById(id, {
      name: payload.name,
      center: payload.center as { lat: number; lng: number } | undefined,
      radiusMeters: payload.radiusMeters,
      enabled: payload.enabled,
    });
  } catch (error) {
    return NextResponse.json(
      {
        message:
          error instanceof Error
            ? error.message
            : "Gagal memperbarui geofence.",
      },
      { status: 400 },
    );
  }

  if (!updated) {
    return NextResponse.json(
      { message: "Geofence tidak ditemukan." },
      { status: 404 },
    );
  }

  return NextResponse.json(updated);
}

export async function DELETE(_: Request, { params }: Params) {
  const adminGuard = await requireAdmin();
  if (!adminGuard.authorized) return adminGuard.response;

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
