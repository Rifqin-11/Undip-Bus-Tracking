/**
 * Server-side Supabase client factories and table-name helpers.
 *
 * User-scoped clients read browser cookies; admin clients use the service role
 * key and must only be called from trusted server code.
 */
import { createServerClient } from "@supabase/ssr";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

/**
 * If using Fluid compute: Don't put this client in a global variable. Always create a new client within each
 * function when using it.
 */
export async function createClient() {
  const cookieStore = await cookies();
  const supabaseUrl = resolveSupabaseUrl();
  const supabaseKey = resolveSupabasePublicKey();

  if (!supabaseUrl || !supabaseKey) {
    throw new Error(
      "Supabase server client env belum lengkap. Set NEXT_PUBLIC_SUPABASE_URL dan NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY atau NEXT_PUBLIC_SUPABASE_ANON_KEY.",
    );
  }

  return createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        } catch {
          // The `setAll` method was called from a Server Component.
          // This can be ignored if you have middleware refreshing
          // user sessions.
        }
      },
    },
  });
}

function resolveSupabaseUrl() {
  return process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
}

function resolveSupabasePublicKey() {
  return (
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}

function resolveSupabaseAdminKey() {
  return process.env.SUPABASE_SERVICE_ROLE_KEY;
}

export function createAdminClient() {
  const supabaseUrl = resolveSupabaseUrl();
  const supabaseKey = resolveSupabaseAdminKey();

  if (!supabaseUrl || !supabaseKey) {
    return null;
  }

  return createSupabaseClient(supabaseUrl, supabaseKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

export function getBuggyHistoryTableName() {
  return (
    process.env.SUPABASE_BUGGY_HISTORY_TABLE ??
    process.env.NEXT_PUBLIC_SUPABASE_BUGGY_HISTORY_TABLE ??
    "buggy_history"
  );
}

export function getLatestBuggyTelemetryTableName() {
  return (
    process.env.SUPABASE_LATEST_BUGGY_TELEMETRY_TABLE ??
    "latest_buggy_telemetry"
  );
}

export function getBuggySessionTableName() {
  return process.env.SUPABASE_BUGGY_SESSION_TABLE ?? "buggy_session_history";
}

export function getDeviceAssignmentsTableName() {
  return process.env.SUPABASE_DEVICE_ASSIGNMENTS_TABLE ?? "device_assignments";
}

export function getDeviceRegistryTableName() {
  return process.env.SUPABASE_DEVICE_REGISTRY_TABLE ?? "device_registry";
}
