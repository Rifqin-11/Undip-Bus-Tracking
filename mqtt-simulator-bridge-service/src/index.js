require("dotenv").config();

const http = require("http");
const mqtt = require("mqtt");

const brokerUrl =
  process.env.MQTT_BROKER_URL ||
  process.env.MQTT_SERVER ||
  "mqtt://localhost:1883";
const topic = process.env.MQTT_TOPIC || "buggy/+/data";
const gpsBeaconUrl =
  process.env.NEXT_GPS_BEACON_URL ||
  process.env.API_URL ||
  "http://localhost:3000/api/gps-beacon";
const ingestToken = process.env.BUGGY_INGEST_TOKEN;
const port = Number(process.env.PORT || 8080);
const host = "0.0.0.0";

if (!ingestToken) {
  console.error("BUGGY_INGEST_TOKEN is required because /api/gps-beacon rejects unauthenticated ingest requests.");
  process.exit(1);
}

const status = {
  mqttConnected: false,
  subscribed: false,
  lastMessageAt: null,
  lastForwardAt: null,
  lastForwardStatus: null,
  lastError: null,
};

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
      code: error.code,
      stack: error.stack,
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

function optionalNumber(value) {
  if (value === null || value === undefined || value === "") return undefined;
  const number = Number(value);
  return Number.isFinite(number) ? number : undefined;
}

function nullableNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
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
    return {
      buggyId,
      sessionEnd: true,
      source: parsed.source || "gps-tracker",
    };
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
    heading: nullableNumber(parsed.heading),
    altitude: nullableNumber(parsed.altitude),
    accuracy: nullableNumber(parsed.accuracy),
    batteryLevel: nullableNumber(parsed.batteryLevel),
    passengers: optionalNumber(parsed.passengers),
    capacity: optionalNumber(parsed.capacity),
    etaMinutes: optionalNumber(parsed.etaMinutes),
    sessionStart: parsed.sessionStart === true || undefined,
    forceResync: parsed.forceResync === true || undefined,
    source: parsed.source || "gps-tracker",
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

  const responseText = await response.text().catch(() => "");

  if (!response.ok) {
    throw new Error(
      `GPS beacon HTTP ${response.status}: ${responseText || response.statusText}`,
    );
  }

  return responseText ? JSON.parse(responseText) : { ok: true };
}

function createHealthServer() {
  return http.createServer((req, res) => {
    const body = JSON.stringify({
      ok: true,
      service: "simobi-mqtt-simulator-bridge",
      topic,
      gpsBeaconUrl,
      ...status,
    });

    res.writeHead(req.url === "/health" ? 200 : 200, {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    });
    res.end(body);
  });
}

if (!Number.isFinite(port)) {
  console.error("PORT must be a number.");
  process.exit(1);
}

const healthServer = createHealthServer();
healthServer.listen(port, host, () => {
  log(`Health server listening on ${host}:${port}`);
});
healthServer.on("error", (error) => {
  log("Health server failed", formatError(error));
  process.exit(1);
});

log(`Connecting MQTT simulator bridge to ${brokerUrl}`);
log(`Subscribing to ${topic}`);
log(`Forwarding to ${gpsBeaconUrl}`);

const client = mqtt.connect(brokerUrl, {
  clientId: `simobi-simulator-bridge-${Math.random().toString(16).slice(2)}`,
  clean: true,
  reconnectPeriod: 2500,
  connectTimeout: 10_000,
  username: process.env.MQTT_USERNAME || process.env.MQTT_USER || undefined,
  password: process.env.MQTT_PASSWORD || process.env.MQTT_PASS || undefined,
});

client.on("connect", () => {
  status.mqttConnected = true;
  status.lastError = null;
  log("MQTT connected");

  client.subscribe(topic, { qos: 0 }, (error) => {
    if (error) {
      status.subscribed = false;
      status.lastError = error.message;
      log("MQTT subscribe failed", formatError(error));
      return;
    }

    status.subscribed = true;
    log(`MQTT subscribed: ${topic}`);
  });
});

client.on("message", (receivedTopic, rawPayload) => {
  void (async () => {
    try {
      const payload = normalizePayload(receivedTopic, rawPayload);
      status.lastMessageAt = new Date().toISOString();

      const result = await forwardToGpsBeacon(payload);
      status.lastForwardAt = new Date().toISOString();
      status.lastForwardStatus = 200;
      status.lastError = null;

      log(`Forwarded ${receivedTopic}`, {
        buggyId: payload.buggyId,
        sessionEnd: payload.sessionEnd === true,
        accepted: result.accepted,
      });
    } catch (error) {
      status.lastError = error instanceof Error ? error.message : String(error);
      log(`Dropped ${receivedTopic}`, formatError(error));
    }
  })();
});

client.on("reconnect", () => log("MQTT reconnecting"));
client.on("offline", () => {
  status.mqttConnected = false;
  log("MQTT offline");
});
client.on("close", () => {
  status.mqttConnected = false;
  status.subscribed = false;
  log("MQTT connection closed");
});
client.on("disconnect", () => log("MQTT disconnected"));
client.on("error", (error) => {
  status.lastError = error.message;
  log("MQTT error", formatError(error));
});

function shutdown(signal) {
  log(`${signal} received, closing MQTT simulator bridge`);

  client.end(false, () => {
    healthServer.close(() => {
      log("MQTT simulator bridge stopped");
      process.exit(0);
    });
  });

  setTimeout(() => {
    log("Forced shutdown after timeout");
    process.exit(0);
  }, 5000).unref();
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
