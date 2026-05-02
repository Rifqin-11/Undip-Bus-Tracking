import { useState } from "react";
import type { Geofence } from "@/types/geofence";
import type { LatLngLiteral } from "@/types/map-canvas";
import { TrashIcon, PencilIcon } from "@/components/ui/Icons";
import { DeleteConfirmModal } from "@/components/ui/DeleteConfirmModal";
import { Plus, X } from "lucide-react";

type GeofenceManagerProps = {
  geofences: Geofence[];
  geofenceLoading: boolean;
  geofenceCreateMode: boolean;
  draftGeofence: { center: LatLngLiteral; radiusMeters: number } | null;
  draftName: string;
  browserNotificationEnabled: boolean;
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

export function GeofenceManager({
  geofences,
  geofenceLoading,
  geofenceCreateMode,
  draftGeofence,
  draftName,
  browserNotificationEnabled,
  onToggleCreateMode,
  onDraftNameChange,
  onDraftRadiusChange,
  onSaveDraft,
  onCancelDraft,
  onToggleGeofence,
  onEditGeofence,
  onDeleteGeofence,
  onToggleBrowserNotification,
}: GeofenceManagerProps) {
  const [pendingDeleteGeofence, setPendingDeleteGeofence] = useState<Geofence | null>(null);
  const [isDeletingGeofence, setIsDeletingGeofence] = useState(false);

  async function handleConfirmDeleteGeofence() {
    if (!pendingDeleteGeofence) {
      return;
    }

    setIsDeletingGeofence(true);
    try {
      const success = await onDeleteGeofence(pendingDeleteGeofence.id);
      if (success) {
        setPendingDeleteGeofence(null);
      }
    } finally {
      setIsDeletingGeofence(false);
    }
  }

  return (
    <div className="rounded-3xl border border-slate-200/80 bg-white/70 p-3">
      {/* Header + action buttons */}
      <div className="mb-3 flex items-start justify-between gap-2">
        <div>
          <h2 className="text-[17px] font-semibold text-slate-900">Manajemen Geofence</h2>
          <p className="text-[11px] text-slate-400">{geofences.length} zona terdaftar</p>
        </div>
        <div className="flex gap-1.5">
          <button
            type="button"
            onClick={onToggleCreateMode}
            className={`rounded-xl px-3 py-1.5 text-[12px] font-semibold transition active:scale-95 ${
              geofenceCreateMode
                ? "border border-rose-500 bg-rose-500 text-white hover:bg-white hover:text-rose-500"
                : "border border-[#0f1a3b] bg-[#0f1a3b] text-white hover:bg-white hover:text-[#0f1a3b]"
            }`}
          >
            {geofenceCreateMode ? <X className="size-4"/> : <Plus className="size-4"/>}
          </button>
        </div>
      </div>

      {/* Draft geofence form */}
      {geofenceCreateMode && draftGeofence && (
        <div className="mb-3 rounded-2xl border border-emerald-200 bg-emerald-50/60 p-3">
          <div className="mb-2 flex items-center gap-2">
            <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
            <p className="text-[11px] font-semibold text-emerald-700">
              Geser lingkaran di peta untuk posisi, tarik tepinya untuk ukuran
            </p>
          </div>

          {/* Koordinat (read-only) */}
          <p className="mb-3 font-mono text-[11px] text-slate-500">
            {draftGeofence.center.lat.toFixed(5)}, {draftGeofence.center.lng.toFixed(5)}
          </p>

          {/* Slider radius */}
          <div className="mb-3">
            <div className="mb-1 flex items-center justify-between">
              <label className="text-[11px] font-medium text-slate-500">Radius</label>
              <span className="rounded-lg bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
                {Math.round(draftGeofence.radiusMeters)} m
              </span>
            </div>
            <input
              type="range"
              min={10}
              max={1000}
              step={5}
              value={draftGeofence.radiusMeters}
              onChange={(e) => onDraftRadiusChange(Number(e.target.value))}
              className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-slate-200 accent-emerald-500"
            />
            <div className="mt-1 flex justify-between text-[9px] text-slate-400">
              <span>10 m</span>
              <span>500 m</span>
              <span>1000 m</span>
            </div>
          </div>

          {/* Nama input */}
          <div className="mb-3">
            <label className="mb-1 block text-[11px] font-medium text-slate-500">
              Nama Zona
            </label>
            <input
              className="h-9 w-full rounded-xl border border-slate-200 bg-white px-3 text-[13px] text-slate-800 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
              value={draftName}
              onChange={(e) => onDraftNameChange(e.target.value)}
              placeholder="cth. Parkiran FT"
              autoFocus
            />
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={onSaveDraft}
              className="flex-1 rounded-xl bg-emerald-600 py-2 text-[12px] font-semibold text-white transition hover:bg-emerald-700 active:scale-[0.98]"
            >
              Simpan Zona
            </button>
            <button
              type="button"
              onClick={onCancelDraft}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-[12px] font-medium text-slate-600 transition hover:border-slate-900 hover:bg-slate-900 hover:text-white active:scale-[0.98]"
            >
              Batal
            </button>
          </div>
        </div>
      )}

      {/* Geofence list */}
      {geofenceLoading ? (
        <p className="py-2 text-[12px] text-slate-400">Memuat zona...</p>
      ) : geofences.length === 0 ? (
        <p className="py-2 text-[12px] text-slate-400">
          Belum ada zona. Klik "Buat" untuk menambahkan.
        </p>
      ) : (
        <div className="space-y-2">
          {geofences.map((geofence) => (
            <div
              key={geofence.id}
              className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-3 py-2.5"
            >
              <div
                className={`h-2 w-2 shrink-0 rounded-full ${
                  geofence.enabled ? "bg-emerald-500" : "bg-slate-300"
                }`}
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-semibold text-slate-800">
                  {geofence.name}
                </p>
                <div className="mt-0.5 flex items-center gap-2">
                  <span className="text-[10px] text-slate-400">
                    {geofence.center.lat.toFixed(4)}, {geofence.center.lng.toFixed(4)}
                  </span>
                  <span className="rounded-full border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[9px] font-medium text-slate-500">
                    r {Math.round(geofence.radiusMeters)} m
                  </span>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {/* Toggle Switch */}
                <button
                  type="button"
                  onClick={() => onToggleGeofence(geofence.id, !geofence.enabled)}
                  className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-white/75 ${
                    geofence.enabled ? "bg-emerald-500" : "bg-slate-300"
                  }`}
                  role="switch"
                  aria-checked={geofence.enabled}
                >
                  <span className="sr-only">Toggle geofence</span>
                  <span
                    aria-hidden="true"
                    className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                      geofence.enabled ? "translate-x-4" : "translate-x-0"
                    }`}
                  />
                </button>

                {/* Actions Separator */}
                <div className="mx-1 h-4 w-px bg-slate-200" />

                {/* Edit Button */}
                <button
                  type="button"
                  onClick={() => onEditGeofence(geofence)}
                  className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 active:scale-95"
                  title="Edit Geofence"
                >
                  <PencilIcon className="h-3.5 w-3.5" />
                </button>

                {/* Delete Button */}
                <button
                  type="button"
                  onClick={() => setPendingDeleteGeofence(geofence)}
                  className="rounded-lg p-1.5 text-rose-400 transition hover:bg-rose-50 hover:text-rose-600 active:scale-95"
                  title="Hapus Geofence"
                >
                  <TrashIcon className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <DeleteConfirmModal
        open={pendingDeleteGeofence !== null}
        title="Hapus Geofence?"
        description="Data geofence di bawah ini akan dihapus permanen dari server. Tindakan ini tidak dapat dibatalkan."
        confirmLabel="Ya, Hapus Geofence"
        loadingLabel="Menghapus..."
        isLoading={isDeletingGeofence}
        onClose={() => setPendingDeleteGeofence(null)}
        onConfirm={handleConfirmDeleteGeofence}
      >
        {pendingDeleteGeofence ? (
          <div className="rounded-2xl border border-rose-100 bg-rose-50/60 p-3 text-left">
            <p className="truncate text-[13px] font-semibold text-slate-800">{pendingDeleteGeofence.name}</p>
            <p className="mt-1 text-[11px] text-slate-500">
              {pendingDeleteGeofence.center.lat.toFixed(5)}, {pendingDeleteGeofence.center.lng.toFixed(5)}
            </p>
            <p className="mt-1 inline-flex rounded-full border border-rose-200 bg-white px-2 py-0.5 text-[10px] font-semibold text-rose-600">
              Radius {Math.round(pendingDeleteGeofence.radiusMeters)} m
            </p>
          </div>
        ) : null}
      </DeleteConfirmModal>
    </div>
  );
}
