"use client";

import { useEffect, useState, useMemo } from "react";
import type { ReactNode } from "react";
import type { Buggy, PanelView } from "@/types/buggy";
import { HALTE_LOCATIONS } from "@/lib/transit/buggy-data";
import { haversineMeters } from "@/lib/transit/buggy-route-utils";

type LatLng = {
  lat: number;
  lng: number;
};
import { BuggyCard } from "@/components/buggy/BuggyCard";
import { BuggyDetailView } from "@/components/buggy/BuggyDetailView";
import { PanelContainer } from "@/components/panel/PanelContainer";
import { HalteSection } from "@/components/halte/HalteSection";
import { HalteDetailView } from "@/components/halte/HalteDetailView";
import { DirectionPanel } from "@/components/panel/DirectionPanel";
import type { DirectionResult } from "@/components/panel/DirectionPanel";


type BuggyListProps = {
  buggies: Buggy[];
  panelOpen: boolean;
  activeView: PanelView;
  onClose: () => void;
  selectedBuggyId: string | null;
  selectedHalteId?: string | null;
  onFocusBuggy: (buggyId: string) => void;
  onSelectBuggy: (buggyId: string) => void;
  onSelectHalte?: (halteId: string) => void;
  directionResult?: DirectionResult | null;
  onCloseDirection?: () => void;
  dataViewContent?: ReactNode;
  dataDetailViewContent?: ReactNode;
  historyViewContent?: ReactNode;
};

export function BuggyList({
  buggies,
  panelOpen,
  activeView,
  onClose,
  selectedBuggyId,
  selectedHalteId = null,
  onFocusBuggy,
  onSelectBuggy,
  onSelectHalte,
  directionResult = null,
  onCloseDirection,
  dataViewContent,
  dataDetailViewContent,
  historyViewContent,
}: BuggyListProps) {
  const [buggyViewMode, setBuggyViewMode] = useState<"list" | "detail">("list");
  const [halteViewMode, setHalteViewMode] = useState<"list" | "detail">("list");
  const [selectedHalteIdLocal, setSelectedHalteIdLocal] = useState<
    string | null
  >(null);

  const [userLocation, setUserLocation] = useState<LatLng | null>(null);

  useEffect(() => {
    if (!navigator.geolocation) return;

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setUserLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
      },
      (error) => {
        console.warn("Lokasi pengguna tidak terdeteksi:", error);
      },
    );
  }, []);

  const sortedBuggies = useMemo(() => {
    const byBuggyNumber = (a: Buggy, b: Buggy) => {
      const getNumber = (id: string) => {
        const match = id.match(/\d+/);
        return match ? Number(match[0]) : Number.MAX_SAFE_INTEGER;
      };
      return getNumber(a.id) - getNumber(b.id);
    };

    const sortByDistance = (origin: LatLng) =>
      [...buggies].sort((a, b) => {
        const distA = haversineMeters(origin, a.position);
        const distB = haversineMeters(origin, b.position);

        if (distA === distB) return byBuggyNumber(a, b);
        return distA - distB;
      });

    const originHaltePosition = directionResult?.walkingToHalte
      ? (() => {
          const halte = HALTE_LOCATIONS.find(
            (h) => h.name === directionResult.walkingToHalte?.originHalteName,
          );
          return halte ? { lat: halte.lat, lng: halte.lng } : null;
        })()
      : null;

    if (originHaltePosition) {
      return sortByDistance(originHaltePosition);
    }

    if (!userLocation) {
      return [...buggies].sort(byBuggyNumber);
    }

    return sortByDistance(userLocation);
  }, [buggies, userLocation, directionResult]);

  const activeSortedBuggies = useMemo(
    () => sortedBuggies.filter((buggy) => buggy.isActive),
    [sortedBuggies],
  );

  const selectedBuggy = selectedBuggyId
    ? (buggies.find((b) => b.id === selectedBuggyId) ?? null)
    : null;

  const selectedHalte = selectedHalteIdLocal
    ? (HALTE_LOCATIONS.find((h) => h.id === selectedHalteIdLocal) ?? null)
    : null;

  const selectedHalteIndex = selectedHalte
    ? HALTE_LOCATIONS.findIndex((h) => h.id === selectedHalte.id)
    : -1;

  const handleSelectHalte = (halteId: string) => {
    setSelectedHalteIdLocal(halteId);
    setHalteViewMode("detail");
    onSelectHalte?.(halteId);
  };

  const handleBackToHalteList = () => {
    setHalteViewMode("list");
    setSelectedHalteIdLocal(null);
  };

  useEffect(() => {
    if (activeView !== "halte") return;
    if (!selectedHalteId) return;

    setSelectedHalteIdLocal(selectedHalteId);
    setHalteViewMode("detail");
  }, [activeView, selectedHalteId]);

  return (
    <PanelContainer open={panelOpen} onClose={onClose}>
      {directionResult && onCloseDirection && (
        <div className="mb-3">
          <DirectionPanel
            result={directionResult}
            buggies={buggies}
            onClose={onCloseDirection}
          />
        </div>
      )}

      {activeView === "buggy" && buggyViewMode === "detail" && selectedBuggy ? (
        <BuggyDetailView
          buggy={selectedBuggy}
          onBack={() => setBuggyViewMode("list")}
        />
      ) : activeView === "buggy" ? (
        <div className="rounded-3xl border border-slate-200/80 bg-white/70 p-3">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-[17px] font-semibold text-slate-900">
              Pilih Armada
            </h2>
            <span className="rounded-full bg-[#0f1a3b] px-2.5 py-1 text-[10px] font-semibold text-white">
              {`${activeSortedBuggies.length} unit`}
            </span>
          </div>
          {activeSortedBuggies.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-3 text-center text-[13px] text-slate-500">
              tidak ada buggy yang aktif saat ini
            </p>
          ) : (
            <div className="space-y-3">
              {activeSortedBuggies.map((buggy) => (
                <BuggyCard
                  key={buggy.id}
                  buggy={buggy}
                  isSelected={selectedBuggyId === buggy.id}
                  onFocus={onFocusBuggy}
                  onSelect={(id) => {
                    onSelectBuggy(id);
                    setBuggyViewMode("detail");
                  }}
                />
              ))}
            </div>
          )}
        </div>
      ) : null}

      {/* On desktop and mobile, Detail view replaces Halte list */}
      {activeView === "halte" && halteViewMode === "detail" && selectedHalte ? (
        <HalteDetailView
          halte={selectedHalte}
          halteIndex={selectedHalteIndex}
          onBack={handleBackToHalteList}
        />
      ) : activeView === "halte" ? (
        <HalteSection onSelectHalte={handleSelectHalte} />
      ) : null}

      {activeView === "notifikasi" && (
        <div className="rounded-3xl border border-slate-200/80 bg-white/70 p-5 text-center">
          <p className="text-[15px] font-semibold text-slate-700">Notifikasi</p>
          <p className="mt-1 text-[12px] text-slate-400">
            Belum ada notifikasi baru.
          </p>
        </div>
      )}
      {activeView === "lapor" && (
        <div className="rounded-3xl border border-slate-200/80 bg-white/70 p-5 text-center">
          <p className="text-[15px] font-semibold text-slate-700">
            Lapor Masalah
          </p>
          <p className="mt-1 text-[12px] text-slate-400">
            Fitur pelaporan segera hadir.
          </p>
        </div>
      )}
      {activeView === "data" && dataViewContent}
      {activeView === "data-detail" && dataDetailViewContent}
      {activeView === "history" && historyViewContent}
    </PanelContainer>
  );
}
