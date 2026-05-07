import type { ReactNode } from "react";

type MobileTopBarProps = {
  /** Heading kiri (default "SIMOBI"). */
  title?: string;
  /** Slot di sisi kanan (Bell + Profile / Sign-In / Admin Menu, dll). */
  actions?: ReactNode;
  /** Render gradient overlay full-width dari atas (hilangkan jika tidak diinginkan). */
  showGradient?: boolean;
};

/**
 * Top bar mobile untuk dashboard (root/admin/driver).
 * Menampilkan:
 *  - gradient overlay tipis dari atas (untuk readability),
 *  - heading kiri,
 *  - slot tombol aksi di kanan.
 *
 * Disembunyikan otomatis pada viewport `xl` ke atas.
 */
export function MobileTopBar({
  title = "SIMOBI",
  actions,
  showGradient = true,
}: MobileTopBarProps) {
  return (
    <>
      {showGradient ? (
        <div className="pointer-events-none absolute inset-x-0 top-0 z-20 h-52 bg-linear-to-b from-slate-900/45 via-slate-900/20 to-transparent xl:hidden" />
      ) : null}
      <section
        className="absolute inset-x-0 z-50 flex items-center justify-between px-4 xl:hidden"
        style={{ top: "calc(0.75rem + var(--sai-top, 0px))" }}
      >
        <h1 className="text-[26px] font-bold tracking-tight text-white drop-shadow-md">
          {title}
        </h1>
        {actions ? (
          <div className="flex items-center gap-2">{actions}</div>
        ) : null}
      </section>
    </>
  );
}
