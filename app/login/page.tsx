"use client";

import { FormEvent, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import logo from "@/public/logo.svg";

export default function LoginPage() {
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
    <main className="grid min-h-screen place-items-center bg-slate-100 px-4 py-10">
      <section className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_14px_40px_rgba(15,23,42,0.12)]">
        <div className="mb-6 flex items-center gap-3">
          <img
            src={logo.src}
            alt="Logo"
            className="h-12 w-12 rounded-full object-cover"
          />
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
              Smart Mobility UNDIP
            </p>
            <h1 className="text-[24px] font-bold text-slate-900">
              Login Admin
            </h1>
          </div>
        </div>

        <form className="space-y-3" onSubmit={handleSubmit}>
          <label className="block">
            <span className="mb-1 block text-[13px] font-medium text-slate-700">
              Username
            </span>
            <input
              type="text"
              className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-[14px] text-slate-900 outline-none transition focus:border-slate-500"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Masukkan username"
              autoComplete="username"
              required
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-[13px] font-medium text-slate-700">
              Password
            </span>
            <input
              type="password"
              className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-[14px] text-slate-900 outline-none transition focus:border-slate-500"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Masukkan password"
              autoComplete="current-password"
              required
            />
          </label>

          {errorMessage ? (
            <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-[12px] font-medium text-rose-700">
              {errorMessage}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={isSubmitting}
            className="mt-1 h-11 w-full rounded-xl bg-[#0f1a3b] text-[14px] font-semibold text-white transition hover:bg-[#162656] disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isSubmitting ? "Memproses..." : "Masuk ke Admin"}
          </button>
        </form>
      </section>
    </main>
  );
}
