import type { Buggy, HaltePoint } from "@/types/buggy";
import type { Geofence } from "@/types/geofence";

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
  fitBounds: (bounds: LatLngBoundsHandle, padding?: number) => void;
  addListener: (
    eventName: string,
    handler: (event: { latLng?: { lat: () => number; lng: () => number } }) => void,
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
};

export type MapsApi = {
  Map: new (
    element: HTMLElement,
    options: Record<string, unknown>,
  ) => MapHandle;
  Marker: new (options: Record<string, unknown>) => MarkerHandle;
  InfoWindow: new () => InfoWindowHandle;
  Polyline: new (options: Record<string, unknown>) => PolylineHandle;
  Circle: new (options: Record<string, unknown>) => CircleHandle;
  LatLngBounds: new () => LatLngBoundsHandle;
  SymbolPath: {
    CIRCLE: unknown;
  };
};

export type GoogleMapsWindow = Window & {
  google?: {
    maps?: MapsApi;
  };
};

export type MapCanvasProps = {
  buggies: Buggy[];
  haltes: HaltePoint[];
  routePath: [number, number][];
  directionPath?: [number, number][];
  walkingToHaltePath?: [number, number][];
  walkingFromHaltePath?: [number, number][];
  originMarkerPosition?: { lat: number; lng: number };
  destinationMarkerPosition?: { lat: number; lng: number };
  selectedBuggyId?: string | null;
  selectedHalteId?: string | null;
  centerTarget?: { lat: number; lng: number } | null;
  geofences?: Geofence[];
  geofenceCreateMode?: boolean;
  onInfoWindowClose?: () => void;
  onMapClick?: (position: LatLngLiteral) => void;
  onBuggyMarkerClick?: (buggyId: string) => void;
  onHalteMarkerClick?: (halteId: string) => void;
  focusHaltes?: boolean;
};
