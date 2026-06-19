/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require("fs");
const path = require("path");
const { createClient } = require("@supabase/supabase-js");

const UPDATE_CHUNK_SIZE = 100;
const MIN_PASSENGER_STABLE_SAMPLES = 3;

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

function parsePath(value) {
  try {
    const raw = typeof value === "string" ? JSON.parse(value) : value;
    return Array.isArray(raw) ? raw : [];
  } catch {
    return [];
  }
}

function calculatePassengerBoardings(value) {
  const passengerValues = parsePath(value)
    .map((point) => (Array.isArray(point) ? point[3] : null))
    .filter((passengers) =>
      typeof passengers === "number" &&
      Number.isFinite(passengers) &&
      passengers >= 0,
    );

  if (passengerValues.length === 0) return null;

  let boardings = Math.max(0, passengerValues[0]);
  let currentOccupancy = passengerValues[0];
  let runValue = passengerValues[0];
  let runLength = 1;

  for (let index = 1; index <= passengerValues.length; index += 1) {
    const value = passengerValues[index];
    if (value === runValue) {
      runLength += 1;
      continue;
    }

    if (runLength >= MIN_PASSENGER_STABLE_SAMPLES) {
      boardings += Math.max(0, runValue - currentOccupancy);
      currentOccupancy = runValue;
    }

    runValue = value;
    runLength = 1;
  }

  return boardings;
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
    .select("id, buggy_id, session_date, session_number, path")
    .order("started_at", { ascending: true });

  if (error) throw error;

  const updates = (Array.isArray(data) ? data : [])
    .map((row) => ({
      ...row,
      passenger_boardings: calculatePassengerBoardings(row.path),
    }))
    .filter((row) => row.passenger_boardings !== null);

  const backupDir = path.join(process.cwd(), "backups");
  fs.mkdirSync(backupDir, { recursive: true });
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupPath = path.join(
    backupDir,
    `buggy-session-passenger-boardings-backfill-${timestamp}.json`,
  );

  fs.writeFileSync(
    backupPath,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        executed: execute,
        tableName,
        minPassengerStableSamples: MIN_PASSENGER_STABLE_SAMPLES,
        rowsChecked: Array.isArray(data) ? data.length : 0,
        rowsToUpdate: updates.length,
        updates: updates.map((row) => ({
          id: row.id,
          buggy_id: row.buggy_id,
          session_date: row.session_date,
          session_number: row.session_number,
          passenger_boardings: row.passenger_boardings,
        })),
      },
      null,
      2,
    ),
  );

  console.log(`Backup written: ${backupPath}`);
  console.log(`Rows checked: ${Array.isArray(data) ? data.length : 0}`);
  console.log(`Rows to update: ${updates.length}`);

  if (!execute || updates.length === 0) {
    console.log(execute ? "Nothing to update." : "Dry run only. Re-run with --execute after applying the passenger_boardings migration.");
    return;
  }

  let updated = 0;
  for (const updateChunk of chunk(updates, UPDATE_CHUNK_SIZE)) {
    await Promise.all(
      updateChunk.map(async (row) => {
        const { error: updateError } = await supabase
          .from(tableName)
          .update({ passenger_boardings: row.passenger_boardings })
          .eq("id", row.id);

        if (updateError) throw updateError;
        updated += 1;
      }),
    );
  }

  console.log(`Updated rows: ${updated}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
