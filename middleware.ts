import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

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
          request.cookies.set(name, value)
        );
        supabaseResponse = NextResponse.next({
          request,
        });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options)
        );
      },
    },
  });

  // Call getUser to verify the session token
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const authenticated = !!user;
  const isAdminPage = pathname.startsWith("/admin");
  const isDriverPage = pathname.startsWith("/driver");
  const isAdminApi = pathname.startsWith("/api/admin");
  const isGeofenceApi = pathname.startsWith("/api/geofences");
  const isProtectedRoute =
    isAdminPage || isDriverPage || isAdminApi || isGeofenceApi;

  let role: "Admin" | "Driver" | "Pengguna umum" = "Pengguna umum";

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

  if (isProtectedRoute) {
    if (!authenticated) {
      if (pathname.startsWith("/api/")) {
        return NextResponse.json(
          { message: "Authentication required." },
          { status: 401 },
        );
      }

      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("next", pathname);
      return NextResponse.redirect(loginUrl);
    }

    if ((isAdminPage || isDriverPage) && role === "Pengguna umum") {
      return NextResponse.redirect(new URL("/", request.url));
    }

    if (isAdminApi && role !== "Admin") {
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
      return NextResponse.redirect(new URL("/admin", request.url));
    }

    if (role === "Driver") {
      return NextResponse.redirect(new URL("/driver", request.url));
    }

    return NextResponse.redirect(new URL("/", request.url));
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/admin/:path*",
    "/driver/:path*",
    "/login",
    "/api/geofences/:path*",
    "/api/admin/:path*"
  ],
};
