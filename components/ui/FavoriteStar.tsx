"use client";

import { Star } from "lucide-react";
import { useTranslation } from "react-i18next";

type FavoriteStarProps = {
  /** Apakah item ini sudah di-favorit. */
  active: boolean;
  /** Callback saat user toggle. Wrap async error handling di pemanggil. */
  onToggle: () => void | Promise<unknown>;
  /** Jika false (guest user atau belum ready), tombol disembunyikan. */
  visible?: boolean;
  /** Variant ukuran. Default `"sm"`. */
  size?: "xs" | "sm" | "md";
  /** Optional aria-label override. */
  label?: string;
  /** Tambahan className container. */
  className?: string;
};

const SIZE_CLASS: Record<NonNullable<FavoriteStarProps["size"]>, string> = {
  xs: "h-6 w-6",
  sm: "h-7 w-7",
  md: "h-8 w-8",
};

const ICON_SIZE: Record<NonNullable<FavoriteStarProps["size"]>, string> = {
  xs: "h-3.5 w-3.5",
  sm: "h-4 w-4",
  md: "h-4.5 w-4.5",
};

/**
 * Tombol bintang reusable untuk toggle favorit (halte / buggy).
 * - Saat aktif: bintang terisi warna amber dengan glow halus.
 * - Saat di-toggle: animasi pop singkat (scale + rotate) untuk feedback.
 * - Otomatis stop propagation agar tidak men-trigger parent (mis. card click).
 */
export function FavoriteStar({
  active,
  onToggle,
  visible = true,
  size = "sm",
  label,
  className = "",
}: FavoriteStarProps) {
  const { t } = useTranslation("dashboard");
  if (!visible) return null;

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    void onToggle();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      e.stopPropagation();
      void onToggle();
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      aria-pressed={active}
      aria-label={
        label ?? (active ? t("removeFavorite") : t("addFavorite"))
      }
      className={`inline-flex shrink-0 items-center justify-center rounded-full transition-colors ${
        SIZE_CLASS[size]
      } ${
        active
          ? "bg-amber-50 text-amber-500 shadow-[0_0_0_1px_rgba(245,158,11,0.25)] hover:bg-amber-100"
          : "bg-white/80 text-slate-300 hover:bg-amber-50 hover:text-amber-400"
      } ${className}`}
    >
      {/*
        `key` di-flip mengikuti state `active` agar icon di-remount
        setiap toggle — ini me-restart CSS animation `favorite-star-pop`
        tanpa perlu state/effect.
      */}
      <Star
        key={active ? "on" : "off"}
        className={`${ICON_SIZE[size]} ${
          active ? "fill-amber-400 stroke-amber-500 favorite-star-pop" : ""
        }`}
        strokeWidth={2.2}
      />
    </button>
  );
}
