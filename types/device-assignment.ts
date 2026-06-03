export type DeviceAssignment = {
  id: string;
  devicesId: string;
  buggyId: string;
  buggyCode: string | null;
  buggyName: string | null;
  buggyNumericId: number | null;
  label: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  lastSeenAt: string | null;
  speedKmh: number | null;
  passengers: number | null;
};

export type DeviceOption = DeviceAssignment & {
  source: "assignment" | "registry";
};
