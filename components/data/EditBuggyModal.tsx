"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { XIcon, Trash2Icon } from "lucide-react";
import type { Buggy } from "@/types/buggy";
import { DeleteConfirmModal } from "@/components/ui/DeleteConfirmModal";

type EditBuggyModalProps = {
  isOpen: boolean;
  buggy: Buggy | null;
  onClose: () => void;
  onSuccess: () => void;
  /** Dipanggil setelah buggy berhasil dihapus */
  onDelete?: () => void;
};

export function EditBuggyModal({ isOpen, buggy, onClose, onSuccess, onDelete }: EditBuggyModalProps) {
  const [loading, setLoading] = useState(false);
  const [code, setCode] = useState(buggy?.code || "");
  const [name, setName] = useState(buggy?.name || "");
  const [capacity, setCapacity] = useState(buggy?.capacity || 8);
  const [isActive, setIsActive] = useState(buggy?.isActive ?? true);

  // State untuk konfirmasi hapus
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Sync state if buggy prop changes while modal is open
  useState(() => {
    if (buggy) {
      setCode(buggy.code);
      setName(buggy.name);
      setCapacity(buggy.capacity);
      setIsActive(buggy.isActive);
    }
  });

  if (!buggy) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const res = await fetch(`/api/admin/buggies/${buggy.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code,
          name,
          capacity: Number(capacity),
          isActive,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Gagal memperbarui armada");
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/admin/buggies/${buggy.id}`, {
        method: "DELETE",
      });

      if (!res.ok) throw new Error("Gagal menghapus buggy");

      setIsDeleteConfirmOpen(false);
      onClose();
      onDelete?.();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <>
      <AnimatePresence>
        {isOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={onClose}
              className="fixed inset-0 z-[100] bg-slate-900/40 backdrop-blur-sm"
            />

            <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 pointer-events-none">
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 10 }}
                className="w-full max-w-sm pointer-events-auto rounded-[24px] border border-white/60 bg-white/70 backdrop-blur-xl p-6 shadow-[0_12px_40px_rgba(15,23,42,0.12)]"
              >
                <div className="mb-5 flex items-center justify-between">
                  <h3 className="text-[18px] font-bold text-slate-800 tracking-tight">
                    Edit Armada
                  </h3>
                  <button
                    type="button"
                    onClick={onClose}
                    className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-500 transition hover:border-slate-900 hover:bg-slate-900 hover:text-white"
                  >
                    <XIcon className="h-4 w-4" />
                  </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label className="block text-[12px] font-bold text-slate-700 mb-1.5 ml-1">
                      Kode Buggy / Plat
                    </label>
                    <input
                      required
                      value={code}
                      onChange={(e) => setCode(e.target.value)}
                      placeholder="B08"
                      className="w-full rounded-xl border border-slate-200/80 bg-white/80 px-4 py-2.5 text-[14px] text-slate-800 outline-none transition focus:border-[#0f1a3b] focus:ring-2 focus:ring-[#0f1a3b]/20"
                    />
                  </div>

                  <div>
                    <label className="block text-[12px] font-bold text-slate-700 mb-1.5 ml-1">
                      Nama Armada
                    </label>
                    <input
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Buggy 08"
                      className="w-full rounded-xl border border-slate-200/80 bg-white/80 px-4 py-2.5 text-[14px] text-slate-800 outline-none transition focus:border-[#0f1a3b] focus:ring-2 focus:ring-[#0f1a3b]/20"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[12px] font-bold text-slate-700 mb-1.5 ml-1">
                        Kapasitas
                      </label>
                      <input
                        required
                        type="number"
                        min={1}
                        value={capacity}
                        onChange={(e) => setCapacity(Number(e.target.value))}
                        className="w-full rounded-xl border border-slate-200/80 bg-white/80 px-4 py-2.5 text-[14px] text-slate-800 outline-none transition focus:border-[#0f1a3b] focus:ring-2 focus:ring-[#0f1a3b]/20"
                      />
                    </div>
                    <div>
                      <label className="block text-[12px] font-bold text-slate-700 mb-1.5 ml-1">
                        Status
                      </label>
                      <button
                        type="button"
                        onClick={() => setIsActive(!isActive)}
                        className={`w-full rounded-xl border py-2.5 px-4 text-[13px] font-bold transition-all ${
                          isActive
                            ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                            : "border-slate-200 bg-slate-50 text-slate-500"
                        }`}
                      >
                        {isActive ? "Aktif" : "Non-aktif"}
                      </button>
                    </div>
                  </div>

                  {/* Action buttons */}
                  <div className="flex gap-2 pt-2">
                    {/* Simpan */}
                    <button
                      type="submit"
                      disabled={loading}
                      className="flex-1 rounded-xl border border-transparent bg-[#0f1a3b] py-3 text-[14px] font-bold text-white shadow-md transition hover:bg-white hover:text-[#0f1a3b] hover:border-[#0f1a3b] active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed"
                    >
                      {loading ? "Menyimpan..." : "Simpan Perubahan"}
                    </button>

                    {/* Hapus */}
                    <button
                      type="button"
                      onClick={() => setIsDeleteConfirmOpen(true)}
                      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-rose-200 bg-rose-50 text-rose-500 transition hover:bg-rose-500 hover:text-white hover:border-rose-500 active:scale-95"
                      title="Hapus armada ini"
                      aria-label="Hapus armada"
                    >
                      <Trash2Icon className="h-4 w-4" />
                    </button>
                  </div>
                </form>
              </motion.div>
            </div>
          </>
        )}
      </AnimatePresence>

      {/* Delete Confirm Modal — di luar AnimatePresence agar z-index lebih tinggi */}
      <DeleteConfirmModal
        open={isDeleteConfirmOpen}
        title="Hapus Armada?"
        description={`Armada ${buggy.code} – ${buggy.name} akan dihapus permanen. Tindakan ini tidak dapat dibatalkan.`}
        confirmLabel="Ya, Hapus"
        loadingLabel="Menghapus..."
        isLoading={isDeleting}
        onClose={() => setIsDeleteConfirmOpen(false)}
        onConfirm={handleDelete}
      />
    </>
  );
}
