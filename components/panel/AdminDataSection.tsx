"use client";

import type { Buggy } from "@/types/buggy";
import { getBuggyStopNameAtOffset } from "@/lib/transit/buggy-route-utils";
import type { Geofence, GeofenceEvent } from "@/types/geofence";

type AdminDataSectionProps = {
  buggies: Buggy[];
  geofences: Geofence[];
  events: GeofenceEvent[];
  geofenceStatuses: Record<string, string[]>;
  geofenceLoading: boolean;
  geofenceCreateMode: boolean;
  pendingCenter: { lat: number; lng: number } | null;
  pendingName: string;
  pendingRadiusMeters: number;
  browserNotificationEnabled: boolean;
  onToggleCreateMode: () => void;
  onPendingNameChange: (name: string) => void;
  onPendingRadiusChange: (radiusMeters: number) => void;
  onSavePending: () => void;
  onCancelPending: () => void;
  onToggleGeofence: (id: string, enabled: boolean) => void;
  onDeleteGeofence: (id: string) => void;
  onToggleBrowserNotification: () => void;
};

export function AdminDataSection({
  buggies,
  geofences,
  events,
  geofenceStatuses,
  geofenceLoading,
  geofenceCreateMode,
  pendingCenter,
  pendingName,
  pendingRadiusMeters,
  browserNotificationEnabled,
  onToggleCreateMode,
  onPendingNameChange,
  onPendingRadiusChange,
  onSavePending,
  onCancelPending,
  onToggleGeofence,
  onDeleteGeofence,
  onToggleBrowserNotification,
}: AdminDataSectionProps) {
  return (
    <section className="space-y-3">
      <div className="rounded-3xl border border-slate-200/80 bg-white/70 p-3">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="text-[17px] font-semibold text-slate-900">
            Data Operasional Buggy
          </h2>
          <span className="rounded-full bg-[#0f1a3b] px-2.5 py-1 text-[10px] font-semibold text-white">
            {buggies.length} armada
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-230 text-left text-[12px] text-slate-700">
            <thead>
              <tr className="border-b border-slate-200 text-[11px] uppercase tracking-[0.08em] text-slate-500">
                <th className="px-2 py-2">Kode</th>
                <th className="px-2 py-2">Nama</th>
                <th className="px-2 py-2">Posisi</th>
                <th className="px-2 py-2">Speed</th>
                <th className="px-2 py-2">ETA</th>
                <th className="px-2 py-2">Okupansi</th>
                <th className="px-2 py-2">Halte Saat Ini</th>
                <th className="px-2 py-2">Halte Berikutnya</th>
                <th className="px-2 py-2">Update</th>
                <th className="px-2 py-2">Status Geofence</th>
              </tr>
            </thead>
            <tbody>
              {buggies.map((buggy) => {
                const activeZones = geofenceStatuses[buggy.id] ?? [];
                return (
                  <tr
                    key={buggy.id}
                    className="border-b border-slate-100/80 align-top last:border-b-0"
                  >
                    <td className="px-2 py-2 font-semibold text-slate-900">
                      {buggy.code}
                    </td>
                    <td className="px-2 py-2">{buggy.name}</td>
                    <td className="px-2 py-2">
                      {buggy.position.lat.toFixed(5)},{" "}
                      {buggy.position.lng.toFixed(5)}
                    </td>
                    <td className="px-2 py-2">{buggy.speedKmh} km/h</td>
                    <td className="px-2 py-2">{buggy.etaMinutes} min</td>
                    <td className="px-2 py-2">
                      {buggy.passengers}/{buggy.capacity}
                    </td>
                    <td className="px-2 py-2">
                      {getBuggyStopNameAtOffset(buggy, 0)}
                    </td>
                    <td className="px-2 py-2">
                      {getBuggyStopNameAtOffset(buggy, 1)}
                    </td>
                    <td className="px-2 py-2">{buggy.updatedAt}</td>
                    <td className="px-2 py-2">
                      {activeZones.length > 0 ? activeZones.join(", ") : "-"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-3xl border border-slate-200/80 bg-white/70 p-3">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-[17px] font-semibold text-slate-900">
            Manajemen Geofence
          </h2>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className={`rounded-xl px-3 py-2 text-[12px] font-semibold text-white transition ${
                geofenceCreateMode
                  ? "bg-rose-600 hover:bg-rose-700"
                  : "bg-[#0f1a3b] hover:bg-[#162656]"
              }`}
              onClick={onToggleCreateMode}
            >
              {geofenceCreateMode ? "Matikan Mode Buat" : "Aktifkan Mode Buat"}
            </button>
            <button
              type="button"
              className={`rounded-xl px-3 py-2 text-[12px] font-semibold text-white transition ${
                browserNotificationEnabled
                  ? "bg-emerald-600 hover:bg-emerald-700"
                  : "bg-slate-600 hover:bg-slate-700"
              }`}
              onClick={onToggleBrowserNotification}
            >
              {browserNotificationEnabled
                ? "Browser Notification ON"
                : "Browser Notification OFF"}
            </button>
          </div>
        </div>

        {geofenceCreateMode && (
          <p className="mb-3 rounded-2xl border border-blue-200 bg-blue-50 px-3 py-2 text-[12px] text-blue-700">
            Klik peta untuk menentukan titik pusat geofence baru.
          </p>
        )}

        {pendingCenter && (
          <div className="mb-3 rounded-2xl border border-slate-200 bg-slate-50 p-3">
            <p className="mb-2 text-[12px] text-slate-700">
              Pusat: {pendingCenter.lat.toFixed(6)},{" "}
              {pendingCenter.lng.toFixed(6)}
            </p>
            <div className="grid gap-2 md:grid-cols-2">
              <input
                className="h-10 rounded-xl border border-slate-300 bg-white px-3 text-[13px] text-slate-800 outline-none focus:border-slate-500"
                value={pendingName}
                onChange={(e) => onPendingNameChange(e.target.value)}
                placeholder="Nama geofence"
              />
              <input
                type="number"
                min={1}
                className="h-10 rounded-xl border border-slate-300 bg-white px-3 text-[13px] text-slate-800 outline-none focus:border-slate-500"
                value={pendingRadiusMeters}
                onChange={(e) => onPendingRadiusChange(Number(e.target.value))}
                placeholder="Radius meter"
              />
            </div>
            <div className="mt-2 flex gap-2">
              <button
                type="button"
                className="rounded-xl bg-[#0f1a3b] px-3 py-2 text-[12px] font-semibold text-white transition hover:bg-[#162656]"
                onClick={onSavePending}
              >
                Simpan Geofence
              </button>
              <button
                type="button"
                className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-[12px] font-semibold text-slate-700 transition hover:bg-slate-50"
                onClick={onCancelPending}
              >
                Batal
              </button>
            </div>
          </div>
        )}

        <div className="space-y-2">
          {geofenceLoading ? (
            <p className="text-[12px] text-slate-500">Memuat geofence...</p>
          ) : geofences.length === 0 ? (
            <p className="text-[12px] text-slate-500">
              Belum ada geofence. Aktifkan mode buat lalu klik di peta.
            </p>
          ) : (
            geofences.map((geofence) => (
              <article
                key={geofence.id}
                className="rounded-2xl border border-slate-200 bg-white p-3"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="text-[14px] font-semibold text-slate-900">
                      {geofence.name}
                    </p>
                    <p className="text-[12px] text-slate-500">
                      {geofence.center.lat.toFixed(5)},{" "}
                      {geofence.center.lng.toFixed(5)} •{" "}
                      {Math.round(geofence.radiusMeters)} m
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      className={`rounded-lg px-2.5 py-1.5 text-[11px] font-semibold text-white ${
                        geofence.enabled
                          ? "bg-amber-500 hover:bg-amber-600"
                          : "bg-emerald-600 hover:bg-emerald-700"
                      }`}
                      onClick={() =>
                        onToggleGeofence(geofence.id, !geofence.enabled)
                      }
                    >
                      {geofence.enabled ? "Disable" : "Enable"}
                    </button>
                    <button
                      type="button"
                      className="rounded-lg bg-rose-600 px-2.5 py-1.5 text-[11px] font-semibold text-white hover:bg-rose-700"
                      onClick={() => onDeleteGeofence(geofence.id)}
                    >
                      Hapus
                    </button>
                  </div>
                </div>
              </article>
            ))
          )}
        </div>
      </div>

      <div className="rounded-3xl border border-slate-200/80 bg-white/70 p-3">
        <h2 className="mb-3 text-[17px] font-semibold text-slate-900">
          Event Geofence
        </h2>
        <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
          {events.length === 0 ? (
            <p className="text-[12px] text-slate-500">
              Belum ada event geofence.
            </p>
          ) : (
            events.map((event) => (
              <article
                key={event.id}
                className="rounded-2xl border border-slate-200 bg-white px-3 py-2"
              >
                <p className="text-[13px] font-semibold text-slate-900">
                  {event.buggyName}{" "}
                  {event.type === "ENTER" ? "masuk" : "keluar"}{" "}
                  {event.geofenceName}
                </p>
                <p className="text-[11px] text-slate-500">
                  {new Date(event.timestamp).toLocaleString("id-ID")} •{" "}
                  {event.position.lat.toFixed(5)},{" "}
                  {event.position.lng.toFixed(5)}
                </p>
              </article>
            ))
          )}
        </div>
      </div>
    </section>
  );
}
