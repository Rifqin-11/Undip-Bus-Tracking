"use client";

import { useEffect, useState } from "react";
import type { Buggy } from "@/types/buggy";
import { OFFICIAL_ROUTE_PATH } from "@/lib/transit/buggy-data";

const TICK_MS = 3000;
const PATH_STEPS_PER_TICK = 2;
const TOTAL_PATH_POINTS = OFFICIAL_ROUTE_PATH.length;

function advanceBuggy(buggy: Buggy): Buggy {
  const nextCursor =
    (buggy.pathCursor + PATH_STEPS_PER_TICK) % TOTAL_PATH_POINTS;
  const [lat, lng] = OFFICIAL_ROUTE_PATH[nextCursor];

  const speedJitter = Math.floor(Math.random() * 4) - 1;
  const newSpeed = Math.min(30, Math.max(3, buggy.speedKmh + speedJitter));
  const newEta = Math.max(1, buggy.etaMinutes - Math.floor(Math.random() * 2));

  return {
    ...buggy,
    pathCursor: nextCursor,
    position: { lat, lng },
    speedKmh: newSpeed,
    etaMinutes: newEta,
    updatedAt: new Date().toLocaleTimeString("id-ID", {
      hour: "2-digit",
      minute: "2-digit",
    }),
  };
}

export function useBuggyRealtime(initialBuggies: Buggy[]): Buggy[] {
  const [buggies, setBuggies] = useState<Buggy[]>(initialBuggies);

  useEffect(() => {
    const interval = setInterval(() => {
      setBuggies((prev) => prev.map(advanceBuggy));
    }, TICK_MS);

    return () => clearInterval(interval);
  }, []);

  return buggies;
}
