import {
  HalteIcon,
  MapPinIcon,
  NavigateIcon,
  XIcon,
} from "@/components/ui/Icons";
import type { Buggy } from "@/types/buggy";
import { useTranslation } from "react-i18next";

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

export function DirectionPanel({ result, buggies, onClose }: DirectionPanelProps) {
  const { t } = useTranslation("dashboard");
  const hasActiveBuggy = Boolean(result.nearestBuggyId);
  const recommendedBuggy = result.nearestBuggyId
    ? buggies.find((buggy) => buggy.id === result.nearestBuggyId)
    : undefined;
  const firstRouteStopName = result.routeStopNames[0] ?? result.originName;
  const lastRouteStopName =
    result.routeStopNames[result.routeStopNames.length - 1] ??
    result.destinationName;
  const activeBuggyName = result.nearestBuggyName ?? t("buggyTrip");
  const activeBuggyCode = recommendedBuggy?.code;
  const activeBuggySpeed =
    typeof recommendedBuggy?.speedKmh === "number" &&
    Number.isFinite(recommendedBuggy.speedKmh)
      ? `${Math.max(0, Math.round(recommendedBuggy.speedKmh))} ${t("speedUnit")}`
      : null;
  const activeBuggyPassengers =
    typeof recommendedBuggy?.passengers === "number" &&
    typeof recommendedBuggy?.capacity === "number"
      ? `${recommendedBuggy.passengers}/${recommendedBuggy.capacity} ${t("passengers")}`
      : null;

  return (
    <div className="shrink-0 overflow-hidden rounded-[22px] border border-slate-200/80 bg-white/90 shadow-[0_16px_40px_rgba(15,23,42,0.12)] backdrop-blur-xl">
      <div className="flex items-center justify-between border-b border-slate-100 px-3.5 py-3">
        <div className="flex min-w-0 items-center gap-2">
          <div className="grid h-8 w-8 shrink-0 place-items-center rounded-2xl bg-slate-100 text-slate-600">
            <MapPinIcon className="h-3.5 w-3.5" />
          </div>
          <div className="min-w-0">
            <h3 className="truncate text-[13px] font-bold text-slate-900">
              {t("tripRoute")}
            </h3>
            <p className="truncate text-[10px] text-slate-500">
              {result.originName} → {result.destinationName}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="grid h-8 w-8 place-items-center rounded-full border border-slate-200 bg-white text-slate-400 shadow-sm transition hover:border-slate-900 hover:bg-slate-900 hover:text-white"
          aria-label={t("closeRoute")}
        >
          <XIcon className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="space-y-3 px-3.5 py-3">
        <div className="space-y-0">
          <div className="grid grid-cols-[22px_1fr] gap-2">
            <span className="relative flex justify-center">
              <span className="mt-2 h-2.5 w-2.5 rounded-full bg-blue-500 shadow-[0_0_0_4px_rgba(59,130,246,0.12)]" />
              <span className="absolute top-6 h-[calc(100%+12px)] w-px bg-slate-200" />
            </span>
            <div className="rounded-2xl border border-blue-100 bg-blue-50/90 px-3 py-2">
              <p className="truncate text-[11px] font-bold text-slate-800">
                {result.originName}
              </p>
            </div>
          </div>

          {result.walkingToHalte && (
            <div className="grid grid-cols-[22px_1fr] gap-2">
              <span className="relative flex justify-center">
                <span className="absolute inset-y-0 w-px border-l border-dashed border-emerald-300" />
                <span className="relative mt-3 grid h-5 w-5 place-items-center rounded-full border border-emerald-200 bg-white text-emerald-600">
                  <NavigateIcon className="h-3 w-3" aria-label={t("walk")} />
                </span>
              </span>
              <div className="py-1.5">
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50/90 px-3 py-2">
                  <p className="text-[9px] font-bold uppercase tracking-[0.08em] text-emerald-700/75">
                    {t("walk")}
                  </p>
                  <div className="mt-0.5 flex items-center gap-1.5 text-emerald-700">
                    <p className="truncate text-[10px] font-bold text-emerald-800">
                      {t("walkToStop", {
                        stop: result.walkingToHalte.originHalteName,
                      })}
                    </p>
                  </div>
                  <p className="mt-0.5 text-[10px] text-emerald-700/80">
                    {result.walkingToHalte.distance} ·{" "}
                    {result.walkingToHalte.duration}
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-[22px_1fr] gap-2">
            <span className="relative flex justify-center">
              <span className="absolute inset-y-0 w-px bg-indigo-300" />
              <span className="relative mt-3 grid h-5 w-5 place-items-center rounded-full border border-indigo-200 bg-white text-indigo-700 shadow-sm">
                <HalteIcon
                  className="h-3 w-3"
                  aria-label={t("buggyTrip")}
                />
              </span>
            </span>
            <div className="py-1.5">
              <div className="rounded-2xl border border-indigo-200 bg-linear-to-br from-indigo-50/80 to-white px-3 py-2.5 shadow-sm">
                <div className="mb-1 flex items-start justify-between gap-2 text-slate-900">
                  <div className="min-w-0">
                    <p className="text-[9px] font-bold uppercase tracking-[0.08em] text-indigo-700">
                      {t("buggyTrip")}
                    </p>
                    <p className="mt-0.5 truncate text-[11px] font-bold text-slate-900">
                      {firstRouteStopName} → {lastRouteStopName}
                    </p>
                  </div>
                  <span className="shrink-0 rounded-full bg-indigo-100 px-2 py-0.5 text-[9px] font-bold text-indigo-700">
                    {t("routeStopsCount", { count: result.routeStopNames.length })}
                  </span>
                </div>
                <p className="text-[10px] leading-relaxed text-slate-500">
                  {hasActiveBuggy
                    ? t("routeGuidanceWithFleet", {
                        buggy: activeBuggyName,
                        endStop: lastRouteStopName,
                      })
                    : t("routeGuidanceOnly", {
                        startStop: firstRouteStopName,
                        endStop: lastRouteStopName,
                      })}
                </p>

                {hasActiveBuggy && (
                  <div className="mt-2 rounded-xl border border-indigo-100 bg-white/90 px-2.5 py-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-[9px] font-bold uppercase tracking-[0.08em] text-indigo-500">
                          {t("recommendedBuggy")}
                        </p>
                        <p className="mt-0.5 truncate text-[11px] font-bold text-slate-900">
                          {activeBuggyName}
                          {activeBuggyCode ? (
                            <span className="ml-1 text-[10px] font-semibold text-slate-500">
                              · {activeBuggyCode}
                            </span>
                          ) : null}
                        </p>
                      </div>
                      <span className="shrink-0 rounded-full bg-emerald-50 px-2 py-0.5 text-[9px] font-bold text-emerald-700">
                        {t("activeBuggy")}
                      </span>
                    </div>
                    {(activeBuggySpeed || activeBuggyPassengers) && (
                      <div className="mt-2 grid grid-cols-2 gap-1.5">
                        <div className="rounded-lg bg-slate-50 px-2 py-1.5">
                          <p className="text-[8px] font-bold uppercase tracking-[0.08em] text-slate-400">
                            {t("speed")}
                          </p>
                          <p className="truncate text-[10px] font-bold text-slate-800">
                            {activeBuggySpeed ?? "--"}
                          </p>
                        </div>
                        <div className="rounded-lg bg-slate-50 px-2 py-1.5">
                          <p className="text-[8px] font-bold uppercase tracking-[0.08em] text-slate-400">
                            {t("passengers")}
                          </p>
                          <p className="truncate text-[10px] font-bold text-slate-800">
                            {activeBuggyPassengers ?? "--"}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                <details className="mt-2 rounded-xl border border-slate-200 bg-white px-2.5 py-2">
                  <summary className="cursor-pointer text-[10px] font-bold text-indigo-700 hover:text-indigo-900">
                    {t("showStopList")}
                  </summary>
                  <ol className="mt-2 max-h-32 space-y-1.5 overflow-y-auto pr-1">
                    {result.routeStopNames.map((stop, i) => (
                      <li key={`${stop}-${i}`} className="flex items-start gap-2">
                        <span className="mt-px grid h-4 w-4 shrink-0 place-items-center rounded-full border border-slate-200 bg-white text-[9px] font-semibold text-slate-500">
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
          </div>

          {result.walkingFromHalte && (
            <div className="grid grid-cols-[22px_1fr] gap-2">
              <span className="relative flex justify-center">
                <span className="absolute inset-y-0 w-px border-l border-dashed border-emerald-300" />
                <span className="relative mt-3 grid h-5 w-5 place-items-center rounded-full border border-emerald-200 bg-white text-emerald-600">
                  <NavigateIcon className="h-3 w-3" aria-label={t("walk")} />
                </span>
              </span>
              <div className="py-1.5">
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50/90 px-3 py-2">
                  <p className="text-[9px] font-bold uppercase tracking-[0.08em] text-emerald-700/75">
                    {t("walk")}
                  </p>
                  <div className="mt-0.5 flex items-center gap-1.5 text-emerald-700">
                    <p className="truncate text-[10px] font-bold text-emerald-800">
                      {t("walkFromStop", {
                        stop: result.walkingFromHalte.destinationHalteName,
                      })}
                    </p>
                  </div>
                  <p className="mt-0.5 text-[10px] text-emerald-700/80">
                    {result.walkingFromHalte.distance} ·{" "}
                    {result.walkingFromHalte.duration}
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-[22px_1fr] gap-2">
            <span className="flex justify-center">
              <span className="mt-2 h-2.5 w-2.5 rounded-full bg-rose-500 shadow-[0_0_0_4px_rgba(244,63,94,0.12)]" />
            </span>
            <div className="rounded-2xl border border-rose-100 bg-rose-50/90 px-3 py-2">
              <p className="truncate text-[11px] font-bold text-slate-800">
                {result.destinationName}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
