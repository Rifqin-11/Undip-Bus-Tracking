"use client";

import { useCallback, useEffect, useRef, type MutableRefObject } from "react";
import type { HistoryStopPoint } from "@/lib/history/stop-points";
import type { Locale } from "@/lib/i18n/config";
import type {
  InfoWindowHandle,
  MapHandle,
  MapsApi,
  MarkerHandle,
  PolylineHandle,
} from "@/types/map-canvas";
import {
  HISTORY_POLYLINE_OPTIONS,
  buildHistoryEndpointIcon,
  buildHistoryStopIcon,
} from "@/components/map/MapPolyline";
import {
  buildHistoryStopInfoContent,
  formatHistoryStopTime,
} from "@/components/map/history-stop-info";

type UseHistoryTrailOptions = {
  mapReady: boolean;
  mapInstanceRef: MutableRefObject<MapHandle | null>;
  mapsApiRef: MutableRefObject<MapsApi | null>;
  infoWindowRef: MutableRefObject<InfoWindowHandle | null>;
  historyPath: [number, number][];
  historyStopPoints: HistoryStopPoint[];
  locale: Locale;
};

export function useHistoryTrail({
  mapReady,
  mapInstanceRef,
  mapsApiRef,
  infoWindowRef,
  historyPath,
  historyStopPoints,
  locale,
}: UseHistoryTrailOptions) {
  const historyPolylineRef = useRef<PolylineHandle | null>(null);
  const historyStopMarkersRef = useRef<MarkerHandle[]>([]);
  const historyEndpointMarkersRef = useRef<MarkerHandle[]>([]);

  const clearHistoryTrail = useCallback(() => {
    historyPolylineRef.current?.setMap(null);
    historyPolylineRef.current = null;
    historyStopMarkersRef.current.forEach((marker) => marker.setMap(null));
    historyStopMarkersRef.current = [];
    historyEndpointMarkersRef.current.forEach((marker) => marker.setMap(null));
    historyEndpointMarkersRef.current = [];
  }, []);

  useEffect(() => {
    if (!mapReady || !mapInstanceRef.current || !mapsApiRef.current) return;

    const map = mapInstanceRef.current;
    const maps = mapsApiRef.current;

    historyPolylineRef.current?.setMap(null);
    historyPolylineRef.current =
      historyPath.length > 1
        ? new maps.Polyline({
            map,
            path: historyPath.map(([lat, lng]) => ({ lat, lng })),
            ...HISTORY_POLYLINE_OPTIONS,
          })
        : null;
  }, [historyPath, mapInstanceRef, mapReady, mapsApiRef]);

  useEffect(() => {
    if (!mapReady || !mapInstanceRef.current || !mapsApiRef.current) return;

    const map = mapInstanceRef.current;
    const maps = mapsApiRef.current;
    const startLabel = locale === "en" ? "Start" : "Awal";
    const finishLabel = locale === "en" ? "Finish" : "Akhir";
    const endpointPoints = historyPath.length
      ? [
          {
            label: startLabel,
            title: locale === "en" ? "Session start point" : "Titik awal sesi",
            tone: "start" as const,
            position: { lat: historyPath[0][0], lng: historyPath[0][1] },
          },
          ...(historyPath.length > 1
            ? [
                {
                  label: finishLabel,
                  title:
                    locale === "en" ? "Session finish point" : "Titik akhir sesi",
                  tone: "finish" as const,
                  position: {
                    lat: historyPath[historyPath.length - 1][0],
                    lng: historyPath[historyPath.length - 1][1],
                  },
                },
              ]
            : []),
        ]
      : [];

    historyEndpointMarkersRef.current.forEach((marker) => marker.setMap(null));
    historyEndpointMarkersRef.current = endpointPoints.map((point) =>
      new maps.Marker({
        map,
        position: point.position,
        title: point.title,
        icon: buildHistoryEndpointIcon(maps, point.label, point.tone),
        zIndex: 48,
      }),
    );

    return () => {
      historyEndpointMarkersRef.current.forEach((marker) => marker.setMap(null));
      historyEndpointMarkersRef.current = [];
    };
  }, [historyPath, locale, mapInstanceRef, mapReady, mapsApiRef]);

  useEffect(() => {
    if (!mapReady || !mapInstanceRef.current || !mapsApiRef.current) return;

    const map = mapInstanceRef.current;
    const maps = mapsApiRef.current;
    const infoWindow = infoWindowRef.current;
    const stopsByHalteId = new Map<string, HistoryStopPoint[]>();
    for (const point of historyStopPoints) {
      const current = stopsByHalteId.get(point.halteId) ?? [];
      current.push(point);
      stopsByHalteId.set(point.halteId, current);
    }

    historyStopMarkersRef.current.forEach((marker) => marker.setMap(null));
    historyStopMarkersRef.current = historyStopPoints.map((point) => {
      const durationText =
        typeof point.durationSeconds === "number"
          ? ` · ${Math.max(1, Math.round(point.durationSeconds / 60))} menit`
          : "";
      const timeLabel = formatHistoryStopTime(
        point.startedAtMs ?? point.endedAtMs,
        locale,
      );

      const marker = new maps.Marker({
        map,
        position: { lat: point.lat, lng: point.lng },
        title: `${point.halteName} · ${timeLabel}${durationText}`,
        icon: buildHistoryStopIcon(maps, timeLabel),
        zIndex: 45,
      });
      marker.addListener("click", () => {
        if (!infoWindow) return;
        infoWindow.setContent(
          buildHistoryStopInfoContent(
            point,
            stopsByHalteId.get(point.halteId) ?? [point],
            locale,
          ),
        );
        infoWindow.open({ map, anchor: marker });
      });

      return marker;
    });

    return () => {
      historyStopMarkersRef.current.forEach((marker) => marker.setMap(null));
      historyStopMarkersRef.current = [];
    };
  }, [
    historyStopPoints,
    infoWindowRef,
    locale,
    mapInstanceRef,
    mapReady,
    mapsApiRef,
  ]);

  useEffect(() => clearHistoryTrail, [clearHistoryTrail]);

  return { clearHistoryTrail };
}
