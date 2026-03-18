import type { Buggy } from "@/types/buggy";

export type DirectionResult = {
  originName: string;
  destinationName: string;
  originPosition: { lat: number; lng: number };
  destinationPosition: { lat: number; lng: number };
  routeStopNames: string[];
  nearestBuggyName: string;
  nearestBuggyId: string;
  directionPath: [number, number][];
  walkingToHalte?: {
    originHalteName: string;
    distance: string;
    duration: string;
    path: [number, number][];
  };
  walkingFromHalte?: {
    destinationHalteName: string;
    distance: string;
    duration: string;
    path: [number, number][];
  };
};

type DirectionPanelProps = {
  result: DirectionResult;
  buggies: Buggy[];
  onClose: () => void;
};

export function DirectionPanel({ result, onClose }: DirectionPanelProps) {
  return (
    <div className="shrink-0 rounded-2xl border border-slate-200/80 bg-white/80 p-3">
      {/* Header */}
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <svg className="h-4 w-4 text-amber-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M9 11a3 3 0 1 0 6 0a3 3 0 0 0 -6 0" />
            <path d="M17.657 16.657l-4.243 4.243a2 2 0 0 1 -2.827 0l-4.244 -4.243a8 8 0 1 1 11.314 0z" />
          </svg>
          <h3 className="text-[13px] font-bold text-slate-800">Rute Perjalanan</h3>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="grid h-6 w-6 place-items-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
          aria-label="Tutup"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3.5 w-3.5">
            <path d="m6 6 12 12" />
            <path d="m18 6-12 12" />
          </svg>
        </button>
      </div>

      {/* Journey steps — compact vertical timeline */}
      <div className="space-y-1.5">
        {/* Origin */}
        <div className="flex items-center gap-2">
          <div className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-blue-500">
            <div className="h-1.5 w-1.5 rounded-full bg-white" />
          </div>
          <p className="truncate text-[11px] font-medium text-slate-700">{result.originName}</p>
        </div>

        {/* Walking to halte */}
        {result.walkingToHalte && (
          <div className="ml-1.75 border-l-2 border-dashed border-emerald-300 py-0.5 pl-3">
            <p className="text-[10px] text-emerald-700">
              🚶 {result.walkingToHalte.distance} ke <span className="font-semibold">{result.walkingToHalte.originHalteName}</span>
              <span className="text-slate-400"> • {result.walkingToHalte.duration}</span>
            </p>
          </div>
        )}

        {/* Bus */}
        <div className="ml-1.75 border-l-2 border-amber-400 py-0.5 pl-3">
          <p className="text-[10px] text-amber-700">
            🚌 <span className="font-semibold">{result.nearestBuggyName}</span>
            <span className="text-slate-400"> • {result.routeStopNames.length} halte</span>
          </p>
          <details className="mt-0.5">
            <summary className="cursor-pointer text-[10px] text-amber-500 hover:text-amber-600">
              Lihat halte
            </summary>
            <div className="mt-1 max-h-20 overflow-y-auto text-[9px] text-slate-600">
              {result.routeStopNames.map((stop, i) => (
                <span key={i}>
                  {i > 0 && <span className="text-slate-300"> → </span>}
                  {stop}
                </span>
              ))}
            </div>
          </details>
        </div>

        {/* Walking from halte */}
        {result.walkingFromHalte && (
          <div className="ml-1.75 border-l-2 border-dashed border-emerald-300 py-0.5 pl-3">
            <p className="text-[10px] text-emerald-700">
              🚶 {result.walkingFromHalte.distance} dari <span className="font-semibold">{result.walkingFromHalte.destinationHalteName}</span>
              <span className="text-slate-400"> • {result.walkingFromHalte.duration}</span>
            </p>
          </div>
        )}

        {/* Destination */}
        <div className="flex items-center gap-2">
          <div className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-rose-500">
            <div className="h-1.5 w-1.5 rounded-full bg-white" />
          </div>
          <p className="truncate text-[11px] font-medium text-slate-700">{result.destinationName}</p>
        </div>
      </div>
    </div>
  );
}
