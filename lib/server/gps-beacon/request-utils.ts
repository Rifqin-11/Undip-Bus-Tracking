export function isSchemaColumnError(message: string) {
  return (
    message.includes("schema cache") ||
    message.includes("Could not find") ||
    message.includes("column")
  );
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function normalizePassengerCount(
  value: unknown,
  capacity: number | null | undefined,
): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  const safeCapacity =
    typeof capacity === "number" && Number.isFinite(capacity) && capacity > 0
      ? Math.round(capacity)
      : 22;

  return Math.min(safeCapacity, Math.max(0, Math.round(value)));
}
