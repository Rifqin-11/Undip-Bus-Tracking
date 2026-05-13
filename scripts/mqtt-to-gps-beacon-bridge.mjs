import mqtt from "mqtt";

const brokerUrl = process.env.MQTT_BROKER_URL ?? "mqtt://localhost:1883";
const topic = process.env.MQTT_TOPIC ?? "buggy/+/data";
const gpsBeaconUrl =
  process.env.NEXT_GPS_BEACON_URL ?? "http://localhost:3000/api/gps-beacon";
const ingestToken = process.env.BUGGY_INGEST_TOKEN;

if (!ingestToken) {
  console.error("BUGGY_INGEST_TOKEN is required because /api/gps-beacon rejects unauthenticated ingest requests.");
  process.exit(1);
}

function log(message, detail) {
  const time = new Date().toISOString();
  if (detail) {
    console.log(`[${time}] ${message}`, detail);
    return;
  }
  console.log(`[${time}] ${message}`);
}

function formatError(error) {
  if (!error) return "Unknown error";
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
      code: error.code,
    };
  }
  return error;
}

function inferBuggyIdFromTopic(receivedTopic) {
  const match = receivedTopic.match(/^buggy\/([^/]+)\/data$/);
  if (!match) return null;
  const numericId = Number(match[1]);
  return Number.isFinite(numericId) ? numericId : null;
}

function normalizePayload(receivedTopic, rawPayload) {
  let parsed;
  try {
    parsed = JSON.parse(rawPayload.toString("utf8"));
  } catch (error) {
    throw new Error(`Invalid JSON payload: ${JSON.stringify(formatError(error))}`);
  }

  const topicBuggyId = inferBuggyIdFromTopic(receivedTopic);
  const buggyId = Number(parsed.buggyId ?? topicBuggyId);
  if (!Number.isFinite(buggyId)) {
    throw new Error(`Missing buggyId and cannot infer from topic ${receivedTopic}`);
  }

  if (parsed.sessionEnd === true) {
    return { buggyId, sessionEnd: true, source: parsed.source ?? "mqtt_bridge" };
  }

  const lat = Number(parsed.lat ?? parsed.latitude);
  const lng = Number(parsed.lng ?? parsed.longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    throw new Error("Missing valid lat/lng fields");
  }

  return {
    buggyId,
    lat,
    lng,
    speedKmh: Number(parsed.speedKmh ?? parsed.speed ?? 0),
    heading:
      parsed.heading === null || parsed.heading === undefined
        ? null
        : Number(parsed.heading),
    altitude:
      parsed.altitude === null || parsed.altitude === undefined
        ? null
        : Number(parsed.altitude),
    accuracy:
      parsed.accuracy === null || parsed.accuracy === undefined
        ? null
        : Number(parsed.accuracy),
    batteryLevel:
      parsed.batteryLevel === null || parsed.batteryLevel === undefined
        ? null
        : Number(parsed.batteryLevel),
    passengers:
      parsed.passengers === null || parsed.passengers === undefined
        ? undefined
        : Number(parsed.passengers),
    capacity:
      parsed.capacity === null || parsed.capacity === undefined
        ? undefined
        : Number(parsed.capacity),
    etaMinutes:
      parsed.etaMinutes === null || parsed.etaMinutes === undefined
        ? undefined
        : Number(parsed.etaMinutes),
    sessionStart: parsed.sessionStart === true || undefined,
    forceResync: parsed.forceResync === true || undefined,
    source: parsed.source ?? "mqtt_bridge",
  };
}

async function forwardToGpsBeacon(payload) {
  const headers = { "Content-Type": "application/json" };
  if (ingestToken) headers.Authorization = `Bearer ${ingestToken}`;

  const response = await fetch(gpsBeaconUrl, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => response.statusText);
    throw new Error(`GPS beacon HTTP ${response.status}: ${text}`);
  }

  return response.json().catch(() => ({ ok: true }));
}

log(`Connecting MQTT bridge to ${brokerUrl}`);
log(`Subscribing to ${topic}`);
log(`Forwarding to ${gpsBeaconUrl}`);

const client = mqtt.connect(brokerUrl, {
  clientId: `simobi-mqtt-bridge-${Math.random().toString(16).slice(2)}`,
  clean: true,
  reconnectPeriod: 2500,
  connectTimeout: 10_000,
  username: process.env.MQTT_USERNAME,
  password: process.env.MQTT_PASSWORD,
});

client.on("connect", () => {
  log("MQTT connected");
  client.subscribe(topic, { qos: 0 }, (error) => {
    if (error) {
      log("MQTT subscribe failed", formatError(error));
      return;
    }
    log(`MQTT subscribed: ${topic}`);
  });
});

client.on("message", (receivedTopic, rawPayload) => {
  void (async () => {
    try {
      const payload = normalizePayload(receivedTopic, rawPayload);
      const result = await forwardToGpsBeacon(payload);
      log(`Forwarded ${receivedTopic}`, {
        buggyId: payload.buggyId,
        sessionEnd: payload.sessionEnd === true,
        accepted: result.accepted,
      });
    } catch (error) {
      log(`Dropped ${receivedTopic}`, formatError(error));
    }
  })();
});

client.on("reconnect", () => log("MQTT reconnecting"));
client.on("offline", () => log("MQTT offline"));
client.on("close", () => log("MQTT connection closed"));
client.on("disconnect", () => log("MQTT disconnected"));
client.on("error", (error) => log("MQTT error", formatError(error)));

process.on("SIGINT", () => {
  log("SIGINT received, closing MQTT bridge");
  client.end(true, () => process.exit(0));
});

process.on("SIGTERM", () => {
  log("SIGTERM received, closing MQTT bridge");
  client.end(true, () => process.exit(0));
});
