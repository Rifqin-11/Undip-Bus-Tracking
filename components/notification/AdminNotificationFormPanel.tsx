"use client";

import { useState } from "react";
import type { Announcement } from "@/types/announcement";
import { ChevronLeft, Save } from "lucide-react";

type AnnouncementType = Announcement["type"];

type AdminNotificationFormPanelProps = {
  announcement: Announcement | null;
  onBack: () => void;
  onSaved: () => void;
};

export function AdminNotificationFormPanel({
  announcement,
  onBack,
  onSaved,
}: AdminNotificationFormPanelProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    title: announcement?.title ?? "",
    content: announcement?.content ?? "",
    type: announcement?.type ?? "info",
    is_active: announcement?.is_active ?? true,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const url = announcement
        ? `/api/admin/announcements/${announcement.id}`
        : "/api/admin/announcements";
      const method = announcement ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (res.ok) {
        onSaved();
      } else {
        alert("Gagal menyimpan pengumuman.");
      }
    } catch {
      alert("Terjadi kesalahan.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="rounded-3xl border border-slate-200/80 bg-white/70 p-3">
      {/* Header */}
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
            {announcement ? "Edit Pengumuman" : "Buat Pengumuman Baru"}
          </p>
          <h2 className="truncate text-[17px] font-bold text-slate-900 tracking-tight">
            {announcement ? "Edit" : "Baru"}
          </h2>
        </div>
      </div>

      <form id="announcement-form" onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-widest text-slate-500">
            Judul
          </label>
          <input
            type="text"
            required
            value={formData.title}
            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-[14px] font-medium text-slate-800 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
            placeholder="Contoh: Perubahan Rute"
          />
        </div>

        <div>
          <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-widest text-slate-500">
            Tipe Notifikasi
          </label>
          <select
            value={formData.type}
            onChange={(e) =>
              setFormData({
                ...formData,
                type: e.target.value as AnnouncementType,
              })
            }
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-[14px] font-medium text-slate-800 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
          >
            <option value="info">Info (Biru)</option>
            <option value="warning">Warning (Kuning)</option>
            <option value="alert">Alert (Merah)</option>
          </select>
        </div>

        <div>
          <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-widest text-slate-500">
            Isi Pengumuman
          </label>
          <textarea
            required
            rows={4}
            value={formData.content}
            onChange={(e) => setFormData({ ...formData, content: e.target.value })}
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-[14px] font-medium text-slate-800 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
            placeholder="Tuliskan isi pengumuman..."
          />
        </div>

        <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-3">
          <div>
            <p className="text-[13px] font-semibold text-slate-700">Status</p>
            <p className="text-[11px] text-slate-400">Tampilkan ke pengguna</p>
          </div>
          <label className="relative inline-flex cursor-pointer items-center">
            <input
              type="checkbox"
              className="peer sr-only"
              checked={formData.is_active}
              onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
            />
            <div className="peer h-6 w-11 rounded-full bg-slate-200 after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-gray-300 after:bg-white after:transition-all after:content-[''] peer-checked:bg-emerald-500 peer-checked:after:translate-x-full peer-checked:after:border-white peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-emerald-300" />
          </label>
        </div>

        <div className="pt-2">
          <button
            type="submit"
            disabled={isSubmitting}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 py-3 text-[13px] font-bold text-white transition hover:bg-slate-800 disabled:opacity-50"
          >
            <Save className="h-4 w-4" />
            {isSubmitting ? "Menyimpan..." : "Simpan Pengumuman"}
          </button>
        </div>
      </form>
    </div>
  );
}
