"use client";

import { FormEvent, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import logo from "@/public/logo.svg";

export default function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const redirectTo = useMemo(() => {
    const next = searchParams.get("next");
    if (!next || !next.startsWith("/")) return "/admin";
    return next;
  }, [searchParams]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: username.trim(),
          password,
        }),
      });

      if (!response.ok) {
        const data = (await response.json()) as { message?: string };
        setErrorMessage(data.message ?? "Login gagal.");
        return;
      }

      router.replace(redirectTo);
      router.refresh();
    } catch {
      setErrorMessage("Terjadi kesalahan saat login.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#e8eef8] px-4 py-10">
      <div className="pointer-events-none absolute -left-20 -top-20 h-72 w-72 rounded-full bg-[#1c3f7d]/22 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-28 -right-12 h-96 w-96 rounded-full bg-[#51a0e2]/24 blur-3xl" />
      <div className="pointer-events-none absolute left-1/2 top-1/2 h-64 w-lg -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/35 blur-3xl" />

      <section className="liquid-glass-shell relative z-10 w-full max-w-4xl rounded-4xl border border-white/45 p-3 shadow-[0_30px_80px_rgba(15,23,42,0.18)] sm:p-4">
        <div className="grid gap-3 md:grid-cols-[1.04fr_0.96fr]">
          <div className="hidden rounded-3xl bg-linear-to-br from-[#0f1a3b] via-[#1a2b59] to-[#29508f] p-8 text-white md:flex md:flex-col md:justify-between">
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
              <p className="rounded-xl border border-white/18 bg-white/10 px-3 py-2">
                Realtime Tracking
              </p>
              <p className="rounded-xl border border-white/18 bg-white/10 px-3 py-2">
                Geofence Alert
              </p>
              <p className="rounded-xl border border-white/18 bg-white/10 px-3 py-2">
                Smart Route Guidance
              </p>
            </div>
          </div>

          <div className="rounded-3xl border border-white/45 bg-white/72 p-5 backdrop-blur-xl sm:p-7">
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
                  Login Admin
                </h1>
              </div>
            </div>

            <div className="mb-6 hidden md:block">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                Admin Access
              </p>
              <h2 className="mt-1 text-[28px] font-bold tracking-tight text-slate-900">
                Selamat Datang
              </h2>
              <p className="mt-1 text-sm text-slate-600">
                Masuk untuk membuka dashboard manajemen SIMOBI.
              </p>
            </div>

            <form className="space-y-3.5" onSubmit={handleSubmit}>
              <label className="block">
                <span className="mb-1.5 block text-[13px] font-medium text-slate-700">
                  Username
                </span>
                <input
                  type="text"
                  className="h-11 w-full rounded-2xl border border-slate-300/80 bg-white/90 px-3.5 text-[14px] text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[#2a4f8e] focus:ring-3 focus:ring-[#2a4f8e]/15"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Masukkan username"
                  autoComplete="username"
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

              {errorMessage ? (
                <p className="rounded-2xl border border-rose-200 bg-rose-50/90 px-3.5 py-2.5 text-[12px] font-medium text-rose-700">
                  {errorMessage}
                </p>
              ) : null}

              <button
                type="submit"
                disabled={isSubmitting}
                className="liquid-glass-cta mt-1 h-11 w-full rounded-2xl text-[14px] font-semibold text-white bg-blue-900 transition hover:bg-slate-200 hover:text-blue-900  disabled:cursor-not-allowed disabled:opacity-70"
              >
                {isSubmitting ? "Loading..." : "Login"}
              </button>
            </form>
          </div>
        </div>
      </section>
    </main>
  );
}
