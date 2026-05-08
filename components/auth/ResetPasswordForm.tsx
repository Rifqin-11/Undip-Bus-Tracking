"use client";

import { FormEvent, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import logo from "@/public/logo.svg";
import { createClient } from "@/lib/supabase/client";

function formatResetError(err: unknown) {
  if (!(err instanceof Error)) return "Terjadi kesalahan.";

  const message = err.message.toLowerCase();
  if (message.includes("session") || message.includes("auth")) {
    return "Link reset tidak valid atau sudah kedaluwarsa. Silakan minta link reset baru.";
  }

  return err.message;
}

export function ResetPasswordForm() {
  const supabase = createClient();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);
    setIsSubmitting(true);

    try {
      if (password.length < 6) {
        throw new Error("Kata sandi minimal 6 karakter.");
      }

      if (password !== confirmPassword) {
        throw new Error("Kata sandi dan konfirmasi kata sandi tidak cocok.");
      }

      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;

      await supabase.auth.signOut();
      setPassword("");
      setConfirmPassword("");
      setSuccessMessage(
        "Kata sandi berhasil diperbarui. Silakan login dengan kata sandi baru.",
      );
    } catch (err: unknown) {
      setErrorMessage(formatResetError(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className="relative z-10 w-full max-w-md rounded-[2rem] border border-white/45 bg-white/75 p-5 shadow-[0_30px_80px_rgba(15,23,42,0.18)] backdrop-blur-xl sm:p-7">
      <div className="mb-6 flex items-center gap-3">
        <Image
          src={logo.src}
          alt="Logo SIMOBI"
          width={44}
          height={44}
          className="h-11 w-11 rounded-xl border border-slate-200/80 bg-white p-1.5 object-contain"
        />
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
            SIMOBI
          </p>
          <h1 className="text-[24px] font-bold tracking-tight text-slate-900">
            Buat Kata Sandi Baru
          </h1>
        </div>
      </div>

      <p className="mb-5 text-sm leading-relaxed text-slate-600">
        Masukkan kata sandi baru untuk akun Anda. Halaman ini hanya bisa
        digunakan setelah membuka link reset dari email Supabase.
      </p>

      <form className="space-y-3.5" onSubmit={handleSubmit}>
        <label className="block">
          <span className="mb-1.5 block text-[13px] font-medium text-slate-700">
            Kata Sandi Baru
          </span>
          <input
            type="password"
            className="h-11 w-full rounded-2xl border border-slate-300/80 bg-white/90 px-3.5 text-[14px] text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[#2a4f8e] focus:ring-3 focus:ring-[#2a4f8e]/15"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Minimal 6 karakter"
            autoComplete="new-password"
            required
          />
        </label>

        <label className="block">
          <span className="mb-1.5 block text-[13px] font-medium text-slate-700">
            Konfirmasi Kata Sandi Baru
          </span>
          <input
            type="password"
            className="h-11 w-full rounded-2xl border border-slate-300/80 bg-white/90 px-3.5 text-[14px] text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[#2a4f8e] focus:ring-3 focus:ring-[#2a4f8e]/15"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Masukkan ulang kata sandi"
            autoComplete="new-password"
            required
          />
        </label>

        {errorMessage ? (
          <p className="rounded-2xl border border-rose-200 bg-rose-50/90 px-3.5 py-2.5 text-[12px] font-medium text-rose-700">
            {errorMessage}
          </p>
        ) : null}

        {successMessage ? (
          <p className="rounded-2xl border border-emerald-200 bg-emerald-50/90 px-3.5 py-2.5 text-[12px] font-medium text-emerald-700">
            {successMessage}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={isSubmitting || !!successMessage}
          className="h-11 w-full rounded-2xl bg-[#0f1a3b] text-[14px] font-bold text-white transition hover:bg-[#1a2b59] disabled:cursor-not-allowed disabled:opacity-70"
        >
          {isSubmitting ? "Menyimpan..." : "Simpan Kata Sandi Baru"}
        </button>
      </form>

      <Link
        href="/login"
        className="mt-3 flex h-11 w-full items-center justify-center rounded-2xl border border-slate-200 bg-white text-[14px] font-semibold text-slate-700 transition hover:bg-slate-50 active:scale-95"
      >
        Kembali ke Login
      </Link>
    </section>
  );
}
