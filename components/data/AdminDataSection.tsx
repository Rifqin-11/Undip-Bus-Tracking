"use client";

import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { Buggy } from "@/types/buggy";
import type { Geofence, GeofenceEvent } from "@/types/geofence";
import type { LatLngLiteral } from "@/types/map-canvas";
import { AdminBuggyCard } from "./AdminBuggyCard";
import { AdminStatisticsPanel } from "./AdminStatisticsPanel";
import { GeofenceManager } from "./GeofenceManager";
import { GeofenceEventLog } from "./GeofenceEventLog";
import { AdminBuggyFormPanel } from "./AdminBuggyFormPanel";
import { PlusIcon } from "lucide-react";

export type AdminDataPanel = "statistics" | "buggy" | "geofence";

type AdminDataSectionProps = {
  buggies: Buggy[];
  realtimeConnected: boolean;
  realtimeSource: string;
  geofences: Geofence[];
  events: GeofenceEvent[];
  geofenceStatuses: Record<string, string[]>;
  geofenceLoading: boolean;
  geofenceCreateMode: boolean;
  draftGeofence: { center: LatLngLiteral; radiusMeters: number } | null;
  draftName: string;
  browserNotificationEnabled: boolean;
  onSelectBuggy: (buggyId: string) => void;
  onToggleCreateMode: () => void;
  onDraftNameChange: (name: string) => void;
  onDraftRadiusChange: (radiusMeters: number) => void;
  onSaveDraft: () => void;
  onCancelDraft: () => void;
  onToggleGeofence: (id: string, enabled: boolean) => void;
  onEditGeofence: (geofence: Geofence) => void;
  onDeleteGeofence: (id: string) => Promise<boolean> | boolean;
  onToggleBrowserNotification: () => void;
  compactMode?: boolean;
  readOnly?: boolean;
  /** Dipanggil setelah add atau delete buggy agar parent dapat refresh list */
  onBuggyMutated?: () => void;
  /** Optional controlled active panel (agar state bertahan lintas mount/unmount) */
  activePanel?: AdminDataPanel;
  onActivePanelChange?: (panel: AdminDataPanel) => void;
};

export function AdminDataSection({
  buggies,
  geofences,
  events,
  geofenceStatuses,
  geofenceLoading,
  geofenceCreateMode,
  draftGeofence,
  draftName,
  browserNotificationEnabled,
  onSelectBuggy,
  onToggleCreateMode,
  onDraftNameChange,
  onDraftRadiusChange,
  onSaveDraft,
  onCancelDraft,
  onToggleGeofence,
  onEditGeofence,
  onDeleteGeofence,
  onToggleBrowserNotification,
  compactMode = false,
  readOnly = false,
  onBuggyMutated,
  activePanel: controlledActivePanel,
  onActivePanelChange,
}: AdminDataSectionProps) {
  const { t } = useTranslation("admin");
  const { t: tCommon } = useTranslation("common");
  const [isAddingBuggy, setIsAddingBuggy] = useState(false);
  const [internalActivePanel, setInternalActivePanel] =
    useState<AdminDataPanel>("statistics");
  const activePanel = controlledActivePanel ?? internalActivePanel;
  const setActivePanel = (panel: AdminDataPanel) => {
    if (controlledActivePanel === undefined) {
      setInternalActivePanel(panel);
    }
    onActivePanelChange?.(panel);
  };

  const tabs: { id: AdminDataPanel; label: string }[] = [
    { id: "statistics", label: t("statistics") },
    { id: "buggy", label: t("buggy") },
    { id: "geofence", label: t("geofence") },
  ];

  return (
    <section className={compactMode ? "space-y-2" : "space-y-3"}>
      <div className="grid grid-cols-3 rounded-full border border-slate-200/80 bg-white/70 p-1.5 shadow-[0_8px_20px_rgba(15,23,42,0.04)]">
        {tabs.map((tab) => {
          const isActive = activePanel === tab.id;

          return (
            <button
              key={tab.id}
              type="button"
              aria-pressed={isActive}
              onClick={() => setActivePanel(tab.id)}
              className={`rounded-full px-3 py-2 text-[12px] font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300 ${
                isActive
                  ? "bg-[#0f1a3b] text-white shadow-sm"
                  : "text-slate-500 hover:bg-white/80 hover:text-slate-900"
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* ── Statistik Operasional ──────────────────────────────────────── */}
      {activePanel === "statistics" ? (
        <AdminStatisticsPanel buggies={buggies} />
      ) : null}

      {/* ── Data Operasional Buggy ─────────────────────────────────────── */}
      {activePanel === "buggy" ? (
        isAddingBuggy && !readOnly ? (
          <AdminBuggyFormPanel
            buggy={null}
            onBack={() => setIsAddingBuggy(false)}
            onSaved={() => {
              setIsAddingBuggy(false);
              onBuggyMutated?.();
            }}
          />
        ) : (
          <div
            className={`rounded-3xl border border-slate-200/80 bg-white/70 ${compactMode ? "p-2.5" : "p-3 lg:p-4"}`}
          >
            <div
              className={`mb-3 w-full rounded-[20px] border border-white/60 bg-white/40 px-3.5 shadow-[0_8px_20px_rgba(15,23,42,0.04)] backdrop-blur-md ${compactMode ? "py-2.5" : "py-3"}`}
            >
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-[17px] font-bold tracking-tight text-slate-900">
                  {tCommon("data")}
                </h2>
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-slate-200/80 px-2.5 py-1 text-[10px] font-semibold text-slate-700">
                    {tCommon("units", { count: buggies.length })}
                  </span>
                  {!readOnly ? (
                    <button
                      type="button"
                      onClick={() => setIsAddingBuggy(true)}
                      className="flex items-center gap-1 rounded-full border border-[#0f1a3b] bg-[#0f1a3b] px-3 py-2 text-[11px] font-bold text-white shadow-sm transition hover:bg-white hover:text-[#0f1a3b] active:scale-95"
                    >
                      <PlusIcon className="size-3" />
                    </button>
                  ) : null}
                </div>
              </div>
            </div>

            {buggies.length === 0 ? (
              <p className="py-4 text-center text-[12px] text-slate-400">
                {t("noBuggyData")}
              </p>
            ) : (
              <div className="space-y-2">
                {buggies.map((buggy) => (
                  <AdminBuggyCard
                    key={buggy.id}
                    buggy={buggy}
                    activeZones={geofenceStatuses[buggy.id] ?? []}
                    onClick={() => onSelectBuggy(buggy.id)}
                  />
                ))}
              </div>
            )}
          </div>
        )
      ) : null}

      {/* ── Manajemen Geofence ─────────────────────────────────────────── */}
      {activePanel === "geofence" ? (
        <>
          <GeofenceManager
            geofences={geofences}
            geofenceLoading={geofenceLoading}
            geofenceCreateMode={geofenceCreateMode}
            draftGeofence={draftGeofence}
            draftName={draftName}
            browserNotificationEnabled={browserNotificationEnabled}
            onToggleCreateMode={onToggleCreateMode}
            onDraftNameChange={onDraftNameChange}
            onDraftRadiusChange={onDraftRadiusChange}
            onSaveDraft={onSaveDraft}
            onCancelDraft={onCancelDraft}
            onToggleGeofence={onToggleGeofence}
            onEditGeofence={onEditGeofence}
            onDeleteGeofence={onDeleteGeofence}
            onToggleBrowserNotification={onToggleBrowserNotification}
            readOnly={readOnly}
          />

          {/* ── Event Geofence ─────────────────────────────────────────────── */}
          <GeofenceEventLog events={events} />
        </>
      ) : null}
    </section>
  );
}
