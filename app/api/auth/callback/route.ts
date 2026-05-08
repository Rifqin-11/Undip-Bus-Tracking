import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/admin";
  const safeNext = next.startsWith("/") ? next : "/";
  const isPasswordReset = safeNext === "/reset-password";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      if (isPasswordReset) {
        return NextResponse.redirect(`${origin}/reset-password`);
      }

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        const { data: account } = await supabase
          .from("accounts")
          .select("role")
          .eq("id", user.id)
          .single();

        if (account?.role === "Admin") {
          return NextResponse.redirect(`${origin}/admin`);
        }

        if (account?.role === "Driver") {
          return NextResponse.redirect(`${origin}/driver`);
        }

        return NextResponse.redirect(`${origin}/`);
      }

      return NextResponse.redirect(
        `${origin}${safeNext}`,
      );
    }
  }

  if (isPasswordReset) {
    return NextResponse.redirect(
      `${origin}/reset-password?error=invalid_reset_link`,
    );
  }

  return NextResponse.redirect(`${origin}/login?error=Invalid+OAuth+Code`);
}
