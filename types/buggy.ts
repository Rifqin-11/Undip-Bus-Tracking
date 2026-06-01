export type CrowdLevel = "LONGGAR" | "HAMPIR_PENUH" | "PENUH";

export type BuggyConnectionStatus =
  | "online"
  | "signal_unstable"
  | "connection_lost"
  | "offline";

export type BuggyGsmStatus = {
  apn?: string;
  signalCsq?: number;
  signalDbm?: number;
  signalPercent?: number;
  simStatus?: number;
  simStatusText?: string;
  networkConnected?: boolean;
  gprsConnected?: boolean;
  localIp?: string;
  networkType?: string;
  mqttState?: number;
  mqttStateText?: string;
};

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
  connectionStatus?: BuggyConnectionStatus;
  lastSeenAt?: string;
  lastSeenSecondsAgo?: number;
  currentStopIndex: number;
  stops: string[];
  pathCursor: number;
  position: {
    lat: number;
    lng: number;
  };
  gsm?: BuggyGsmStatus;
};

export type HaltePoint = {
  id: string;
  name: string;
  lat: number;
  lng: number;
  /** Jadwal keberangkatan, mis. ["07:00","07:45","08:30"] */
  schedule?: string[];
  /** Fasilitas terdekat, mis. ["Gedung kuliah terdekat","Area parkir"] */
  facilities?: string[];
  /** Status aktif/nonaktif (default true) */
  isActive?: boolean;
  /** Urutan rute halte */
  sortOrder?: number;
};

export type PanelView =
  | "buggy"
  | "halte"
  | "notifikasi"
  | "settings"
  | "lapor"
  | "data"
  | "data-detail"
  | "history";
