/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require("fs");
const path = require("path");
const { createClient } = require("@supabase/supabase-js");

const MAX_SESSION_SPEED_KMH = 60;
const DELETE_CHUNK_SIZE = 100;

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {};

  return Object.fromEntries(
    fs
      .readFileSync(filePath, "utf8")
      .split(/\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#"))
      .map((line) => {
        const index = line.indexOf("=");
        if (index < 0) return [line, ""];
        return [line.slice(0, index), line.slice(index + 1)];
      }),
  );
}

function toNumber(value) {
  const numeric = Number(value ?? 0);
  return Number.isFinite(numeric) ? numeric : 0;
}

function getSessionKey(row) {
  const buggyId = row.buggy_id ?? "unknown";
  const startedAt = row.started_at ? new Date(row.started_at) : null;
  const sessionDate =
    row.session_date ??
    (startedAt && !Number.isNaN(startedAt.getTime())
      ? startedAt.toISOString().slice(0, 10)
      : "unknown");
  const sessionNumber = String(row.session_number ?? "");

  return sessionNumber
    ? `${buggyId}:${sessionDate}:${sessionNumber}`
    : `${buggyId}:${row.started_at ?? ""}:${row.ended_at ?? ""}`;
}

function getImpliedSpeedKmh(row) {
  const distanceKm = toNumber(row.total_distance_km);
  const durationMinutes = toNumber(row.duration_minutes);

  if (distanceKm <= 0) return 0;
  if (durationMinutes <= 0) return Number.POSITIVE_INFINITY;

  return distanceKm / (durationMinutes / 60);
}

function isEligible(row) {
  return (
    getImpliedSpeedKmh(row) <= MAX_SESSION_SPEED_KMH &&
    toNumber(row.avg_speed_kmh) <= MAX_SESSION_SPEED_KMH
  );
}

function compareQuality(a, b) {
  const aEligible = isEligible(a);
  const bEligible = isEligible(b);
  if (aEligible !== bEligible) return Number(aEligible) - Number(bEligible);

  const pointDelta = toNumber(a.point_count) - toNumber(b.point_count);
  if (pointDelta !== 0) return pointDelta;

  const durationDelta = toNumber(a.duration_minutes) - toNumber(b.duration_minutes);
  if (durationDelta !== 0) return durationDelta;

  const distanceDelta = toNumber(a.total_distance_km) - toNumber(b.total_distance_km);
  if (distanceDelta !== 0) return distanceDelta;

  const aEndedAt = a.ended_at ? new Date(a.ended_at).getTime() : 0;
  const bEndedAt = b.ended_at ? new Date(b.ended_at).getTime() : 0;

  return (Number.isFinite(aEndedAt) ? aEndedAt : 0) -
    (Number.isFinite(bEndedAt) ? bEndedAt : 0);
}

function chooseBestRow(rows) {
  return [...rows].sort(compareQuality).at(-1);
}

function chunk(items, size) {
  const chunks = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

async function main() {
  const execute = process.argv.includes("--execute");
  const env = {
    ...loadEnvFile(path.join(process.cwd(), ".env")),
    ...loadEnvFile(path.join(process.cwd(), ".env.local")),
    ...process.env,
  };

  const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;
  const tableName = env.SUPABASE_BUGGY_SESSION_TABLE ?? "buggy_session_history";

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.");
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);
  const { data, error } = await supabase
    .from(tableName)
    .select("*")
    .order("started_at", { ascending: true });

  if (error) throw error;

  const rows = Array.isArray(data) ? data : [];
  const groups = new Map();

  for (const row of rows) {
    const key = getSessionKey(row);
    groups.set(key, [...(groups.get(key) ?? []), row]);
  }

  const duplicateGroups = Array.from(groups.entries())
    .filter(([, groupRows]) => groupRows.length > 1)
    .map(([key, groupRows]) => {
      const keep = chooseBestRow(groupRows);
      if (!keep?.id) {
        throw new Error(`Cannot choose best row for duplicate group ${key}`);
      }

      const remove = groupRows.filter((row) => row.id !== keep.id);
      return {
        key,
        keepId: keep.id,
        removeIds: remove.map((row) => row.id),
        rows: groupRows.map((row) => ({
          ...row,
          cleanup_score: {
            eligible: isEligible(row),
            implied_speed_kmh: Number(getImpliedSpeedKmh(row).toFixed(3)),
          },
        })),
      };
    });

  const backupDir = path.join(process.cwd(), "backups");
  fs.mkdirSync(backupDir, { recursive: true });
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupPath = path.join(
    backupDir,
    `buggy-session-duplicate-cleanup-${timestamp}.json`,
  );
  const removeIds = duplicateGroups.flatMap((group) => group.removeIds);

  fs.writeFileSync(
    backupPath,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        executed: execute,
        tableName,
        maxSessionSpeedKmh: MAX_SESSION_SPEED_KMH,
        totalRows: rows.length,
        duplicateGroupCount: duplicateGroups.length,
        duplicateRowsToDelete: removeIds.length,
        duplicateGroups,
      },
      null,
      2,
    ),
  );

  console.log(`Backup written: ${backupPath}`);
  console.log(`Total rows: ${rows.length}`);
  console.log(`Duplicate groups: ${duplicateGroups.length}`);
  console.log(`Duplicate rows to delete: ${removeIds.length}`);

  if (!execute || removeIds.length === 0) {
    console.log(execute ? "Nothing to delete." : "Dry run only. Re-run with --execute to delete duplicates.");
    return;
  }

  let deleted = 0;
  for (const idChunk of chunk(removeIds, DELETE_CHUNK_SIZE)) {
    const { data: deletedRows, error: deleteError } = await supabase
      .from(tableName)
      .delete()
      .in("id", idChunk)
      .select("id");

    if (deleteError) throw deleteError;
    deleted += Array.isArray(deletedRows) ? deletedRows.length : 0;
  }

  console.log(`Deleted duplicate rows: ${deleted}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
