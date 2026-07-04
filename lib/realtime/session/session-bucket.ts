export const MIN_SESSION_DISTANCE_KM = 1.0;
const OPERATIONAL_TIME_ZONE = "Asia/Jakarta";

function getJakartaDateParts(value: string | number | Date): {
  date: string;
  hour: number;
  minute: number;
} {
  const date = new Date(value);
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: OPERATIONAL_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const partMap = Object.fromEntries(
    parts.map((part) => [part.type, part.value]),
  );

  return {
    date: `${partMap.year}-${partMap.month}-${partMap.day}`,
    hour: Number(partMap.hour ?? 0),
    minute: Number(partMap.minute ?? 0),
  };
}

export function getOperationalSessionBucket(value: string | number | Date): {
  date: string;
  key: string;
  sessionNumber: number;
  isScheduled: boolean;
} {
  const { date, hour, minute } = getJakartaDateParts(value);
  const minutesSinceMidnight = hour * 60 + minute;

  if (minutesSinceMidnight >= 5 * 60 && minutesSinceMidnight < 12 * 60) {
    return {
      date,
      key: `${date}:morning`,
      sessionNumber: 1,
      isScheduled: true,
    };
  }

  if (
    minutesSinceMidnight >= 13 * 60 &&
    minutesSinceMidnight <= 17 * 60 + 30
  ) {
    return {
      date,
      key: `${date}:afternoon`,
      sessionNumber: 2,
      isScheduled: true,
    };
  }

  return {
    date,
    key: `${date}:outside`,
    sessionNumber: 3,
    isScheduled: false,
  };
}

export function isSessionDistanceEligible(totalDistanceKm: number): boolean {
  return (
    Number.isFinite(totalDistanceKm) &&
    totalDistanceKm >= MIN_SESSION_DISTANCE_KM
  );
}
