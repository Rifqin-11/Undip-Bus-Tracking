import { BuggyIcon, HalteIcon, RouteIcon, InfoIcon, LoginIcon } from "@/components/map/Icons";
import type { PanelView } from "@/types/buggy";

type MobileBottomNavProps = {
  activeView: PanelView;
  onSelectView: (view: PanelView) => void;
};

const navButtonBase =
  "grid h-12 w-12 place-items-center rounded-2xl transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 active:scale-95";

export function MobileBottomNav({ activeView, onSelectView }: MobileBottomNavProps) {
  return (
    <nav className="fixed bottom-4 left-1/2 z-50 flex w-[calc(100%-2rem)] max-w-md -translate-x-1/2 items-center justify-around gap-1 rounded-3xl border-2 border-white/50 bg-white/90 px-4 py-3 shadow-[0_8px_32px_rgba(15,23,42,0.25)] backdrop-blur-xl xl:hidden">
      <button
        type="button"
        className={`${navButtonBase} ${activeView === "buggy" ? "bg-[#0f1a3b] text-white shadow-lg" : "text-slate-500 active:bg-slate-100"}`}
        aria-label="Buggy"
        onClick={() => onSelectView("buggy")}
      >
        <BuggyIcon className="h-6 w-6" />
      </button>
      <button
        type="button"
        className={`${navButtonBase} ${activeView === "halte" ? "bg-[#0f1a3b] text-white shadow-lg" : "text-slate-500 active:bg-slate-100"}`}
        aria-label="Halte"
        onClick={() => onSelectView("halte")}
      >
        <HalteIcon className="h-6 w-6" />
      </button>
      <button
        type="button"
        className={`${navButtonBase} ${activeView === "rute" ? "bg-[#0f1a3b] text-white shadow-lg" : "text-slate-500 active:bg-slate-100"}`}
        aria-label="Rute"
        onClick={() => onSelectView("rute")}
      >
        <RouteIcon className="h-6 w-6" />
      </button>
      <button
        type="button"
        className={`${navButtonBase} ${activeView === "info" ? "bg-[#0f1a3b] text-white shadow-lg" : "text-slate-500 active:bg-slate-100"}`}
        aria-label="Info"
        onClick={() => onSelectView("info")}
      >
        <InfoIcon className="h-6 w-6" />
      </button>
      <button
        type="button"
        className="grid h-12 w-12 place-items-center rounded-2xl bg-[#0f1a3b] text-white shadow-lg transition-all duration-200 active:scale-95"
        aria-label="Login admin"
      >
        <LoginIcon className="h-6 w-6" />
      </button>
    </nav>
  );
}
