import LoginForm from "@/components/auth/LoginForm";
import { getServerT } from "@/lib/i18n/server";
import { normalizeLocale } from "@/lib/i18n/config";
import { Suspense } from "react";

export default async function LoginPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: rawLocale } = await params;
  const t = await getServerT(normalizeLocale(rawLocale), "auth");

  return (
    <Suspense
      fallback={
        <main className="relative flex min-h-screen items-center justify-center bg-[#e8eef8] px-4 py-10">
          <div className="rounded-2xl border border-white/45 bg-white/72 px-6 py-4 text-sm text-slate-700 backdrop-blur-xl">
            {t("loadingSignIn")}
          </div>
        </main>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
