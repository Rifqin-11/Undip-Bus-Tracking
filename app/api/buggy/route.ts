import { NextResponse } from "next/server";
import { getBuggyLiveSnapshot } from "@/lib/realtime/buggy-live-store";
import { bootstrapFromDatabase } from "@/lib/supabase/data-loader";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  // Lazy bootstrap: load data dari Supabase jika belum pernah dilakukan
  await bootstrapFromDatabase();

  const snapshot = getBuggyLiveSnapshot();
  return NextResponse.json(snapshot.buggies, {
    headers: {
      "x-buggy-source": snapshot.source,
      "x-buggy-updated-at": String(snapshot.updatedAt),
    },
  });
}
