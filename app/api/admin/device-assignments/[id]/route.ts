/**
 * Admin device assignment item API.
 *
 * Updates or deactivates one assignment record. Deactivation is preferred over
 * hard delete so operational history can still be audited later.
 */
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/admin-guard";
import {
  createAdminClient,
  getDeviceAssignmentsTableName,
} from "@/lib/supabase/server";
import { normalizeDevicesId } from "@/lib/buggy/device-assignment";
import { getErrorMessage } from "@/lib/utils/error-message";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const adminGuard = await requireAdmin();
  if (!adminGuard.authorized) return adminGuard.response;

  try {
    const { id } = await params;
    const body = await request.json();
    const devicesId = normalizeDevicesId(body.devicesId ?? body.deviceId);
    const buggyId = typeof body.buggyId === "string" ? body.buggyId.trim() : "";
    const label =
      typeof body.label === "string" && body.label.trim()
        ? body.label.trim()
        : null;
    const isActive = body.isActive !== false;

    if (!id || !devicesId || !buggyId) {
      return NextResponse.json(
        { error: "id, devicesId, dan buggyId wajib diisi" },
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
        .eq("is_active", true)
        .neq("id", id);

      if (deactivateError) {
        return NextResponse.json(
          { error: deactivateError.message },
          { status: 500 },
        );
      }
    }

    const { data, error } = await supabase
      .from(getDeviceAssignmentsTableName())
      .update({
        devices_id: devicesId,
        buggy_id: buggyId,
        label,
        is_active: isActive,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select("id, devices_id, buggy_id, label, is_active, created_at, updated_at")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ assignment: data });
  } catch (err) {
    return NextResponse.json({ error: getErrorMessage(err) }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const adminGuard = await requireAdmin();
  if (!adminGuard.authorized) return adminGuard.response;

  try {
    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: "id wajib diisi" }, { status: 400 });
    }

    const supabase = createAdminClient();
    if (!supabase) {
      return NextResponse.json(
        { error: "Fungsi Supabase Admin belum dikonfigurasi" },
        { status: 500 },
      );
    }

    const { data, error } = await supabase
      .from(getDeviceAssignmentsTableName())
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select("id")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, assignment: data });
  } catch (err) {
    return NextResponse.json({ error: getErrorMessage(err) }, { status: 500 });
  }
}
