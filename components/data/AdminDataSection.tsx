"use client";

import { useState } from "react";
import type { Buggy } from "@/types/buggy";
import type { Geofence, GeofenceEvent } from "@/types/geofence";
import type { LatLngLiteral } from "@/types/map-canvas";
import { AdminBuggyCard } from "./AdminBuggyCard";
import { GeofenceManager } from "./GeofenceManager";
import { GeofenceEventLog } from "./GeofenceEventLog";
import { AddBuggyModal } from "./AddBuggyModal";
import { PlusIcon } from "lucide-react";

type AdminDataSectionProps = {
  buggies: Buggy[];
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
  /** Dipanggil setelah add atau delete buggy agar parent dapat refresh list */
  onBuggyMutated?: () => void;
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
  onBuggyMutated,
}: AdminDataSectionProps) {
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  return (
    <section className="space-y-3">
      <AddBuggyModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onSuccess={() => {
          setIsAddModalOpen(false);
          onBuggyMutated?.();
        }}
      />

      {/* ── Data Operasional Buggy ─────────────────────────────────────── */}
      <div className="rounded-3xl border border-slate-200/80 bg-white/70 p-3 lg:p-4">
        <div className="mb-3 w-full rounded-[20px] border border-white/60 bg-white/40 backdrop-blur-md py-3 px-3.5 shadow-[0_8px_20px_rgba(15,23,42,0.04)]">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-[17px] font-bold text-slate-900 tracking-tight">
              Data Operasional
            </h2>
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-slate-200/80 px-2.5 py-1 text-[10px] font-semibold text-slate-700">
                {buggies.length} armada
              </span>
              <button
                type="button"
                onClick={() => setIsAddModalOpen(true)}
                className="flex items-center gap-1 rounded-full border border-[#0f1a3b] bg-[#0f1a3b] px-3 py-2 text-[11px] font-bold text-white shadow-sm transition hover:bg-white hover:text-[#0f1a3b] active:scale-95"
              >
                <PlusIcon className="size-3" />
              </button>
            </div>
          </div>
        </div>

        {buggies.length === 0 ? (
          <p className="py-4 text-center text-[12px] text-slate-400">
            Belum ada data buggy.
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

      {/* ── Manajemen Geofence ─────────────────────────────────────────── */}
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
      />

      {/* ── Event Geofence ─────────────────────────────────────────────── */}
      <GeofenceEventLog events={events} />
    </section>
  );
}
