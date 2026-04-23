"use client";

import type { Buggy } from "@/types/buggy";
import type { Geofence, GeofenceEvent } from "@/types/geofence";
import type { LatLngLiteral } from "@/types/map-canvas";
import { AdminBuggyCard } from "./AdminBuggyCard";
import { GeofenceManager } from "./GeofenceManager";
import { GeofenceEventLog } from "./GeofenceEventLog";

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
}: AdminDataSectionProps) {
  return (
    <section className="space-y-3">
      {/* ── Data Operasional Buggy ─────────────────────────────────────── */}
      <div className="rounded-3xl border border-slate-200/80 bg-white/70 p-3 lg:p-4">
        <div className="mb-4 flex items-center justify-between gap-2">
          <h2 className="text-[17px] font-bold text-slate-900 tracking-tight">
            Data Operasional
          </h2>
          <span className="rounded-full bg-[#0f1a3b] px-2.5 py-1 text-[10px] font-semibold text-white">
            {buggies.length} armada
          </span>
        </div>

        {/* Filters */}
        {/* <div className="mb-4 flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
          <button type="button" className="flex items-center gap-2 rounded-full bg-white border-2 border-slate-100 px-4 py-1.5 hover:bg-slate-50 transition active:scale-95 shrink-0 text-slate-400">
             <span className="text-[10px]">🚍</span>
             <span className="text-[12px] font-semibold">Bus</span>
          </button>
          <button type="button" className="flex items-center gap-2 rounded-full bg-slate-800 border-2 border-slate-800 shadow-md px-4 py-1.5 hover:bg-slate-700 transition active:scale-95 shrink-0 text-white">
             <span className="text-[10px]">🛺</span>
             <span className="text-[12px] font-semibold tracking-wide">Buggy</span>
          </button>
          <button type="button" className="flex items-center gap-2 rounded-full bg-white border-2 border-slate-100 px-4 py-1.5 hover:bg-slate-50 transition active:scale-95 shrink-0 text-slate-400">
             <span className="text-[10px]">🚐</span>
             <span className="text-[12px] font-semibold">Minibus</span>
          </button>
        </div> */}

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
