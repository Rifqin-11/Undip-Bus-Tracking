"use client";

import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import type { Buggy, PanelView } from "@/types/buggy";
import { HALTE_LOCATIONS } from "@/lib/transit/buggy-data";
import { BuggyCard } from "@/components/buggy/BuggyCard";
import { BuggyDetailView } from "@/components/buggy/BuggyDetailView";
import { PanelShell } from "@/components/panel/PanelShell";
import { MobileDrawer } from "@/components/panel/MobileDrawer";
import { HalteSection } from "@/components/panel/HalteSection";
import { HalteDetailView } from "@/components/panel/HalteDetailView";
import { RuteSection } from "@/components/panel/RuteSection";
import { InfoSection } from "@/components/panel/InfoSection";
import { DirectionPanel } from "@/components/panel/DirectionPanel";
import type { DirectionResult } from "@/components/panel/DirectionPanel";
import { activeFleetLabel } from "@/lib/presenters/crowd-presenter";

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
}: BuggyListProps) {
  const [buggyViewMode, setBuggyViewMode] = useState<"list" | "detail">("list");
  const [halteViewMode, setHalteViewMode] = useState<"list" | "detail">("list");
  const [selectedHalteIdLocal, setSelectedHalteIdLocal] = useState<
    string | null
  >(null);

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

  // ── Desktop Layout ──────────────────────────────────────────────────────────
  const desktopMainContent = (
    <>
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
              {activeFleetLabel(buggies)}
            </span>
          </div>
          <div className="space-y-3">
            {buggies.map((buggy) => (
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
        </div>
      ) : null}

      {/* On desktop, Detail view replaces Halte list (same flow as mobile) */}
      {activeView === "halte" && halteViewMode === "detail" && selectedHalte ? (
        <HalteDetailView
          halte={selectedHalte}
          halteIndex={selectedHalteIndex}
          onBack={handleBackToHalteList}
        />
      ) : activeView === "halte" ? (
        <HalteSection onSelectHalte={handleSelectHalte} />
      ) : null}
      {activeView === "rute" && <RuteSection buggies={buggies} />}
      {activeView === "info" && <InfoSection />}
      {activeView === "data" && dataViewContent}
    </>
  );

  // ── Mobile Layout (Inline Detail View for Halte) ───────────────────────────
  const mobileContent = (
    <>
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
              {activeFleetLabel(buggies)}
            </span>
          </div>
          <div className="space-y-3">
            {buggies.map((buggy) => (
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
        </div>
      ) : null}

      {/* On mobile, Detail view REPLACES the List view */}
      {activeView === "halte" && halteViewMode === "detail" && selectedHalte ? (
        <HalteDetailView
          halte={selectedHalte}
          halteIndex={selectedHalteIndex}
          onBack={handleBackToHalteList}
        />
      ) : activeView === "halte" ? (
        <HalteSection onSelectHalte={handleSelectHalte} />
      ) : null}

      {activeView === "rute" && <RuteSection buggies={buggies} />}
      {activeView === "info" && <InfoSection />}
      {activeView === "data" && dataViewContent}
    </>
  );

  return (
    <>
      {/* Desktop — main panel */}
      {panelOpen && (
        <PanelShell onClose={onClose}>{desktopMainContent}</PanelShell>
      )}

      {/* Mobile — bottom drawer (hidden on desktop) */}
      <MobileDrawer open={panelOpen} onClose={onClose}>
        {mobileContent}
      </MobileDrawer>
    </>
  );
}
