/**
 * data-loader.ts
 *
 * Bootstrap fungsi yang mengisi:
 *  - Halte runtime (lib/transit/halte-runtime) dari tabel `haltes` Supabase
 *  - Buggy live store (lib/realtime/buggy-live-store) dari tabel `buggies` Supabase
 *
 * Dipanggil sekali secara lazy di /api/buggy/route.ts saat first request.
 * Menggunakan globalThis flag agar tidak dipanggil berulang dalam satu server process.
 */

import { createAdminClient } from "@/lib/supabase/server";
import { getHalteLocations, setHalteLocations, isHalteRuntimeReady } from "@/lib/transit/halte-runtime";
import {
  getBuggyLiveSnapshot,
  adminAddBuggyToStore,
} from "@/lib/realtime/buggy-live-store";
import { findNearestPathIndex } from "@/lib/transit/buggy-route-utils";
import { CENTER_UNDIP } from "@/lib/transit/buggy-data";
import type { HaltePoint } from "@/types/buggy";
import type { Buggy } from "@/types/buggy";

declare global {
  // eslint-disable-next-line no-var
  var __DB_BOOTSTRAP_DONE__: boolean | undefined;
  // eslint-disable-next-line no-var
  var __DB_BOOTSTRAP_IN_PROGRESS__: Promise<void> | undefined;
}

// ─── Row types ────────────────────────────────────────────────────────────────

type HalteRow = {
  id: string;
  name: string;
  lat: number;
  lng: number;
  sort_order: number;
  is_active: boolean;
};

type BuggyRow = {
  id: string;
  code: string;
  name: string;
  capacity: number;
  is_active: boolean;
  numeric_id: number | null;
};

// ─── Halte bootstrap ──────────────────────────────────────────────────────────

async function bootstrapHaltes(): Promise<void> {
  if (isHalteRuntimeReady()) return;

  const supabase = createAdminClient();
  if (!supabase) {
    console.warn("[data-loader] Supabase admin client tidak tersedia, pakai data halte statis.");
    return;
  }

  const { data, error } = await supabase
    .from("haltes")
    .select("id, name, lat, lng, sort_order, is_active")
    .eq("is_active", true)
    .order("sort_order", { ascending: true });

  if (error) {
    console.error("[data-loader] Gagal fetch halte dari Supabase:", error.message);
    return;
  }

  if (!data || data.length === 0) {
    console.info("[data-loader] Tabel haltes kosong, gunakan data statis sebagai fallback.");
    return;
  }

  const haltePoints: HaltePoint[] = (data as HalteRow[]).map((row) => ({
    id: row.id,
    name: row.name,
    lat: row.lat,
    lng: row.lng,
  }));

  setHalteLocations(haltePoints);
  console.info(`[data-loader] ✓ ${haltePoints.length} halte dimuat dari Supabase.`);
}

// ─── Buggy bootstrap ──────────────────────────────────────────────────────────

async function bootstrapBuggies(): Promise<void> {
  const supabase = createAdminClient();
  if (!supabase) {
    console.warn("[data-loader] Supabase admin client tidak tersedia, live store tetap kosong.");
    return;
  }

  const { data, error } = await supabase
    .from("buggies")
    .select("id, code, name, capacity, is_active, numeric_id")
    .order("code", { ascending: true });

  if (error) {
    console.error("[data-loader] Gagal fetch buggy dari Supabase:", error.message);
    return;
  }

  if (!data || data.length === 0) {
    console.info("[data-loader] Tabel buggies kosong, live store tidak memiliki data buggy.");
    return;
  }

  const haltes = getHalteLocations();
  const lat = CENTER_UNDIP[0];
  const lng = CENTER_UNDIP[1];

  const buggies: Buggy[] = (data as BuggyRow[]).map((row) => ({
    id: row.id,
    numericId: row.numeric_id ?? undefined,
    code: row.code,
    name: row.name,
    isActive: false,
    routeLabel: "Rute Kampus Undip",
    tripId: `TRIP-2026-${row.code}`,
    etaMinutes: 5,
    speedKmh: 0,
    crowdLevel: "LONGGAR" as const,
    passengers: 0,
    capacity: row.capacity,
    tag: "Real GPS",
    updatedAt: "--:--",
    currentStopIndex: 0,
    stops: haltes.map((h) => h.name),
    pathCursor: findNearestPathIndex(lat, lng),
    position: { lat, lng },
  }));

  // Inject satu per satu — adminAddBuggyToStore skip jika ID/kode sudah ada
  for (const buggy of buggies) {
    adminAddBuggyToStore(buggy);
  }

  console.info(`[data-loader] ✓ ${buggies.length} buggy dimuat dari Supabase.`);
}

// ─── Main bootstrap ───────────────────────────────────────────────────────────

/**
 * Panggil sekali saat first request ke /api/buggy.
 * Idempotent — safe untuk dipanggil berkali-kali.
 */
export async function bootstrapFromDatabase(): Promise<void> {
  // Sudah selesai di request sebelumnya
  if (globalThis.__DB_BOOTSTRAP_DONE__) return;

  // Sedang berjalan di request parallel — tunggu yang sudah ada
  if (globalThis.__DB_BOOTSTRAP_IN_PROGRESS__) {
    await globalThis.__DB_BOOTSTRAP_IN_PROGRESS__;
    return;
  }

  const work = (async () => {
    try {
      // Halte harus diload terlebih dahulu agar buggy bisa pakai nama halte yang benar
      await bootstrapHaltes();
      await bootstrapBuggies();
      globalThis.__DB_BOOTSTRAP_DONE__ = true;
    } catch (err) {
      console.error("[data-loader] Bootstrap error:", err);
    } finally {
      globalThis.__DB_BOOTSTRAP_IN_PROGRESS__ = undefined;
    }
  })();

  globalThis.__DB_BOOTSTRAP_IN_PROGRESS__ = work;
  await work;
}
