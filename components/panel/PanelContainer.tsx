"use client";

import type { ReactNode } from "react";
import { PanelShell } from "./PanelShell";
import { MobileDrawer } from "./MobileDrawer";

type PanelContainerProps = {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
};

export function PanelContainer({ open, onClose, children }: PanelContainerProps) {
  return (
    <>
      {/* Desktop — main panel */}
      {open && (
        <PanelShell onClose={onClose}>{children}</PanelShell>
      )}

      {/* Mobile — bottom drawer (hidden on desktop) */}
      <MobileDrawer open={open} onClose={onClose}>
        {children}
      </MobileDrawer>
    </>
  );
}
