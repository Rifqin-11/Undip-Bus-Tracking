import "server-only";

import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Geofence } from "@/types/geofence";

const DATA_DIR = path.join(process.cwd(), "data");
const GEOFENCE_FILE = path.join(DATA_DIR, "geofences.json");

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

function isGeofenceShape(value: unknown): value is Geofence {
  if (!value || typeof value !== "object") return false;
  const obj = value as Partial<Geofence>;
  return (
    typeof obj.id === "string" &&
    typeof obj.name === "string" &&
    typeof obj.createdAt === "string" &&
    typeof obj.enabled === "boolean" &&
    !!obj.center &&
    isFiniteNumber(obj.center.lat) &&
    isFiniteNumber(obj.center.lng) &&
    isValidLatLng(obj.center.lat, obj.center.lng) &&
    isFiniteNumber(obj.radiusMeters) &&
    obj.radiusMeters > 0
  );
}

async function ensureStorageFile() {
  await mkdir(DATA_DIR, { recursive: true });
  try {
    await readFile(GEOFENCE_FILE, "utf8");
  } catch (error: unknown) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "ENOENT"
    ) {
      await writeFile(GEOFENCE_FILE, "[]\n", "utf8");
      return;
    }
    throw error;
  }
}

async function writeGeofences(geofences: Geofence[]) {
  await ensureStorageFile();
  await writeFile(GEOFENCE_FILE, `${JSON.stringify(geofences, null, 2)}\n`, "utf8");
}

export async function readGeofences(): Promise<Geofence[]> {
  await ensureStorageFile();
  const raw = await readFile(GEOFENCE_FILE, "utf8");
  let parsed: unknown = [];
  try {
    parsed = JSON.parse(raw);
  } catch {
    parsed = [];
  }

  if (!Array.isArray(parsed)) return [];
  return parsed.filter(isGeofenceShape);
}

export async function createGeofence(input: CreateGeofenceInput): Promise<Geofence> {
  const name = input.name.trim();
  if (!name) {
    throw new Error("Nama geofence wajib diisi.");
  }

  if (
    !isFiniteNumber(input.center.lat) ||
    !isFiniteNumber(input.center.lng) ||
    !isValidLatLng(input.center.lat, input.center.lng)
  ) {
    throw new Error("Koordinat geofence tidak valid.");
  }

  if (!isFiniteNumber(input.radiusMeters) || input.radiusMeters <= 0) {
    throw new Error("Radius geofence harus lebih dari 0.");
  }

  const geofences = await readGeofences();
  const geofence: Geofence = {
    id: randomUUID(),
    name,
    center: {
      lat: input.center.lat,
      lng: input.center.lng,
    },
    radiusMeters: input.radiusMeters,
    enabled: true,
    createdAt: new Date().toISOString(),
  };

  geofences.push(geofence);
  await writeGeofences(geofences);
  return geofence;
}

export async function patchGeofenceEnabled(
  id: string,
  enabled: boolean,
): Promise<Geofence | null> {
  const geofences = await readGeofences();
  const idx = geofences.findIndex((item) => item.id === id);
  if (idx < 0) return null;

  const updated: Geofence = {
    ...geofences[idx],
    enabled,
  };
  geofences[idx] = updated;
  await writeGeofences(geofences);
  return updated;
}

export async function deleteGeofenceById(id: string): Promise<boolean> {
  const geofences = await readGeofences();
  const next = geofences.filter((item) => item.id !== id);
  if (next.length === geofences.length) return false;
  await writeGeofences(next);
  return true;
}
