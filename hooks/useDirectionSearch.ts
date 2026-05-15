"use client";

import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { GoogleMapsService } from "@/lib/services/google-maps-service";
import {
  cartesianDistance,
  findHalteByQuery,
  findNearestBuggyToHalte,
  getRouteBetweenHaltes,
  normalize,
} from "@/lib/transit/route-search";
import type { Buggy, HaltePoint } from "@/types/buggy";
import type { LatLng } from "@/hooks/useUserPosition";
import type { DirectionResult } from "@/components/panel/DirectionPanel";

export type SearchStep = "destination" | "origin";

type UseDirectionSearchOptions = {
  liveBuggies: Buggy[];
  haltes: HaltePoint[];
  routePath: [number, number][];
  getLatestUserPosition: () => Promise<LatLng | null>;
  /** Optional auth gate yang dijalankan sebelum search; return false untuk membatalkan. */
  requireAuth?: () => boolean;
  /** Dipanggil setelah search/recommendation berhasil mendapatkan result + nearestBuggy. */
  onSearchComplete?: (
    result: DirectionResult,
    nearestBuggy: Buggy | null,
  ) => void;
  /** Set true untuk membatalkan jika tidak ada buggy aktif (perilaku admin lama). */
  requireNearestBuggy?: boolean;
};

function ensureGoogleMaps(): boolean {
  return Boolean(
    (window as Window & { google?: { maps?: unknown } }).google?.maps,
  );
}

/** State + handler untuk pencarian rute (origin/destination) berbasis Google Maps. */
export function useDirectionSearch(opts: UseDirectionSearchOptions) {
  const { t } = useTranslation("dashboard");
  const {
    liveBuggies,
    haltes,
    routePath,
    getLatestUserPosition,
    requireAuth,
    onSearchComplete,
    requireNearestBuggy = false,
  } = opts;

  const [searchStep, setSearchStep] = useState<SearchStep>("destination");
  const [fromInput, setFromInput] = useState("");
  const [toInput, setToInput] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [directionResult, setDirectionResult] =
    useState<DirectionResult | null>(null);

  const resetToDestination = useCallback(() => {
    setSearchStep("destination");
    setFromInput("");
    setDirectionResult(null);
  }, []);

  const runDirectionSearch = useCallback(async () => {
    if (requireAuth && !requireAuth()) return;

    if (searchStep === "destination") {
      if (!normalize(toInput)) return;
      setSearchStep("origin");
      return;
    }

    setIsSearching(true);
    try {
      if (!ensureGoogleMaps()) {
        alert("Google Maps belum loading. Coba lagi.");
        return;
      }

      const mapsService = GoogleMapsService.fromWindow();

      // ── Resolve origin ─────────────────────────────────────────────────
      let originHalte = findHalteByQuery(fromInput, haltes);
      let walkingToHalte: DirectionResult["walkingToHalte"];
      let originPos: LatLng;

      const effectiveFrom = normalize(fromInput);
      if (!effectiveFrom) {
        const currentPos = await getLatestUserPosition();
        if (!currentPos) {
          alert("Aktifkan izin lokasi atau ketik lokasi asal Anda.");
          return;
        }
        originPos = currentPos;
        setFromInput(t("useMyLocation"));
        originHalte = mapsService.findNearestHalte(currentPos, haltes);
        if (!originHalte) {
          alert("Halte terdekat dari lokasi Anda tidak ditemukan.");
          return;
        }
        const walk = await mapsService.getWalkingDirections(currentPos, {
          lat: originHalte.lat,
          lng: originHalte.lng,
        });
        if (walk) {
          walkingToHalte = {
            originHalteName: originHalte.name,
            distance: walk.totalDistance,
            duration: walk.totalDuration,
            path: walk.decodedPath,
          };
        }
      } else if (!originHalte) {
        const geocoded = await mapsService.geocodePlace(fromInput);
        if (!geocoded) {
          alert(
            `Lokasi "${fromInput}" tidak ditemukan. Coba nama lengkap + UNDIP.`,
          );
          return;
        }
        originPos = { lat: geocoded.lat, lng: geocoded.lng };
        originHalte = mapsService.findNearestHalte(geocoded, haltes);
        if (!originHalte) return;
        const walk = await mapsService.getWalkingDirections(geocoded, {
          lat: originHalte.lat,
          lng: originHalte.lng,
        });
        if (walk) {
          walkingToHalte = {
            originHalteName: originHalte.name,
            distance: walk.totalDistance,
            duration: walk.totalDuration,
            path: walk.decodedPath,
          };
        }
      } else {
        originPos = { lat: originHalte.lat, lng: originHalte.lng };
      }

      // ── Resolve destination ────────────────────────────────────────────
      let destHalte = findHalteByQuery(toInput, haltes);
      let walkingFromHalte: DirectionResult["walkingFromHalte"];
      let destPos: LatLng;

      if (!destHalte) {
        const geocoded = await mapsService.geocodePlace(toInput);
        if (!geocoded) {
          alert(
            `Lokasi "${toInput}" tidak ditemukan. Coba nama lengkap + UNDIP.`,
          );
          return;
        }
        destPos = { lat: geocoded.lat, lng: geocoded.lng };
        destHalte = mapsService.findNearestHalte(geocoded, haltes);
        if (!destHalte) return;
        const walk = await mapsService.getWalkingDirections(
          { lat: destHalte.lat, lng: destHalte.lng },
          geocoded,
        );
        if (walk) {
          walkingFromHalte = {
            destinationHalteName: destHalte.name,
            distance: walk.totalDistance,
            duration: walk.totalDuration,
            path: walk.decodedPath,
          };
        }
      } else {
        destPos = { lat: destHalte.lat, lng: destHalte.lng };
      }

      const originIdx = haltes.findIndex((h) => h.id === originHalte?.id);
      const destIdx = haltes.findIndex((h) => h.id === destHalte?.id);
      if (originIdx < 0 || destIdx < 0) return;

      const routeStopNames: string[] = [];
      let cursor = originIdx;
      while (true) {
        routeStopNames.push(haltes[cursor].name);
        if (cursor === destIdx) break;
        cursor = (cursor + 1) % haltes.length;
      }

      const busRoutePath = getRouteBetweenHaltes(
        originHalte!.lat,
        originHalte!.lng,
        destHalte!.lat,
        destHalte!.lng,
        routePath,
      );

      const nearest = findNearestBuggyToHalte(liveBuggies, originHalte!);
      if (requireNearestBuggy && !nearest) return;

      const result: DirectionResult = {
        originName: fromInput,
        destinationName: toInput,
        originPosition: originPos,
        destinationPosition: destPos,
        routeStopNames,
        nearestBuggyName: nearest?.name,
        nearestBuggyId: nearest?.id,
        directionPath: busRoutePath,
        walkingToHalte,
        walkingFromHalte,
      };

      setDirectionResult(result);
      onSearchComplete?.(result, nearest ?? null);
    } catch (err) {
      console.error("Direction search error:", err);
      alert("Terjadi kesalahan saat mencari rute.");
    } finally {
      setIsSearching(false);
    }
  }, [
    requireAuth,
    searchStep,
    toInput,
    fromInput,
    haltes,
    routePath,
    liveBuggies,
    getLatestUserPosition,
    requireNearestBuggy,
    onSearchComplete,
    t,
  ]);

  const runRecommendedHalteDirection = useCallback(
    async (halteId: string) => {
      if (requireAuth && !requireAuth()) return;

      const destinationHalte = haltes.find((h) => h.id === halteId) ?? null;
      if (!destinationHalte) return;

      setIsSearching(true);
      try {
        if (!ensureGoogleMaps()) {
          alert("Google Maps belum loading. Coba lagi.");
          return;
        }

        const currentPos = await getLatestUserPosition();
        if (!currentPos) {
          alert(
            "Lokasi pengguna belum tersedia. Aktifkan izin lokasi lalu coba lagi.",
          );
          return;
        }

        const mapsService = GoogleMapsService.fromWindow();
        const originHalte = mapsService.findNearestHalte(currentPos, haltes);
        if (!originHalte) {
          alert("Halte asal terdekat tidak ditemukan.");
          return;
        }

        const walkToOriginHalte = await mapsService.getWalkingDirections(
          currentPos,
          { lat: originHalte.lat, lng: originHalte.lng },
        );

        const originIdx = haltes.findIndex((h) => h.id === originHalte.id);
        const destIdx = haltes.findIndex((h) => h.id === destinationHalte.id);
        if (originIdx < 0 || destIdx < 0) return;

        const routeStopNames: string[] = [];
        let cursor = originIdx;
        while (true) {
          routeStopNames.push(haltes[cursor].name);
          if (cursor === destIdx) break;
          cursor = (cursor + 1) % haltes.length;
        }

        const busRoutePath = getRouteBetweenHaltes(
          originHalte.lat,
          originHalte.lng,
          destinationHalte.lat,
          destinationHalte.lng,
          routePath,
        );

        const nearest = liveBuggies.reduce<Buggy | null>((best, buggy) => {
          if (!best) return buggy;
          return cartesianDistance(buggy.position, originHalte) <
            cartesianDistance(best.position, originHalte)
            ? buggy
            : best;
        }, null);

        setFromInput(t("useMyLocation"));
        setToInput(destinationHalte.name);
        setSearchStep("origin");

        const result: DirectionResult = {
          originName: t("useMyLocation"),
          destinationName: destinationHalte.name,
          originPosition: currentPos,
          destinationPosition: {
            lat: destinationHalte.lat,
            lng: destinationHalte.lng,
          },
          routeStopNames,
          nearestBuggyName: nearest?.name,
          nearestBuggyId: nearest?.id,
          directionPath: busRoutePath,
          walkingToHalte: walkToOriginHalte
            ? {
                originHalteName: originHalte.name,
                distance: walkToOriginHalte.totalDistance,
                duration: walkToOriginHalte.totalDuration,
                path: walkToOriginHalte.decodedPath,
              }
            : undefined,
        };

        setDirectionResult(result);
        onSearchComplete?.(result, nearest);
      } catch (err) {
        console.error("Recommendation direction error:", err);
        alert("Terjadi kesalahan saat membuat rute dari lokasi Anda.");
      } finally {
        setIsSearching(false);
      }
    },
    [
      requireAuth,
      haltes,
      routePath,
      liveBuggies,
      getLatestUserPosition,
      onSearchComplete,
      t,
    ],
  );

  return {
    searchStep,
    setSearchStep,
    fromInput,
    setFromInput,
    toInput,
    setToInput,
    isSearching,
    directionResult,
    setDirectionResult,
    runDirectionSearch,
    runRecommendedHalteDirection,
    resetToDestination,
  };
}
