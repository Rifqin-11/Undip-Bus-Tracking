"use client";

import { useEffect, useRef, type ReactNode } from "react";

type MobileDrawerProps = {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
};

export function MobileDrawer({ open, onClose, children }: MobileDrawerProps) {
  const drawerRef = useRef<HTMLDivElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);

  // Prevent body scroll when drawer is open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  return (
    <>
      {/* Backdrop */}
      <div
        ref={backdropRef}
        className={`fixed inset-0 z-40 bg-black/30 backdrop-blur-[2px] transition-opacity duration-300 xl:hidden ${
          open ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer */}
      <div
        ref={drawerRef}
        className={`fixed inset-x-0 bottom-0 z-50 flex max-h-[85vh] flex-col rounded-t-[28px] border-t border-white/50 bg-white/80 shadow-[0_-16px_50px_rgba(15,23,42,0.2)] backdrop-blur-xl transition-transform duration-300 ease-out xl:hidden ${
          open ? "translate-y-0" : "translate-y-full"
        }`}
      >
        {/* Drag handle */}
        <div className="flex shrink-0 justify-center pb-2 pt-3">
          <div className="h-1 w-10 rounded-full bg-slate-300" />
        </div>

        {/* Header */}
        <div className="flex shrink-0 items-center justify-between px-5 pb-3">
          <div>
            <p className="text-[8px] font-semibold uppercase tracking-[0.18em] text-slate-500">
              Smart Mobility UNDIP
            </p>
            <h1 className="text-[20px] font-bold leading-tight text-slate-900">
              Buggy Monitoring
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">
              Live
            </span>
            <button
              type="button"
              onClick={onClose}
              className="grid h-8 w-8 place-items-center rounded-full border border-slate-200 bg-white text-slate-500 transition active:bg-slate-100"
              aria-label="Tutup panel"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
                <path d="m6 6 12 12" />
                <path d="m18 6-12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto overscroll-contain px-4 pb-24">
          {children}
        </div>
      </div>
    </>
  );
}
