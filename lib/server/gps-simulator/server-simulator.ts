import mqtt, { type MqttClient } from "mqtt";
import { createAdminClient, getDeviceAssignmentsTableName } from "@/lib/supabase/server";
import { OFFICIAL_ROUTE_PATH } from "@/lib/transit/buggy-data";

const DEFAULT_INTERVAL_MS = 3_000;
const DEFAULT_FLEET_COUNT = 3;
const DEFAULT_CAPACITY = 8;
const EARTH_RADIUS_M = 6_371_000;

type LatLng = { lat: number; lng: number };

type SimulatorMode = "device" | "fleet";

export type ServerGpsSimulatorStartOptions = {
  mode?: SimulatorMode;
  selectedBuggyNumericId?: number;
  fleetCount?: number;
  intervalMs?: number;
  mqttBrokerUrl?: string;
};

type BuggyMaster = {
  id: string;
  numericId: number;
  code: string;
  name: string;
  capacity: number;
  devicesId?: string;
};

type SimulatedVehicle = BuggyMaster & {
  cursor: number;
  batteryLevel: number;
  passengers: number;
  speedKmh: number;
  sessionStarted: boolean;
};

type TelemetryPayload = {
  buggyId: number;
  devicesId?: string;
  lat: number;
  lng: number;
  speedKmh: number;
  heading: number | null;
  altitude: number | null;
  accuracy: number;
  batteryLevel: number;
  passengers: number;
  capacity: number;
  etaMinutes: number;
  sessionStart?: boolean;
  sessionEnd?: boolean;
  timestamp: string;
  source: "server-gps-simulator";
  gsm: {
    apn: string;
    signalCsq: number;
    signalDbm: number;
    signalPercent: number;
    simStatus: number;
    simStatusText: string;
    networkConnected: boolean;
    gprsConnected: boolean;
    localIp: string;
    networkType: string;
    mqttState: number;
    mqttStateText: string;
  };
};

type ServerGpsSimulatorState = {
  timer: ReturnType<typeof setInterval> | null;
  client: MqttClient | null;
  running: boolean;
  mode: SimulatorMode;
  intervalMs: number;
  mqttBrokerUrl: string;
  topicPrefix: string;
  sendCount: number;
  lastSentAt: string | null;
  startedAt: string | null;
  error: string | null;
  vehicles: SimulatedVehicle[];
};

declare global {
  var __SIMOBI_SERVER_GPS_SIMULATOR__: ServerGpsSimulatorState | undefined;
}

function getState(): ServerGpsSimulatorState {
  if (!globalThis.__SIMOBI_SERVER_GPS_SIMULATOR__) {
    globalThis.__SIMOBI_SERVER_GPS_SIMULATOR__ = {
      timer: null,
      client: null,
      running: false,
      mode: "fleet",
      intervalMs: DEFAULT_INTERVAL_MS,
      mqttBrokerUrl: resolveDefaultBrokerUrl(),
      topicPrefix: resolveTopicPrefix(),
      sendCount: 0,
      lastSentAt: null,
      startedAt: null,
      error: null,
      vehicles: [],
    };
  }

  return globalThis.__SIMOBI_SERVER_GPS_SIMULATOR__;
}

function resolveDefaultBrokerUrl() {
  return (
    process.env.MQTT_BROKER_URL ??
    process.env.NEXT_PUBLIC_MQTT_BROKER_WS_URL ??
    "ws://localhost:9001"
  );
}

function resolveTopicPrefix() {
  return process.env.MQTT_TOPIC_PREFIX ?? process.env.NEXT_PUBLIC_MQTT_TOPIC_PREFIX ?? "buggy";
}

function clampNumber(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function haversineM(a: LatLng, b: LatLng) {
  const toRad = (degree: number) => (degree * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) *
      Math.cos(toRad(b.lat)) *
      Math.sin(dLng / 2) ** 2;
  return EARTH_RADIUS_M * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

function bearingDegrees(a: LatLng, b: LatLng) {
  const toRad = (degree: number) => (degree * Math.PI) / 180;
  const toDeg = (radian: number) => (radian * 180) / Math.PI;
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const lngDiff = toRad(b.lng - a.lng);
  const y = Math.sin(lngDiff) * Math.cos(lat2);
  const x =
    Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(lngDiff);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

function resolveRoutePosition(cursor: number) {
  if (OFFICIAL_ROUTE_PATH.length === 0) {
    return {
      position: { lat: -7.054518, lng: 110.44413 },
      heading: null,
      etaMinutes: 5,
    };
  }

  const segmentCount = OFFICIAL_ROUTE_PATH.length;
  const normalized = ((cursor % segmentCount) + segmentCount) % segmentCount;
  const segmentIndex = Math.floor(normalized);
  const progress = normalized - segmentIndex;
  const from = OFFICIAL_ROUTE_PATH[segmentIndex];
  const to = OFFICIAL_ROUTE_PATH[(segmentIndex + 1) % segmentCount];
  const fromPosition = { lat: from[0], lng: from[1] };
  const toPosition = { lat: to[0], lng: to[1] };
  const position = {
    lat: fromPosition.lat + (toPosition.lat - fromPosition.lat) * progress,
    lng: fromPosition.lng + (toPosition.lng - fromPosition.lng) * progress,
  };

  return {
    position,
    heading: bearingDegrees(fromPosition, toPosition),
    etaMinutes: Math.max(1, Math.round(haversineM(position, toPosition) / (12 / 3.6) / 60)),
  };
}

function resolveNumericId(
  row: { numeric_id: number | string | null; code: string | null },
  fallback: number,
) {
  const numericId = Number(row.numeric_id);
  if (Number.isFinite(numericId) && numericId > 0) return Math.round(numericId);

  const codeNumber = String(row.code ?? "").match(/\d+/)?.[0];
  const parsedCode = Number(codeNumber);
  return Number.isFinite(parsedCode) && parsedCode > 0 ? parsedCode : fallback;
}

async function loadBuggyMasters(): Promise<BuggyMaster[]> {
  const supabase = createAdminClient();
  if (!supabase) {
    throw new Error("Supabase admin client belum dikonfigurasi.");
  }

  const [{ data: buggyRows, error: buggyError }, { data: assignmentRows }] =
    await Promise.all([
      supabase
        .from("buggies")
        .select("id, numeric_id, code, name, capacity, is_active")
        .eq("is_active", true)
        .order("code", { ascending: true }),
      supabase
        .from(getDeviceAssignmentsTableName())
        .select("devices_id, buggy_id, is_active")
        .eq("is_active", true),
    ]);

  if (buggyError) throw buggyError;

  const devicesIdByBuggyId = new Map<string, string>();
  for (const row of (assignmentRows ?? []) as Array<{
    devices_id: string | null;
    buggy_id: string | null;
  }>) {
    if (row.buggy_id && row.devices_id) {
      devicesIdByBuggyId.set(row.buggy_id, row.devices_id);
    }
  }

  return ((buggyRows ?? []) as Array<{
    id: string;
    numeric_id: number | string | null;
    code: string | null;
    name: string | null;
    capacity: number | string | null;
  }>).map((row, index) => ({
    id: row.id,
    numericId: resolveNumericId(row, index + 1),
    code: row.code ?? `B${String(index + 1).padStart(2, "0")}`,
    name: row.name ?? `Buggy ${index + 1}`,
    capacity: Math.max(1, Math.round(Number(row.capacity ?? DEFAULT_CAPACITY))),
    devicesId: devicesIdByBuggyId.get(row.id),
  }));
}

function buildVehicles(
  masters: BuggyMaster[],
  mode: SimulatorMode,
  selectedBuggyNumericId: number | undefined,
  fleetCount: number,
): SimulatedVehicle[] {
  const selected =
    mode === "device" && selectedBuggyNumericId
      ? masters.filter((buggy) => buggy.numericId === selectedBuggyNumericId).slice(0, 1)
      : masters.slice(0, fleetCount);
  const targets = selected.length > 0 ? selected : masters.slice(0, Math.max(1, fleetCount));
  const total = Math.max(targets.length, 1);

  return targets.map((buggy, index) => ({
    ...buggy,
    cursor: (index * Math.max(OFFICIAL_ROUTE_PATH.length, 1)) / total,
    batteryLevel: clampNumber(96 - index * 4, 35, 100),
    passengers: index % (buggy.capacity + 1),
    speedKmh: 10 + (index % 4) * 2,
    sessionStarted: false,
  }));
}

function buildPayload(vehicle: SimulatedVehicle, routeState: ReturnType<typeof resolveRoutePosition>, sessionEnd = false): TelemetryPayload {
  const signalPercent = 84;
  const payload: TelemetryPayload = {
    buggyId: vehicle.numericId,
    lat: Number(routeState.position.lat.toFixed(7)),
    lng: Number(routeState.position.lng.toFixed(7)),
    speedKmh: Number(vehicle.speedKmh.toFixed(2)),
    heading: typeof routeState.heading === "number" ? Math.round(routeState.heading) : null,
    altitude: null,
    accuracy: 8,
    batteryLevel: Math.round(clampNumber(vehicle.batteryLevel, 0, 100)),
    passengers: Math.round(clampNumber(vehicle.passengers, 0, vehicle.capacity)),
    capacity: vehicle.capacity,
    etaMinutes: Math.max(1, Math.round(routeState.etaMinutes)),
    sessionStart: !vehicle.sessionStarted && !sessionEnd ? true : undefined,
    sessionEnd: sessionEnd ? true : undefined,
    timestamp: new Date().toISOString(),
    source: "server-gps-simulator",
    gsm: {
      apn: "Internet",
      signalPercent,
      signalCsq: Math.round((signalPercent / 100) * 31),
      signalDbm: Math.round(-113 + (signalPercent / 100) * 62),
      simStatus: 1,
      simStatusText: "SIM_READY",
      networkConnected: true,
      gprsConnected: true,
      localIp: `10.122.45.${20 + (vehicle.numericId % 100)}`,
      networkType: "GSM_GPRS",
      mqttState: 4,
      mqttStateText: "MQTT_CONNECTED",
    },
  };

  if (vehicle.devicesId) payload.devicesId = vehicle.devicesId;
  return payload;
}

async function connectMqtt(state: ServerGpsSimulatorState) {
  if (state.client?.connected) return state.client;

  const client = mqtt.connect(state.mqttBrokerUrl, {
    clientId: `simobi-server-simulator-${Math.random().toString(16).slice(2)}`,
    clean: true,
    protocolVersion: 4,
    reconnectPeriod: 2_000,
    connectTimeout: 12_000,
    keepalive: 30,
    username: process.env.MQTT_USERNAME ?? process.env.NEXT_PUBLIC_MQTT_USERNAME,
    password: process.env.MQTT_PASSWORD ?? process.env.NEXT_PUBLIC_MQTT_PASSWORD,
  });

  await new Promise<void>((resolve, reject) => {
    const cleanup = () => {
      client.off("connect", handleConnect);
      client.off("error", handleError);
    };
    const handleConnect = () => {
      cleanup();
      resolve();
    };
    const handleError = (error: Error) => {
      cleanup();
      reject(error);
    };
    client.once("connect", handleConnect);
    client.once("error", handleError);
  });

  client.on("error", (error) => {
    state.error = error.message;
  });
  state.client = client;
  return client;
}

async function publishVehicle(state: ServerGpsSimulatorState, vehicle: SimulatedVehicle, sessionEnd = false) {
  const client = await connectMqtt(state);
  const routeState = resolveRoutePosition(vehicle.cursor);
  const payload = buildPayload(vehicle, routeState, sessionEnd);
  const topic = `${state.topicPrefix}/${payload.buggyId}/data`;

  await new Promise<void>((resolve, reject) => {
    client.publish(topic, JSON.stringify(payload), { qos: 0 }, (error) => {
      if (error) reject(error);
      else resolve();
    });
  });

  state.sendCount += 1;
  state.lastSentAt = new Date().toISOString();
}

async function tickServerSimulator() {
  const state = getState();
  if (!state.running) return;

  try {
    const nextVehicles: SimulatedVehicle[] = [];
    for (const vehicle of state.vehicles) {
      await publishVehicle(state, vehicle);
      nextVehicles.push({
        ...vehicle,
        cursor: vehicle.cursor + 0.7 + vehicle.speedKmh / 25,
        batteryLevel: clampNumber(vehicle.batteryLevel - 0.12, 5, 100),
        passengers: clampNumber(
          vehicle.passengers + (Math.random() > 0.62 ? (Math.random() > 0.5 ? 1 : -1) : 0),
          0,
          vehicle.capacity,
        ),
        speedKmh: clampNumber(vehicle.speedKmh + (Math.random() - 0.5), 6, 20),
        sessionStarted: true,
      });
    }
    state.vehicles = nextVehicles;
    state.error = null;
  } catch (error) {
    state.error = error instanceof Error ? error.message : "Gagal publish telemetry server simulator.";
  }
}

export function getServerGpsSimulatorStatus() {
  const state = getState();
  return {
    running: state.running,
    mode: state.mode,
    intervalMs: state.intervalMs,
    mqttBrokerUrl: state.mqttBrokerUrl,
    topicPrefix: state.topicPrefix,
    sendCount: state.sendCount,
    lastSentAt: state.lastSentAt,
    startedAt: state.startedAt,
    error: state.error,
    vehicles: state.vehicles.map((vehicle) => ({
      id: vehicle.id,
      numericId: vehicle.numericId,
      code: vehicle.code,
      name: vehicle.name,
      devicesId: vehicle.devicesId ?? null,
      batteryLevel: vehicle.batteryLevel,
      passengers: vehicle.passengers,
      speedKmh: vehicle.speedKmh,
    })),
  };
}

export async function startServerGpsSimulator(options: ServerGpsSimulatorStartOptions = {}) {
  await stopServerGpsSimulator({ sendSessionEnd: false });

  const state = getState();
  const masters = await loadBuggyMasters();
  if (masters.length === 0) {
    throw new Error("Tidak ada buggy aktif untuk disimulasikan.");
  }

  const mode = options.mode === "device" ? "device" : "fleet";
  const intervalMs = clampNumber(
    Math.round(Number(options.intervalMs ?? DEFAULT_INTERVAL_MS)),
    1_000,
    60_000,
  );
  const fleetCount = clampNumber(
    Math.round(Number(options.fleetCount ?? DEFAULT_FLEET_COUNT)),
    1,
    Math.min(10, masters.length),
  );

  state.mode = mode;
  state.intervalMs = intervalMs;
  state.mqttBrokerUrl = options.mqttBrokerUrl?.trim() || resolveDefaultBrokerUrl();
  state.topicPrefix = resolveTopicPrefix();
  state.sendCount = 0;
  state.lastSentAt = null;
  state.startedAt = new Date().toISOString();
  state.error = null;
  state.vehicles = buildVehicles(
    masters,
    mode,
    options.selectedBuggyNumericId,
    fleetCount,
  );
  state.running = true;

  await tickServerSimulator();
  state.timer = setInterval(() => {
    void tickServerSimulator();
  }, intervalMs);

  return getServerGpsSimulatorStatus();
}

export async function stopServerGpsSimulator(options: { sendSessionEnd?: boolean } = {}) {
  const state = getState();
  const shouldSendSessionEnd = options.sendSessionEnd !== false;

  if (state.timer) {
    clearInterval(state.timer);
    state.timer = null;
  }

  if (shouldSendSessionEnd && state.running) {
    for (const vehicle of state.vehicles) {
      await publishVehicle(state, vehicle, true).catch((error) => {
        state.error = error instanceof Error ? error.message : "Gagal mengirim sessionEnd.";
      });
    }
  }

  if (state.client) {
    state.client.end(true);
    state.client = null;
  }

  state.running = false;
  return getServerGpsSimulatorStatus();
}
