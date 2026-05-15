import { NextResponse } from "next/server";
import { localeCookieName, normalizeLocale } from "@/lib/i18n/config";
import { getLocaleFromPath, localizePath } from "@/lib/i18n/routing";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/admin";
  const safeNext = next.startsWith("/") ? next : "/";
  const locale = getLocaleFromPath(safeNext) ?? normalizeLocale(request.headers.get("accept-language"));
  const strippedNext = safeNext.replace(/^\/(id|en)(?=\/|$)/, "") || "/";
  const localizedNext = localizePath(strippedNext, locale);
  const isPasswordReset = strippedNext === "/reset-password";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      if (isPasswordReset) {
        return NextResponse.redirect(`${origin}${localizePath("/reset-password", locale)}`);
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
          return NextResponse.redirect(`${origin}${localizePath("/admin", locale)}`);
        }

        if (account?.role === "Driver") {
          return NextResponse.redirect(`${origin}${localizePath("/driver", locale)}`);
        }

        return NextResponse.redirect(`${origin}${localizePath("/", locale)}`);
      }

      const response = NextResponse.redirect(`${origin}${localizedNext}`);
      response.cookies.set(localeCookieName, locale, {
        path: "/",
        maxAge: 60 * 60 * 24 * 365,
        sameSite: "lax",
      });
      return response;
    }
  }

  if (isPasswordReset) {
    return NextResponse.redirect(
      `${origin}${localizePath("/reset-password", locale)}?error=invalid_reset_link`,
    );
  }

  return NextResponse.redirect(
    `${origin}${localizePath("/login", locale)}?error=Invalid+OAuth+Code`,
  );
}
