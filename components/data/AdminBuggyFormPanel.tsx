"use client";

import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import type { Buggy } from "@/types/buggy";
import { ChevronLeft, Trash2 } from "lucide-react";
import { getErrorMessage } from "@/lib/utils/error-message";
import { DeviceAssignmentPanel } from "./DeviceAssignmentPanel";

type AdminBuggyFormPanelProps = {
  /** null = mode tambah, object = mode edit */
  buggy: Buggy | null;
  onBack: () => void;
  onSaved: () => void;
  onDeleted?: () => void;
};

export function AdminBuggyFormPanel({
  buggy,
  onBack,
  onSaved,
  onDeleted,
}: AdminBuggyFormPanelProps) {
  const { t } = useTranslation("admin");
  const { t: tCommon } = useTranslation("common");
  const isEdit = buggy !== null;

  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [capacity, setCapacity] = useState(8);
  const [isActive, setIsActive] = useState(true);

  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Populate form when editing
  useEffect(() => {
    if (buggy) {
      setCode(buggy.code);
      setName(buggy.name);
      setCapacity(buggy.capacity);
      setIsActive(buggy.isActive);
    } else {
      setCode("");
      setName("");
      setCapacity(8);
      setIsActive(true);
    }
    setError(null);
    setShowDeleteConfirm(false);
  }, [buggy]);

  const handleSubmit = async () => {
    setError(null);

    const trimmedCode = code.trim();
    const trimmedName = name.trim();
    const parsedCapacity = Number(capacity);

    if (!trimmedCode) {
      setError(t("fleetCodeRequired"));
      return;
    }
    if (!trimmedName) {
      setError(t("fleetNameRequired"));
      return;
    }
    if (Number.isNaN(parsedCapacity) || parsedCapacity < 1) {
      setError(t("capacityInvalid"));
      return;
    }

    setSaving(true);
    try {
      if (isEdit) {
        // PUT /api/admin/buggies/[id]
        const res = await fetch(`/api/admin/buggies/${buggy.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            code: trimmedCode,
            name: trimmedName,
            capacity: parsedCapacity,
            isActive,
          }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error((data as { error?: string }).error || t("failedUpdateFleet"));
        }
      } else {
        // POST /api/admin/buggies
        const res = await fetch("/api/admin/buggies", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            code: trimmedCode,
            name: trimmedName,
            capacity: parsedCapacity,
          }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error((data as { error?: string }).error || t("failedAddFleet"));
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
    if (!buggy) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/buggies/${buggy.id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data as { error?: string }).error || t("failedDeleteFleet"));
      }
      onDeleted?.();
      onSaved();
    } catch (err) {
      setError(getErrorMessage(err, t("failedDeleteFleet")));
    } finally {
      setDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  return (
    <section className="space-y-3">
      {/* Header */}
      <div className="rounded-3xl border border-slate-200/80 bg-white/70 p-3 lg:p-4">
        <div className="mb-4 flex items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-slate-300 bg-white text-slate-700 shadow-sm transition hover:border-slate-900 hover:bg-slate-900 hover:text-white active:scale-95"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">
              {isEdit ? t("editFleet") : t("addNewFleet")}
            </p>
            <h2 className="truncate text-[17px] font-bold text-slate-900 tracking-tight">
              {isEdit ? buggy.name : t("newFleet")}
            </h2>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-3 rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-[12px] font-medium text-rose-700">
            {error}
          </div>
        )}

        {/* Form fields */}
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2.5">
            <FormField label={t("codePlate")} required>
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="B08"
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-[14px] font-medium text-slate-800 outline-none transition focus:border-[#0f1a3b] focus:ring-2 focus:ring-[#0f1a3b]/20"
              />
            </FormField>
            <FormField label={t("capacity")} required>
              <input
                type="number"
                min={1}
                value={capacity}
                onChange={(e) => setCapacity(Number(e.target.value))}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-[14px] font-medium text-slate-800 outline-none transition focus:border-[#0f1a3b] focus:ring-2 focus:ring-[#0f1a3b]/20"
              />
            </FormField>
          </div>

          <FormField label={t("fleetName")} required>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Buggy 08"
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-[14px] font-medium text-slate-800 outline-none transition focus:border-[#0f1a3b] focus:ring-2 focus:ring-[#0f1a3b]/20"
            />
          </FormField>

          {isEdit && (
            <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-3">
              <div>
                <p className="text-[13px] font-semibold text-slate-700">
                  {t("hideFleet")}
                </p>
                <p className="text-[11px] text-slate-400">
                  {isActive ? t("fleetVisible") : t("fleetHidden")}
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={!isActive}
                onClick={() => setIsActive((v) => !v)}
                className={`relative h-7 w-12 rounded-full transition-colors duration-200 ${isActive ? "bg-slate-300" : "bg-[#0f1a3b]"}`}
              >
                <span
                  className={`absolute top-0.5 left-0.5 h-6 w-6 rounded-full bg-white shadow-sm transition-transform duration-200 ${isActive ? "translate-x-0" : "translate-x-5"}`}
                />
              </button>
            </div>
          )}
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
                : t("addFleet")}
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
                {t("deleteFleetInline", { name: buggy.name })}
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

      {isEdit ? (
        <DeviceAssignmentPanel
          buggies={[buggy]}
          selectedBuggy={buggy}
          readOnly={false}
        />
      ) : null}
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
