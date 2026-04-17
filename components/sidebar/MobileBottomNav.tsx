"use client";

import { usePathname, useRouter } from "next/navigation";
import {
  BuggyIcon,
  HalteIcon,
  RouteIcon,
  InfoIcon,
  LoginIcon,
  LogoutIcon,
  DataIcon,
} from "@/components/map/Icons";
import type { PanelView } from "@/types/buggy";

type MobileBottomNavProps = {
  activeView: PanelView;
  onSelectView: (view: PanelView) => void;
  showDataButton?: boolean;
};

const navButtonBase =
  "grid h-12 w-12 place-items-center rounded-2xl transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 active:scale-95";

export function MobileBottomNav({
  activeView,
  onSelectView,
  showDataButton = false,
}: MobileBottomNavProps) {
  const pathname = usePathname();
  const router = useRouter();
  const isOnAdminPage = pathname.startsWith("/admin");
  const shouldShowDataButton = isOnAdminPage && showDataButton;

  const handleAdminButtonClick = async () => {
    if (isOnAdminPage) {
      try {
        await fetch("/api/auth/logout", { method: "POST" });
      } catch {
        // noop
      }
      router.push("/");
      router.refresh();
      return;
    }

    router.push("/login");
  };

  return (
    <nav className="fixed bottom-4 left-1/2 z-50 flex w-[calc(100%-2rem)] max-w-md -translate-x-1/2 items-center justify-around gap-1 rounded-3xl border-2 border-white/50 bg-white/90 px-4 py-3 shadow-[0_8px_32px_rgba(15,23,42,0.25)] backdrop-blur-xl xl:hidden">
      {shouldShowDataButton ? (
        <button
          type="button"
          className={`${navButtonBase} ${activeView === "data" ? "bg-[#0f1a3b] text-white shadow-lg" : "text-slate-500 active:bg-slate-100"}`}
          aria-label="Data"
          onClick={() => onSelectView("data")}
        >
          <DataIcon className="h-6 w-6" />
        </button>
      ) : null}
      <button
        type="button"
        className={`${navButtonBase} ${activeView === "buggy" ? "bg-[#0f1a3b] text-white shadow-lg" : "text-slate-500 active:bg-slate-100"}`}
        aria-label="Buggy"
        onClick={() => onSelectView("buggy")}
      >
        <BuggyIcon className="h-6 w-6" />
      </button>
      <button
        type="button"
        className={`${navButtonBase} ${activeView === "halte" ? "bg-[#0f1a3b] text-white shadow-lg" : "text-slate-500 active:bg-slate-100"}`}
        aria-label="Halte"
        onClick={() => onSelectView("halte")}
      >
        <HalteIcon className="h-6 w-6" />
      </button>
      <button
        type="button"
        className={`${navButtonBase} ${activeView === "rute" ? "bg-[#0f1a3b] text-white shadow-lg" : "text-slate-500 active:bg-slate-100"}`}
        aria-label="Rute"
        onClick={() => onSelectView("rute")}
      >
        <RouteIcon className="h-6 w-6" />
      </button>
      <button
        type="button"
        className={`${navButtonBase} ${activeView === "info" ? "bg-[#0f1a3b] text-white shadow-lg" : "text-slate-500 active:bg-slate-100"}`}
        aria-label="Info"
        onClick={() => onSelectView("info")}
      >
        <InfoIcon className="h-6 w-6" />
      </button>
      <button
        type="button"
        className="grid h-12 w-12 place-items-center rounded-2xl bg-[#0f1a3b] text-white shadow-lg transition-all duration-200 active:scale-95"
        aria-label={isOnAdminPage ? "Logout admin" : "Login admin"}
        onClick={handleAdminButtonClick}
      >
        {isOnAdminPage ? (
          <LogoutIcon className="h-6 w-6" />
        ) : (
          <LoginIcon className="h-6 w-6" />
        )}
      </button>
    </nav>
  );
}
