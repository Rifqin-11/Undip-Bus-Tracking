"use client";

import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Skeleton } from "@/components/ui/Skeleton";

type UserSummary = {
  name?: string | null;
  role?: string | null;
  avatar?: string | null;
};

export type AccountMenuItem = {
  label: string;
  icon?: ReactNode;
  onClick: () => void;
  /** Untuk item destruktif (keluar). */
  tone?: "default" | "danger";
};

type AccountPillProps = {
  variant: "desktop" | "mobile-icon";
  user?: UserSummary | null;
  /** Klik tombol langsung (jika `menuItems` tidak diberikan / kosong). */
  onClick?: () => void;
  /** Jika diisi, klik akan toggle dropdown menu. */
  menuItems?: AccountMenuItem[];
  /** Konten saat user tidak login. */
  fallback?: {
    label: string;
    description?: string;
    icon: ReactNode;
    onClick: () => void;
  };
  /** Karakter avatar default, misalnya "A" atau "D". */
  defaultAvatar?: string;
  /** Default role fallback text. */
  defaultRole?: string;
  /** Default name fallback text. */
  defaultName?: string;
  /** Tampilkan skeleton selama session/profile masih dimuat. */
  loading?: boolean;
};

/**
 * Account pill untuk dashboard.
 * - `variant="desktop"`: pill putih dengan name + role (visible xl ke atas).
 * - `variant="mobile-icon"`: tombol bulat icon-only dengan avatar.
 * - Jika `menuItems` diberikan, klik akan toggle dropdown menu di bawah.
 */
export function AccountPill({
  variant,
  user,
  onClick,
  menuItems,
  fallback,
  defaultAvatar = "A",
  defaultRole = "SIMOBI Operator",
  defaultName = "Admin",
  loading = false,
}: AccountPillProps) {
  const { t } = useTranslation("common");
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const hasMenu = !!menuItems && menuItems.length > 0;

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    window.addEventListener("mousedown", handler);
    return () => window.removeEventListener("mousedown", handler);
  }, [open]);

  // ── Loading: skeleton pill ────────────────────────────────────────────────
  if (loading) {
    if (variant === "mobile-icon") {
      return (
        <Skeleton className="h-10 w-10 shrink-0 rounded-full border border-white/20" />
      );
    }
    return (
      <div className="flex w-full min-w-37.5 items-center gap-3 rounded-full border border-white/60 bg-white px-3 py-2 shadow-[0_10px_30px_rgba(15,23,42,0.12)] backdrop-blur-xl">
        <Skeleton className="size-8 shrink-0 rounded-full" />
        <div className="min-w-0 flex-1 space-y-1">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-2.5 w-24" />
        </div>
      </div>
    );
  }

  // ── Not logged in: render fallback ─────────────────────────────────────────
  if (!user) {
    if (!fallback) return null;
    if (variant === "mobile-icon") {
      return (
        <button
          type="button"
          aria-label={fallback.label}
          onClick={fallback.onClick}
          className="relative flex h-10 w-10 items-center justify-center rounded-full border border-white/20 bg-slate-900/50 text-white backdrop-blur-md transition active:scale-95"
        >
          {fallback.icon}
        </button>
      );
    }
    return (
      <button
        type="button"
        aria-label={fallback.label}
        onClick={fallback.onClick}
        className="flex w-full items-center gap-2 rounded-full border border-white/60 bg-white px-2 py-2 text-left shadow-[0_10px_30px_rgba(15,23,42,0.12)] backdrop-blur-xl transition hover:bg-white/90 active:scale-[0.98]"
      >
        <div className="grid size-8 place-items-center rounded-full bg-[#0f1a3b] text-sm font-black text-white">
          {fallback.icon}
        </div>
        <div className="min-w-0 pr-1">
          <p className="text-[13px] font-extrabold leading-tight text-slate-900">
            {fallback.label}
          </p>
          {fallback.description ? (
            <p className="text-[10px] font-semibold leading-tight text-slate-400">
              {fallback.description}
            </p>
          ) : null}
        </div>
      </button>
    );
  }

  // ── Logged in: avatar resolve ──────────────────────────────────────────────
  const avatarChar =
    (user.avatar?.toString().trim() ?? "") !== "" ? user.avatar : defaultAvatar;

  const handleTriggerClick = () => {
    if (hasMenu) {
      setOpen((v) => !v);
      return;
    }
    onClick?.();
  };

  // ── Mobile icon variant ────────────────────────────────────────────────────
  if (variant === "mobile-icon") {
    return (
      <div ref={containerRef} className="relative">
        <button
          type="button"
          aria-label={t("profile")}
          aria-expanded={hasMenu ? open : undefined}
          onClick={handleTriggerClick}
          className="relative flex h-10 w-10 items-center justify-center rounded-full border border-white/20 bg-slate-900/50 text-white backdrop-blur-md transition hover:bg-slate-800/70 active:scale-95"
        >
          <span className="grid size-8 place-items-center rounded-full bg-[#0f1a3b]/70 text-sm font-black text-white">
            {avatarChar}
          </span>
        </button>
        {hasMenu && open ? (
          <DropdownMenu items={menuItems!} onClose={() => setOpen(false)} />
        ) : null}
      </div>
    );
  }

  // ── Desktop variant ────────────────────────────────────────────────────────
  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        aria-label={t("accountMenu")}
        aria-expanded={hasMenu ? open : undefined}
        onClick={handleTriggerClick}
        className="flex w-full min-w-37.5 items-center gap-3 rounded-full border border-white/60 bg-white px-3 py-2 text-left shadow-[0_10px_30px_rgba(15,23,42,0.12)] backdrop-blur-xl transition hover:bg-white/90 active:scale-[0.98]"
      >
        <div className="grid size-8 place-items-center rounded-full bg-[#0f1a3b] text-sm font-black text-white">
          {avatarChar}
        </div>
        <div className="min-w-0 pr-1">
          <p className="text-[13px] font-extrabold leading-tight text-slate-900">
            {user.name ?? defaultName}
          </p>
          <p className="text-[10px] font-semibold leading-tight text-slate-400">
            {user.role ?? defaultRole}
          </p>
        </div>
      </button>
      {hasMenu && open ? (
        <DropdownMenu items={menuItems!} onClose={() => setOpen(false)} />
      ) : null}
    </div>
  );
}

function DropdownMenu({
  items,
  onClose,
}: {
  items: AccountMenuItem[];
  onClose: () => void;
}) {
  return (
    <div className="absolute right-0 top-full z-60 mt-2 w-42 overflow-hidden rounded-2xl border border-white/70 bg-white/95 p-1.5 text-slate-800 shadow-[0_14px_40px_rgba(15,23,42,0.18)] backdrop-blur-xl">
      {items.map((item, idx) => {
        const isDanger = item.tone === "danger";
        return (
          <button
            key={`${item.label}-${idx}`}
            type="button"
            onClick={() => {
              item.onClick();
              onClose();
            }}
            className={`flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-[12px] font-bold transition active:scale-[0.98] ${
              isDanger ? "text-rose-600 hover:bg-rose-50" : "hover:bg-slate-100"
            }`}
          >
            {item.icon ? (
              <span
                className={`grid h-4 w-4 place-items-center ${
                  isDanger ? "" : "text-slate-500"
                }`}
              >
                {item.icon}
              </span>
            ) : null}
            {item.label}
          </button>
        );
      })}
    </div>
  );
}
