const { createClient } = require("@supabase/supabase-js");
require("dotenv").config({ path: ".env.local" });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const buggyId = "buggy-2";
  const { data: latestSession } = await supabase
    .from("buggy_session_history")
    .select("*")
    .eq("buggy_id", buggyId)
    .order("started_at", { ascending: false })
    .limit(1);

  if (!latestSession || latestSession.length === 0) {
    console.log("No latest session found");
    return;
  }
  const s = latestSession[0];
  console.log("Target session to delete:", s.id, "started:", s.started_at, "ended:", s.ended_at);

  const endPlusOne = new Date(new Date(s.ended_at).getTime() + 1000).toISOString();
  
  const { data: pointsToDel } = await supabase
      .from("buggy_history")
      .select("*")
      .eq("buggy_id", buggyId)
      .gte("recorded_at", s.started_at)
      .lte("recorded_at", endPlusOne);
      
  console.log("Points that would be deleted via API:", pointsToDel?.length);

  // Lets try a looser bound
  const startMinusOne = new Date(new Date(s.started_at).getTime() - 1000).toISOString();
  const { data: pointsLooser } = await supabase
      .from("buggy_history")
      .select("*")
      .eq("buggy_id", buggyId)
      .gte("recorded_at", startMinusOne)
      .lte("recorded_at", endPlusOne);
      
  console.log("Points with looser bound (-1s / +1s):", pointsLooser?.length);
  
}
run();
