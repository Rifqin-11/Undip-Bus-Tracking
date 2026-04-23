import {
  BuggyIcon,
  HalteIcon,
  MapPinIcon,
  NavigateIcon,
  XIcon,
} from "@/components/ui/Icons";
import type { Buggy } from "@/types/buggy";

export type DirectionResult = {
  originName: string;
  destinationName: string;
  originPosition: { lat: number; lng: number };
  destinationPosition: { lat: number; lng: number };
  routeStopNames: string[];
  nearestBuggyName?: string;
  nearestBuggyId?: string;
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
    <div className="shrink-0 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-200 px-3 py-2.5">
        <div className="flex min-w-0 items-center gap-2">
          <div className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-slate-100 text-slate-600">
            <MapPinIcon className="h-3.5 w-3.5" />
          </div>
          <div className="min-w-0">
            <h3 className="truncate text-[13px] font-semibold text-slate-800">
              Rute Perjalanan
            </h3>
            <p className="truncate text-[10px] text-slate-500">
              {result.originName} ke {result.destinationName}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="grid h-7 w-7 place-items-center rounded-full border border-slate-200 bg-white text-slate-400 transition hover:bg-slate-50 hover:text-slate-700"
          aria-label="Tutup"
        >
          <XIcon className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="space-y-2.5 px-3 py-3">
        <div className="flex items-center gap-2 rounded-lg border border-blue-100 bg-blue-50 px-2.5 py-2">
          <div className="h-2.5 w-2.5 shrink-0 rounded-full bg-blue-500" />
          <p className="truncate text-[11px] font-medium text-slate-700">
            {result.originName}
          </p>
        </div>

        {result.walkingToHalte && (
          <div className="ml-3 border-l-2 border-dashed border-emerald-300 pl-3">
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1.5">
              <div className="flex items-center gap-1.5 text-emerald-700">
                <NavigateIcon
                  className="h-3.5 w-3.5 shrink-0"
                  aria-label="Jalan kaki"
                />
                <p className="text-[10px] font-bold">
                  {result.walkingToHalte.originHalteName}
                </p>
              </div>
              <p className="mt-0.5 text-[10px] text-emerald-700/80">
                {result.walkingToHalte.distance} •{" "}
                {result.walkingToHalte.duration}
              </p>
            </div>
          </div>
        )}

        <div className="ml-3 border-l-2 border-amber-300 pl-3">
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-2">
            <div className="mb-1 flex items-center gap-1.5 text-amber-800">
              <HalteIcon
                className="h-3.5 w-3.5 shrink-0"
                aria-label="Perjalanan buggy"
              />
              <span className="text-[10px] font-bold">
                {result.routeStopNames[0]}
              </span>
            </div>
            <p className="text-[10px] text-amber-800">
              Halte yang dilewati: {result.routeStopNames.length} halte
            </p>

            <details className="mt-1.5 rounded-md border border-amber-200 bg-white px-2 py-1.5">
              <summary className="cursor-pointer text-[10px] font-medium text-amber-700 hover:text-amber-800">
                Lihat daftar halte
              </summary>
              <ol className="mt-1.5 max-h-28 space-y-1.5 overflow-y-auto pr-1">
                {result.routeStopNames.map((stop, i) => (
                  <li key={`${stop}-${i}`} className="flex items-start gap-2">
                    <span className="mt-px grid h-4 w-4 shrink-0 place-items-center rounded-full bg-amber-100 text-[9px] font-semibold text-amber-700">
                      {i + 1}
                    </span>
                    <span className="text-[10px] leading-4 text-slate-700">
                      {stop}
                    </span>
                  </li>
                ))}
              </ol>
            </details>
          </div>
        </div>

        {result.walkingFromHalte && (
          <div className="ml-3 border-l-2 border-dashed border-emerald-300 pl-3">
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1.5">
              <div className="flex items-center gap-1.5 text-emerald-700">
                <NavigateIcon
                  className="h-3.5 w-3.5 shrink-0"
                  aria-label="Jalan kaki"
                />
                <p className="text-[10px] font-medium">
                  {result.walkingFromHalte.destinationHalteName}
                </p>
              </div>
              <p className="mt-0.5 text-[10px] text-emerald-700/80">
                {result.walkingFromHalte.distance} •{" "}
                {result.walkingFromHalte.duration}
              </p>
            </div>
          </div>
        )}

        <div className="flex items-center gap-2 rounded-lg border border-rose-100 bg-rose-50 px-2.5 py-2">
          <div className="h-2.5 w-2.5 shrink-0 rounded-full bg-rose-500" />
          <p className="truncate text-[11px] font-medium text-slate-700">
            {result.destinationName}
          </p>
        </div>
      </div>
    </div>
  );
}
