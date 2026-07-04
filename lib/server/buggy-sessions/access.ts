import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

export type HistoryAccessContext = {
  role: "Admin" | "Driver";
  buggyIdFilters: string[] | null;
};

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

function addBuggyAliases(
  target: Set<string>,
  value: string | number | null | undefined,
) {
  if (value === null || value === undefined) return;
  const raw = String(value).trim();
  if (!raw) return;

  target.add(raw);

  const normalized = normalizeAssignmentKey(raw);
  if (normalized) target.add(normalized);

  const numericId = extractAssignmentNumericId(raw);
  if (numericId !== null) {
    target.add(String(numericId));
    target.add(`buggy-${numericId}`);
    target.add(`b${String(numericId).padStart(2, "0")}`);
  }
}

export async function getHistoryAccessContext(
  adminSupabase: SupabaseClient,
): Promise<HistoryAccessContext | NextResponse> {
  // Session history is shared by admin and driver dashboards. Admin receives all
  // rows, while driver access is narrowed to aliases of the assigned buggy.
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

  if (account.role === "Admin") {
    return { role: "Admin", buggyIdFilters: null };
  }

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

  const { data: buggies } = await adminSupabase
    .from("buggies")
    .select("id, code, name, numeric_id");

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

  return { role: "Driver", buggyIdFilters: Array.from(filters) };
}

export function filterIncludesBuggyId(filters: string[], buggyId: string) {
  const requested = new Set<string>();
  addBuggyAliases(requested, buggyId);
  return Array.from(requested).some((value) => filters.includes(value));
}
