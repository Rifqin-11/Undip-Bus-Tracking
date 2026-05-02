export type CrowdLevel = "LONGGAR" | "HAMPIR_PENUH" | "PENUH";

export type Buggy = {
  id: string;
  /** ID numerik untuk pencocokan GPS beacon (kolom numeric_id di tabel buggies) */
  numericId?: number;
  code: string;
  name: string;
  isActive: boolean;
  routeLabel: string;
  tripId: string;
  etaMinutes: number;
  speedKmh: number;
  crowdLevel: CrowdLevel;
  passengers: number;
  capacity: number;
  tag: string;
  updatedAt: string;
  currentStopIndex: number;
  stops: string[];
  pathCursor: number;
  position: {
    lat: number;
    lng: number;
  };
};

export type HaltePoint = {
  id: string;
  name: string;
  lat: number;
  lng: number;
};

export type PanelView = "buggy" | "halte" | "notifikasi" | "lapor" | "data" | "data-detail" | "history";
