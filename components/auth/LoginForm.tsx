"use client";

import { useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { AuthForm } from "@/components/auth/AuthForm";

export default function LoginForm() {
  const searchParams = useSearchParams();

  const redirectTo = useMemo(() => {
    const next = searchParams.get("next");
    if (!next || !next.startsWith("/")) return "/admin";
    return next;
  }, [searchParams]);

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#e8eef8] px-4 py-10">
      <div className="pointer-events-none absolute -left-20 -top-20 h-72 w-72 rounded-full bg-[#1c3f7d]/22 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-28 -right-12 h-96 w-96 rounded-full bg-[#51a0e2]/24 blur-3xl" />
      <div className="pointer-events-none absolute left-1/2 top-1/2 h-64 w-[32rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/35 blur-3xl" />

      <AuthForm redirectTo={redirectTo} />
    </main>
  );
}
