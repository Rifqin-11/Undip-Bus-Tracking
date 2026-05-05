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
  const supabase = createAdminClient();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("geofences")
    .update({ enabled })
    .eq("id", id)
    .select()
    .single();

  if (error || !data) return null;
  return mapSupabaseToGeofence(data);
}

export async function deleteGeofenceById(id: string): Promise<boolean> {
  const supabase = createAdminClient();
  if (!supabase) return false;

  const { error } = await supabase
    .from("geofences")
    .delete()
    .eq("id", id);

  return !error;
}
