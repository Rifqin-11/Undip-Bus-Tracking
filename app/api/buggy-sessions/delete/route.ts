import { NextRequest, NextResponse } from "next/server";
import { createAdminClient, getBuggySessionTableName, getBuggyHistoryTableName } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const supabase = createAdminClient();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });
  }

  try {
    const { id, buggyId, startedAt, endedAt } = await req.json();

    if (!buggyId || !startedAt || !endedAt) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // 1. Hapus data mentah di buggy_history (beri kelonggaran 5 detik agar tidak ada timestamp microsecond yang tertinggal)
    const startMinus5Secs = new Date(new Date(startedAt).getTime() - 5000).toISOString();
    const endPlus5Secs = new Date(new Date(endedAt).getTime() + 5000).toISOString();

    console.log("[DELETE] Attempting to delete session:", { id, buggyId, startedAt, endedAt, startMinus5Secs, endPlus5Secs });

    const { data: rawDeleted, error: rawError } = await supabase
      .from(getBuggyHistoryTableName())
      .delete()
      .eq("buggy_id", buggyId)
      .gte("recorded_at", startMinus5Secs)
      .lte("recorded_at", endPlus5Secs)
      .select();

    if (rawError) {
      console.error("[DELETE] Gagal menghapus raw points:", rawError.message);
    } else {
      console.log(`[DELETE] Successfully deleted ${rawDeleted?.length} raw points from buggy_history`);
    }

    // 2. Hapus terekapitulasi di buggy_session_history (abaikan ID agar sinkron mskipun synth-)
    const { data: sessionDeleted, error: sessionError } = await supabase
      .from(getBuggySessionTableName())
      .delete()
      .eq("buggy_id", buggyId)
      .gte("started_at", startMinus5Secs)
      .lte("started_at", endPlus5Secs)
      .select();

    if (sessionError) {
      console.error("[DELETE] Gagal menghapus session row:", sessionError.message);
    } else {
      console.log(`[DELETE] Successfully deleted ${sessionDeleted?.length} session rows from buggy_session_history`);
    }

    return NextResponse.json({ success: true, rawDeleted: rawDeleted?.length, sessionDeleted: sessionDeleted?.length });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
