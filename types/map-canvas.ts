import type { Buggy, HaltePoint } from "@/types/buggy";

export type LatLngLiteral = {
  lat: number;
  lng: number;
};

export type MarkerHandle = {
  setMap: (map: unknown | null) => void;
  setPosition: (position: LatLngLiteral) => void;
  setTitle: (title: string) => void;
  setIcon: (icon: unknown) => void;
  addListener: (eventName: string, handler: () => void) => void;
};

export type LatLngBoundsHandle = {
  extend: (position: LatLngLiteral) => void;
};

export type MapHandle = {
  panTo: (position: LatLngLiteral) => void;
  setZoom: (zoom: number) => void;
  fitBounds: (bounds: LatLngBoundsHandle, padding?: number) => void;
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

export type MapsApi = {
  Map: new (
    element: HTMLElement,
    options: Record<string, unknown>,
  ) => MapHandle;
  Marker: new (options: Record<string, unknown>) => MarkerHandle;
  InfoWindow: new () => InfoWindowHandle;
  Polyline: new (options: Record<string, unknown>) => PolylineHandle;
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
  selectedBuggyId?: string | null;
  selectedHalteId?: string | null;
  onInfoWindowClose?: () => void;
  onBuggyMarkerClick?: (buggyId: string) => void;
  onHalteMarkerClick?: (halteId: string) => void;
  focusHaltes?: boolean;
};
