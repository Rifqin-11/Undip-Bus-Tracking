/**
 * Session deletion API.
 *
 * Deletes a persisted session and its matching raw GPS points using the stored
 * session path/time span, not only a broad time window. This keeps admin cleanup
 * precise and avoids deleting unrelated nearby sessions.
 */
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/admin-guard";
import {
  createAdminClient,
  getBuggySessionTableName,
  getBuggyHistoryTableName,
} from "@/lib/supabase/server";
import { getErrorMessage } from "@/lib/utils/error-message";

export const runtime = "nodejs";

type SessionRow = {
  id: string;
  buggy_id: string;
  started_at: string;
  ended_at: string;
  path: unknown;
};

function isRealSessionId(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    !value.startsWith("synth-") &&
    !value.startsWith("merged-")
  );
}

function parsePath(value: unknown): [number, number, number?][] {
  const raw = typeof value === "string" ? JSON.parse(value) : value;
  if (!Array.isArray(raw)) return [];

  return raw.filter(
    (point): point is [number, number, number?] =>
      Array.isArray(point) &&
      typeof point[0] === "number" &&
      typeof point[1] === "number" &&
      (point[2] === undefined || typeof point[2] === "number"),
  );
}

function extractPathRecordedAt(path: [number, number, number?][]) {
  return Array.from(
    new Set(
      path
        .map((point) => point[2])
        .filter((timestampMs): timestampMs is number =>
          typeof timestampMs === "number" && Number.isFinite(timestampMs),
        )
        .map((timestampMs) => new Date(timestampMs).toISOString()),
    ),
  );
}

function chunk<T>(items: T[], size: number) {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

export async function POST(req: NextRequest) {
  const adminGuard = await requireAdmin();
  if (!adminGuard.authorized) return adminGuard.response;

  const supabase = createAdminClient();
  if (!supabase) {
    return NextResponse.json(
      { error: "Supabase not configured" },
      { status: 500 },
    );
  }

  try {
    const body = (await req.json()) as {
      id?: unknown;
      sourceSessionIds?: unknown;
      buggyId?: unknown;
      startedAt?: unknown;
      endedAt?: unknown;
      path?: unknown;
    };

    const buggyId = typeof body.buggyId === "string" ? body.buggyId : "";
    const startedAt = typeof body.startedAt === "string" ? body.startedAt : "";
    const endedAt = typeof body.endedAt === "string" ? body.endedAt : "";

    if (!buggyId || !startedAt || !endedAt) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 },
      );
    }

    const requestedIds = [
      ...(Array.isArray(body.sourceSessionIds) ? body.sourceSessionIds : []),
      body.id,
    ].filter(isRealSessionId);
    const sessionIds = Array.from(new Set(requestedIds));
    const sessionTable = getBuggySessionTableName();
    const historyTable = getBuggyHistoryTableName();
    let persistedRows: SessionRow[] = [];

    if (sessionIds.length > 0) {
      const { data, error } = await supabase
        .from(sessionTable)
        .select("id, buggy_id, started_at, ended_at, path")
        .in("id", sessionIds);

      if (error) throw error;
      persistedRows = Array.isArray(data) ? (data as SessionRow[]) : [];
    }

    let requestPath: [number, number, number?][] = [];
    try {
      requestPath = parsePath(body.path);
    } catch {
      requestPath = [];
    }

    const pathRecordedAt = extractPathRecordedAt([
      ...requestPath,
      ...persistedRows.flatMap((row) => {
        try {
          return parsePath(row.path);
        } catch {
          return [];
        }
      }),
    ]);

    let rawDeletedCount = 0;

    if (pathRecordedAt.length > 0) {
      for (const recordedAtChunk of chunk(pathRecordedAt, 100)) {
        const { data, error } = await supabase
          .from(historyTable)
          .delete()
          .eq("buggy_id", buggyId)
          .in("recorded_at", recordedAtChunk)
          .select("recorded_at");

        if (error) throw error;
        rawDeletedCount += Array.isArray(data) ? data.length : 0;
      }
    } else {
      const { data, error } = await supabase
        .from(historyTable)
        .delete()
        .eq("buggy_id", buggyId)
        .gte("recorded_at", startedAt)
        .lte("recorded_at", endedAt)
        .select("recorded_at");

      if (error) throw error;
      rawDeletedCount += Array.isArray(data) ? data.length : 0;
    }

    let sessionDeletedCount = 0;

    if (persistedRows.length > 0) {
      const { data, error } = await supabase
        .from(sessionTable)
        .delete()
        .in(
          "id",
          persistedRows.map((row) => row.id),
        )
        .select("id");

      if (error) throw error;
      sessionDeletedCount += Array.isArray(data) ? data.length : 0;
    } else {
      const { data, error } = await supabase
        .from(sessionTable)
        .delete()
        .eq("buggy_id", buggyId)
        .eq("started_at", startedAt)
        .eq("ended_at", endedAt)
        .select("id");

      if (error) throw error;
      sessionDeletedCount += Array.isArray(data) ? data.length : 0;
    }

    return NextResponse.json({
      success: true,
      rawDeleted: rawDeletedCount,
      sessionDeleted: sessionDeletedCount,
    });
  } catch (err) {
    return NextResponse.json({ error: getErrorMessage(err) }, { status: 500 });
  }
}
