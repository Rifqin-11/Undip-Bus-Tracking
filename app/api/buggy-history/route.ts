/**
 * Buggy raw-history API.
 *
 * Exposes GPS point history for admin and driver dashboards. Driver requests are
 * filtered server-side to the assigned buggy so UI filters cannot bypass access.
 */
import { NextRequest, NextResponse } from "next/server";
import {
  mapBuggyHistoryRow,
  sortHistoryNewestFirst,
} from "@/lib/supabase/buggy-history";
import {
  createAdminClient,
  createClient,
  getBuggyHistoryTableName,
} from "@/lib/supabase/server";
import type { BuggyHistoryEntry } from "@/types/buggy-history";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DEFAULT_HISTORY_WINDOW_HOURS = 24;
const BUGGY_HISTORY_COLUMNS =
  "id,buggy_id,buggy_numeric_id,devices_id,lat,lng,accuracy,speed_kmh,heading,altitude,battery_level,passengers,source,recorded_at,received_at";

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

function normalizeAssignmentKey(value: string | null | undefined) {
  return (value ?? "").trim().toLowerCase().replace(/[\s_]/g, "-");
}

function extractAssignmentNumericId(value: string | null | undefined) {
  const normalized = normalizeAssignmentKey(value);
  const match =
    normalized.match(/^buggy-?0*(\d+)$/) ??
    normalized.match(/^b0*(\d+)$/) ??
    normalized.match(/^0*(\d+)$/);

  if (!match) return null;

  const numericId = Number.parseInt(match[1], 10);
  return Number.isFinite(numericId) ? numericId : null;
}

function addBuggyAliases(target: Set<string>, value: string | number | null | undefined) {
  if (value === null || value === undefined) return;
  const raw = String(value).trim();
  if (!raw) return;

  target.add(raw);
  target.add(normalizeAssignmentKey(raw));

  const numericId = extractAssignmentNumericId(raw);
  if (numericId !== null) {
    target.add(String(numericId));
    target.add(`buggy-${numericId}`);
    target.add(`b${String(numericId).padStart(2, "0")}`);
  }
}

async function resolveHistoryBuggyFilters() {
  let userSupabase: Awaited<ReturnType<typeof createClient>>;

  try {
    userSupabase = await createClient();
  } catch {
    return NextResponse.json(
      { message: "Authentication required." },
      { status: 401 },
    );
  }

  const {
    data: { user },
  } = await userSupabase.auth.getUser();

  if (!user) {
    return NextResponse.json(
      { message: "Authentication required." },
      { status: 401 },
    );
  }

  const { data: account, error } = await userSupabase
    .from("accounts")
    .select("role, buggy_id")
    .eq("id", user.id)
    .maybeSingle();

  if (error || !account) {
    return NextResponse.json(
      { message: "Account profile not found." },
      { status: 403 },
    );
  }

  if (account.role === "Admin") return null;

  if (account.role !== "Driver") {
    return NextResponse.json(
      { message: "Admin or driver access required." },
      { status: 403 },
    );
  }

  const assignedBuggyId =
    typeof account.buggy_id === "string" ? account.buggy_id : "";
  const assignedKey = normalizeAssignmentKey(assignedBuggyId);
  const assignedNumericId = extractAssignmentNumericId(assignedBuggyId);
  const filters = new Set<string>();
  addBuggyAliases(filters, assignedBuggyId);

  const adminSupabase = createAdminClient();
  const { data: buggies } = adminSupabase
    ? await adminSupabase.from("buggies").select("id, code, name, numeric_id")
    : { data: [] };

  if (Array.isArray(buggies)) {
    for (const buggy of buggies as Array<{
      id: string | null;
      code: string | null;
      name: string | null;
      numeric_id: number | null;
    }>) {
      const values = [buggy.id, buggy.code, buggy.name]
        .filter((value): value is string => Boolean(value))
        .map(normalizeAssignmentKey);
      const numericMatches =
        assignedNumericId !== null &&
        typeof buggy.numeric_id === "number" &&
        buggy.numeric_id === assignedNumericId;

      if (values.includes(assignedKey) || numericMatches) {
        addBuggyAliases(filters, buggy.id);
        addBuggyAliases(filters, buggy.code);
        addBuggyAliases(filters, buggy.name);
        addBuggyAliases(filters, buggy.numeric_id);
      }
    }
  }

  return Array.from(filters);
}

function filterAllowsBuggyId(filters: string[], buggyId: string) {
  const aliases = new Set<string>();
  addBuggyAliases(aliases, buggyId);
  return Array.from(aliases).some((alias) => filters.includes(alias));
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

  const allowedBuggyIds = await resolveHistoryBuggyFilters();
  if (allowedBuggyIds instanceof NextResponse) return allowedBuggyIds;

  const query = request.nextUrl.searchParams;
  const limitRaw = Number.parseInt(query.get("limit") ?? "200", 10);
  const limit = Number.isFinite(limitRaw)
    ? Math.min(Math.max(limitRaw, 1), 1000)
    : 200;

  const buggyIdFilter = normalizeBuggyFilter(query.get("buggyId") ?? "");
  const sinceParam = query.get("since");
  const sinceDate = sinceParam ? new Date(sinceParam) : null;
  const sinceIso =
    sinceDate && !Number.isNaN(sinceDate.getTime())
      ? sinceDate.toISOString()
      : new Date(
          Date.now() - DEFAULT_HISTORY_WINDOW_HOURS * 60 * 60 * 1000,
        ).toISOString();
  const queryBuggyIds =
    allowedBuggyIds === null
      ? buggyIdFilter
        ? [buggyIdFilter]
        : []
      : buggyIdFilter
        ? filterAllowsBuggyId(allowedBuggyIds, buggyIdFilter)
          ? allowedBuggyIds
          : []
        : allowedBuggyIds;

  if (allowedBuggyIds !== null && queryBuggyIds.length === 0) {
    return NextResponse.json({
      entries: [],
      count: 0,
      table: getBuggyHistoryTableName(),
    });
  }

  const tableName = getBuggyHistoryTableName();

  let historyQuery = supabase
    .from(tableName)
    .select(BUGGY_HISTORY_COLUMNS)
    .gte("recorded_at", sinceIso)
    .order("recorded_at", { ascending: false })
    .limit(limit);

  if (queryBuggyIds.length === 1) {
    historyQuery = historyQuery.eq("buggy_id", queryBuggyIds[0]);
  } else if (queryBuggyIds.length > 1) {
    historyQuery = historyQuery.in("buggy_id", queryBuggyIds);
  }

  const { data, error } = await historyQuery;

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
