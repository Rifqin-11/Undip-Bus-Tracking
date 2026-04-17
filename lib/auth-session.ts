export const ADMIN_SESSION_COOKIE = "admin_session";
export const ADMIN_SESSION_MAX_AGE_SECONDS = 60 * 60 * 8;

export function getAdminUsername(): string {
  return process.env.ADMIN_USERNAME ?? "admin";
}

export function getAdminPassword(): string {
  return process.env.ADMIN_PASSWORD ?? "admin123";
}
