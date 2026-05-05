"use client";

import { ChevronLeft, Save, Loader2 } from "lucide-react";
import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

export type AccountFormMode = "edit" | "create";

type AccountFormPanelProps = {
  mode: AccountFormMode;
  onClose: () => void;
};

export function AccountFormPanel({ mode, onClose }: AccountFormPanelProps) {
  const isCreate = mode === "create";

  const [name, setName] = useState("");
  const [role, setRole] = useState("Pengguna umum");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  
  const [errorMsg, setErrorMsg] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    async function loadUserData() {
      if (isCreate) return;
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      
      const { data: account } = await supabase.from('accounts').select('*').eq('id', user.id).single();
      
      setName(account?.name || user.user_metadata?.full_name || "Admin");
      setUsername(account?.username || user.email || "admin");
      setRole(account?.role || "Pengguna umum");
    }
    loadUserData();
  }, [isCreate]);

  useEffect(() => {
    if (confirmPassword && password !== confirmPassword) {
      setErrorMsg("Password dan Konfirmasi Password tidak cocok!");
    } else {
      setErrorMsg("");
    }
  }, [password, confirmPassword]);

  const handleSave = async () => {
    if (password !== confirmPassword) {
      setErrorMsg("Password dan Konfirmasi Password tidak cocok!");
      return;
    }

    if (!name || !username || (isCreate && !password)) {
      setErrorMsg("Nama, username, dan password wajib diisi!");
      return;
    }

    setIsLoading(true);
    setErrorMsg("");

    try {
      if (isCreate) {
        const res = await fetch("/api/admin/accounts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, username, role, password }),
        });

        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.message || "Gagal membuat akun");
        }

        onClose(); // Sukses
      } else {
        // Mode edit bisa diimplementasikan ke endpoint PUT di masa mendatang
        // Saat ini baru support create (sebagai contoh / tugas)
        setErrorMsg("Fitur edit akun di database sedang dalam pengembangan.");
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Terjadi kesalahan");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <section className="space-y-3">
      <div className="rounded-3xl border border-slate-200/80 bg-white/70 p-3 lg:p-4">
        <div className="mb-4 flex items-center gap-3">
          <button
            type="button"
            onClick={onClose}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-slate-300 bg-white text-slate-700 shadow-sm transition hover:border-slate-900 hover:bg-slate-900 hover:text-white active:scale-95"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">
              Account
            </p>
            <h2 className="truncate text-[17px] font-bold tracking-tight text-slate-900">
              {isCreate ? "Create Account" : "Edit Account"}
            </h2>
          </div>
        </div>

        <div className="space-y-3">
          <label className="block rounded-2xl border border-slate-200 bg-white p-3">
            <span className="mb-1.5 block text-[11px] font-bold text-slate-500">
              Nama
            </span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-[14px] font-medium text-slate-800 outline-none transition focus:border-[#0f1a3b] focus:ring-2 focus:ring-[#0f1a3b]/20"
              placeholder={isCreate ? "Nama akun" : "Memuat..."}
            />
          </label>
          <label className="block rounded-2xl border border-slate-200 bg-white p-3">
            <span className="mb-1.5 block text-[11px] font-bold text-slate-500">
              Role
            </span>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-[14px] font-medium text-slate-800 outline-none transition focus:border-[#0f1a3b] focus:ring-2 focus:ring-[#0f1a3b]/20 appearance-none"
            >
              <option value="" disabled>
                Pilih Role
              </option>
              <option value="Driver">Driver</option>
              <option value="Admin">Admin</option>
              <option value="Pengguna umum">Pengguna umum</option>
            </select>
          </label>
          <label className="block rounded-2xl border border-slate-200 bg-white p-3">
            <span className="mb-1.5 block text-[11px] font-bold text-slate-500">
              Username
            </span>
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-[14px] font-medium text-slate-800 outline-none transition focus:border-[#0f1a3b] focus:ring-2 focus:ring-[#0f1a3b]/20"
              placeholder={isCreate ? "username" : "Memuat..."}
            />
          </label>
          <label className="block rounded-2xl border border-slate-200 bg-white p-3">
            <span className="mb-1.5 block text-[11px] font-bold text-slate-500">
              Password {isCreate ? "" : "(Kosongkan jika tidak ingin diubah)"}
            </span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-[14px] font-medium text-slate-800 outline-none transition focus:border-[#0f1a3b] focus:ring-2 focus:ring-[#0f1a3b]/20"
              placeholder="Password"
            />
          </label>
          <label className="block rounded-2xl border border-slate-200 bg-white p-3">
            <span className="mb-1.5 block text-[11px] font-bold text-slate-500">
              Konfirmasi Password
            </span>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-[14px] font-medium text-slate-800 outline-none transition focus:border-[#0f1a3b] focus:ring-2 focus:ring-[#0f1a3b]/20"
              placeholder="Konfirmasi Password"
            />
          </label>
          {errorMsg && (
            <p className="text-[12px] font-medium text-red-500 px-1">
              {errorMsg}
            </p>
          )}
        </div>

        <button
          type="button"
          onClick={handleSave}
          disabled={isLoading}
          className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-[#0f1a3b] px-4 py-3 text-[14px] font-bold text-white shadow-sm transition hover:bg-[#1a2b55] active:scale-[0.98] disabled:opacity-70"
        >
          {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {isLoading ? "Menyimpan..." : "Simpan Akun"}
        </button>
      </div>
    </section>
  );
}
