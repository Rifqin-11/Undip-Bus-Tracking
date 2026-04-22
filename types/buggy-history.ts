export type BuggyHistoryEntry = {
  id: string;
  buggyId: string;
  lat: number;
  lng: number;
  speedKmh: number | null;
  accuracy: number | null;
  heading: number | null;
  altitude: number | null;
  source: string | null;
  recordedAt: string;
};
