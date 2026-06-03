import {
  createAdminClient,
  getDeviceAssignmentsTableName,
  getDeviceRegistryTableName,
} from "@/lib/supabase/server";

type BuggyJoinRow = {
  id: string;
  code: string | null;
  name: string | null;
  numeric_id: number | null;
};

type DeviceAssignmentRow = {
  id: string;
  devices_id: string;
  buggy_id: string;
  label: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  buggies?: BuggyJoinRow | BuggyJoinRow[] | null;
};

export type ResolvedDeviceAssignment = {
  id: string;
  devicesId: string;
  buggyId: string;
  buggyCode: string | null;
  buggyName: string | null;
  buggyNumericId: number | null;
  label: string | null;
};

export function normalizeDevicesId(value: unknown): string | null {
  if (typeof value !== "string" && typeof value !== "number") return null;
  const normalized = String(value).trim();
  return normalized.length > 0 ? normalized : null;
}

function normalizeComparableDeviceId(value: string) {
  return value.trim().toLowerCase();
}

function resolveJoinedBuggy(row: DeviceAssignmentRow): BuggyJoinRow | null {
  const joined = row.buggies;
  if (Array.isArray(joined)) return joined[0] ?? null;
  return joined ?? null;
}

export function mapDeviceAssignmentRow(
  row: DeviceAssignmentRow,
): ResolvedDeviceAssignment {
  const buggy = resolveJoinedBuggy(row);

  return {
    id: row.id,
    devicesId: row.devices_id,
    buggyId: row.buggy_id,
    buggyCode: buggy?.code ?? null,
    buggyName: buggy?.name ?? null,
    buggyNumericId:
      typeof buggy?.numeric_id === "number" ? buggy.numeric_id : null,
    label: row.label,
  };
}

export async function resolveActiveDeviceAssignment(
  devicesId: string,
): Promise<{
  assignment: ResolvedDeviceAssignment | null;
  error: string | null;
}> {
  const supabase = createAdminClient();
  if (!supabase) {
    return {
      assignment: null,
      error: "Supabase Admin belum dikonfigurasi.",
    };
  }

  const normalizedDevicesId = normalizeDevicesId(devicesId);
  if (!normalizedDevicesId) {
    return { assignment: null, error: "devicesId tidak valid." };
  }

  const { data, error } = await supabase
    .from(getDeviceAssignmentsTableName())
    .select("id, devices_id, buggy_id, label, is_active, created_at, updated_at, buggies(id, code, name, numeric_id)")
    .eq("is_active", true);

  if (error) {
    return { assignment: null, error: error.message };
  }

  const comparable = normalizeComparableDeviceId(normalizedDevicesId);
  const row = ((data ?? []) as DeviceAssignmentRow[]).find(
    (item) => normalizeComparableDeviceId(item.devices_id) === comparable,
  );

  return {
    assignment: row ? mapDeviceAssignmentRow(row) : null,
    error: null,
  };
}

export async function recordSeenDevice(
  devicesId: string,
  payload?: Record<string, unknown>,
): Promise<void> {
  const supabase = createAdminClient();
  const normalizedDevicesId = normalizeDevicesId(devicesId);
  if (!supabase || !normalizedDevicesId) return;

  const now = new Date().toISOString();
  const { error } = await supabase
    .from(getDeviceRegistryTableName())
    .upsert(
      {
        devices_id: normalizedDevicesId,
        last_seen_at: now,
        last_payload: payload ?? null,
        updated_at: now,
      },
      { onConflict: "devices_id" },
    );

  if (error) {
    console.warn("[device-registry] Failed to record seen device:", error.message);
  }
}
