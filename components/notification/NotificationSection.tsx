"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Skeleton } from "@/components/ui/Skeleton";
import type { Announcement } from "@/types/announcement";
import {
  Plus,
  Info,
  AlertTriangle,
  BellRing,
  Trash2,
  Pencil,
} from "lucide-react";
import { AdminNotificationFormPanel } from "./AdminNotificationFormPanel";
import { DeleteConfirmModal } from "@/components/ui/DeleteConfirmModal";
import { formatDistanceToNow } from "date-fns";
import { enUS, id as idLocale } from "date-fns/locale";
import { useLocale } from "@/lib/i18n/client";

type NotificationSectionProps = {
  isAdmin?: boolean;
};

export function NotificationSection({
  isAdmin = false,
}: NotificationSectionProps) {
  const locale = useLocale();
  const dateLocale = locale === "id" ? idLocale : enUS;
  const { t } = useTranslation("notifications");
  const { t: tCommon } = useTranslation("common");
  const [announcements, setAnnouncements] = useState<Announcement[] | null>(
    null,
  );
  const [formTarget, setFormTarget] = useState<null | "add" | Announcement>(
    null,
  );
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const fetchAnnouncements = useCallback(async () => {
    try {
      setIsLoading(true);
      const url = isAdmin
        ? "/api/announcements?active=false"
        : "/api/announcements";
      const res = await fetch(url, { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) setAnnouncements(data);
      }
    } catch {
      // ignore
    } finally {
      setIsLoading(false);
    }
  }, [isAdmin]);

  useEffect(() => {
    void fetchAnnouncements();
  }, [fetchAnnouncements]);

  const handleSaved = () => {
    setFormTarget(null);
    void fetchAnnouncements();
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTargetId) return;
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/admin/announcements/${deleteTargetId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        void fetchAnnouncements();
      }
    } catch {
      alert("Gagal menghapus.");
    } finally {
      setIsDeleting(false);
      setDeleteTargetId(null);
    }
  };

  // ── Admin form panel (add / edit) ──────────────────────────────────────────
  if (isAdmin && formTarget !== null) {
    return (
      <AdminNotificationFormPanel
        announcement={formTarget === "add" ? null : formTarget}
        onBack={() => setFormTarget(null)}
        onSaved={handleSaved}
      />
    );
  }

  // ── List ────────────────────────────────────────────────────────────────────
  return (
    <div className="rounded-3xl border border-slate-200/80 bg-white/70 p-3">
      {/* Header */}
      <div className="mb-3 flex items-start justify-between gap-2">
        <div>
          <h2 className="text-[17px] font-bold text-slate-900 tracking-tight">
            {isAdmin ? t("management") : t("informationCenter")}
          </h2>
          <p className="text-[11px] text-slate-400">
            {t("titleDescription")}
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

      {/* List */}
      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, idx) => (
            <div
              key={idx}
              className="rounded-[20px] border border-slate-200/80 bg-white p-3.5"
            >
              <div className="mb-2 flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  <Skeleton className="h-4 w-4 rounded-full" />
                  <Skeleton className="h-3.5 w-32" />
                </div>
                <Skeleton className="h-2.5 w-12" />
              </div>
              <Skeleton className="h-2.5 w-full" />
              <Skeleton className="mt-1.5 h-2.5 w-3/4" />
            </div>
          ))}
        </div>
      ) : !announcements || announcements.length === 0 ? (
        <div className="rounded-[20px] border border-slate-200/80 bg-white p-6 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
            <BellRing className="h-6 w-6" />
          </div>
          <p className="text-[13px] font-semibold text-slate-700">
            {t("noInfo")}
          </p>
          <p className="mt-1 text-[11px] leading-relaxed text-slate-400">
            Informasi penting dan update rute
            <br />
            akan muncul di sini.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {announcements.map((ann) => (
            <div
              key={ann.id}
              className={`rounded-[20px] border border-slate-200/80 bg-white p-3.5 transition-all hover:bg-slate-50 hover:shadow-sm ${!ann.is_active ? "opacity-60 grayscale" : ""}`}
            >
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="flex items-center gap-1.5">
                  {ann.type === "alert" ? (
                    <AlertTriangle className="h-4 w-4 text-red-500" />
                  ) : ann.type === "warning" ? (
                    <AlertTriangle className="h-4 w-4 text-amber-500" />
                  ) : (
                    <Info className="h-4 w-4 text-blue-500" />
                  )}
                  <h3 className="text-[13px] font-bold text-slate-800">
                    {ann.title}
                  </h3>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[9px] font-medium text-slate-400">
                    {formatDistanceToNow(new Date(ann.created_at), {
                      addSuffix: true,
                    locale: dateLocale,
                    })}
                  </span>
                  {isAdmin && (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => setFormTarget(ann)}
                        className="p-1 text-slate-400 hover:text-blue-600"
                      >
                        <Pencil className="h-3 w-3" />
                      </button>
                      <button
                        onClick={() => setDeleteTargetId(ann.id)}
                        className="p-1 text-slate-400 hover:text-red-600"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
              <p className="text-[12px] leading-relaxed text-slate-600 whitespace-pre-wrap">
                {ann.content}
              </p>
              {isAdmin && !ann.is_active && (
                <span className="mt-2 inline-block rounded-md bg-slate-100 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-slate-500">
                  {tCommon("inactive")}
                </span>
              )}
            </div>
          ))}
        </div>
      )}

      {isAdmin && (
        <DeleteConfirmModal
          open={!!deleteTargetId}
          title={t("deleteAnnouncement")}
          description="Pengumuman ini akan dihapus secara permanen dan tidak dapat dikembalikan."
          isLoading={isDeleting}
          onClose={() => setDeleteTargetId(null)}
          onConfirm={handleDeleteConfirm}
        />
      )}
    </div>
  );
}
