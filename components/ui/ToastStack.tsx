"use client";

import { useEffect, useRef } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

export type ToastItem = {
  id: string;
  title: string;
  description?: string;
  tone?: "info" | "success" | "warning" | "bus";
  /** Durasi auto-dismiss dalam ms. Default 5000. Set 0 untuk tidak auto-dismiss. */
  duration?: number;
};

type ToastStackProps = {
  toasts: ToastItem[];
  onDismiss: (id: string) => void;
};

// ─── Style helpers ────────────────────────────────────────────────────────────

function toneStyle(tone: ToastItem["tone"]): {
  wrapper: string;
  icon: React.ReactNode;
} {
  switch (tone) {
    case "success":
      return {
        wrapper:
          "border-emerald-200 bg-emerald-50/95 text-emerald-900",
        icon: (
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
              <path d="M5 13l4 4L19 7" />
            </svg>
          </div>
        ),
      };
    case "warning":
      return {
        wrapper:
          "border-amber-200 bg-amber-50/95 text-amber-900",
        icon: (
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-600">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
              <path d="M12 9v4M12 17h.01" />
              <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
            </svg>
          </div>
        ),
      };
    case "bus":
      return {
        wrapper:
          "border-[#0f1a3b]/20 bg-[#0f1a3b]/95 text-white",
        icon: (
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/15 text-white">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
              {/* Wheels */}
              <circle cx="6" cy="17" r="2" />
              <circle cx="18" cy="17" r="2" />
              {/* Body */}
              <path d="M4 17H2V6a1 1 0 0 1 1-1h14a5 7 0 0 1 5 7v5h-2" />
              <path d="M8 17h8" />
              <path d="M16 5l1.5 7H22" />
              <path d="M2 10h15" />
              <path d="M7 5v5M12 5v5" />
            </svg>
          </div>
        ),
      };
    default:
      return {
        wrapper: "border-slate-200 bg-white/95 text-slate-800",
        icon: (
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-500">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
              <circle cx="12" cy="12" r="10" />
              <path d="M12 16v-4M12 8h.01" />
            </svg>
          </div>
        ),
      };
  }
}

// ─── Single Toast ─────────────────────────────────────────────────────────────

function Toast({ toast, onDismiss }: { toast: ToastItem; onDismiss: (id: string) => void }) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const duration = toast.duration ?? 5_000;

  useEffect(() => {
    if (duration <= 0) return;
    timerRef.current = setTimeout(() => onDismiss(toast.id), duration);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [toast.id, duration, onDismiss]);

  const { wrapper, icon } = toneStyle(toast.tone);

  return (
    <div
      className={`flex items-start gap-3 rounded-2xl border px-3 py-2.5 shadow-[0_8px_24px_rgba(0,0,0,0.12)] backdrop-blur-xl animate-in slide-in-from-top-2 fade-in duration-300 ${wrapper}`}
    >
      {icon}
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-semibold leading-tight">{toast.title}</p>
        {toast.description && (
          <p className="mt-0.5 text-[11px] opacity-80 leading-tight">{toast.description}</p>
        )}
      </div>
      <button
        type="button"
        onClick={() => onDismiss(toast.id)}
        aria-label="Tutup notifikasi"
        className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full transition ${
          toast.tone === "bus"
            ? "text-white/60 hover:bg-white/15 hover:text-white"
            : "text-slate-400 hover:bg-slate-100 hover:text-slate-600"
        }`}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" className="h-3 w-3">
          <path d="m6 6 12 12M18 6 6 18" />
        </svg>
      </button>
    </div>
  );
}

// ─── Stack ────────────────────────────────────────────────────────────────────

export function ToastStack({ toasts, onDismiss }: ToastStackProps) {
  if (toasts.length === 0) return null;

  return (
    <div className="pointer-events-none fixed right-3 top-3 z-[80] flex w-[min(92vw,380px)] flex-col gap-2 xl:right-4 xl:top-4">
      {toasts.map((toast) => (
        <div key={toast.id} className="pointer-events-auto">
          <Toast toast={toast} onDismiss={onDismiss} />
        </div>
      ))}
    </div>
  );
}
