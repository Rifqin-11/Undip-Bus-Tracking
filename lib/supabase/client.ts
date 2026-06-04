/**
 * Browser Supabase client factory.
 *
 * Creates a client with public anon credentials for user-scoped reads/writes.
 * Service-role operations must stay server-side.
 */
import { createBrowserClient } from "@supabase/ssr";

function resolveSupabaseUrl() {
  return process.env.NEXT_PUBLIC_SUPABASE_URL;
}

function resolveSupabasePublicKey() {
  return (
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}

export function createClient() {
  const supabaseUrl = resolveSupabaseUrl();
  const supabaseKey = resolveSupabasePublicKey();

  if (!supabaseUrl || !supabaseKey) {
    throw new Error(
      "Supabase client env belum lengkap. Set NEXT_PUBLIC_SUPABASE_URL dan NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY atau NEXT_PUBLIC_SUPABASE_ANON_KEY.",
    );
  }

  return createBrowserClient(supabaseUrl, supabaseKey);
}
