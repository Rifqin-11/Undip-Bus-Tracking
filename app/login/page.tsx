import { Suspense } from "react";
import LoginForm from "../../components/Auth/LoginForm";

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <main className="relative flex min-h-screen items-center justify-center bg-[#e8eef8] px-4 py-10">
          <div className="rounded-2xl border border-white/45 bg-white/72 px-6 py-4 text-sm text-slate-700 backdrop-blur-xl">
            Memuat halaman login...
          </div>
        </main>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
