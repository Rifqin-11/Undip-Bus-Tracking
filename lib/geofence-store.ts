import "server-only";

import { createAdminClient } from "@/lib/supabase/server";
import type { Geofence } from "@/types/geofence";

type CreateGeofenceInput = {
  name: string;
  center: {
    lat: number;
    lng: number;
  };
  radiusMeters: number;
};

type UpdateGeofenceInput = {
  name?: string;
  center?: {
    lat: number;
    lng: number;
  };
  radiusMeters?: number;
  enabled?: boolean;
};

function isFiniteNumber(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

function isValidLatLng(lat: number, lng: number): boolean {
  return lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapSupabaseToGeofence(row: any): Geofence {
  return {
    id: row.id,
    name: row.name,
    center: {
      lat: Number(row.center_lat),
      lng: Number(row.center_lng),
    },
    radiusMeters: Number(row.radius_meters),
    enabled: row.enabled,
    createdAt: row.created_at,
  };
}

export async function readGeofences(): Promise<Geofence[]> {
  const supabase = createAdminClient();
  if (!supabase) {
    console.warn("Supabase admin client not initialized.");
    return [];
  }

  const { data, error } = await supabase
    .from("geofences")
    .select("*")
    .order("created_at", { ascending: false });

  if (error || !data) {
    console.error("Error reading geofences:", error);
    return [];
  }

  return data.map(mapSupabaseToGeofence);
}

export async function createGeofence(input: CreateGeofenceInput): Promise<Geofence> {
  const supabase = createAdminClient();
  if (!supabase) throw new Error("Supabase admin client not initialized");

  const name = input.name.trim();
  if (!name) throw new Error("Nama geofence wajib diisi.");
  
  if (!isFiniteNumber(input.center.lat) || !isFiniteNumber(input.center.lng) || !isValidLatLng(input.center.lat, input.center.lng)) {
    throw new Error("Koordinat geofence tidak valid.");
  }
  
  if (!isFiniteNumber(input.radiusMeters) || input.radiusMeters <= 0) {
    throw new Error("Radius geofence harus lebih dari 0.");
  }

  const { data, error } = await supabase
    .from("geofences")
    .insert({
      name,
      center_lat: input.center.lat,
      center_lng: input.center.lng,
      radius_meters: input.radiusMeters,
      enabled: true,
    })
    .select()
    .single();

  if (error || !data) {
    throw new Error("Gagal menyimpan geofence ke database: " + error?.message);
  }

  return mapSupabaseToGeofence(data);
}

export async function patchGeofenceEnabled(id: string, enabled: boolean): Promise<Geofence | null> {
  return updateGeofenceById(id, { enabled });
}

export async function updateGeofenceById(
  id: string,
  input: UpdateGeofenceInput,
): Promise<Geofence | null> {
  const supabase = createAdminClient();
  if (!supabase) return null;

  const patch: Record<string, unknown> = {};

  if (typeof input.name === "string") {
    const name = input.name.trim();
    if (!name) throw new Error("Nama geofence wajib diisi.");
    patch.name = name;
  }

  if (input.center) {
    if (
      !isFiniteNumber(input.center.lat) ||
      !isFiniteNumber(input.center.lng) ||
      !isValidLatLng(input.center.lat, input.center.lng)
    ) {
      throw new Error("Koordinat geofence tidak valid.");
    }
    patch.center_lat = input.center.lat;
    patch.center_lng = input.center.lng;
  }

  if (input.radiusMeters !== undefined) {
    if (!isFiniteNumber(input.radiusMeters) || input.radiusMeters <= 0) {
      throw new Error("Radius geofence harus lebih dari 0.");
    }
    patch.radius_meters = input.radiusMeters;
  }

  if (input.enabled !== undefined) {
    if (typeof input.enabled !== "boolean") {
      throw new Error("Field `enabled` wajib boolean.");
    }
    patch.enabled = input.enabled;
  }

  if (Object.keys(patch).length === 0) return null;

  const { data, error } = await supabase
    .from("geofences")
    .update(patch)
    .eq("id", id)
    .select()
    .maybeSingle();

  if (error || !data) return null;
  return mapSupabaseToGeofence(data);
}

export async function deleteGeofenceById(id: string): Promise<boolean> {
  const supabase = createAdminClient();
  if (!supabase) return false;

  const { data, error } = await supabase
    .from("geofences")
    .delete()
    .eq("id", id)
    .select("id");

  return !error && Array.isArray(data) && data.length > 0;
}
