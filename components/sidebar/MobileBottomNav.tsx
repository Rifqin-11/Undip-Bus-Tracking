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
  "grid h-13 w-13 place-items-center rounded-full transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300/80 active:scale-95";

const activeButtonClass =
  "bg-[#0f1a3b] text-white shadow-[0_8px_18px_rgba(15,26,59,0.45)]";

const inactiveButtonClass =
  "border border-white/25 bg-slate-500/25 text-white/90 hover:bg-slate-500/35 active:bg-slate-500/45";

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
    <nav className="fixed bottom-4 left-1/2 z-50 flex w-[calc(100%-2rem)] max-w-md -translate-x-1/2 items-center justify-center gap-2 rounded-full border border-white/35 bg-transparent px-3 py-2 shadow-[0_18px_40px_rgba(0,0,0,0.35)] backdrop-blur-2xl xl:hidden">
      {shouldShowDataButton ? (
        <button
          type="button"
          className={`${navButtonBase} ${activeView === "data" ? activeButtonClass : inactiveButtonClass}`}
          aria-label="Data"
          onClick={() => onSelectView("data")}
        >
          <DataIcon className="h-6 w-6" />
        </button>
      ) : null}
      <button
        type="button"
        className={`${navButtonBase} ${activeView === "buggy" ? activeButtonClass : inactiveButtonClass}`}
        aria-label="Buggy"
        onClick={() => onSelectView("buggy")}
      >
        <BuggyIcon className="h-6 w-6" />
      </button>
      <button
        type="button"
        className={`${navButtonBase} ${activeView === "halte" ? activeButtonClass : inactiveButtonClass}`}
        aria-label="Halte"
        onClick={() => onSelectView("halte")}
      >
        <HalteIcon className="h-6 w-6" />
      </button>
      <button
        type="button"
        className={`${navButtonBase} ${activeView === "rute" ? activeButtonClass : inactiveButtonClass}`}
        aria-label="Rute"
        onClick={() => onSelectView("rute")}
      >
        <RouteIcon className="h-6 w-6" />
      </button>
      <button
        type="button"
        className={`${navButtonBase} ${activeView === "info" ? activeButtonClass : inactiveButtonClass}`}
        aria-label="Info"
        onClick={() => onSelectView("info")}
      >
        <InfoIcon className="h-6 w-6" />
      </button>
      <button
        type="button"
        className={`${navButtonBase} bg-[#0f1a3b] text-white shadow-[0_8px_18px_rgba(15,26,59,0.45)]`}
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
