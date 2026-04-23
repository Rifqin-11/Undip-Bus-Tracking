"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { XIcon } from "lucide-react";

type AddBuggyModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
};

export function AddBuggyModal({ isOpen, onClose, onSuccess }: AddBuggyModalProps) {
  const [loading, setLoading] = useState(false);
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [capacity, setCapacity] = useState(8);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const res = await fetch("/api/admin/buggies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code,
          name,
          capacity: Number(capacity),
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Gagal menambah buggy");
      }

      onSuccess();
      setCode("");
      setName("");
      setCapacity(8);
      onClose();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
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
                <h3 className="text-[18px] font-bold text-slate-800 tracking-tight">Tambah Armada</h3>
                <button
                  type="button"
                  onClick={onClose}
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 transition-colors"
                >
                  <XIcon className="h-4 w-4" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-[12px] font-bold text-slate-700 mb-1.5 ml-1">Kode Buggy / Plat</label>
                  <input
                    required
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    placeholder="B08"
                    className="w-full rounded-xl border border-slate-200/80 bg-white/80 px-4 py-2.5 text-[14px] text-slate-800 outline-none transition focus:border-[#0f1a3b] focus:ring-2 focus:ring-[#0f1a3b]/20"
                  />
                </div>

                <div>
                  <label className="block text-[12px] font-bold text-slate-700 mb-1.5 ml-1">Nama Armada</label>
                  <input
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Buggy 08"
                    className="w-full rounded-xl border border-slate-200/80 bg-white/80 px-4 py-2.5 text-[14px] text-slate-800 outline-none transition focus:border-[#0f1a3b] focus:ring-2 focus:ring-[#0f1a3b]/20"
                  />
                </div>

                <div>
                  <label className="block text-[12px] font-bold text-slate-700 mb-1.5 ml-1">Kapasitas</label>
                  <input
                    required
                    type="number"
                    min={1}
                    value={capacity}
                    onChange={(e) => setCapacity(Number(e.target.value))}
                    className="w-full rounded-xl border border-slate-200/80 bg-white/80 px-4 py-2.5 text-[14px] text-slate-800 outline-none transition focus:border-[#0f1a3b] focus:ring-2 focus:ring-[#0f1a3b]/20"
                  />
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full rounded-xl border border-transparent bg-[#0f1a3b] py-3 text-[14px] font-bold text-white shadow-md transition hover:bg-[#1a2b59] active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed"
                  >
                    {loading ? "Menyimpan..." : "Simpan Armada"}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
