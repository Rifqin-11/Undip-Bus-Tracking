import type { NextRequest } from "next/server";
import { getBuggySessions } from "@/lib/server/buggy-sessions/get-sessions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET(request: NextRequest) {
  return getBuggySessions(request);
}
