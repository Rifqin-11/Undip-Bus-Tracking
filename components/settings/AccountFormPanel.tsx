"use client";

import { ChevronLeft, Save, Loader2 } from "lucide-react";
import { useMemo, useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Buggy } from "@/types/buggy";

export type AccountFormMode = "edit" | "create";

type AccountFormPanelProps = {
  mode: AccountFormMode;
  onClose: () => void;
};

const fallbackBuggyOptions = [
  { id: "buggy-1", label: "Buggy 01" },
  { id: "buggy-2", label: "Buggy 02" },
  { id: "buggy-3", label: "Buggy 03" },
  { id: "buggy-4", label: "Buggy 04" },
  { id: "buggy-5", label: "Buggy 05" },
];

export function AccountFormPanel({ mode, onClose }: AccountFormPanelProps) {
  const isCreate = mode === "create";

  const [name, setName] = useState("");
  const [role, setRole] = useState("Pengguna umum");
  const [buggyId, setBuggyId] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [buggyOptions, setBuggyOptions] = useState(fallbackBuggyOptions);

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
      setEmail(account?.email || user.email || "admin");
      setRole(account?.role || "Pengguna umum");
      setBuggyId(account?.buggy_id || "");
    }
    loadUserData();
  }, [isCreate]);

  useEffect(() => {
    async function loadBuggyOptions() {
      try {
        const response = await fetch("/api/buggy", { cache: "no-store" });
        if (!response.ok) return;

        const buggies = (await response.json()) as Buggy[];
        const nextOptions = buggies.map((buggy) => ({
          id: buggy.id,
          label: `${buggy.code} - ${buggy.name}`,
        }));

        if (nextOptions.length > 0) {
          setBuggyOptions(nextOptions);
        }
      } catch {
        // Tetap pakai opsi fallback.
      }
    }

    if (isCreate) {
      void loadBuggyOptions();
    }
  }, [isCreate]);

  const visibleBuggyOptions = useMemo(() => {
    if (!buggyId || buggyOptions.some((buggy) => buggy.id === buggyId)) {
      return buggyOptions;
    }

    return [{ id: buggyId, label: buggyId }, ...buggyOptions];
  }, [buggyId, buggyOptions]);

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

    if (!name || !email || (isCreate && !password)) {
      setErrorMsg("Nama, email, dan password wajib diisi!");
      return;
    }

    setIsLoading(true);
    setErrorMsg("");

    try {
      if (isCreate) {
        const res = await fetch("/api/admin/accounts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, email, role, password, buggy_id: buggyId }),
        });

        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.message || "Gagal membuat akun");
        }

        onClose(); // Sukses
      } else {
        const supabase = createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          throw new Error("Sesi tidak ditemukan. Silakan Sign-In ulang.");
        }

        const authUpdate: {
          email?: string;
          password?: string;
          data: { full_name: string };
        } = {
          data: { full_name: name.trim() },
        };

        if (email.trim() && email.trim() !== user.email) {
          authUpdate.email = email.trim();
        }

        if (password) {
          authUpdate.password = password;
        }

        const { error: authError } = await supabase.auth.updateUser(authUpdate);
        if (authError) {
          throw authError;
        }

        const { error: accountError } = await supabase
          .from("accounts")
          .update({ name: name.trim() })
          .eq("id", user.id);

        if (accountError) {
          throw accountError;
        }

        onClose();
      }
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : "Terjadi kesalahan");
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
          {isCreate ? (
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
          ) : (
            <div className="block rounded-2xl border border-slate-200 bg-white p-3">
              <span className="mb-1.5 block text-[11px] font-bold text-slate-500">
                Role
              </span>
              <p className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-[14px] font-medium text-slate-700">
                {role || "Pengguna umum"}
              </p>
            </div>
          )}

          {isCreate && role === "Driver" && (
            <label className="block rounded-2xl border border-slate-200 bg-white p-3">
              <span className="mb-1.5 block text-[11px] font-bold text-slate-500">
                Pilih Buggy (Khusus Driver)
              </span>
              <select
                value={buggyId}
                onChange={(e) => setBuggyId(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-[14px] font-medium text-slate-800 outline-none transition focus:border-[#0f1a3b] focus:ring-2 focus:ring-[#0f1a3b]/20 appearance-none"
              >
                <option value="" disabled>
                  Pilih Buggy
                </option>
                {visibleBuggyOptions.map((buggy) => (
                  <option key={buggy.id} value={buggy.id}>
                    {buggy.label}
                  </option>
                ))}
              </select>
            </label>
          )}

          <label className="block rounded-2xl border border-slate-200 bg-white p-3">
            <span className="mb-1.5 block text-[11px] font-bold text-slate-500">
              Email
            </span>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-[14px] font-medium text-slate-800 outline-none transition focus:border-[#0f1a3b] focus:ring-2 focus:ring-[#0f1a3b]/20"
              placeholder={isCreate ? "email" : "Memuat..."}
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
