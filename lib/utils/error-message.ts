export function getErrorMessage(
  error: unknown,
  fallback = "Terjadi kesalahan",
): string {
  return error instanceof Error && error.message ? error.message : fallback;
}
