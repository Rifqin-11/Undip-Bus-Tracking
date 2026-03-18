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
  strokeOpacity: 0,
  strokeWeight: 5,
  clickable: false,
  zIndex: 4,
  icons: [
    {
      icon: {
        path: "M 0,-1 0,1",
        strokeOpacity: 1,
        strokeWeight: 2,
        scale: 3,
      },
      offset: "0",
      repeat: "15px",
    },
  ],
} as const;
