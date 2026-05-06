"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AuthModal } from "@/components/auth/AuthModal";
import { MapCanvas } from "@/components/map/MapCanvas";
import { BuggyList } from "@/components/buggy/PanelActive";
import { FloatingSidebar } from "@/components/sidebar/FloatingSidebar";
import { MobileBottomNav } from "@/components/sidebar/MobileBottomNav";
import { LiveSearchBar } from "@/components/search/LiveSearchBar";
import { AppSettingsPanel } from "@/components/settings/AppSettingsPanel";
import {
  MapPinSolidIcon,
  BellIcon,
  LoginIcon,
} from "@/components/ui/Icons";
import { ToastStack, type ToastItem } from "@/components/ui/ToastStack";
import { useNearbyBusAlert } from "@/hooks/useNearbyBusAlert";
import { useAdminSettings, type AdminSettings } from "@/hooks/useAdminSettings";
import { HALTE_LOCATIONS, OFFICIAL_ROUTE_PATH } from "@/lib/transit/buggy-data";
import { haversineMeters } from "@/lib/transit/buggy-route-utils";
import { useBuggyLiveFeed } from "@/hooks/useBuggyLiveFeed";
import { useUserRole } from "@/hooks/useUserRole";
import { GoogleMapsService } from "@/lib/services/google-maps-service";
import type { PanelView } from "@/types/buggy";
import type { DirectionResult } from "@/components/panel/DirectionPanel";
import { createClient } from "@/lib/supabase/client";

function normalize(s: string) {
  return s.trim().toLowerCase();
}

function findHalteByQuery(query: string) {
  const n = normalize(query);
  return HALTE_LOCATIONS.find((h) => normalize(h.name).includes(n)) ?? null;
}

function dist(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
) {
  return Math.hypot(a.lat - b.lat, a.lng - b.lng);
}

/**
 * Find the closest index in OFFICIAL_ROUTE_PATH to a given halte position.
 */
function findNearestPathIndex(lat: number, lng: number): number {
  let bestIdx = 0;
  let bestDist = Infinity;
  for (let i = 0; i < OFFICIAL_ROUTE_PATH.length; i++) {
    const d = Math.hypot(
      OFFICIAL_ROUTE_PATH[i][0] - lat,
      OFFICIAL_ROUTE_PATH[i][1] - lng,
    );
    if (d < bestDist) {
      bestDist = d;
      bestIdx = i;
    }
  }
  return bestIdx;
}

/**
 * Extract the actual road path segment between two haltes
 * by tracing along OFFICIAL_ROUTE_PATH (forward direction, wrapping).
 */
function getRouteBetweenHaltes(
  originLat: number,
  originLng: number,
  destLat: number,
  destLng: number,
): [number, number][] {
  const startIdx = findNearestPathIndex(originLat, originLng);
  const endIdx = findNearestPathIndex(destLat, destLng);
  const totalPoints = OFFICIAL_ROUTE_PATH.length;

  const path: [number, number][] = [];
  let cursor = startIdx;

  // Walk forward along the route (the bus goes in one direction in a loop)
  for (let i = 0; i < totalPoints; i++) {
    path.push(OFFICIAL_ROUTE_PATH[cursor]);
    if (cursor === endIdx) break;
    cursor = (cursor + 1) % totalPoints;
  }

  return path;
}

export default function DashboardPage() {
  const router = useRouter();
  const realtimeFeed = useBuggyLiveFeed();
  const { settings, updateSetting } = useAdminSettings();
  const {
    userProfile,
    loading: userLoading,
    isAuthenticated,
  } = useUserRole();
  const liveBuggies = useMemo(
    () => (realtimeFeed.liveBuggies ?? []).filter((buggy) => buggy.isActive),
    [realtimeFeed.liveBuggies],
  );

  const [activeView, setActiveView] = useState<PanelView>("buggy");
  const [panelOpen, setPanelOpen] = useState(settings.openPanelOnDashboard);
  const [selectedBuggyId, setSelectedBuggyId] = useState<string | null>(null);
  const [mapFollowingBuggyId, setMapFollowingBuggyId] = useState<string | null>(
    null,
  );
  const [selectedHalteId, setSelectedHalteId] = useState<string | null>(null);
  const [userPosition, setUserPosition] = useState<{
    lat: number;
    lng: number;
  } | null>(null);

  // Toast notifications state
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authRedirectTo, setAuthRedirectTo] = useState("/");

  const openAuthModal = useCallback((next = "/") => {
    setAuthRedirectTo(next);
    setAuthModalOpen(true);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback((toast: Omit<ToastItem, "id">) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    setToasts((prev) => [...prev.slice(-4), { ...toast, id }]); // maks 5 toast sekaligus
  }, []);

  const requireDirectionLogin = useCallback(() => {
    if (userLoading) {
      addToast({
        tone: "info",
        title: "Memeriksa sesi",
        description: "Tunggu sebentar lalu coba lagi.",
        duration: 3_000,
      });
      return false;
    }

    if (isAuthenticated) {
      return true;
    }

    addToast({
      tone: "warning",
      title: "Login diperlukan",
      description: "Masuk terlebih dahulu untuk menggunakan pencarian rute.",
      duration: 5_000,
    });
    openAuthModal("/");
    return false;
  }, [addToast, isAuthenticated, openAuthModal, userLoading]);

  const handleLogout = useCallback(async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    setDirectionResult(null);
    setFromInput("");
    setToInput("");
    setSearchStep("destination");
    router.push("/");
    router.refresh();
  }, [router]);

  // Search state
  const [searchStep, setSearchStep] = useState<"destination" | "origin">(
    "destination",
  );
  const [fromInput, setFromInput] = useState("");
  const [toInput, setToInput] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [directionResult, setDirectionResult] =
    useState<DirectionResult | null>(null);

  const handleSelectView = (view: PanelView) => {
    setActiveView(view);
    setPanelOpen(true);
  };

  const handleUpdateSetting = useCallback(
    <Key extends keyof AdminSettings>(key: Key, value: AdminSettings[Key]) => {
      updateSetting(key, value);
      if (key === "openPanelOnDashboard") {
        setPanelOpen(Boolean(value));
      }
    },
    [updateSetting],
  );

  const handleInfoWindowClose = useCallback(() => {
    setMapFollowingBuggyId(null);
  }, []);

  const handleBuggyMarkerClick = useCallback((buggyId: string) => {
    setPanelOpen(true);
    setActiveView("buggy");
    setSelectedBuggyId(buggyId);
    setMapFollowingBuggyId(buggyId);
  }, []);

  const handleHalteMarkerClick = useCallback((halteId: string) => {
    setPanelOpen(true);
    setActiveView("halte");
    setSelectedHalteId(halteId);
  }, []);

  const handleFocusBuggy = useCallback((buggyId: string) => {
    setSelectedBuggyId(buggyId);
    setMapFollowingBuggyId(buggyId);
  }, []);

  const handleSelectBuggy = useCallback((buggyId: string) => {
    setSelectedBuggyId(buggyId);
    setMapFollowingBuggyId(buggyId);
  }, []);

  const handleSelectHalte = useCallback((halteId: string) => {
    setSelectedHalteId(halteId);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined" || !("geolocation" in navigator)) return;

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setUserPosition({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
      },
      () => {
        // noop: keep fallback position
      },
      {
        enableHighAccuracy: false,
        timeout: 8000,
        maximumAge: 60_000,
      },
    );
  }, []);

  // ── Nearby bus alert ──────────────────────────────────────────────────────
  useNearbyBusAlert({
    buggies: liveBuggies,
    userPosition,
    onAlert: ({ busName, halteName, distanceMeters }) => {
      addToast({
        tone: "bus",
        title: `${busName} mendekati halte Anda`,
        description: `${halteName} · ${distanceMeters} m lagi`,
        duration: 7_000,
      });
    },
  });

  const nearestHalteRecommendations = useMemo(() => {
    const fallbackPos = liveBuggies[0]?.position ?? {
      lat: HALTE_LOCATIONS[0].lat,
      lng: HALTE_LOCATIONS[0].lng,
    };
    const sourcePos = userPosition ?? fallbackPos;

    return HALTE_LOCATIONS.map((halte) => ({
      ...halte,
      distanceMeters: haversineMeters(sourcePos, {
        lat: halte.lat,
        lng: halte.lng,
      }),
    }))
      .sort((a, b) => a.distanceMeters - b.distanceMeters)
      .slice(0, 3);
  }, [liveBuggies, userPosition]);

  const getLatestUserPosition = useCallback(async () => {
    if (typeof window === "undefined" || !("geolocation" in navigator)) {
      return userPosition;
    }

    return new Promise<{ lat: number; lng: number } | null>((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const latest = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          };
          setUserPosition(latest);
          resolve(latest);
        },
        () => resolve(userPosition),
        {
          enableHighAccuracy: true,
          timeout: 8000,
          maximumAge: 15_000,
        },
      );
    });
  }, [userPosition]);

  const handleRecommendedHalteDirection = useCallback(
    async (halteId: string) => {
      if (!requireDirectionLogin()) return;

      const destinationHalte =
        HALTE_LOCATIONS.find((halte) => halte.id === halteId) ?? null;
      if (!destinationHalte) return;

      setIsSearching(true);

      try {
        if (
          !(window as Window & { google?: { maps?: unknown } }).google?.maps
        ) {
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
        const originHalte = mapsService.findNearestHalte(
          currentPos,
          HALTE_LOCATIONS,
        );
        if (!originHalte) {
          alert("Halte asal terdekat tidak ditemukan.");
          return;
        }

        const walkToOriginHalte = await mapsService.getWalkingDirections(
          currentPos,
          { lat: originHalte.lat, lng: originHalte.lng },
        );

        const originIdx = HALTE_LOCATIONS.findIndex(
          (h) => h.id === originHalte.id,
        );
        const destIdx = HALTE_LOCATIONS.findIndex(
          (h) => h.id === destinationHalte.id,
        );
        if (originIdx < 0 || destIdx < 0) {
          return;
        }

        const routeStopNames: string[] = [];
        let cursor = originIdx;
        while (true) {
          routeStopNames.push(HALTE_LOCATIONS[cursor].name);
          if (cursor === destIdx) break;
          cursor = (cursor + 1) % HALTE_LOCATIONS.length;
        }

        const busRoutePath = getRouteBetweenHaltes(
          originHalte.lat,
          originHalte.lng,
          destinationHalte.lat,
          destinationHalte.lng,
        );

        const nearest = liveBuggies.reduce((best, buggy) => {
          if (!best) return buggy;
          return dist(buggy.position, originHalte) <
            dist(best.position, originHalte)
            ? buggy
            : best;
        }, liveBuggies[0]);

        setFromInput("Lokasi Saya");
        setToInput(destinationHalte.name);
        setSearchStep("origin");
        setSelectedHalteId(destinationHalte.id);

        setDirectionResult({
          originName: "Lokasi Saya",
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
        });

        if (nearest) {
          setSelectedBuggyId(nearest.id);
          setMapFollowingBuggyId(nearest.id);
        }
        setActiveView("buggy");
        setPanelOpen(true);
      } catch (err) {
        console.error("Recommendation direction error:", err);
        alert("Terjadi kesalahan saat membuat rute dari lokasi Anda.");
      } finally {
        setIsSearching(false);
      }
    },
    [getLatestUserPosition, liveBuggies, requireDirectionLogin],
  );

  // ── Direction search ─────────────────────────────────────────────────────

  const handleDirectionSearch = async () => {
    if (!requireDirectionLogin()) return;

    if (searchStep === "destination") {
      if (!normalize(toInput)) return;
      setSearchStep("origin");
      return;
    }

    setIsSearching(true);

    try {
      if (!(window as Window & { google?: { maps?: unknown } }).google?.maps) {
        alert("Google Maps belum loading. Coba lagi.");
        setIsSearching(false);
        return;
      }

      const mapsService = GoogleMapsService.fromWindow();

      // Resolve origin
      let originHalte = findHalteByQuery(fromInput);
      let walkingToHalte: DirectionResult["walkingToHalte"];
      let originPos: { lat: number; lng: number };

      // Jika fromInput kosong, otomatis gunakan posisi GPS user
      const effectiveFrom = normalize(fromInput);
      if (!effectiveFrom) {
        const currentPos = await getLatestUserPosition();
        if (currentPos) {
          originPos = currentPos;
          setFromInput("Lokasi Saya");
          originHalte = mapsService.findNearestHalte(
            currentPos,
            HALTE_LOCATIONS,
          );
          if (!originHalte) {
            alert("Halte terdekat dari lokasi Anda tidak ditemukan.");
            setIsSearching(false);
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
        } else {
          alert("Aktifkan izin lokasi atau ketik lokasi asal Anda.");
          setIsSearching(false);
          return;
        }
      } else if (!originHalte) {
        const geocoded = await mapsService.geocodePlace(fromInput);
        if (!geocoded) {
          alert(
            `Lokasi "${fromInput}" tidak ditemukan. Coba nama lengkap + UNDIP.`,
          );
          setIsSearching(false);
          return;
        }
        originPos = { lat: geocoded.lat, lng: geocoded.lng };
        originHalte = mapsService.findNearestHalte(geocoded, HALTE_LOCATIONS);
        if (!originHalte) {
          setIsSearching(false);
          return;
        }

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

      // Resolve destination
      let destHalte = findHalteByQuery(toInput);
      let walkingFromHalte: DirectionResult["walkingFromHalte"];
      let destPos: { lat: number; lng: number };

      if (!destHalte) {
        const geocoded = await mapsService.geocodePlace(toInput);
        if (!geocoded) {
          alert(
            `Lokasi "${toInput}" tidak ditemukan. Coba nama lengkap + UNDIP.`,
          );
          setIsSearching(false);
          return;
        }
        destPos = { lat: geocoded.lat, lng: geocoded.lng };
        destHalte = mapsService.findNearestHalte(geocoded, HALTE_LOCATIONS);
        if (!destHalte) {
          setIsSearching(false);
          return;
        }

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

      // Calculate bus route between haltes — using actual road path
      const originIdx = HALTE_LOCATIONS.findIndex(
        (h) => h.id === originHalte?.id,
      );
      const destIdx = HALTE_LOCATIONS.findIndex((h) => h.id === destHalte?.id);
      if (originIdx < 0 || destIdx < 0) {
        setIsSearching(false);
        return;
      }

      // Get stop names
      const routeStopNames: string[] = [];
      let cursor = originIdx;
      while (true) {
        routeStopNames.push(HALTE_LOCATIONS[cursor].name);
        if (cursor === destIdx) break;
        cursor = (cursor + 1) % HALTE_LOCATIONS.length;
      }

      // Get actual road path between the two haltes
      const busRoutePath = getRouteBetweenHaltes(
        originHalte!.lat,
        originHalte!.lng,
        destHalte!.lat,
        destHalte!.lng,
      );

      // Find nearest buggy (optional — direction works without active buggies)
      const nearest = liveBuggies.reduce((best, b) => {
        if (!best) return b;
        return dist(b.position, originHalte!) <
          dist(best.position, originHalte!)
          ? b
          : best;
      }, liveBuggies[0]);

      setDirectionResult({
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
      });

      if (nearest) {
        setSelectedBuggyId(nearest.id);
        setMapFollowingBuggyId(nearest.id);
      }
      setActiveView("buggy");
      setPanelOpen(true);
    } catch (err) {
      console.error("Direction search error:", err);
      alert("Terjadi kesalahan saat mencari rute.");
    } finally {
      setIsSearching(false);
    }
  };

  const handleBackToDestination = () => {
    setSearchStep("destination");
    setFromInput("");
    setDirectionResult(null);
  };

  // Map data
  const mapBuggies = activeView === "halte" ? [] : liveBuggies;
  const mapRoutePath = activeView === "buggy" ? OFFICIAL_ROUTE_PATH : [];
  const mapDirectionPath =
    activeView === "buggy" ? (directionResult?.directionPath ?? []) : [];

  return (
    <main className="fixed inset-0 overflow-hidden bg-slate-100">
      <MapCanvas
        buggies={mapBuggies}
        haltes={HALTE_LOCATIONS}
        routePath={mapRoutePath}
        directionPath={mapDirectionPath}
        walkingToHaltePath={directionResult?.walkingToHalte?.path}
        walkingFromHaltePath={directionResult?.walkingFromHalte?.path}
        originMarkerPosition={directionResult?.originPosition}
        destinationMarkerPosition={directionResult?.destinationPosition}
        selectedBuggyId={mapFollowingBuggyId}
        selectedHalteId={selectedHalteId}
        onInfoWindowClose={handleInfoWindowClose}
        onBuggyMarkerClick={handleBuggyMarkerClick}
        onHalteMarkerClick={handleHalteMarkerClick}
        focusHaltes={activeView === "halte"}
      />

      {/* Gradient overlay for mobile view */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-20 h-52 bg-linear-to-b from-slate-900/45 via-slate-900/20 to-transparent xl:hidden" />

      <section
        className="absolute inset-x-0 z-40 flex items-center justify-between px-4 xl:hidden"
        style={{ top: "calc(0.75rem + var(--sai-top, 0px))" }}
      >
        <h1 className="text-[26px] font-bold tracking-tight text-white drop-shadow-md">
          SIMOBI
        </h1>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => handleSelectView("notifikasi")}
            aria-label="Notifikasi"
            className="relative flex h-10 w-10 items-center justify-center rounded-full border border-white/20 bg-slate-900/50 text-white backdrop-blur-md transition active:scale-95"
          >
            <BellIcon className="h-5 w-5" />
          </button>
          {userProfile ? (
            <button
              onClick={() => handleSelectView("settings")}
              aria-label="Profile"
              className="grid size-10 place-items-center rounded-full border border-white/20 bg-[#0f1a3b] text-sm font-black text-white shadow-sm transition active:scale-95"
            >
              {userProfile.avatar}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => openAuthModal("/admin")}
              aria-label="Login admin"
              className="relative flex h-10 w-10 items-center justify-center rounded-full border border-white/20 bg-slate-900/50 text-white backdrop-blur-md transition active:scale-95"
            >
              <LoginIcon className="h-5 w-5" />
            </button>
          )}
        </div>
      </section>

      <section
        className={`absolute left-1/2 z-40 w-[min(92vw,420px)] -translate-x-1/2 xl:hidden ${
          searchStep === "origin" ? "top-40" : "top-28"
        }`}
      >
        <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {nearestHalteRecommendations.map((halte) => (
            <button
              key={halte.id}
              type="button"
              className="shrink-0 flex items-center gap-2 rounded-full border border-white/35 bg-slate-900/50 px-3 py-1.5 text-white backdrop-blur-md transition active:scale-[0.98]"
              onClick={() => void handleRecommendedHalteDirection(halte.id)}
            >
              <MapPinSolidIcon className="h-4 w-4 shrink-0 text-white" />
              <p className="text-[12px] font-bold leading-none">{halte.name}</p>
            </button>
          ))}
        </div>
      </section>

      <div className="absolute right-3 top-3 z-20 hidden items-center justify-end gap-2 xl:right-4 xl:top-4 xl:flex">
        {userProfile ? (
          <button
            type="button"
            aria-label="Menu account"
            onClick={() => handleSelectView("settings")}
            className="flex w-full items-center gap-3 rounded-full border border-white/60 bg-white px-3 py-2 text-left shadow-[0_10px_30px_rgba(15,23,42,0.12)] backdrop-blur-xl transition hover:bg-white/90 active:scale-[0.98]"
          >
            <div className="grid size-8 place-items-center rounded-full bg-[#0f1a3b] text-sm font-black text-white">
              {userProfile.avatar}
            </div>
            <div className="min-w-0 pr-1">
              <p className="text-[13px] font-extrabold leading-tight text-slate-900">
                {userProfile.name}
              </p>
              <p className="text-[10px] font-semibold leading-tight text-slate-400">
                {userProfile.role}
              </p>
            </div>
          </button>
        ) : (
          <button
            type="button"
            aria-label="Settings"
            onClick={() => openAuthModal("/admin")}
            className="flex w-full items-center gap-2 rounded-full border border-white/60 bg-white px-2 py-2 text-left shadow-[0_10px_30px_rgba(15,23,42,0.12)] backdrop-blur-xl transition hover:bg-white/90 active:scale-[0.98]"
          >
            <div className="grid size-8 place-items-center rounded-full bg-[#0f1a3b] text-sm font-black text-white">
              <LoginIcon className="size-4" />
            </div>
            <div className="min-w-0 pr-1">
              <p className="text-[13px] font-extrabold leading-tight text-slate-900">
                Login
              </p>
              <p className="text-[10px] font-semibold leading-tight text-slate-400">
                Login disini
              </p>
            </div>
          </button>
        )}
      </div>

      <FloatingSidebar
        activeView={activeView}
        onSelectView={handleSelectView}
        onLogin={() => openAuthModal("/admin")}
      />

      <LiveSearchBar
        fromValue={fromInput}
        toValue={toInput}
        onFromChange={setFromInput}
        onToChange={(val) => {
          setToInput(val);
          setDirectionResult(null);
        }}
        onSubmit={handleDirectionSearch}
        showOriginField={searchStep === "origin"}
        onBackToDestination={handleBackToDestination}
        panelOpen={panelOpen}
        isSearching={isSearching}
        mobileTopClass="top-14"
      />

      <BuggyList
        buggies={liveBuggies}
        panelOpen={panelOpen}
        activeView={activeView}
        onClose={() => setPanelOpen(false)}
        selectedBuggyId={selectedBuggyId}
        selectedHalteId={selectedHalteId}
        onFocusBuggy={handleFocusBuggy}
        onSelectBuggy={handleSelectBuggy}
        onSelectHalte={handleSelectHalte}
        directionResult={directionResult}
        onCloseDirection={() => setDirectionResult(null)}
        settingsViewContent={
          <AppSettingsPanel
            mode="public"
            settings={settings}
            onUpdateSetting={handleUpdateSetting}
            onLogin={() => openAuthModal("/")}
            onLogout={handleLogout}
          />
        }
      />

      <MobileBottomNav
        activeView={activeView}
        onSelectView={handleSelectView}
        onDragOpenPanel={() => setPanelOpen(true)}
      />

      {/* Toast notifications */}
      <ToastStack toasts={toasts} onDismiss={dismissToast} />
      <AuthModal
        open={authModalOpen}
        redirectTo={authRedirectTo}
        onClose={() => setAuthModalOpen(false)}
      />
    </main>
  );
}
