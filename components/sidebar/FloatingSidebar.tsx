import { BuggyIcon, HalteIcon, RouteIcon, InfoIcon, LoginIcon } from "@/components/map/Icons";
import { DESKTOP_LAYOUT } from "@/lib/presenters/layout-metrics";
import type { PanelView } from "@/types/buggy";
import logo from "@/public/logo.svg";

type FloatingSidebarProps = {
  activeView: PanelView;
  onSelectView: (view: PanelView) => void;
};

const actionButtonClass =
  "grid h-11 w-11 place-items-center rounded-2xl transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300";

export function FloatingSidebar({ activeView, onSelectView }: FloatingSidebarProps) {
  return (
    <aside
      className="absolute z-30 hidden flex-col items-center justify-between rounded-[30px] border border-white/30 bg-white/55 px-3 py-4 shadow-[0_12px_45px_rgba(16,24,40,0.12)] backdrop-blur-xl xl:flex"
      style={{
        left: DESKTOP_LAYOUT.sideOffset,
        top: DESKTOP_LAYOUT.topOffset,
        width: DESKTOP_LAYOUT.sidebarWidth,
        height: `calc(100vh - (${DESKTOP_LAYOUT.topOffset} * 2))`,
      }}
    >
      <div className="flex h-12 w-12 overflow-hidden rounded-full">
        <img src={logo.src} alt="Logo" className="h-12 w-12 rounded-full object-cover" />
      </div>

      <nav className="flex flex-col gap-2 rounded-2xl bg-white/70 p-2">
        <button
          className={`${actionButtonClass} ${activeView === "buggy" ? "bg-[#0f1a3b] text-white" : "text-slate-600 hover:bg-slate-100"}`}
          aria-label="Buggy"
          type="button"
          onClick={() => onSelectView("buggy")}
        >
          <BuggyIcon className="h-5 w-5" />
        </button>
        <button
          className={`${actionButtonClass} ${activeView === "halte" ? "bg-[#0f1a3b] text-white" : "text-slate-600 hover:bg-slate-100"}`}
          aria-label="Halte"
          type="button"
          onClick={() => onSelectView("halte")}
        >
          <HalteIcon className="h-5 w-5" />
        </button>
        <button
          className={`${actionButtonClass} ${activeView === "rute" ? "bg-[#0f1a3b] text-white" : "text-slate-600 hover:bg-slate-100"}`}
          aria-label="Rute"
          type="button"
          onClick={() => onSelectView("rute")}
        >
          <RouteIcon className="h-5 w-5" />
        </button>
        <button
          className={`${actionButtonClass} ${activeView === "info" ? "bg-[#0f1a3b] text-white" : "text-slate-600 hover:bg-slate-100"}`}
          aria-label="Info"
          type="button"
          onClick={() => onSelectView("info")}
        >
          <InfoIcon className="h-5 w-5" />
        </button>
      </nav>

      <button
        className="grid h-11 w-11 place-items-center rounded-2xl bg-[#0f1a3b] text-white transition hover:bg-[#162656]"
        aria-label="Login admin"
        type="button"
      >
        <LoginIcon className="h-5 w-5" />
      </button>
    </aside>
  );
}
