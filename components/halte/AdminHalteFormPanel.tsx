"use client";

import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import type { HaltePoint } from "@/types/buggy";
import { ChevronLeft, Trash2, Plus, X } from "lucide-react";
import { getErrorMessage } from "@/lib/utils/error-message";

type AdminHalteFormPanelProps = {
  /** null = mode tambah, object = mode edit */
  halte: HaltePoint | null;
  onBack: () => void;
  onSaved: () => void;
};

export function AdminHalteFormPanel({
  halte,
  onBack,
  onSaved,
}: AdminHalteFormPanelProps) {
  const { t } = useTranslation("admin");
  const { t: tDashboard } = useTranslation("dashboard");
  const { t: tCommon } = useTranslation("common");
  const isEdit = halte !== null;

  const [name, setName] = useState("");
  const [lat, setLat] = useState("");
  const [lng, setLng] = useState("");
  const [sortOrder, setSortOrder] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [schedule, setSchedule] = useState<string[]>([]);
  const [newTime, setNewTime] = useState("");
  const [facilities, setFacilities] = useState<string[]>([]);
  const [newFacility, setNewFacility] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Populate form when editing
  useEffect(() => {
    if (halte) {
      setName(halte.name);
      setLat(halte.lat.toString());
      setLng(halte.lng.toString());
      setSortOrder(halte.sortOrder?.toString() || "");
      setIsActive(halte.isActive !== false);
      setSchedule(halte.schedule ?? []);
      setFacilities(halte.facilities ?? []);
    } else {
      setName("");
      setLat("");
      setLng("");
      setSortOrder("");
      setIsActive(true);
      setSchedule([]);
      setFacilities([]);
    }
    setNewTime("");
    setNewFacility("");
    setError(null);
    setShowDeleteConfirm(false);
  }, [halte]);

  // ── Schedule helpers ────────────────────────────────────────────────────────
  const addScheduleTime = () => {
    const t = newTime.trim();
    if (!t || schedule.includes(t)) return;
    setSchedule((prev) => [...prev, t].sort());
    setNewTime("");
  };
  const removeScheduleTime = (idx: number) => {
    setSchedule((prev) => prev.filter((_, i) => i !== idx));
  };

  // ── Facilities helpers ──────────────────────────────────────────────────────
  const addFacility = () => {
    const f = newFacility.trim();
    if (!f || facilities.includes(f)) return;
    setFacilities((prev) => [...prev, f]);
    setNewFacility("");
  };
  const removeFacility = (idx: number) => {
    setFacilities((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSubmit = async () => {
    setError(null);

    const trimmedName = name.trim();
    const parsedLat = Number(lat);
    const parsedLng = Number(lng);
    const parsedSort = sortOrder ? Number(sortOrder) : 99;

    if (!trimmedName) {
      setError("Nama halte wajib diisi");
      return;
    }
    if (Number.isNaN(parsedLat) || Number.isNaN(parsedLng)) {
      setError("Latitude dan Longitude harus berupa angka valid");
      return;
    }
    if (parsedLat < -90 || parsedLat > 90) {
      setError("Latitude harus antara -90 dan 90");
      return;
    }
    if (parsedLng < -180 || parsedLng > 180) {
      setError("Longitude harus antara -180 dan 180");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        name: trimmedName,
        lat: parsedLat,
        lng: parsedLng,
        sort_order: parsedSort,
        is_active: isActive,
        schedule: schedule.length > 0 ? schedule : null,
        facilities: facilities.length > 0 ? facilities : null,
      };

      if (isEdit) {
        const res = await fetch(`/api/haltes/${halte.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error((data as { error?: string }).error || "Gagal menyimpan");
        }
      } else {
        const id = `halte-${trimmedName.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "")}`;
        const res = await fetch("/api/haltes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id, ...payload }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error((data as { error?: string }).error || "Gagal menambah");
        }
      }
      onSaved();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!halte) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/haltes/${halte.id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data as { error?: string }).error || "Gagal menghapus");
      }
      onSaved();
    } catch (err) {
      setError(getErrorMessage(err, "Gagal menghapus halte"));
    } finally {
      setDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  return (
    <section className="space-y-3">
      <div className="rounded-3xl border border-slate-200/80 bg-white/70 p-3 lg:p-4">
        {/* Header */}
        <div className="mb-4 flex items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-slate-300 bg-white text-slate-700 shadow-sm transition hover:border-slate-900 hover:bg-slate-900 hover:text-white active:scale-95"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">
              {isEdit ? t("editHalte") : t("addNewHalte")}
            </p>
            <h2 className="truncate text-[17px] font-bold text-slate-900 tracking-tight">
              {isEdit ? halte.name : t("newHalte")}
            </h2>
          </div>
        </div>

        {error && (
          <div className="mb-3 rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-[12px] font-medium text-rose-700">
            {error}
          </div>
        )}

        {/* Form */}
        <div className="space-y-3">
          {/* Nama */}
          <FormField label={t("halteName")} required>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Mis. Halte FT"
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-[14px] font-medium text-slate-800 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
            />
          </FormField>

          {/* Koordinat */}
          <div className="grid grid-cols-2 gap-2.5">
            <FormField label="Latitude" required>
              <input
                type="number"
                step="any"
                value={lat}
                onChange={(e) => setLat(e.target.value)}
                placeholder="-7.0545"
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-[14px] font-medium text-slate-800 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100 font-mono"
              />
            </FormField>
            <FormField label="Longitude" required>
              <input
                type="number"
                step="any"
                value={lng}
                onChange={(e) => setLng(e.target.value)}
                placeholder="110.4441"
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-[14px] font-medium text-slate-800 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100 font-mono"
              />
            </FormField>
          </div>

          {/* Sort order */}
          <FormField label={t("routeOrder")}>
            <input
              type="number"
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value)}
              placeholder="99"
              min={1}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-[14px] font-medium text-slate-800 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
            />
            <p className="mt-1 text-[11px] text-slate-400">
              Angka lebih kecil = lebih awal di rute loop
            </p>
          </FormField>

          {/* ── Status Aktif Toggle ──────────────────────────────────────── */}
          <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-3">
            <div>
              <p className="text-[13px] font-semibold text-slate-700">Status</p>
              <p className="text-[11px] text-slate-400">
                {isActive ? t("halteActive") : t("halteInactive")}
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={isActive}
              onClick={() => setIsActive((v) => !v)}
              className={`relative h-7 w-12 rounded-full transition-colors duration-200 ${isActive ? "bg-emerald-500" : "bg-slate-300"}`}
            >
              <span
                className={`absolute top-0.5 left-0.5 h-6 w-6 rounded-full bg-white shadow-sm transition-transform duration-200 ${isActive ? "translate-x-5" : "translate-x-0"}`}
              />
            </button>
          </div>

          {/* ── Jadwal Keberangkatan ─────────────────────────────────────── */}
          <FormField label={tDashboard("todaySchedule")}>
            <div className="flex gap-2">
              <input
                type="time"
                value={newTime}
                onChange={(e) => setNewTime(e.target.value)}
                className="flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-[14px] font-medium text-slate-800 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100 font-mono"
              />
              <button
                type="button"
                onClick={addScheduleTime}
                disabled={!newTime.trim()}
                className="grid h-10 w-10 place-items-center rounded-xl bg-[#0f1a3b] text-white transition hover:bg-[#1a2b55] active:scale-95 disabled:opacity-40"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>
            {schedule.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {schedule.map((time, idx) => (
                  <span
                    key={idx}
                    className="flex items-center gap-1 rounded-lg bg-slate-100 px-2.5 py-1 text-[12px] font-bold text-slate-700 font-mono"
                  >
                    {time}
                    <button
                      type="button"
                      onClick={() => removeScheduleTime(idx)}
                      className="text-slate-400 hover:text-rose-500 transition"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
            {schedule.length === 0 && (
              <p className="mt-1 text-[11px] text-slate-400">
                {tDashboard("noSchedule")}
              </p>
            )}
          </FormField>

          {/* ── Fasilitas Terdekat ────────────────────────────────────────── */}
          <FormField label={tDashboard("nearestFacilities")}>
            <div className="flex gap-2">
              <input
                type="text"
                value={newFacility}
                onChange={(e) => setNewFacility(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addFacility())}
                placeholder={tDashboard("defaultFacilityBuilding")}
                className="flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-[14px] font-medium text-slate-800 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
              />
              <button
                type="button"
                onClick={addFacility}
                disabled={!newFacility.trim()}
                className="grid h-10 w-10 place-items-center rounded-xl bg-[#0f1a3b] text-white transition hover:bg-[#1a2b55] active:scale-95 disabled:opacity-40"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>
            {facilities.length > 0 && (
              <div className="mt-2 space-y-1.5">
                {facilities.map((f, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between rounded-xl bg-slate-50 border border-slate-100 px-3 py-2"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#0f1a3b]/50" />
                      <span className="text-[13px] font-medium text-slate-700 truncate">{f}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeFacility(idx)}
                      className="text-slate-400 hover:text-rose-500 transition shrink-0"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            {facilities.length === 0 && (
              <p className="mt-1 text-[11px] text-slate-400">
                {tDashboard("noFacilities")}
              </p>
            )}
          </FormField>
        </div>

        {/* Actions */}
        <div className="mt-4 flex flex-col gap-2">
          <button
            type="button"
            onClick={handleSubmit}
            disabled={saving}
            className="w-full rounded-2xl bg-[#0f1a3b] px-4 py-3 text-[14px] font-bold text-white shadow-sm transition hover:bg-[#1a2b55] active:scale-[0.98] disabled:opacity-50"
          >
            {saving
              ? tCommon("saving")
              : isEdit
                ? t("saveChanges")
                : t("addHalte")}
          </button>

          {isEdit && !showDeleteConfirm && (
            <button
              type="button"
              onClick={() => setShowDeleteConfirm(true)}
              className="flex items-center justify-center gap-1.5 w-full rounded-2xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-[13px] font-bold text-rose-600 transition hover:bg-rose-100 active:scale-[0.98]"
            >
              <Trash2 className="h-3.5 w-3.5" />
              {tCommon("delete")}
            </button>
          )}

          {isEdit && showDeleteConfirm && (
            <div className="rounded-2xl border border-rose-300 bg-rose-50 p-3 space-y-2">
              <p className="text-[12px] font-medium text-rose-700">
                Yakin ingin menghapus <strong>{halte.name}</strong>? Aksi ini permanen.
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(false)}
                  className="flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-[12px] font-bold text-slate-600 transition hover:bg-slate-50"
                >
                  {tCommon("cancel")}
                </button>
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={deleting}
                  className="flex-1 rounded-xl bg-rose-600 px-3 py-2 text-[12px] font-bold text-white transition hover:bg-rose-700 disabled:opacity-50"
                >
                  {deleting ? tCommon("deleting") : tCommon("yesDelete")}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function FormField({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-1 block text-[12px] font-semibold text-slate-500">
        {label}
        {required && <span className="ml-0.5 text-rose-400">*</span>}
      </label>
      {children}
    </div>
  );
}
