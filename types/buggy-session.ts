export type BuggySession = {
  id: string;
  buggyId: string;
  /** YYYY-MM-DD (UTC date of session start) */
  sessionDate: string;
  /** 1-based session number for this buggy on this date */
  sessionNumber: number;
  startedAt: string;   // ISO timestamp
  endedAt: string;     // ISO timestamp
  /** Duration in minutes (rounded to 1 decimal) */
  durationMinutes: number | null;
  pointCount: number;
  totalDistanceKm: number | null;
  avgSpeedKmh: number | null;
  maxSpeedKmh: number | null;
  batteryStart: number | null; // % at session start
  batteryEnd: number | null;   // % at session end
  batteryUsed: number | null;  // start - end (positive = drain)
  /**
   * GPS path as ordered tuples for map rendering.
   * Format: [lat, lng, unixMs?] — 3rd element is unix timestamp (ms) for per-point display.
   */
  path: [number, number, number?][];
  /** True when the session is currently in progress (not yet finalized) */
  isOngoing?: boolean;
};
