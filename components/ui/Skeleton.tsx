import type { CSSProperties, HTMLAttributes } from "react";

type SkeletonProps = HTMLAttributes<HTMLDivElement> & {
  /** Tailwind class tambahan untuk ukuran/bentuk (mis. "h-4 w-24"). */
  className?: string;
};

/**
 * Primitive skeleton: blok abu animate-pulse dengan rounded default.
 * Pakai untuk merepresentasikan placeholder text, angka, atau image saat loading.
 *
 * Contoh:
 *   <Skeleton className="h-4 w-32" />
 *   <Skeleton className="h-8 w-8 rounded-full" />
 */
export function Skeleton({ className = "", style, ...rest }: SkeletonProps) {
  const merged: CSSProperties = {
    backgroundColor: "rgb(226, 232, 240)", // slate-200 fallback (jika class override)
    ...style,
  };
  return (
    <div
      aria-hidden="true"
      className={`animate-pulse rounded-md bg-slate-200/80 ${className}`}
      style={merged}
      {...rest}
    />
  );
}

/**
 * Baris skeleton untuk daftar list-style (avatar + 2 baris teks + chevron).
 * Pas dipakai di NotificationSection, HistoryBuggyList, AccountManagementPanel, GeofenceManager.
 */
export function SkeletonRow({
  showLeading = true,
  showTrailing = true,
  className = "",
}: {
  showLeading?: boolean;
  showTrailing?: boolean;
  className?: string;
}) {
  return (
    <div
      className={`flex items-center gap-3 rounded-2xl border border-slate-200/70 bg-white/60 p-3 ${className}`}
    >
      {showLeading ? (
        <Skeleton className="h-9 w-9 shrink-0 rounded-xl" />
      ) : null}
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <Skeleton className="h-3 w-3/5" />
        <Skeleton className="h-2.5 w-2/5" />
      </div>
      {showTrailing ? (
        <Skeleton className="h-6 w-6 shrink-0 rounded-full" />
      ) : null}
    </div>
  );
}

/**
 * Skeleton untuk stat number (mis. di AdminStatisticsPanel).
 * Akan menempati ruang kira-kira sama dengan angka asli.
 */
export function SkeletonStat({
  width = "w-12",
  height = "h-5",
  className = "",
}: {
  width?: string;
  height?: string;
  className?: string;
}) {
  return (
    <Skeleton className={`inline-block ${height} ${width} ${className}`} />
  );
}
