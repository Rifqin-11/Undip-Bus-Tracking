"use client";

/**
 * Lightweight toast stack state hook.
 *
 * Owns toast ids, max visible count, and optional auto-dismiss timers. UI
 * rendering stays in `ToastStack`; this hook only manages state transitions.
 */
import { useCallback, useRef, useState } from "react";
import type { ToastItem } from "@/components/ui/ToastStack";

type AddToastInput = Omit<ToastItem, "id">;

type UseToastStackOptions = {
  /** Maximum number of visible toasts. Defaults to 5. */
  limit?: number;
  /** Default auto-dismiss duration in ms. Set 0 to disable auto-dismiss. */
  defaultTtlMs?: number;
};

function makeToastId(): string {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return crypto.randomUUID();
  }
  return `toast-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

/**
 * Toast state container dengan API object-style.
 * - `addToast({ tone, title, description, duration })` — toast baru selalu di atas, drop oldest jika melebihi limit.
 * - `dismissToast(id)` — hilangkan satu toast.
 * - Auto-dismiss memakai `duration` per-toast atau `defaultTtlMs`.
 */
export function useToastStack(options: UseToastStackOptions = {}) {
  const { limit = 5, defaultTtlMs = 4_500 } = options;
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(
    new Map(),
  );

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    const timer = timersRef.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timersRef.current.delete(id);
    }
  }, []);

  const addToast = useCallback(
    (toast: AddToastInput) => {
      const id = makeToastId();
      const ttl = toast.duration ?? defaultTtlMs;

      setToasts((prev) => {
        const next = [{ ...toast, id }, ...prev].slice(0, limit);
        // Bersihkan timer milik toast yang ter-evict.
        const surviving = new Set(next.map((t) => t.id));
        prev.forEach((t) => {
          if (!surviving.has(t.id)) {
            const timer = timersRef.current.get(t.id);
            if (timer) {
              clearTimeout(timer);
              timersRef.current.delete(t.id);
            }
          }
        });
        return next;
      });

      if (ttl > 0) {
        const timer = setTimeout(() => {
          dismissToast(id);
        }, ttl);
        timersRef.current.set(id, timer);
      }
    },
    [defaultTtlMs, dismissToast, limit],
  );

  return { toasts, addToast, dismissToast };
}
