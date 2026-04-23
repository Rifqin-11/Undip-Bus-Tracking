"use client";

import React from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  BuggyIcon,
  HalteIcon,
  LoginIcon,
  LogoutIcon,
  DataIcon,
  ChatIcon,
  HistoryIcon,
} from "@/components/ui/Icons";
import type { PanelView } from "@/types/buggy";

type MobileBottomNavProps = {
  activeView: PanelView;
  onSelectView: (view: PanelView) => void;
  showDataButton?: boolean;
};

const navButtonBase =
  "grid h-12 w-12 place-items-center rounded-full transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300/80 active:scale-95";

const activeButtonClass =
  "bg-[#0f1a3b] text-white shadow-[0_8px_18px_rgba(15,26,59,0.45)]";

const inactiveButtonClass =
  "border border-white/25 bg-slate-500/25 text-white/90 hover:bg-slate-500/35 active:bg-slate-500/45";

const navItems: {
  view: PanelView;
  label: string;
  Icon: React.FC<React.SVGProps<SVGSVGElement>>;
}[] = [
  { view: "buggy", label: "Buggy", Icon: BuggyIcon },
  { view: "halte", label: "Halte", Icon: HalteIcon },
  { view: "lapor", label: "Lapor", Icon: ChatIcon },
];

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
    <nav
      className="fixed bottom-4 left-1/2 z-50 flex w-[calc(100%-5rem)] max-w-sm -translate-x-1/2 items-center justify-around rounded-full border border-white/35 bg-transparent px-2 py-1.5 shadow-[0_18px_40px_rgba(0,0,0,0.35)] backdrop-blur-2xl xl:hidden"
      style={{ bottom: "calc(1rem + var(--sai-bottom, 0px))" }}
    >
      {shouldShowDataButton && (
        <button
          type="button"
          className={`${navButtonBase} ${activeView === "data" ? activeButtonClass : inactiveButtonClass}`}
          aria-label="Data"
          onClick={() => onSelectView("data")}
        >
          <DataIcon className="h-6 w-6" />
        </button>
      )}

      {shouldShowDataButton && (
        <button
          type="button"
          className={`${navButtonBase} ${activeView === "history" ? activeButtonClass : inactiveButtonClass}`}
          aria-label="History"
          onClick={() => onSelectView("history")}
        >
          <HistoryIcon className="h-6 w-6" />
        </button>
      )}

      {navItems.map(({ view, label, Icon }) => (
        <button
          key={view}
          type="button"
          className={`${navButtonBase} ${activeView === view ? activeButtonClass : inactiveButtonClass}`}
          aria-label={label}
          onClick={() => onSelectView(view)}
        >
          <Icon className="h-6 w-6" />
        </button>
      ))}

      {/* Login / Logout admin */}
      <button
        type="button"
        className={`${navButtonBase} ${isOnAdminPage ? activeButtonClass : inactiveButtonClass}`}
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
