import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import {
  ADMIN_SESSION_COOKIE,
  ADMIN_SESSION_MAX_AGE_SECONDS,
  getAdminPassword,
  getAdminUsername,
} from "@/lib/auth-session";

export const runtime = "nodejs";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { message: "Payload JSON tidak valid." },
      { status: 400 },
    );
  }

  const payload = body as { username?: unknown; password?: unknown };
  const username = typeof payload.username === "string" ? payload.username : "";
  const password = typeof payload.password === "string" ? payload.password : "";

  if (username !== getAdminUsername() || password !== getAdminPassword()) {
    return NextResponse.json(
      { message: "Username atau password salah." },
      { status: 401 },
    );
  }

  const response = NextResponse.json({ success: true });
  response.cookies.set({
    name: ADMIN_SESSION_COOKIE,
    value: randomUUID(),
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: ADMIN_SESSION_MAX_AGE_SECONDS,
  });
  return response;
}
