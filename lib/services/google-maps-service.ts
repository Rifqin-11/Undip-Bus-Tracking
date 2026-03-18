/**
 * Google Maps Service menggunakan JavaScript API (browser)
 * untuk geocoding dan directions.
 */

export type LatLngConstructor = new (lat: number, lng: number) => {
  lat: () => number;
  lng: () => number;
};

export type LatLngBoundsConstructor = new (sw?: unknown, ne?: unknown) => unknown;

export type TravelModeEnum = {
  WALKING: unknown;
  DRIVING: unknown;
  BICYCLING: unknown;
  TRANSIT: unknown;
};

export type GeocoderResult = {
  formatted_address: string;
  geometry: {
    location: { lat: () => number; lng: () => number };
  };
  address_components?: Array<{ long_name: string; short_name: string }>;
};

export type GeocoderService = {
  geocode: (request: {
    address: string;
    bounds?: unknown;
    region?: string;
  }) => Promise<{ results: GeocoderResult[] }>;
};

export type DirectionsLeg = {
  distance?: { text: string };
  duration?: { text: string };
  steps: Array<{
    distance?: { text: string };
    duration?: { text: string };
    instructions: string;
    start_location: { lat: () => number; lng: () => number };
    end_location: { lat: () => number; lng: () => number };
    polyline?: { points: string };
  }>;
};

export type DirectionsRoute = {
  overview_polyline: string;
  overview_path: Array<{ lat: () => number; lng: () => number }>;
  legs: DirectionsLeg[];
};

export type DirectionsService = {
  route: (request: {
    origin: unknown;
    destination: unknown;
    travelMode: unknown;
    region?: string;
    language?: string;
  }) => Promise<{ routes: DirectionsRoute[] }>;
};

export type MapsApiBundle = {
  Geocoder: new () => GeocoderService;
  DirectionsService: new () => DirectionsService;
  TravelMode: TravelModeEnum;
  LatLng: LatLngConstructor;
  LatLngBounds: LatLngBoundsConstructor;
};

export type PlaceLocation = {
  name: string;
  address: string;
  lat: number;
  lng: number;
};

export type WalkingRoute = {
  totalDistance: string;
  totalDuration: string;
  decodedPath: [number, number][];
};

export class GoogleMapsService {
  private static readonly UNDIP_BOUNDS = {
    southwest: { lat: -7.065, lng: 110.428 },
    northeast: { lat: -7.045, lng: 110.448 },
  };

  private readonly geocoder: GeocoderService;
  private readonly directionsService: DirectionsService;
  private readonly api: MapsApiBundle;

  constructor(api: MapsApiBundle) {
    this.api = api;
    this.geocoder = new api.Geocoder();
    this.directionsService = new api.DirectionsService();
  }

  static fromWindow(): GoogleMapsService {
    const maps = (window as Window & { google?: { maps?: MapsApiBundle } })
      .google?.maps;

    if (
      !maps?.Geocoder ||
      !maps.DirectionsService ||
      !maps.TravelMode ||
      !maps.LatLng ||
      !maps.LatLngBounds
    ) {
      throw new Error("Google Maps JavaScript API belum loaded.");
    }

    return new GoogleMapsService(maps as MapsApiBundle);
  }

  async geocodePlace(query: string): Promise<PlaceLocation | null> {
    try {
      let searchQuery = query.trim();
      const isShort = searchQuery.length < 10;
      const hasContext = /undip|diponegoro|tembalang|semarang/i.test(searchQuery);

      if (isShort && !hasContext) {
        searchQuery = `${searchQuery} UNDIP Tembalang Semarang`;
      }

      const bounds = new this.api.LatLngBounds(
        new this.api.LatLng(
          GoogleMapsService.UNDIP_BOUNDS.southwest.lat,
          GoogleMapsService.UNDIP_BOUNDS.southwest.lng,
        ),
        new this.api.LatLng(
          GoogleMapsService.UNDIP_BOUNDS.northeast.lat,
          GoogleMapsService.UNDIP_BOUNDS.northeast.lng,
        ),
      );

      const result = await this.geocoder.geocode({
        address: searchQuery,
        bounds,
        region: "id",
      });

      if (!result.results?.length) return null;

      const first = result.results[0];
      const loc = first.geometry.location;
      const placeName =
        first.address_components?.[0]?.long_name ??
        first.formatted_address.split(",")[0];

      return {
        name: placeName,
        address: first.formatted_address,
        lat: loc.lat(),
        lng: loc.lng(),
      };
    } catch {
      return null;
    }
  }

  async getWalkingDirections(
    origin: { lat: number; lng: number },
    destination: { lat: number; lng: number },
  ): Promise<WalkingRoute | null> {
    try {
      const result = await this.directionsService.route({
        origin: new this.api.LatLng(origin.lat, origin.lng),
        destination: new this.api.LatLng(destination.lat, destination.lng),
        travelMode: this.api.TravelMode.WALKING,
        region: "id",
        language: "id",
      });

      if (!result.routes?.length) return null;

      const route = result.routes[0];
      const leg = route.legs[0];
      if (!leg) return null;

      const decodedPath: [number, number][] = (route.overview_path ?? []).map(
        (p) => [p.lat(), p.lng()],
      );

      return {
        totalDistance: leg.distance?.text ?? "",
        totalDuration: leg.duration?.text ?? "",
        decodedPath,
      };
    } catch {
      return null;
    }
  }

  findNearestHalte(
    location: { lat: number; lng: number },
    haltes: Array<{ id: string; name: string; lat: number; lng: number }>,
  ) {
    if (!haltes.length) return null;

    let nearest = haltes[0];
    let minDist = this.haversine(location, haltes[0]);

    for (const h of haltes) {
      const d = this.haversine(location, h);
      if (d < minDist) {
        minDist = d;
        nearest = h;
      }
    }

    return nearest;
  }

  private haversine(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
    const R = 6371e3;
    const φ1 = (a.lat * Math.PI) / 180;
    const φ2 = (b.lat * Math.PI) / 180;
    const Δφ = ((b.lat - a.lat) * Math.PI) / 180;
    const Δλ = ((b.lng - a.lng) * Math.PI) / 180;
    const x = Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
  }
}
