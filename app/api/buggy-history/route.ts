import { NextRequest, NextResponse } from "next/server";
import {
  mapBuggyHistoryRow,
  sortHistoryNewestFirst,
} from "@/lib/supabase/buggy-history";
import {
  createAdminClient,
  getBuggyHistoryTableName,
} from "@/lib/supabase/server";
import type { BuggyHistoryEntry } from "@/types/buggy-history";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function normalizeBuggyFilter(value: string): string {
  const text = value.trim();
  if (!text) return "";
  if (text.startsWith("buggy-")) return text;

  const numeric = Number.parseInt(text, 10);
  if (!Number.isNaN(numeric) && String(numeric) === text) {
    return `buggy-${numeric}`;
  }

  return text;
}

export async function GET(request: NextRequest) {
  const supabase = createAdminClient();
  if (!supabase) {
    return NextResponse.json(
      {
        error:
          "Supabase env belum lengkap. Pastikan NEXT_PUBLIC_SUPABASE_URL dan SUPABASE_SERVICE_ROLE_KEY sudah di-set.",
      },
      { status: 500 },
    );
  }

  const query = request.nextUrl.searchParams;
  const limitRaw = Number.parseInt(query.get("limit") ?? "200", 10);
  const limit = Number.isFinite(limitRaw)
    ? Math.min(Math.max(limitRaw, 1), 1000)
    : 200;

  const buggyIdFilter = normalizeBuggyFilter(query.get("buggyId") ?? "");
  const tableName = getBuggyHistoryTableName();

  const { data, error } = await supabase
    .from(tableName)
    .select("*")
    .limit(limit);

  if (error) {
    return NextResponse.json(
      {
        error: `Gagal mengambil data history dari Supabase table '${tableName}'. ${error.message}`,
      },
      { status: 500 },
    );
  }

  const rows = Array.isArray(data) ? (data as Record<string, unknown>[]) : [];

  const mapped = rows
    .map((row) => mapBuggyHistoryRow(row))
    .filter((entry): entry is BuggyHistoryEntry => entry !== null);

  const filtered = buggyIdFilter
    ? mapped.filter((entry) =>
        [entry.buggyId, normalizeBuggyFilter(entry.buggyId)].includes(
          buggyIdFilter,
        ),
      )
    : mapped;

  return NextResponse.json({
    entries: sortHistoryNewestFirst(filtered),
    count: filtered.length,
    table: tableName,
  });
}
