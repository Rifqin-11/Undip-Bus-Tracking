/**
 * Error normalization helper.
 *
 * Converts unknown caught values into safe strings for API responses and logs.
 */
export function getErrorMessage(
  error: unknown,
  fallback = "Terjadi kesalahan",
): string {
  return error instanceof Error && error.message ? error.message : fallback;
}
