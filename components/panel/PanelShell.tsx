import type { ReactNode } from "react";
import { DESKTOP_LAYOUT } from "@/lib/presenters/layout-metrics";

type PanelShellProps = {
  onClose: () => void;
  children: ReactNode;
};

function PanelHeader({ onClose }: { onClose: () => void }) {
  return (
    <div className="mb-4 flex items-start justify-between">
      <div>
        <p className="text-[8px] font-semibold uppercase tracking-[0.18em] text-slate-500">
          Smart Mobility UNDIP
        </p>
        <h1 className="text-[22px] font-bold leading-[0.95] text-slate-900">
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
          className="grid h-8 w-8 place-items-center rounded-full border border-slate-200 bg-white text-slate-500 transition hover:bg-slate-50 hover:text-slate-800"
          aria-label="Tutup panel"
        >
          X
        </button>
      </div>
    </div>
  );
}

export function PanelShell({ onClose, children }: PanelShellProps) {
  return (
    <section
      className="absolute z-20 hidden overflow-y-auto rounded-[30px] border border-white/40 bg-white/60 p-4 shadow-[0_16px_50px_rgba(15,23,42,0.14)] backdrop-blur-xl xl:block"
      style={{
        left: `calc(${DESKTOP_LAYOUT.sideOffset} + ${DESKTOP_LAYOUT.sidebarWidth} + ${DESKTOP_LAYOUT.gap})`,
        top: DESKTOP_LAYOUT.topOffset,
        width: DESKTOP_LAYOUT.panelWidth,
        height: `calc(100vh - (${DESKTOP_LAYOUT.topOffset} * 2))`,
      }}
    >
      <PanelHeader onClose={onClose} />
      {children}
    </section>
  );
}
