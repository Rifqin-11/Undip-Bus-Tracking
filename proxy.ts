import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import {
  defaultLocale,
  localeCookieName,
  normalizeLocale,
  type Locale,
} from "@/lib/i18n/config";
import {
  getLocaleFromPath,
  localizePath,
  pathShouldSkipLocale,
  stripLocaleFromPath,
} from "@/lib/i18n/routing";

function getPreferredLocale(request: NextRequest): Locale {
  const cookieLocale = request.cookies.get(localeCookieName)?.value;
  if (cookieLocale) return normalizeLocale(cookieLocale);

  const acceptLanguage = request.headers.get("accept-language");
  const browserLocale = acceptLanguage
    ?.split(",")
    .map((part) => part.split(";")[0]?.trim())
    .find(Boolean);

  return browserLocale ? normalizeLocale(browserLocale) : defaultLocale;
}

function redirectToLocalized(request: NextRequest, pathname: string) {
  const locale = getPreferredLocale(request);
  const url = request.nextUrl.clone();
  url.pathname = localizePath(pathname, locale);
  const response = NextResponse.redirect(url);
  response.cookies.set(localeCookieName, locale, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });
  return response;
}

export async function proxy(request: NextRequest) {
  const originalPathname = request.nextUrl.pathname;

  // Locale normalization runs before auth so every browser-facing page has a
  // stable `/id` or `/en` prefix. API routes and static assets are skipped to
  // keep machine-facing endpoints untouched.
  if (!pathShouldSkipLocale(originalPathname)) {
    const pathLocale = getLocaleFromPath(originalPathname);
    if (!pathLocale) {
      return redirectToLocalized(request, originalPathname);
    }
  }

  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return supabaseResponse;
  }

  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value),
        );
        supabaseResponse = NextResponse.next({
          request,
        });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options),
        );
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname: rawPathname } = request.nextUrl;
  const activeLocale = getLocaleFromPath(rawPathname) ?? getPreferredLocale(request);
  const pathname = stripLocaleFromPath(rawPathname);
  const authenticated = !!user;
  const isAdminPage = pathname.startsWith("/admin");
  const isDriverPage = pathname.startsWith("/driver");
  const isGpsTrackerPage = pathname.startsWith("/gps-tracker");
  const isAdminApi = pathname.startsWith("/api/admin");
  const isGeofenceApi = pathname.startsWith("/api/geofences");
  const isHistoryApi =
    pathname.startsWith("/api/buggy-sessions") ||
    pathname.startsWith("/api/buggy-history");
  const isProtectedRoute =
    isAdminPage ||
    isDriverPage ||
    isGpsTrackerPage ||
    isAdminApi ||
    isGeofenceApi ||
    isHistoryApi;

  let role: "Admin" | "Driver" | "Pengguna umum" = "Pengguna umum";

  // The Supabase session only proves identity. Authorization comes from the
  // application-owned `accounts.role` field, so role changes take effect without
  // modifying Supabase Auth metadata.
  if (authenticated) {
    const { data: account } = await supabase
      .from("accounts")
      .select("role")
      .eq("id", user.id)
      .single();

    if (
      account?.role === "Admin" ||
      account?.role === "Driver" ||
      account?.role === "Pengguna umum"
    ) {
      role = account.role;
    }
  }

  // Route-level access control lives here as a first line of defense. Sensitive
  // API handlers still keep their own guards for write operations.
  if (isProtectedRoute) {
    if (!authenticated) {
      if (pathname.startsWith("/api/")) {
        return NextResponse.json(
          { message: "Authentication required." },
          { status: 401 },
        );
      }

      const loginUrl = new URL(localizePath("/login", activeLocale), request.url);
      loginUrl.searchParams.set("next", localizePath(pathname, activeLocale));
      return NextResponse.redirect(loginUrl);
    }

    if ((isAdminPage || isDriverPage) && role === "Pengguna umum") {
      return NextResponse.redirect(
        new URL(localizePath("/", activeLocale), request.url),
      );
    }

    if (isGpsTrackerPage && role !== "Admin") {
      return NextResponse.redirect(
        new URL(localizePath("/", activeLocale), request.url),
      );
    }

    if (isAdminApi && role !== "Admin") {
      return NextResponse.json(
        { message: "Admin access required." },
        { status: 403 },
      );
    }

    if (isHistoryApi && role !== "Admin" && role !== "Driver") {
      return NextResponse.json(
        { message: "Admin access required." },
        { status: 403 },
      );
    }

    if (isGeofenceApi && request.method !== "GET" && role !== "Admin") {
      return NextResponse.json(
        { message: "Admin access required." },
        { status: 403 },
      );
    }
  }

  if (pathname === "/login" && authenticated) {
    if (role === "Admin") {
      return NextResponse.redirect(
        new URL(localizePath("/admin", activeLocale), request.url),
      );
    }

    if (role === "Driver") {
      return NextResponse.redirect(
        new URL(localizePath("/driver", activeLocale), request.url),
      );
    }

    return NextResponse.redirect(
      new URL(localizePath("/", activeLocale), request.url),
    );
  }

  supabaseResponse.cookies.set(localeCookieName, activeLocale, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });
  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|logo.svg|.*\\..*).*)",
    "/admin/:path*",
    "/driver/:path*",
    "/gps-tracker/:path*",
    "/login",
    "/api/geofences/:path*",
    "/api/admin/:path*",
    "/api/buggy-sessions/:path*",
    "/api/buggy-history",
  ],
};
