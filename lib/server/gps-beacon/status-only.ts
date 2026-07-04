import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { adminUpdateBuggyInStore } from "@/lib/realtime/buggy-live-store";
import { broadcastBuggySnapshot } from "@/lib/realtime/buggy-sse-bus";
import {
  getLatestBuggyTelemetryTableName,
} from "@/lib/supabase/server";
import { normalizeGsmStatus } from "@/lib/buggy/gsm-status";
import { isSchemaColumnError } from "@/lib/server/gps-beacon/request-utils";

type NormalizedGsm = NonNullable<ReturnType<typeof normalizeGsmStatus>>;

type StatusOnlyOptions = {
  supabase: SupabaseClient | null;
  normalizedGsm: NormalizedGsm | null;
  incomingDevicesId: string | null;
  resolvedBuggyId: string;
  numericBuggyId: number | null;
  identitySource: "device_assignment" | "legacy_buggy_id";
};

function toGsmResponse(normalizedGsm: NormalizedGsm | null) {
  return normalizedGsm
    ? {
        apn: normalizedGsm.apn,
        signalPercent: normalizedGsm.signalPercent,
        networkConnected: normalizedGsm.networkConnected,
        gprsConnected: normalizedGsm.gprsConnected,
        mqttStateText: normalizedGsm.mqttStateText,
      }
    : null;
}

export async function handleStatusOnlyTelemetry({
  supabase,
  normalizedGsm,
  incomingDevicesId,
  resolvedBuggyId,
  numericBuggyId,
  identitySource,
}: StatusOnlyOptions) {
  const receivedAt = new Date().toISOString();
  if (supabase && normalizedGsm) {
    adminUpdateBuggyInStore(resolvedBuggyId, { gsm: normalizedGsm });
  }

  let statusTelemetryUpdated = false;
  if (supabase && normalizedGsm) {
    const telemetryClient = supabase;
    const statusPatch = {
      devices_id: incomingDevicesId,
      gsm: normalizedGsm,
      received_at: receivedAt,
      updated_at: receivedAt,
    };
    const { data, error } = await telemetryClient
      .from(getLatestBuggyTelemetryTableName())
      .update(statusPatch)
      .eq("buggy_id", resolvedBuggyId)
      .select("buggy_id")
      .maybeSingle();

    if (error) {
      if (isSchemaColumnError(error.message)) {
        const fallbackPatch: Record<string, unknown> = { ...statusPatch };
        delete fallbackPatch.devices_id;
        delete fallbackPatch.received_at;
        const { data: fallbackData, error: fallbackError } = await telemetryClient
          .from(getLatestBuggyTelemetryTableName())
          .update(fallbackPatch)
          .eq("buggy_id", resolvedBuggyId)
          .select("buggy_id")
          .maybeSingle();

        if (fallbackError) {
          console.warn(
            "Supabase status telemetry update failed:",
            fallbackError.message,
          );
        } else {
          statusTelemetryUpdated = Boolean(fallbackData);
        }
      } else {
        console.warn("Supabase status telemetry update failed:", error.message);
      }
    } else {
      statusTelemetryUpdated = Boolean(data);
    }
  }

  broadcastBuggySnapshot({
    forceRefresh: true,
    durableOverlay: false,
    reason: "statusOnly",
  });
  return NextResponse.json({
    ok: true,
    statusOnly: true,
    statusTelemetryUpdated,
    devicesId: incomingDevicesId,
    buggyId: resolvedBuggyId,
    buggyNumericId: numericBuggyId,
    identitySource,
    gsm: toGsmResponse(normalizedGsm),
  });
}
