/**
 * Server-side admin authorization guard.
 *
 * Combines Supabase Auth identity with the application `accounts.role` value.
 * API routes use this helper so admin-only write operations share one consistent
 * 401/403 response contract.
 */
import { NextResponse } from "next/server";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

type AdminGuardResult =
  | {
      authorized: true;
      user: User;
    }
  | {
      authorized: false;
      response: NextResponse;
    };

export async function requireAdmin(): Promise<AdminGuardResult> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return {
        authorized: false,
        response: NextResponse.json(
          { message: "Authentication required." },
          { status: 401 },
        ),
      };
    }

    const { data: account, error: accountError } = await supabase
      .from("accounts")
      .select("role")
      .eq("id", user.id)
      .single();

    if (accountError || account?.role !== "Admin") {
      return {
        authorized: false,
        response: NextResponse.json(
          { message: "Admin access required." },
          { status: 403 },
        ),
      };
    }

    return { authorized: true, user };
  } catch (error) {
    return {
      authorized: false,
      response: NextResponse.json(
        {
          message:
            error instanceof Error
              ? error.message
              : "Gagal memverifikasi akses admin.",
        },
        { status: 500 },
      ),
    };
  }
}
