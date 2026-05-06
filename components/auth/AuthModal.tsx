"use client";

import { AuthForm } from "@/components/auth/AuthForm";

type AuthModalProps = {
  open: boolean;
  redirectTo: string;
  onClose: () => void;
};

export function AuthModal({ open, redirectTo, onClose }: AuthModalProps) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center overflow-y-auto bg-slate-950/45 px-4 py-6 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
    >
      <AuthForm
        variant="modal"
        redirectTo={redirectTo}
        onClose={onClose}
        onSuccess={onClose}
      />
    </div>
  );
}
