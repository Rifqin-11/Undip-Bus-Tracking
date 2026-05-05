"use client";

import { FormEvent, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import logo from "@/public/logo.svg";
import { createClient } from "@/lib/supabase/client";

export default function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  const [isRegister, setIsRegister] = useState(false);
  
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const supabase = createClient();

  const redirectTo = useMemo(() => {
    const next = searchParams.get("next");
    if (!next || !next.startsWith("/")) return "/admin";
    return next;
  }, [searchParams]);

  const handleGoogleLogin = async () => {
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/api/auth/callback?next=${redirectTo}`,
        },
      });
      if (error) throw error;
    } catch (err: any) {
      setErrorMessage(err.message || "Gagal login dengan Google");
    }
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);
    setIsSubmitting(true);

    try {
      if (isRegister) {
        if (password !== confirmPassword) {
          throw new Error("Password dan konfirmasi password tidak cocok.");
        }
        if (!name.trim()) {
          throw new Error("Nama lengkap wajib diisi.");
        }
        
        const { error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            data: { full_name: name.trim() },
          }
        });
        
        if (error) throw error;
        
        setSuccessMessage("Registrasi berhasil! Silakan login (cek email jika konfirmasi aktif).");
        setIsRegister(false);
        setPassword("");
        setConfirmPassword("");
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });

        if (error) throw error;

        router.replace(redirectTo);
        router.refresh();
      }
    } catch (err: any) {
      setErrorMessage(err.message || "Terjadi kesalahan.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#e8eef8] px-4 py-10">
      <div className="pointer-events-none absolute -left-20 -top-20 h-72 w-72 rounded-full bg-[#1c3f7d]/22 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-28 -right-12 h-96 w-96 rounded-full bg-[#51a0e2]/24 blur-3xl" />
      <div className="pointer-events-none absolute left-1/2 top-1/2 h-64 w-[32rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/35 blur-3xl" />

      <section className="liquid-glass-shell relative z-10 w-full max-w-4xl rounded-[2rem] border border-white/45 p-3 shadow-[0_30px_80px_rgba(15,23,42,0.18)] sm:p-4">
        <div className="grid gap-3 md:grid-cols-[1.04fr_0.96fr]">
          <div className="hidden rounded-3xl bg-gradient-to-br from-[#0f1a3b] via-[#1a2b59] to-[#29508f] p-8 text-white md:flex md:flex-col md:justify-between">
            <div>
              <div className="mb-6 flex items-center gap-3">
                <img
                  src={logo.src}
                  alt="Logo SIMOBI"
                  className="h-11 w-11 rounded-xl bg-white/90 p-1.5 object-contain"
                />
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-blue-100/90">
                    Smart Mobility UNDIP
                  </p>
                  <h1 className="text-xl font-bold tracking-tight">
                    SIMOBI Admin
                  </h1>
                </div>
              </div>

              <p className="max-w-xs text-sm leading-relaxed text-blue-100/85">
                Kelola armada buggy listrik secara realtime, pantau rute, dan
                kontrol area geofence dalam satu dashboard terintegrasi.
              </p>
            </div>

            <div className="space-y-2.5 text-sm text-blue-50/90">
              <p className="rounded-xl border border-white/20 bg-white/10 px-3 py-2">
                Realtime Tracking
              </p>
              <p className="rounded-xl border border-white/20 bg-white/10 px-3 py-2">
                Geofence Alert
              </p>
              <p className="rounded-xl border border-white/20 bg-white/10 px-3 py-2">
                Smart Route Guidance
              </p>
            </div>
          </div>

          <div className="rounded-3xl border border-white/45 bg-white/70 p-5 backdrop-blur-xl sm:p-7">
            <div className="mb-6 flex items-center gap-3 md:hidden">
              <img
                src={logo.src}
                alt="Logo SIMOBI"
                className="h-11 w-11 rounded-xl border border-slate-200/80 bg-white p-1.5 object-contain"
              />
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                  Smart Mobility UNDIP
                </p>
                <h1 className="text-[22px] font-bold tracking-tight text-slate-900">
                  {isRegister ? "Daftar Admin" : "Login Admin"}
                </h1>
              </div>
            </div>

            <div className="mb-6 hidden md:block">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                Admin Access
              </p>
              <h2 className="mt-1 text-[28px] font-bold tracking-tight text-slate-900">
                {isRegister ? "Buat Akun Baru" : "Selamat Datang"}
              </h2>
              <p className="mt-1 text-sm text-slate-600">
                {isRegister ? "Daftar untuk mengakses dashboard." : "Masuk untuk membuka dashboard manajemen SIMOBI."}
              </p>
            </div>

            <button
              type="button"
              onClick={handleGoogleLogin}
              className="mb-4 flex w-full items-center justify-center gap-3 rounded-2xl border border-slate-300 bg-white px-4 py-3 text-[14px] font-bold text-slate-700 transition hover:bg-slate-50 active:scale-[0.98]"
            >
              <svg className="h-5 w-5" viewBox="0 0 24 24">
                <path
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  fill="#4285F4"
                />
                <path
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  fill="#34A853"
                />
                <path
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  fill="#FBBC05"
                />
                <path
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  fill="#EA4335"
                />
              </svg>
              {isRegister ? "Daftar dengan Google" : "Masuk dengan Google"}
            </button>

            <div className="mb-4 flex items-center gap-3">
              <div className="h-px flex-1 bg-slate-200" />
              <span className="text-[12px] font-medium text-slate-400">atau dengan email</span>
              <div className="h-px flex-1 bg-slate-200" />
            </div>

            <form className="space-y-3.5" onSubmit={handleSubmit}>
              {isRegister && (
                <label className="block">
                  <span className="mb-1.5 block text-[13px] font-medium text-slate-700">
                    Nama Lengkap
                  </span>
                  <input
                    type="text"
                    className="h-11 w-full rounded-2xl border border-slate-300/80 bg-white/90 px-3.5 text-[14px] text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[#2a4f8e] focus:ring-3 focus:ring-[#2a4f8e]/15"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Masukkan nama lengkap"
                    required
                  />
                </label>
              )}

              <label className="block">
                <span className="mb-1.5 block text-[13px] font-medium text-slate-700">
                  Email
                </span>
                <input
                  type="email"
                  className="h-11 w-full rounded-2xl border border-slate-300/80 bg-white/90 px-3.5 text-[14px] text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[#2a4f8e] focus:ring-3 focus:ring-[#2a4f8e]/15"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Masukkan email"
                  autoComplete="email"
                  required
                />
              </label>

              <label className="block">
                <span className="mb-1.5 block text-[13px] font-medium text-slate-700">
                  Password
                </span>
                <input
                  type="password"
                  className="h-11 w-full rounded-2xl border border-slate-300/80 bg-white/90 px-3.5 text-[14px] text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[#2a4f8e] focus:ring-3 focus:ring-[#2a4f8e]/15"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Masukkan password"
                  autoComplete="current-password"
                  required
                />
              </label>

              {isRegister && (
                <label className="block">
                  <span className="mb-1.5 block text-[13px] font-medium text-slate-700">
                    Konfirmasi Password
                  </span>
                  <input
                    type="password"
                    className="h-11 w-full rounded-2xl border border-slate-300/80 bg-white/90 px-3.5 text-[14px] text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[#2a4f8e] focus:ring-3 focus:ring-[#2a4f8e]/15"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Masukkan ulang password"
                    required
                  />
                </label>
              )}

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
                disabled={isSubmitting}
                className="mt-1 h-11 w-full rounded-2xl bg-[#0f1a3b] text-[14px] font-bold text-white transition hover:bg-[#1a2b59] disabled:cursor-not-allowed disabled:opacity-70"
              >
                {isSubmitting ? "Loading..." : isRegister ? "Daftar" : "Login"}
              </button>

              <div className="pt-2 text-center text-[13px] text-slate-600">
                {isRegister ? "Sudah punya akun? " : "Belum punya akun? "}
                <button
                  type="button"
                  onClick={() => {
                    setIsRegister(!isRegister);
                    setErrorMessage(null);
                    setSuccessMessage(null);
                  }}
                  className="font-bold text-[#2a4f8e] hover:underline"
                >
                  {isRegister ? "Login di sini" : "Daftar di sini"}
                </button>
              </div>

              <div className="pt-1">
                <Link
                  href="/"
                  className="flex h-11 w-full items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 text-[14px] font-semibold text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 active:scale-95"
                >
                  Kembali ke Beranda
                </Link>
              </div>
            </form>
          </div>
        </div>
      </section>
    </main>
  );
}
