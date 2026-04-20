"use client";

import { useEffect, useMemo, useState } from "react";
import { HALTE_LOCATIONS, OFFICIAL_ROUTE_PATH } from "@/lib/transit/buggy-data";
import { haversineMeters } from "@/lib/transit/buggy-route-utils";
import {
  createBuggyMovementSimulator,
  type BuggySimulatorOptions,
  type BuggySimulatorPosition,
  type LatLng,
} from "../lib/simulation/buggyMovementSimulator";
import type { Buggy } from "@/types/buggy";

type UseBuggySimulationOptions = {
  autoStart?: boolean;
  simulatorOptions?: Partial<BuggySimulatorOptions>;
};

const ROUTE_POINTS: LatLng[] = OFFICIAL_ROUTE_PATH.map(([lat, lng]) => ({
  lat,
  lng,
}));

function rotateRoute(route: LatLng[], startIndex: number): LatLng[] {
  if (route.length < 2) return route;
  const normalized =
    ((startIndex % route.length) + route.length) % route.length;
  return [...route.slice(normalized), ...route.slice(0, normalized)];
}

function findNearestRouteIndex(position: LatLng): number {
  let bestIndex = 0;
  let bestDistance = Infinity;

  for (let i = 0; i < ROUTE_POINTS.length; i += 1) {
    const candidate = ROUTE_POINTS[i];
    const distance = Math.hypot(
      candidate.lat - position.lat,
      candidate.lng - position.lng,
    );
    if (distance < bestDistance) {
      bestDistance = distance;
      bestIndex = i;
    }
  }

  return bestIndex;
}

const HALTE_ARRIVAL_RADIUS_METERS = 40;
// Keep stop progression strict and deterministic: no halte skipping.
const MAX_SKIP_AHEAD_STOPS = 0;

function normalizeLoopIndex(index: number, length: number): number {
  if (length <= 0) return 0;
  return ((index % length) + length) % length;
}

function findSemiFlexibleArrivalHalteIndex(
  position: LatLng,
  currentStopIndex: number,
  radiusMeters: number = HALTE_ARRIVAL_RADIUS_METERS,
  maxSkipAheadStops: number = MAX_SKIP_AHEAD_STOPS,
): number | null {
  const halteCount = HALTE_LOCATIONS.length;
  if (halteCount <= 0) return null;

  const current = normalizeLoopIndex(currentStopIndex, halteCount);
  const maxStep = Math.min(halteCount - 1, maxSkipAheadStops + 1);
  let bestIndex: number | null = null;
  let bestStep = Number.POSITIVE_INFINITY;
  let bestDistance = Number.POSITIVE_INFINITY;

  for (let step = 1; step <= maxStep; step += 1) {
    const halteIndex = normalizeLoopIndex(current + step, halteCount);
    const halte = HALTE_LOCATIONS[halteIndex];
    const distance = haversineMeters(position, {
      lat: halte.lat,
      lng: halte.lng,
    });

    if (distance > radiusMeters) continue;
    if (step < bestStep || (step === bestStep && distance < bestDistance)) {
      bestStep = step;
      bestDistance = distance;
      bestIndex = halteIndex;
    }
  }

  return bestIndex;
}

function computeEtaMinutes(
  position: LatLng,
  currentStopIndex: number,
  speedKmh: number,
): number {
  const halteCount = HALTE_LOCATIONS.length;
  if (halteCount <= 0) return 1;

  const normalizedCurrent = normalizeLoopIndex(currentStopIndex, halteCount);
  const nextHalte = HALTE_LOCATIONS[(normalizedCurrent + 1) % halteCount];
  const distanceMeters = haversineMeters(position, {
    lat: nextHalte.lat,
    lng: nextHalte.lng,
  });
  const speedMps = Math.max(0.8, speedKmh / 3.6);
  const etaMinutes = distanceMeters / speedMps / 60;
  return Math.max(1, Math.min(30, Math.round(etaMinutes)));
}

function applyPositionUpdate(
  buggy: Buggy,
  point: BuggySimulatorPosition,
): Buggy {
  const position = { lat: point.latitude, lng: point.longitude };
  const halteWithinRadius = findSemiFlexibleArrivalHalteIndex(
    position,
    buggy.currentStopIndex,
  );
  const halteCount = HALTE_LOCATIONS.length;
  const currentStopIndex =
    halteCount > 0
      ? normalizeLoopIndex(
          halteWithinRadius ?? buggy.currentStopIndex,
          halteCount,
        )
      : 0;

  return {
    ...buggy,
    position,
    pathCursor: findNearestRouteIndex(position),
    currentStopIndex,
    speedKmh: point.speedKmh,
    etaMinutes: computeEtaMinutes(position, currentStopIndex, point.speedKmh),
    updatedAt: new Date(point.timestamp).toLocaleTimeString("id-ID", {
      hour: "2-digit",
      minute: "2-digit",
    }),
  };
}

export function useBuggySimulation(
  initialBuggies: Buggy[],
  { autoStart = true, simulatorOptions = {} }: UseBuggySimulationOptions = {},
): Buggy[] {
  const [buggies, setBuggies] = useState<Buggy[]>(initialBuggies);
  const initialBuggiesKey = useMemo(
    () => JSON.stringify(initialBuggies),
    [initialBuggies],
  );
  const simulatorOptionsKey = useMemo(
    () => JSON.stringify(simulatorOptions),
    [simulatorOptions],
  );

  useEffect(() => {
    setBuggies(initialBuggies);
  }, [initialBuggiesKey, initialBuggies]);

  useEffect(() => {
    const parsedOptions = JSON.parse(
      simulatorOptionsKey,
    ) as Partial<BuggySimulatorOptions>;
    const simulators = initialBuggies.map((buggy) => {
      const rotatedRoute = rotateRoute(ROUTE_POINTS, buggy.pathCursor);
      return createBuggyMovementSimulator(rotatedRoute, parsedOptions);
    });

    const unsubscribers = simulators.map((simulator, index) =>
      simulator.subscribe((point) => {
        const buggyId = initialBuggies[index]?.id;
        if (!buggyId) return;

        setBuggies((prev) =>
          prev.map((item) =>
            item.id === buggyId ? applyPositionUpdate(item, point) : item,
          ),
        );
      }),
    );

    if (autoStart) {
      simulators.forEach((simulator) => simulator.start());
    }

    return () => {
      unsubscribers.forEach((unsubscribe) => unsubscribe());
      simulators.forEach((simulator) => simulator.stop());
    };
  }, [autoStart, initialBuggies, simulatorOptionsKey]);

  return buggies;
}
