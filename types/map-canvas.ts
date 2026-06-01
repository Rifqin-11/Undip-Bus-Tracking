import type { Buggy, HaltePoint } from "@/types/buggy";
import type { Geofence } from "@/types/geofence";
import type { HistoryStopPoint } from "@/lib/history/stop-points";

export type LatLngLiteral = {
  lat: number;
  lng: number;
};

export type MarkerHandle = {
  setMap: (map: unknown | null) => void;
  setPosition: (position: LatLngLiteral) => void;
  setTitle: (title: string) => void;
  setIcon: (icon: unknown) => void;
  addListener: (
    eventName: string,
    handler: () => void,
  ) => { remove: () => void };
};

export type LatLngBoundsHandle = {
  extend: (position: LatLngLiteral) => void;
};

export type MapHandle = {
  panTo: (position: LatLngLiteral) => void;
  setZoom: (zoom: number) => void;
  getZoom: () => number | undefined;
  getCenter: () => { lat: () => number; lng: () => number } | null;
  fitBounds: (bounds: LatLngBoundsHandle, padding?: number) => void;
  setMapTypeId: (mapTypeId: string) => void;
  addListener: (
    eventName: string,
    handler: (event?: {
      latLng?: { lat: () => number; lng: () => number };
    }) => void,
  ) => { remove: () => void };
};

export type InfoWindowHandle = {
  setContent: (content: string) => void;
  open: (options: { map: unknown; anchor: unknown }) => void;
  close: () => void;
  addListener: (
    eventName: string,
    handler: () => void,
  ) => { remove: () => void };
};

export type PolylineHandle = {
  setMap: (map: unknown | null) => void;
};

export type CircleHandle = {
  setMap: (map: unknown | null) => void;
  setCenter: (center: LatLngLiteral) => void;
  setRadius: (radius: number) => void;
  setOptions: (options: Record<string, unknown>) => void;
  getCenter: () => { lat: () => number; lng: () => number } | null;
  getRadius: () => number;
  addListener: (
    eventName: string,
    handler: () => void,
  ) => { remove: () => void };
};

export type MapsApi = {
  Map: new (
    element: HTMLElement,
    options: Record<string, unknown>,
  ) => MapHandle;
  Marker: new (options: Record<string, unknown>) => MarkerHandle;
  Size: new (width: number, height: number) => unknown;
  Point: new (x: number, y: number) => unknown;
  InfoWindow: new () => InfoWindowHandle;
  Polyline: new (options: Record<string, unknown>) => PolylineHandle;
  Circle: new (options: Record<string, unknown>) => CircleHandle;
  LatLngBounds: new () => LatLngBoundsHandle;
  SymbolPath: {
    CIRCLE: unknown;
  };
  event: {
    trigger: (instance: unknown, eventName: string) => void;
  };
};

export type GoogleMapsWindow = Window & {
  google?: {
    maps?: MapsApi;
  };
};

export type MapStyleId = "standard" | "satellite" | "terrain";

export type MapCanvasProps = {
  buggies: Buggy[];
  haltes: HaltePoint[];
  routePath: [number, number][];
  /** Style/jenis dasar peta. Default `"standard"`. */
  mapStyle?: MapStyleId;
  directionPath?: [number, number][];
  walkingToHaltePath?: [number, number][];
  walkingFromHaltePath?: [number, number][];
  /** Posisi device/user saat ini dari browser geolocation. */
  userPosition?: { lat: number; lng: number } | null;
  originMarkerPosition?: { lat: number; lng: number };
  destinationMarkerPosition?: { lat: number; lng: number };
  selectedBuggyId?: string | null;
  selectedHalteId?: string | null;
  centerTarget?: { lat: number; lng: number } | null;
  geofences?: Geofence[];
  geofenceCreateMode?: boolean;
  /** Draft geofence circle shown while user is creating a new geofence */
  draftGeofence?: { center: LatLngLiteral; radiusMeters: number } | null;
  /** Called whenever the user drags or resizes the draft circle */
  onDraftGeofenceChange?: (center: LatLngLiteral, radiusMeters: number) => void;
  onInfoWindowClose?: () => void;
  onMapClick?: (position: LatLngLiteral) => void;
  onBuggyMarkerClick?: (buggyId: string) => void;
  onHalteMarkerClick?: (halteId: string) => void;
  focusHaltes?: boolean;
  /** GPS history trail path to render on the map as a coloured polyline */
  historyPath?: [number, number][];
  /** Stop markers detected from a selected GPS history trail */
  historyStopPoints?: HistoryStopPoint[];
};
