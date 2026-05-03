"use client";

import { useState, useEffect, useCallback } from "react";
import { HALTE_LOCATIONS } from "@/lib/transit/buggy-data";
import type { HaltePoint } from "@/types/buggy";
import {
  BusStopIcon,
  ChevronRightIcon,
} from "@/components/ui/Icons";
import { Plus, Pencil } from "lucide-react";
import { AdminHalteFormPanel } from "./AdminHalteFormPanel";

type HalteSectionProps = {
  onSelectHalte?: (halteId: string, halteObj: HaltePoint) => void;
  /** Jika true, tampilkan tombol add/edit dan ambil data dari API */
  isAdmin?: boolean;
};

export function HalteSection({ onSelectHalte, isAdmin = false }: HalteSectionProps) {
  // Admin: fetch dari API, User: pakai HALTE_LOCATIONS statis
  const [apiHaltes, setApiHaltes] = useState<HaltePoint[] | null>(null);
  /** null = list, "add" = form tambah, HaltePoint = form edit */
  const [formTarget, setFormTarget] = useState<null | "add" | HaltePoint>(null);

  const fetchHaltes = useCallback(async () => {
    try {
      const res = await fetch("/api/haltes", { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) setApiHaltes(data as HaltePoint[]);
      }
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    if (isAdmin) void fetchHaltes();
  }, [isAdmin, fetchHaltes]);

  const haltes = isAdmin && apiHaltes ? apiHaltes : HALTE_LOCATIONS;

  const handleSaved = () => {
    setFormTarget(null);
    void fetchHaltes();
  };

  // ── Admin form panel (add / edit) ──────────────────────────────────────────
  if (isAdmin && formTarget !== null) {
    return (
      <AdminHalteFormPanel
        halte={formTarget === "add" ? null : formTarget}
        onBack={() => setFormTarget(null)}
        onSaved={handleSaved}
      />
    );
  }

  // ── List ────────────────────────────────────────────────────────────────────
  return (
    <div className="rounded-3xl border border-slate-200/80 bg-white/70 p-3">
      {/* Header */}
      <div className={`mb-3 ${isAdmin ? "w-full rounded-[20px] border border-white/60 bg-white/40 backdrop-blur-md py-3 px-3.5 shadow-[0_8px_20px_rgba(15,23,42,0.04)]" : "flex items-start justify-between gap-2"}`}>
        <div className={isAdmin ? "flex items-center justify-between gap-2" : ""}>
          <div>
            <h2 className="text-[17px] font-bold text-slate-900 tracking-tight">
              Daftar Halte
            </h2>
            <p className="text-[11px] text-slate-400">
              {haltes.length} Halte{isAdmin ? "" : " Aktif"}
            </p>
          </div>
          {isAdmin && (
            <button
              type="button"
              onClick={() => setFormTarget("add")}
              className="flex items-center gap-1 rounded-full border border-[#0f1a3b] bg-[#0f1a3b] px-3 py-2 text-[11px] font-bold text-white shadow-sm transition hover:bg-white hover:text-[#0f1a3b] active:scale-95"
            >
              <Plus className="size-3" />
            </button>
          )}
        </div>
      </div>

      {/* List */}
      {haltes.length === 0 ? (
        <p className="py-4 text-center text-[12px] text-slate-400">
          Belum ada data halte.
        </p>
      ) : (
        <div className="space-y-2">
          {haltes.map((halte) => (
            <div
              key={halte.id}
              className="group flex w-full items-center justify-between rounded-[20px] border border-slate-200/80 bg-white p-3 text-left transition-all hover:bg-slate-50 hover:shadow-sm hover:border-[#0f1a3b]/20"
            >
              {/* Left: halte info */}
              <button
                type="button"
                onClick={() => onSelectHalte?.(halte.id, halte)}
                className="flex flex-1 items-center gap-3 min-w-0 outline-none"
              >
                <div className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-[#0f1a3b] text-white shadow-sm transition-transform group-hover:scale-105">
                  <BusStopIcon className="h-4 w-4" />
                </div>
                <div className="min-w-0 text-left">
                  <p className="truncate text-[15px] font-bold text-slate-800 tracking-tight mb-1">
                    {halte.name}
                  </p>
                  <p className="truncate text-[12px] font-medium text-slate-500">
                    {isAdmin
                      ? `${halte.lat.toFixed(5)}, ${halte.lng.toFixed(5)}`
                      : "Titik keberangkatan"}
                  </p>
                </div>
              </button>

              {/* Right: edit (admin) + chevron */}
              <div className="flex items-center gap-1.5 shrink-0 ml-2">
                {isAdmin && (
                  <button
                    type="button"
                    onClick={() => setFormTarget(halte)}
                    className="grid h-7 w-7 place-items-center rounded-full bg-slate-100 text-slate-400 transition-colors hover:bg-amber-100 hover:text-amber-600 active:scale-95"
                    title="Edit halte"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => onSelectHalte?.(halte.id, halte)}
                  className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-slate-100 text-slate-400 transition-colors group-hover:bg-[#0f1a3b] group-hover:text-white"
                >
                  <ChevronRightIcon className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
