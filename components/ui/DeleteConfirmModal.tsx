import type { ReactNode } from "react";
import { SpinnerIcon, TrashIcon } from "@/components/ui/Icons";

type DeleteConfirmModalProps = {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  loadingLabel?: string;
  cancelLabel?: string;
  isLoading?: boolean;
  onClose: () => void;
  onConfirm: () => void;
  children?: ReactNode;
};

export function DeleteConfirmModal({
  open,
  title,
  description,
  confirmLabel = "Ya, Hapus",
  loadingLabel = "Menghapus...",
  cancelLabel = "Batal",
  isLoading = false,
  onClose,
  onConfirm,
  children,
}: DeleteConfirmModalProps) {
  if (!open) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full max-w-sm shrink-0 animate-in fade-in zoom-in-95 rounded-[24px] bg-white p-5 shadow-2xl">
        <div className="mb-4 flex flex-col items-center text-center">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-rose-100 text-rose-600 shadow-sm">
            <TrashIcon className="h-6 w-6" />
          </div>
          <h3 className="text-[17px] font-bold text-slate-900">{title}</h3>
          <p className="mt-1 max-w-70 text-[13px] leading-relaxed text-slate-500">{description}</p>
        </div>

        {children ? <div className="mb-4">{children}</div> : null}

        <div className="flex gap-2">
          <button
            type="button"
            disabled={isLoading}
            onClick={onClose}
            className="flex-1 rounded-xl bg-slate-100 py-2.5 text-[13px] font-semibold text-slate-700 transition hover:bg-slate-200 active:scale-95 disabled:opacity-50"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            disabled={isLoading}
            onClick={onConfirm}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-rose-600 py-2.5 text-[13px] font-semibold text-white shadow-md shadow-rose-600/20 transition hover:bg-rose-700 active:scale-95 disabled:opacity-50"
          >
            {isLoading && <SpinnerIcon className="h-4 w-4" />}
            {isLoading ? loadingLabel : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
