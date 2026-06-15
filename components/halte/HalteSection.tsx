"use client";

import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { HaltePoint } from "@/types/buggy";
import { BusStopIcon, ChevronRightIcon } from "@/components/ui/Icons";
import { Plus, Pencil } from "lucide-react";
import { AdminHalteFormPanel } from "./AdminHalteFormPanel";
import { FavoriteStar } from "@/components/ui/FavoriteStar";

type HalteSectionProps = {
  haltes: HaltePoint[];
  onSelectHalte?: (halteId: string, halteObj: HaltePoint) => void;
  onHaltesChanged?: () => void | Promise<void>;
  /** Jika true, tampilkan tombol tambah dan edit. */
  isAdmin?: boolean;
  /** Set ID halte favorit user. */
  favoriteHaltes?: Set<string>;
  /** Toggle favorit halte. */
  onToggleFavoriteHalte?: (halteId: string) => void | Promise<unknown>;
  /** True jika user authenticated & favorit ready (UI tampilkan star). */
  canFavorite?: boolean;
};

export function HalteSection({
  haltes,
  onSelectHalte,
  onHaltesChanged,
  isAdmin = false,
  favoriteHaltes,
  onToggleFavoriteHalte,
  canFavorite = false,
}: HalteSectionProps) {
  const { t } = useTranslation("dashboard");
  const { t: tCommon } = useTranslation("common");
  /** null = list, "add" = form tambah, HaltePoint = form edit */
  const [formTarget, setFormTarget] = useState<null | "add" | HaltePoint>(null);

  const handleSaved = () => {
    setFormTarget(null);
    void onHaltesChanged?.();
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
      <div
        className={`mb-3 ${isAdmin ? "w-full rounded-[20px] border border-white/60 bg-white/40 backdrop-blur-md py-3 px-3.5 shadow-[0_8px_20px_rgba(15,23,42,0.04)]" : "flex items-start justify-between gap-2"}`}
      >
        <div
          className={isAdmin ? "flex items-center justify-between gap-2" : ""}
        >
          <div>
            <h2 className="text-[17px] font-bold text-slate-900 tracking-tight">
              {t("stopList")}
            </h2>
            <p className="text-[11px] text-slate-400">
              {isAdmin
                ? t("stopsCount", { count: haltes.length })
                : t("activeStops", { count: haltes.length })}
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
          {t("noStopData")}
        </p>
      ) : (
        <div className="space-y-2">
          {haltes.map((halte) => {
            const isFav = favoriteHaltes?.has(halte.id) ?? false;
            return (
              <div
                key={halte.id}
                className={`group flex w-full items-center justify-between rounded-[20px] border p-3 text-left transition-all hover:shadow-sm ${
                  canFavorite && isFav
                    ? "border-amber-200 bg-amber-50/40 hover:bg-amber-50"
                    : "border-slate-200/80 bg-white hover:bg-slate-50 hover:border-[#0f1a3b]/20"
                }`}
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
                    <div className="flex items-center gap-1.5">
                      <p className="truncate text-[15px] font-bold text-slate-800 tracking-tight mb-1">
                        {halte.name}
                      </p>
                      {canFavorite && isFav ? (
                        <span className="shrink-0 rounded-full border border-amber-200 bg-amber-100 px-1.5 py-0 text-[8px] font-bold uppercase tracking-wide text-amber-700">
                          ★ {t("favorite")}
                        </span>
                      ) : null}
                    </div>
                    <p className="truncate text-[12px] font-medium text-slate-500">
                      {isAdmin
                        ? `${halte.lat.toFixed(5)}, ${halte.lng.toFixed(5)}`
                        : t("departurePoint")}
                    </p>
                  </div>
                </button>

                {/* Right: favorite (auth) + edit (admin) + chevron */}
                <div className="flex items-center gap-1.5 shrink-0 ml-2">
                  {canFavorite && onToggleFavoriteHalte ? (
                    <FavoriteStar
                      active={isFav}
                      onToggle={() => onToggleFavoriteHalte(halte.id)}
                      size="sm"
                      label={
                        isFav
                          ? t("removeNamedFavorite", { name: halte.name })
                          : t("addNamedFavorite", { name: halte.name })
                      }
                    />
                  ) : null}
                  {isAdmin && (
                    <button
                      type="button"
                      onClick={() => setFormTarget(halte)}
                      className="grid h-7 w-7 place-items-center rounded-full bg-slate-100 text-slate-400 transition-colors hover:bg-amber-100 hover:text-amber-600 active:scale-95"
                      title={`${tCommon("edit")} ${t("halte", { ns: "navigation" })}`}
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
            );
          })}
        </div>
      )}
    </div>
  );
}
