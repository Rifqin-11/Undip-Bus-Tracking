export type StatTone = "navy" | "emerald" | "amber" | "rose" | "slate";

export type ChartDatum = {
  label: string;
  value: number;
  helper?: string;
};

export type AdminStatisticsData = {
  currentMonth: {
    totalTrips: number;
    totalDistanceKm: number;
    avgSpeedKmh: number;
    totalDurationMin: number;
    totalPassengers: number;
    avgBatteryUsed: number | null;
    avgPassengersPerDay: number;
  };
  trends: {
    trips: number;
    distance: number;
    passengers: number;
  };
  dailySeries: Array<{
    date: string;
    trips: number;
    distanceKm: number;
    durationMin: number;
  }>;
  hourlyPassengerDemand: ChartDatum[];
  delayTrend: {
    targetDuration: number;
    data: ChartDatum[];
  };
};
