import type { NextRequest } from "next/server";
import {
  getGpsBeaconHealth,
  handleGpsBeaconPost,
} from "@/lib/server/gps-beacon/ingest-route";

export const runtime = "nodejs";

export function POST(request: NextRequest) {
  return handleGpsBeaconPost(request);
}

export function GET() {
  return getGpsBeaconHealth();
}
