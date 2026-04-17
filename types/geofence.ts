export type Geofence = {
  id: string;
  name: string;
  center: {
    lat: number;
    lng: number;
  };
  radiusMeters: number;
  enabled: boolean;
  createdAt: string;
};

export type GeofenceEventType = "ENTER" | "EXIT";

export type GeofenceEvent = {
  id: string;
  buggyId: string;
  buggyName: string;
  geofenceId: string;
  geofenceName: string;
  type: GeofenceEventType;
  timestamp: string;
  position: {
    lat: number;
    lng: number;
  };
};
