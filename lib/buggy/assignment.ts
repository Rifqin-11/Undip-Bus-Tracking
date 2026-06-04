/**
 * Driver-to-buggy assignment helpers.
 *
 * These functions normalize historical assignment formats so driver accounts can
 * be matched against UUIDs, numeric ids, codes, or display names safely.
 */
import type { Buggy } from "@/types/buggy";

function normalizeKey(value: string | null | undefined) {
  return (value ?? "").trim().toLowerCase().replace(/[\s_]/g, "-");
}

function extractNumericId(value: string | null | undefined) {
  const normalized = normalizeKey(value);
  const match =
    normalized.match(/^buggy-?0*(\d+)$/) ??
    normalized.match(/^b0*(\d+)$/) ??
    normalized.match(/^0*(\d+)$/);

  if (!match) return null;

  const numericId = Number.parseInt(match[1], 10);
  return Number.isFinite(numericId) ? numericId : null;
}

export function isBuggyAssignedToValue(
  buggy: Buggy,
  assignedBuggyId: string | null | undefined,
) {
  const assignedKey = normalizeKey(assignedBuggyId);
  if (!assignedKey) return false;

  const buggyKeys = [
    buggy.id,
    buggy.code,
    buggy.name,
    typeof buggy.numericId === "number" ? String(buggy.numericId) : null,
    typeof buggy.numericId === "number" ? `buggy-${buggy.numericId}` : null,
    typeof buggy.numericId === "number" ? `b${String(buggy.numericId).padStart(2, "0")}` : null,
  ]
    .filter((value): value is string => Boolean(value))
    .map(normalizeKey);

  if (buggyKeys.includes(assignedKey)) return true;

  const assignedNumericId = extractNumericId(assignedBuggyId);
  return (
    assignedNumericId !== null &&
    typeof buggy.numericId === "number" &&
    buggy.numericId === assignedNumericId
  );
}

export function resolveAssignedBuggy(
  assignedBuggyId: string | null | undefined,
  buggies: Buggy[],
) {
  return buggies.find((buggy) => isBuggyAssignedToValue(buggy, assignedBuggyId));
}
