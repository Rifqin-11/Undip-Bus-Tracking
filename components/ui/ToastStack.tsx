"use client";

export type ToastItem = {
  id: string;
  title: string;
  description?: string;
  tone?: "info" | "success" | "warning";
};

type ToastStackProps = {
  toasts: ToastItem[];
};

function toneClassName(tone: ToastItem["tone"]) {
  if (tone === "success") return "border-emerald-200 bg-emerald-50 text-emerald-800";
  if (tone === "warning") return "border-amber-200 bg-amber-50 text-amber-800";
  return "border-slate-200 bg-white text-slate-800";
}

export function ToastStack({ toasts }: ToastStackProps) {
  if (toasts.length === 0) return null;

  return (
    <div className="pointer-events-none fixed right-3 top-3 z-[80] flex w-[min(92vw,380px)] flex-col gap-2 xl:right-4 xl:top-4">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`rounded-2xl border px-3 py-2 shadow-lg backdrop-blur ${toneClassName(toast.tone)}`}
        >
          <p className="text-[13px] font-semibold">{toast.title}</p>
          {toast.description ? (
            <p className="text-[12px] opacity-90">{toast.description}</p>
          ) : null}
        </div>
      ))}
    </div>
  );
}
