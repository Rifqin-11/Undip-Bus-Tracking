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

function getImpliedSpeedKmh(row) {
  const distanceKm = toNumber(row.total_distance_km);
  const durationMinutes = toNumber(row.duration_minutes);

  if (distanceKm <= 0) return 0;
  if (durationMinutes <= 0) return Number.POSITIVE_INFINITY;

  return distanceKm / (durationMinutes / 60);
}

function isOutlier(row) {
  return (
    getImpliedSpeedKmh(row) > MAX_SESSION_SPEED_KMH ||
    toNumber(row.avg_speed_kmh) > MAX_SESSION_SPEED_KMH
  );
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

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });
  const { data, error } = await supabase
    .from(tableName)
    .select("*")
    .order("started_at", { ascending: true });

  if (error) throw error;

  const rows = Array.isArray(data) ? data : [];
  const outlierRows = rows
    .filter(isOutlier)
    .map((row) => ({
      ...row,
      cleanup_score: {
        implied_speed_kmh: Number(getImpliedSpeedKmh(row).toFixed(3)),
        avg_speed_kmh: toNumber(row.avg_speed_kmh),
        max_session_speed_kmh: MAX_SESSION_SPEED_KMH,
      },
    }));
  const removeIds = outlierRows
    .map((row) => row.id)
    .filter((id) => typeof id === "string" && id.length > 0);

  const backupDir = path.join(process.cwd(), "backups");
  fs.mkdirSync(backupDir, { recursive: true });
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupPath = path.join(
    backupDir,
    `buggy-session-outlier-cleanup-${timestamp}.json`,
  );

  fs.writeFileSync(
    backupPath,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        executed: execute,
        tableName,
        maxSessionSpeedKmh: MAX_SESSION_SPEED_KMH,
        totalRows: rows.length,
        outlierRowsToDelete: removeIds.length,
        outlierRows,
      },
      null,
      2,
    ),
  );

  console.log(`Backup written: ${backupPath}`);
  console.log(`Total rows: ${rows.length}`);
  console.log(`Outlier rows to delete: ${removeIds.length}`);

  if (!execute || removeIds.length === 0) {
    console.log(execute ? "Nothing to delete." : "Dry run only. Re-run with --execute to delete outliers.");
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

  console.log(`Deleted outlier rows: ${deleted}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
