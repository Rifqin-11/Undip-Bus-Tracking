import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/admin-guard";
import {
  createAdminClient,
  getDeviceAssignmentsTableName,
  getLatestBuggyTelemetryTableName,
} from "@/lib/supabase/server";
import {
  mapDeviceAssignmentRow,
  normalizeDevicesId,
} from "@/lib/buggy/device-assignment";
import { getErrorMessage } from "@/lib/utils/error-message";

type LatestTelemetryRow = {
  devices_id?: string | null;
  buggy_id: string | null;
  speed_kmh: number | null;
  passengers?: number | null;
  recorded_at: string | null;
  received_at?: string | null;
  updated_at?: string | null;
};

function isSchemaColumnError(message: string) {
  return (
    message.includes("schema cache") ||
    message.includes("Could not find") ||
    message.includes("column")
  );
}

function resolveLastSeenAt(row: LatestTelemetryRow) {
  return row.received_at ?? row.updated_at ?? row.recorded_at ?? null;
}

function normalizeComparable(value: string) {
  return value.trim().toLowerCase();
}

async function fetchLatestTelemetryByDevice() {
  const supabase = createAdminClient();
  if (!supabase) return new Map<string, LatestTelemetryRow>();

  const { data, error } = await supabase
    .from(getLatestBuggyTelemetryTableName())
    .select("devices_id, buggy_id, speed_kmh, passengers, recorded_at, received_at, updated_at")
    .order("recorded_at", { ascending: false });

  if (error) {
    if (!isSchemaColumnError(error.message)) {
      console.warn("[device-assignments] Failed to load latest telemetry:", error.message);
    }
    return new Map<string, LatestTelemetryRow>();
  }

  const latestByDevice = new Map<string, LatestTelemetryRow>();
  for (const row of (data ?? []) as LatestTelemetryRow[]) {
    if (!row.devices_id) continue;
    const key = normalizeComparable(row.devices_id);
    if (!latestByDevice.has(key)) latestByDevice.set(key, row);
  }

  return latestByDevice;
}

export async function GET() {
  const adminGuard = await requireAdmin();
  if (!adminGuard.authorized) return adminGuard.response;

  try {
    const supabase = createAdminClient();
    if (!supabase) {
      return NextResponse.json(
        { error: "Fungsi Supabase Admin belum dikonfigurasi" },
        { status: 500 },
      );
    }

    const [{ data, error }, latestByDevice] = await Promise.all([
      supabase
        .from(getDeviceAssignmentsTableName())
        .select("id, devices_id, buggy_id, label, is_active, created_at, updated_at, buggies(id, code, name, numeric_id)")
        .order("updated_at", { ascending: false }),
      fetchLatestTelemetryByDevice(),
    ]);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const assignments = ((data ?? []) as Parameters<typeof mapDeviceAssignmentRow>[0][])
      .map((row) => {
        const assignment = mapDeviceAssignmentRow(row);
        const latest = latestByDevice.get(
          normalizeComparable(assignment.devicesId),
        );

        return {
          ...assignment,
          isActive: row.is_active,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
          lastSeenAt: latest ? resolveLastSeenAt(latest) : null,
          speedKmh:
            typeof latest?.speed_kmh === "number" ? latest.speed_kmh : null,
          passengers:
            typeof latest?.passengers === "number" ? latest.passengers : null,
        };
      });

    return NextResponse.json({ assignments });
  } catch (err) {
    return NextResponse.json({ error: getErrorMessage(err) }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const adminGuard = await requireAdmin();
  if (!adminGuard.authorized) return adminGuard.response;

  try {
    const body = await request.json();
    const devicesId = normalizeDevicesId(body.devicesId ?? body.deviceId);
    const buggyId = typeof body.buggyId === "string" ? body.buggyId.trim() : "";
    const label =
      typeof body.label === "string" && body.label.trim()
        ? body.label.trim()
        : null;
    const isActive = body.isActive !== false;

    if (!devicesId || !buggyId) {
      return NextResponse.json(
        { error: "devicesId dan buggyId wajib diisi" },
        { status: 400 },
      );
    }

    const supabase = createAdminClient();
    if (!supabase) {
      return NextResponse.json(
        { error: "Fungsi Supabase Admin belum dikonfigurasi" },
        { status: 500 },
      );
    }

    if (isActive) {
      const { error: deactivateError } = await supabase
        .from(getDeviceAssignmentsTableName())
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .ilike("devices_id", devicesId)
        .eq("is_active", true);

      if (deactivateError) {
        return NextResponse.json(
          { error: deactivateError.message },
          { status: 500 },
        );
      }
    }

    const { data, error } = await supabase
      .from(getDeviceAssignmentsTableName())
      .insert({
        devices_id: devicesId,
        buggy_id: buggyId,
        label,
        is_active: isActive,
      })
      .select("id, devices_id, buggy_id, label, is_active, created_at, updated_at, buggies(id, code, name, numeric_id)")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ assignment: data }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: getErrorMessage(err) }, { status: 500 });
  }
}
