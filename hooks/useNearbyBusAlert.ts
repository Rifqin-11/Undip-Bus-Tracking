import { useEffect, useRef } from "react";
import { haversineMeters } from "@/lib/transit/buggy-route-utils";
import { HALTE_LOCATIONS } from "@/lib/transit/buggy-data";
import { isBuggyRealtimeReachable } from "@/lib/buggy/connection-status";
import type { Buggy } from "@/types/buggy";

// ─── Configuration ────────────────────────────────────────────────────────────

/** Default radius (meter) bus dianggap "mendekati" halte. Bisa di-override via prop. */
const DEFAULT_NEARBY_THRESHOLD_METERS = 150;

/** Radius (meter) maks halte dianggap sebagai "halte terdekat pengguna" */
const USER_HALTE_RADIUS_METERS = 500;

/** Cooldown (ms) per kombinasi busId+halteId agar tidak spam notifikasi */
const ALERT_COOLDOWN_MS = 60_000;

// ─── Types ────────────────────────────────────────────────────────────────────

export type NearbyBusAlert = {
  busName: string;
  halteName: string;
  distanceMeters: number;
};

type UseNearbyBusAlertOptions = {
  buggies: Buggy[];
  userPosition: { lat: number; lng: number } | null;
  onAlert: (alert: NearbyBusAlert) => void;
  /**
   * Override threshold (meter) bus dianggap mendekati halte.
   * Default: 150 m. Akan di-clamp ke [50, 1000].
   */
  thresholdMeters?: number;
};

// ─── Hook ─────────────────────────────────────────────────────────────────────

/**
 * Memantau bus aktif yang mendekati halte terdekat pengguna.
 * Memanggil `onAlert` saat bus < NEARBY_THRESHOLD_METERS dari halte tersebut.
 * Dilengkapi cooldown per kombinasi busId+halteId.
 */
export function useNearbyBusAlert({
  buggies,
  userPosition,
  onAlert,
  thresholdMeters,
}: UseNearbyBusAlertOptions): void {
  // Map cooldown: key = `${busId}::${halteId}`, value = timestamp terakhir notifikasi
  const cooldownRef = useRef<Map<string, number>>(new Map());

  // Clamp threshold agar tetap masuk akal walau setting di-tweak.
  const safeThreshold = Math.max(
    50,
    Math.min(1000, thresholdMeters ?? DEFAULT_NEARBY_THRESHOLD_METERS),
  );

  useEffect(() => {
    // Tidak ada posisi user → skip
    if (!userPosition) return;

    // Cari halte terdekat dari posisi pengguna, dalam radius USER_HALTE_RADIUS_METERS
    let nearestHalte: (typeof HALTE_LOCATIONS)[number] | null = null;
    let nearestHalteDistance = Infinity;

    for (const halte of HALTE_LOCATIONS) {
      const d = haversineMeters(userPosition, {
        lat: halte.lat,
        lng: halte.lng,
      });
      if (d < nearestHalteDistance) {
        nearestHalteDistance = d;
        nearestHalte = halte;
      }
    }

    // Jika halte terdekat di luar radius user → skip
    if (!nearestHalte || nearestHalteDistance > USER_HALTE_RADIUS_METERS)
      return;

    const now = Date.now();

    for (const buggy of buggies) {
      // Hanya pantau bus yang datanya masih cukup segar.
      if (!isBuggyRealtimeReachable(buggy)) continue;

      // Jarak bus ke halte terdekat user
      const busToHalteDistance = haversineMeters(buggy.position, {
        lat: nearestHalte.lat,
        lng: nearestHalte.lng,
      });

      if (busToHalteDistance > safeThreshold) continue;

      // Cek cooldown
      const cooldownKey = `${buggy.id}::${nearestHalte.id}`;
      const lastAlerted = cooldownRef.current.get(cooldownKey) ?? 0;
      if (now - lastAlerted < ALERT_COOLDOWN_MS) continue;

      // Update cooldown & trigger alert
      cooldownRef.current.set(cooldownKey, now);
      onAlert({
        busName: buggy.name,
        halteName: nearestHalte.name,
        distanceMeters: Math.round(busToHalteDistance),
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [buggies, userPosition, safeThreshold]);
  // onAlert tidak dimasukkan ke deps karena bisa menyebabkan infinite loop
  // jika caller tidak memoize. Ref digunakan sebagai workaround.
}
