import type { MapsApi } from "@/types/map-canvas";

// ─── Polyline style constants ────────────────────────────────────────────────

export const ROUTE_POLYLINE_OPTIONS = {
  geodesic: true,
  strokeColor: "#1d4ed8",
  strokeOpacity: 0.65,
  strokeWeight: 4,
  clickable: false,
  zIndex: 1,
} as const;

export const DIRECTION_POLYLINE_OPTIONS = {
  geodesic: true,
  strokeColor: "#f59e0b",
  strokeOpacity: 0.95,
  strokeWeight: 6,
  clickable: false,
  zIndex: 5,
} as const;

export const WALKING_POLYLINE_OPTIONS = {
  geodesic: true,
  strokeColor: "#059669",
  strokeOpacity: 0.5,
  strokeWeight: 6,
  clickable: false,
  zIndex: 4,
  icons: [
    {
      icon: {
        path: "M 0,1 0, 1",
        strokeOpacity: 1,
        strokeWeight: 7,
        scale: 10,
      },
      offset: "0",
      repeat: "15px",
    },
  ],
} as const;

/** GPS history trail: bright magenta/purple line shown in "history" admin view */
export const HISTORY_POLYLINE_OPTIONS = {
  geodesic: true,
  strokeColor: "#e11d48",
  strokeOpacity: 0.85,
  strokeWeight: 3,
  clickable: false,
  zIndex: 7,
} as const;

export function buildPolylineEndpointIcon(maps: Pick<MapsApi, "SymbolPath">) {
  return {
    path: maps.SymbolPath.CIRCLE,
    fillColor: "#ffffff",
    fillOpacity: 1,
    strokeColor: "#111827",
    strokeOpacity: 1,
    strokeWeight: 2,
    scale: 5.5,
  };
}

export function buildHistoryStopIcon(
  maps: Pick<MapsApi, "Point" | "Size">,
  label: string,
) {
  const safeLabel = label
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
  const width = Math.max(54, safeLabel.length * 7 + 18);
  const center = width / 2;
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="46" viewBox="0 0 ${width} 46">
      <rect x="2" y="1" width="${width - 4}" height="22" rx="11" fill="#ffffff" stroke="#dbeafe" stroke-width="1.5"/>
      <text x="${center}" y="16" text-anchor="middle" font-family="Inter, Arial, sans-serif" font-size="11" font-weight="700" fill="#0f1a3b">${safeLabel}</text>
      <line x1="${center}" y1="24" x2="${center}" y2="30" stroke="#93c5fd" stroke-width="2" stroke-linecap="round"/>
      <circle cx="${center}" cy="36" r="7" fill="#2563eb" stroke="#ffffff" stroke-width="3"/>
    </svg>
  `.trim();

  return {
    url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`,
    size: new maps.Size(width, 46),
    scaledSize: new maps.Size(width, 46),
    anchor: new maps.Point(center, 36),
  };
}

export function buildHistoryEndpointIcon(
  maps: Pick<MapsApi, "Point" | "Size">,
  label: string,
  tone: "start" | "finish",
) {
  const safeLabel = label
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
  const width = Math.max(62, safeLabel.length * 7 + 24);
  const center = width / 2;
  const fillColor = tone === "start" ? "#059669" : "#e11d48";
  const softColor = tone === "start" ? "#d1fae5" : "#ffe4e6";
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="50" viewBox="0 0 ${width} 50">
      <rect x="2" y="1" width="${width - 4}" height="24" rx="12" fill="#ffffff" stroke="${softColor}" stroke-width="1.5"/>
      <circle cx="15" cy="13" r="4" fill="${fillColor}"/>
      <text x="${center + 5}" y="17" text-anchor="middle" font-family="Inter, Arial, sans-serif" font-size="11" font-weight="800" fill="#0f172a">${safeLabel}</text>
      <line x1="${center}" y1="27" x2="${center}" y2="32" stroke="${fillColor}" stroke-width="2" stroke-linecap="round"/>
      <circle cx="${center}" cy="39" r="8" fill="${fillColor}" stroke="#ffffff" stroke-width="3"/>
      <circle cx="${center}" cy="39" r="3" fill="#ffffff"/>
    </svg>
  `.trim();

  return {
    url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`,
    size: new maps.Size(width, 50),
    scaledSize: new maps.Size(width, 50),
    anchor: new maps.Point(center, 39),
  };
}
