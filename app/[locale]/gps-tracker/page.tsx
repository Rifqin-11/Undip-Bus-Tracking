"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { MqttClient } from "mqtt";
import { OFFICIAL_ROUTE_PATH } from "@/lib/transit/buggy-data";

const DEFAULT_BUGGY_ID = 1;
const DEFAULT_INTERVAL_MS = 3000;
const DEFAULT_CAPACITY = 8;
const EARTH_RADIUS_M = 6_371_000;

type TrackerMode = "device" | "fleet";
type PositionSource = "gps" | "simulated";
type TrackStatus = "idle" | "requesting" | "tracking" | "error";
type MqttStatus = "disconnected" | "connecting" | "connected" | "publishing" | "error";

type LatLng = { lat: number; lng: number };
type HaltePoint = { id: string; name: string; lat: number; lng: number; isOptional?: boolean; isActive?: boolean };
type BuggyOption = {
  id: string;
  numericId: number;
  name: string;
  code: string;
  capacity: number;
};
type ResolvedDeviceAssignment = {
  id: string;
  devicesId: string;
  buggyId: string;
  buggyCode: string | null;
  buggyName: string | null;
  buggyNumericId: number | null;
  label: string | null;
};
type DeviceCoords = LatLng & {
  accuracy: number;
  speedMps: number | null;
  heading: number | null;
  altitude: number | null;
};
type SimulatedVehicle = {
  buggyId: number;
  id: string;
  name: string;
  code: string;
  capacity: number;
  cursor: number;
  batteryLevel: number;
  passengers: number;
  speedKmh: number;
  sessionStarted: boolean;
  devicesId?: string;
  gsm?: {
    apn: string;
    signalPercent: number;
    networkConnected: boolean;
    gprsConnected: boolean;
    simStatusText: string;
    localIp: string;
    networkType: string;
    mqttStateText: string;
  };
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
  source: "gps-tracker";
  gsm?: {
    apn?: string;
    signalCsq?: number;
    signalDbm?: number;
    signalPercent?: number;
    simStatus?: number;
    simStatusText?: string;
    networkConnected?: boolean;
    gprsConnected?: boolean;
    localIp?: string;
    networkType?: string;
    mqttState?: number;
    mqttStateText?: string;
  };
};

type MqttModule = {
  connect?: typeof import("mqtt").connect;
  default?: {
    connect?: typeof import("mqtt").connect;
  };
};

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

function clampNumber(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function resolveRoutePosition(
  route: [number, number][],
  cursor: number,
  haltes: HaltePoint[],
): { position: LatLng; heading: number | null; etaMinutes: number } {
  if (route.length === 0) {
    return {
      position: { lat: -7.054518, lng: 110.44413 },
      heading: null,
      etaMinutes: 5,
    };
  }

  if (route.length === 1) {
    return {
      position: { lat: route[0][0], lng: route[0][1] },
      heading: null,
      etaMinutes: 1,
    };
  }

  const segmentCount = route.length;
  const normalized = ((cursor % segmentCount) + segmentCount) % segmentCount;
  const segmentIndex = Math.floor(normalized);
  const progress = normalized - segmentIndex;
  const from = route[segmentIndex];
  const to = route[(segmentIndex + 1) % route.length];
  const fromPosition = { lat: from[0], lng: from[1] };
  const toPosition = { lat: to[0], lng: to[1] };
  const position = {
    lat: fromPosition.lat + (toPosition.lat - fromPosition.lat) * progress,
    lng: fromPosition.lng + (toPosition.lng - fromPosition.lng) * progress,
  };
  const nearestHalteDistance =
    haltes.length > 0
      ? Math.min(
          ...haltes.map((halte) =>
            haversineM(position, { lat: halte.lat, lng: halte.lng }),
          ),
        )
      : haversineM(position, toPosition);

  return {
    position,
    heading: bearingDegrees(fromPosition, toPosition),
    etaMinutes: Math.max(1, Math.round(nearestHalteDistance / (12 / 3.6) / 60)),
  };
}

function mqttStatusText(status: MqttStatus) {
  if (status === "connected") return "Terhubung";
  if (status === "connecting") return "Menghubungkan";
  if (status === "publishing") return "Mengirim";
  if (status === "error") return "Error";
  return "Terputus";
}

function resolveInitialRouteCursor(index: number, totalVehicles: number) {
  const routeLength = Math.max(OFFICIAL_ROUTE_PATH.length, 1);
  const vehicleCount = Math.max(totalVehicles, 1);
  return (index * routeLength) / vehicleCount;
}

function createVehicle(
  option: BuggyOption,
  index: number,
  totalVehicles = 1,
): SimulatedVehicle {
  return {
    buggyId: option.numericId,
    id: option.id,
    name: option.name,
    code: option.code,
    capacity: option.capacity,
    cursor: resolveInitialRouteCursor(index, totalVehicles),
    batteryLevel: clampNumber(96 - index * 5, 35, 100),
    passengers: index % (option.capacity + 1),
    speedKmh: 10 + (index % 4) * 2,
    sessionStarted: false,
  };
}

export default function GpsTrackerPage() {
  const [trackerMode, setTrackerMode] = useState<TrackerMode>("device");
  const [positionSource, setPositionSource] =
    useState<PositionSource>("simulated");
  const [trackStatus, setTrackStatus] = useState<TrackStatus>("idle");
  const [mqttStatus, setMqttStatus] = useState<MqttStatus>("disconnected");
  const [buggyOptions, setBuggyOptions] = useState<BuggyOption[]>([]);
  const [haltes, setHaltes] = useState<HaltePoint[]>([]);
  const [selectedBuggyId, setSelectedBuggyId] = useState(DEFAULT_BUGGY_ID);
  const [fleetCount, setFleetCount] = useState(3);
  const [intervalMs, setIntervalMs] = useState(DEFAULT_INTERVAL_MS);
  const [sendCount, setSendCount] = useState(0);
  const [lastSent, setLastSent] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [log, setLog] = useState<string[]>([]);
  const [latestPayloads, setLatestPayloads] = useState<TelemetryPayload[]>([]);
  const [vehicles, setVehicles] = useState<SimulatedVehicle[]>([]);
  const [deviceCoords, setDeviceCoords] = useState<DeviceCoords | null>(null);
  const [deviceBattery, setDeviceBattery] = useState(92);
  const [devicePassengers, setDevicePassengers] = useState(2);

  // GSM & Device assignments states
  const [deviceAssignments, setDeviceAssignments] = useState<ResolvedDeviceAssignment[]>([]);
  const [simulateGsm, setSimulateGsm] = useState(true);
  const [deviceIdInput, setDeviceIdInput] = useState("");
  const [gsmApn, setGsmApn] = useState("Internet");
  const [gsmSignalPercent, setGsmSignalPercent] = useState(85);
  const [gsmSimStatusText, setGsmSimStatusText] = useState("SIM_READY");
  const [gsmNetworkConnected, setGsmNetworkConnected] = useState(true);
  const [gsmGprsConnected, setGsmGprsConnected] = useState(true);
  const [gsmLocalIp, setGsmLocalIp] = useState("10.122.45.18");
  const [gsmNetworkType, setGsmNetworkType] = useState("GSM_GPRS");
  const [gsmMqttStateText, setGsmMqttStateText] = useState("MQTT_CONNECTED");

  const mqttClientRef = useRef<MqttClient | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const watchIdRef = useRef<number | null>(null);
  const sessionStartedRef = useRef(false);
  const deviceCoordsRef = useRef<DeviceCoords | null>(null);
  const deviceBatteryRef = useRef(deviceBattery);
  const devicePassengersRef = useRef(devicePassengers);
  const vehiclesRef = useRef<SimulatedVehicle[]>([]);

  // Refs for GSM/Device inputs to maintain safe callback access
  const simulateGsmRef = useRef(simulateGsm);
  const deviceIdInputRef = useRef(deviceIdInput);
  const gsmApnRef = useRef(gsmApn);
  const gsmSignalPercentRef = useRef(gsmSignalPercent);
  const gsmSimStatusTextRef = useRef(gsmSimStatusText);
  const gsmNetworkConnectedRef = useRef(gsmNetworkConnected);
  const gsmGprsConnectedRef = useRef(gsmGprsConnected);
  const gsmLocalIpRef = useRef(gsmLocalIp);
  const gsmNetworkTypeRef = useRef(gsmNetworkType);
  const gsmMqttStateTextRef = useRef(gsmMqttStateText);

  useEffect(() => { simulateGsmRef.current = simulateGsm; }, [simulateGsm]);
  useEffect(() => { deviceIdInputRef.current = deviceIdInput; }, [deviceIdInput]);
  useEffect(() => { gsmApnRef.current = gsmApn; }, [gsmApn]);
  useEffect(() => { gsmSignalPercentRef.current = gsmSignalPercent; }, [gsmSignalPercent]);
  useEffect(() => { gsmSimStatusTextRef.current = gsmSimStatusText; }, [gsmSimStatusText]);
  useEffect(() => { gsmNetworkConnectedRef.current = gsmNetworkConnected; }, [gsmNetworkConnected]);
  useEffect(() => { gsmGprsConnectedRef.current = gsmGprsConnected; }, [gsmGprsConnected]);
  useEffect(() => { gsmLocalIpRef.current = gsmLocalIp; }, [gsmLocalIp]);
  useEffect(() => { gsmNetworkTypeRef.current = gsmNetworkType; }, [gsmNetworkType]);
  useEffect(() => { gsmMqttStateTextRef.current = gsmMqttStateText; }, [gsmMqttStateText]);
  const mqttBrokerUrl =
    process.env.NEXT_PUBLIC_MQTT_BROKER_WS_URL ?? "ws://localhost:9001";
  const mqttTopicPrefix = process.env.NEXT_PUBLIC_MQTT_TOPIC_PREFIX ?? "buggy";
  const mqttUsername = process.env.NEXT_PUBLIC_MQTT_USERNAME;
  const mqttPassword = process.env.NEXT_PUBLIC_MQTT_PASSWORD;

  const selectedBuggy = useMemo(
    () =>
      buggyOptions.find((buggy) => buggy.numericId === selectedBuggyId) ?? {
        id: `buggy-${selectedBuggyId}`,
        numericId: selectedBuggyId,
        name: `Buggy ${selectedBuggyId}`,
        code: `B${String(selectedBuggyId).padStart(2, "0")}`,
        capacity: DEFAULT_CAPACITY,
      },
    [buggyOptions, selectedBuggyId],
  );

  // Auto-populate Device ID when selected buggy or assignments change
  useEffect(() => {
    const ass = deviceAssignments.find((a) => a.buggyId === selectedBuggy.id);
    if (ass) {
      setDeviceIdInput(ass.devicesId);
    } else {
      setDeviceIdInput(`ESP-${selectedBuggy.code}`);
    }
  }, [selectedBuggy, deviceAssignments]);

  const sortedHaltes = useMemo(
    () =>
      [...haltes].sort((a, b) =>
        a.name.localeCompare(b.name, "id-ID", { numeric: true }),
      ),
    [haltes],
  );

  const latestDevicePayload = latestPayloads.find(
    (payload) => payload.buggyId === selectedBuggyId,
  );
  const isTracking = trackStatus === "tracking";
  const isBusy = trackStatus === "requesting";
  const formatTrackerTime = useCallback(() =>
    new Intl.DateTimeFormat("id-ID", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      timeZone: "Asia/Jakarta",
    }).format(new Date()), []);

  const addLog = useCallback((message: string) => {
    const time = formatTrackerTime();
    setLog((prev) => [`[${time}] ${message}`, ...prev].slice(0, 60));
  }, [formatTrackerTime]);

  useEffect(() => {
    fetch("/api/haltes", { cache: "no-store" })
      .then((response) => response.json())
      .then((data) => {
        if (Array.isArray(data)) setHaltes(data as HaltePoint[]);
      })
      .catch(() => addLog("Gagal memuat halte"));

    fetch("/api/buggy", { cache: "no-store" })
      .then((response) => response.json())
      .then((data) => {
        if (!Array.isArray(data)) return;
        const options = data.map((buggy, index) => ({
          id: String(buggy.id ?? `buggy-${index + 1}`),
          numericId: Number(buggy.numericId ?? index + 1),
          name: String(buggy.name ?? `Buggy ${index + 1}`),
          code: String(buggy.code ?? `B${String(index + 1).padStart(2, "0")}`),
          capacity: Number(buggy.capacity ?? DEFAULT_CAPACITY),
        })) as BuggyOption[];
        if (options.length > 0) {
          setBuggyOptions(options);
          setSelectedBuggyId(options[0].numericId);
        }
      })
      .catch(() => addLog("Gagal memuat data buggy"));

    fetch("/api/admin/device-assignments")
      .then((response) => {
        if (!response.ok) throw new Error();
        return response.json();
      })
      .then((data) => {
        if (data && Array.isArray(data.assignments)) {
          setDeviceAssignments(data.assignments);
          addLog(`Berhasil memuat ${data.assignments.length} assignment device`);
        }
      })
      .catch(() => {
        addLog("Info: Device assignments tidak dapat dimuat (memerlukan login admin). Menggunakan manual input.");
      });
  }, [addLog]);

  useEffect(() => {
    deviceCoordsRef.current = deviceCoords;
  }, [deviceCoords]);

  useEffect(() => {
    deviceBatteryRef.current = deviceBattery;
  }, [deviceBattery]);

  useEffect(() => {
    devicePassengersRef.current = devicePassengers;
  }, [devicePassengers]);

  useEffect(() => {
    vehiclesRef.current = vehicles;
  }, [vehicles]);

  useEffect(
    () => () => {
      stopAll();
      mqttClientRef.current?.end(true);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const connectMqtt = useCallback(async () => {
    if (mqttClientRef.current?.connected) return mqttClientRef.current;

    setMqttStatus("connecting");
    const mqttModule = (await import("mqtt")) as MqttModule;
    const mqttConnect = mqttModule.connect ?? mqttModule.default?.connect;

    if (!mqttConnect) {
      throw new Error("MQTT client tidak tersedia di bundle browser.");
    }

    return await new Promise<MqttClient>((resolve, reject) => {
      const client = mqttConnect(mqttBrokerUrl, {
        clientId: `simobi-tracker-${Math.random().toString(16).slice(2)}`,
        clean: true,
        protocolVersion: 4,
        reconnectPeriod: 0,
        connectTimeout: 12_000,
        keepalive: 30,
        username: mqttUsername || undefined,
        password: mqttPassword || undefined,
      });

      const fail = (error: Error) => {
        setMqttStatus("error");
        addLog(`MQTT error: ${error.message || error.name}`);
        client.end(true);
        reject(error);
      };

      client.once("connect", () => {
        mqttClientRef.current = client;
        setMqttStatus("connected");
        addLog(`MQTT terhubung ke ${mqttBrokerUrl}`);
        resolve(client);
      });
      client.once("error", fail);
      client.on("reconnect", () => {
        setMqttStatus("connecting");
        addLog("MQTT reconnect...");
      });
      client.on("offline", () => {
        setMqttStatus("disconnected");
        addLog("MQTT offline");
      });
      client.on("close", () => {
        setMqttStatus("disconnected");
      });
    });
  }, [addLog, mqttBrokerUrl, mqttPassword, mqttUsername]);

  const publishPayload = useCallback(
    async (payload: TelemetryPayload) => {
      const client = await connectMqtt();
      const topic = `${mqttTopicPrefix}/${payload.buggyId}/data`;

      setMqttStatus("publishing");
      await new Promise<void>((resolve, reject) => {
        client.publish(topic, JSON.stringify(payload), { qos: 0 }, (error) => {
          if (error) reject(error);
          else resolve();
        });
      });

      setMqttStatus("connected");
      setSendCount((count) => count + 1);
      setLastSent(formatTrackerTime());
      setLatestPayloads((prev) => [
        payload,
        ...prev.filter((item) => item.buggyId !== payload.buggyId),
      ]);
    },
    [connectMqtt, formatTrackerTime, mqttTopicPrefix],
  );

  const buildPayload = useCallback(
    (
      vehicle: SimulatedVehicle,
      position: LatLng,
      options?: {
        heading?: number | null;
        accuracy?: number;
        altitude?: number | null;
        etaMinutes?: number;
        sessionStart?: boolean;
        sessionEnd?: boolean;
      },
    ): TelemetryPayload => {
      const payload: TelemetryPayload = {
        buggyId: vehicle.buggyId,
        lat: Number(position.lat.toFixed(7)),
        lng: Number(position.lng.toFixed(7)),
        speedKmh: Number(vehicle.speedKmh.toFixed(2)),
        heading:
          typeof options?.heading === "number"
            ? Math.round(options.heading)
            : null,
        altitude: options?.altitude ?? null,
        accuracy: Math.round(options?.accuracy ?? 8),
        batteryLevel: Math.round(clampNumber(vehicle.batteryLevel, 0, 100)),
        passengers: Math.round(clampNumber(vehicle.passengers, 0, vehicle.capacity)),
        capacity: vehicle.capacity,
        etaMinutes: Math.max(1, Math.round(options?.etaMinutes ?? 5)),
        sessionStart: options?.sessionStart || undefined,
        sessionEnd: options?.sessionEnd || undefined,
        timestamp: new Date().toISOString(),
        source: "gps-tracker",
      };

      if (vehicle.devicesId) {
        payload.devicesId = vehicle.devicesId;
      }

      if (vehicle.gsm) {
        const pct = vehicle.gsm.signalPercent;
        const csq = Math.round((pct / 100) * 31);
        const dbm = Math.round(-113 + (pct / 100) * 62);

        payload.gsm = {
          apn: vehicle.gsm.apn,
          signalPercent: pct,
          signalCsq: csq,
          signalDbm: dbm,
          simStatus: vehicle.gsm.simStatusText === "SIM_READY" ? 1 : 0,
          simStatusText: vehicle.gsm.simStatusText || "SIM_READY",
          networkConnected: vehicle.gsm.networkConnected,
          gprsConnected: vehicle.gsm.gprsConnected,
          localIp: vehicle.gsm.localIp,
          networkType: vehicle.gsm.networkType,
          mqttState: vehicle.gsm.mqttStateText === "MQTT_CONNECTED" ? 4 : -1,
          mqttStateText: vehicle.gsm.mqttStateText || "MQTT_CONNECTED",
        };
      }

      return payload;
    },
    [],
  );

  const tickDevice = useCallback(async () => {
    const baseVehicle = createVehicle(selectedBuggy, 0);
    const routeState = resolveRoutePosition(
      OFFICIAL_ROUTE_PATH,
      (Date.now() / 1000 / 1.8) % Math.max(OFFICIAL_ROUTE_PATH.length, 1),
      sortedHaltes,
    );
    const coords = deviceCoordsRef.current;
    const useGps = positionSource === "gps" && coords;
    const speedKmh = useGps ? (coords.speedMps ?? 0) * 3.6 : 12;
    const vehicle: SimulatedVehicle = {
      ...baseVehicle,
      batteryLevel: deviceBatteryRef.current,
      passengers: devicePassengersRef.current,
      speedKmh,
      sessionStarted: sessionStartedRef.current,
    };

    if (simulateGsmRef.current) {
      vehicle.devicesId = deviceIdInputRef.current.trim() || undefined;
      vehicle.gsm = {
        apn: gsmApnRef.current,
        signalPercent: gsmSignalPercentRef.current,
        networkConnected: gsmNetworkConnectedRef.current,
        gprsConnected: gsmGprsConnectedRef.current,
        simStatusText: gsmSimStatusTextRef.current,
        localIp: gsmLocalIpRef.current,
        networkType: gsmNetworkTypeRef.current,
        mqttStateText: gsmMqttStateTextRef.current,
      };
    }

    const payload = buildPayload(
      vehicle,
      useGps ? coords : routeState.position,
      {
        heading: useGps ? coords.heading : routeState.heading,
        altitude: useGps ? coords.altitude : null,
        accuracy: useGps ? coords.accuracy : 7,
        etaMinutes: routeState.etaMinutes,
        sessionStart: !sessionStartedRef.current,
      },
    );

    sessionStartedRef.current = true;
    const nextBattery = clampNumber(deviceBatteryRef.current - 0.2, 5, 100);
    deviceBatteryRef.current = nextBattery;
    setDeviceBattery(nextBattery);
    await publishPayload(payload);
  }, [
    buildPayload,
    positionSource,
    publishPayload,
    selectedBuggy,
    sortedHaltes,
  ]);

  const tickFleet = useCallback(async () => {
    const current = vehiclesRef.current;
    const nextVehicles: SimulatedVehicle[] = [];
    const payloads: TelemetryPayload[] = [];

    for (const vehicle of current) {
      const routeState = resolveRoutePosition(
        OFFICIAL_ROUTE_PATH,
        vehicle.cursor,
        sortedHaltes,
      );
      const nextPassengerDelta = Math.random() > 0.62 ? (Math.random() > 0.5 ? 1 : -1) : 0;
      const nextVehicle: SimulatedVehicle = {
        ...vehicle,
        cursor: vehicle.cursor + 0.7 + vehicle.speedKmh / 25,
        batteryLevel: clampNumber(vehicle.batteryLevel - 0.12, 5, 100),
        passengers: clampNumber(
          vehicle.passengers + nextPassengerDelta,
          0,
          vehicle.capacity,
        ),
        speedKmh: clampNumber(vehicle.speedKmh + (Math.random() - 0.5), 6, 20),
        sessionStarted: true,
      };

      nextVehicles.push(nextVehicle);
      payloads.push(
        buildPayload(nextVehicle, routeState.position, {
          heading: routeState.heading,
          accuracy: 6 + Math.random() * 6,
          etaMinutes: routeState.etaMinutes,
          sessionStart: !vehicle.sessionStarted,
        }),
      );
    }

    setVehicles(nextVehicles);
    await Promise.all(payloads.map((payload) => publishPayload(payload)));
  }, [buildPayload, publishPayload, sortedHaltes]);

  const stopAll = useCallback(() => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const stopTracking = useCallback(async () => {
    stopAll();
    setTrackStatus("idle");
    addLog("Tracking dihentikan, mengirim sessionEnd...");

    const targets =
      trackerMode === "fleet"
        ? vehiclesRef.current
        : [
            (() => {
              const v = createVehicle(selectedBuggy, 0);
              if (simulateGsmRef.current) {
                v.devicesId = deviceIdInputRef.current.trim() || undefined;
                v.gsm = {
                  apn: gsmApnRef.current,
                  signalPercent: gsmSignalPercentRef.current,
                  networkConnected: gsmNetworkConnectedRef.current,
                  gprsConnected: gsmGprsConnectedRef.current,
                  simStatusText: gsmSimStatusTextRef.current,
                  localIp: gsmLocalIpRef.current,
                  networkType: gsmNetworkTypeRef.current,
                  mqttStateText: gsmMqttStateTextRef.current,
                };
              }
              return v;
            })(),
          ];

    for (const target of targets) {
      const routeState = resolveRoutePosition(
        OFFICIAL_ROUTE_PATH,
        target.cursor,
        sortedHaltes,
      );
      await publishPayload(
        buildPayload(target, routeState.position, {
          sessionEnd: true,
          etaMinutes: routeState.etaMinutes,
          heading: routeState.heading,
        }),
      ).catch((error) => addLog(`Gagal kirim sessionEnd: ${String(error)}`));
    }

    sessionStartedRef.current = false;
  }, [
    addLog,
    buildPayload,
    publishPayload,
    selectedBuggy,
    sortedHaltes,
    stopAll,
    trackerMode,
  ]);

  const startTracking = useCallback(async () => {
    setErrorMsg(null);
    setTrackStatus("requesting");
    sessionStartedRef.current = false;

    try {
      await connectMqtt();

      if (trackerMode === "fleet") {
        const options = buggyOptions.length > 0 ? buggyOptions : [selectedBuggy];
        const selectedOptions = options.slice(0, fleetCount);
        const selected = selectedOptions.map((option, index) => {
          const v = createVehicle(option, index, selectedOptions.length);
          const ass = deviceAssignments.find((a) => a.buggyId === option.id);
          return {
            ...v,
            devicesId: ass ? ass.devicesId : `ESP-${option.code}`,
            gsm: {
              apn: "Internet",
              signalPercent: Math.round(80 + Math.random() * 15),
              networkConnected: true,
              gprsConnected: true,
              simStatusText: "SIM_READY",
              localIp: `10.122.45.${20 + index}`,
              networkType: "GSM_GPRS",
              mqttStateText: "MQTT_CONNECTED",
            },
          };
        });
        setVehicles(selected);
        vehiclesRef.current = selected;
        await tickFleet();
        timerRef.current = setInterval(() => void tickFleet(), intervalMs);
      } else {
        if (positionSource === "gps") {
          if (!navigator.geolocation) {
            throw new Error("Browser tidak mendukung Geolocation.");
          }
          watchIdRef.current = navigator.geolocation.watchPosition(
            (position) => {
              setDeviceCoords({
                lat: position.coords.latitude,
                lng: position.coords.longitude,
                accuracy: position.coords.accuracy,
                speedMps: position.coords.speed,
                heading: position.coords.heading,
                altitude: position.coords.altitude,
              });
            },
            (error) => {
              setErrorMsg(`GPS error: ${error.message}`);
              addLog(`GPS error: ${error.message}`);
            },
            { enableHighAccuracy: true, timeout: 15_000, maximumAge: 500 },
          );
        }
        await tickDevice();
        timerRef.current = setInterval(() => void tickDevice(), intervalMs);
      }

      setTrackStatus("tracking");
      addLog("Simulator berjalan");
    } catch (error) {
      setTrackStatus("error");
      setMqttStatus("error");
      setErrorMsg(error instanceof Error ? error.message : "Gagal memulai simulator");
      addLog(`Gagal memulai: ${String(error)}`);
      stopAll();
    }
  }, [
    addLog,
    buggyOptions,
    connectMqtt,
    deviceAssignments,
    fleetCount,
    intervalMs,
    positionSource,
    selectedBuggy,
    stopAll,
    tickDevice,
    tickFleet,
    trackerMode,
  ]);

  const previewPayload =
    trackerMode === "fleet" ? latestPayloads[0] : latestDevicePayload;

  return (
    <main style={S.page}>
      <header style={S.header}>
        <div>
          <p style={S.eyebrow}>SIMOBI Telemetry</p>
          <h1 style={S.h1}>GPS Tracker MQTT</h1>
          <p style={S.subtitle}>
            Simulasikan data operasional buggy lalu publish ke MQTT WebSocket.
          </p>
        </div>
        <div style={S.pills}>
          <Pill label="Mode" value={trackerMode === "fleet" ? "Armada" : "Device"} />
          <Pill label="MQTT" value={mqttStatusText(mqttStatus)} highlight={mqttStatus === "connected"} />
          <Pill label="Publish" value={`${sendCount}x`} />
          {lastSent ? <Pill label="Terakhir" value={lastSent} /> : null}
        </div>
      </header>

      <section style={S.body}>
        {errorMsg ? <div style={S.errorBox}>{errorMsg}</div> : null}

        {!isTracking ? (
          <Card title="Pengaturan Simulator">
            <div style={S.grid}>
              <Field label="Mode tracker">
                <select
                  style={S.input}
                  value={trackerMode}
                  onChange={(event) => setTrackerMode(event.target.value as TrackerMode)}
                >
                  <option value="device">Device tunggal</option>
                  <option value="fleet">Simulator armada</option>
                </select>
              </Field>

              {trackerMode === "device" ? (
                <>
                  <Field label="Buggy">
                    <select
                      style={S.input}
                      value={selectedBuggyId}
                      onChange={(event) => setSelectedBuggyId(Number(event.target.value))}
                    >
                      {buggyOptions.length > 0 ? (
                        buggyOptions.map((buggy) => (
                          <option key={buggy.id} value={buggy.numericId}>
                            {buggy.code} - {buggy.name}
                          </option>
                        ))
                      ) : (
                        <option value={selectedBuggyId}>Buggy {selectedBuggyId}</option>
                      )}
                    </select>
                  </Field>
                  <Field label="Sumber posisi">
                    <select
                      style={S.input}
                      value={positionSource}
                      onChange={(event) => setPositionSource(event.target.value as PositionSource)}
                    >
                      <option value="simulated">Simulasi rute halte</option>
                      <option value="gps">GPS perangkat</option>
                    </select>
                  </Field>
                  <Field label={`Penumpang: ${devicePassengers}/${selectedBuggy.capacity}`}>
                    <input
                      style={{ width: "100%", accentColor: "#38bdf8" }}
                      type="range"
                      min={0}
                      max={selectedBuggy.capacity}
                      value={devicePassengers}
                      onChange={(event) => setDevicePassengers(Number(event.target.value))}
                    />
                  </Field>
                  <Field label={`Baterai awal: ${Math.round(deviceBattery)}%`}>
                    <input
                      style={{ width: "100%", accentColor: "#38bdf8" }}
                      type="range"
                      min={5}
                      max={100}
                      value={deviceBattery}
                      onChange={(event) => setDeviceBattery(Number(event.target.value))}
                    />
                  </Field>

                  <div style={{ gridColumn: "1 / -1", display: "flex", alignItems: "center", gap: 8, margin: "6px 0" }}>
                    <input
                      type="checkbox"
                      id="simulateGsm"
                      checked={simulateGsm}
                      onChange={(e) => setSimulateGsm(e.target.checked)}
                      style={{ accentColor: "#38bdf8", cursor: "pointer" }}
                    />
                    <label htmlFor="simulateGsm" style={{ ...S.label, cursor: "pointer" }}>
                      Simulasikan Identitas Device & Modul GSM (SIM800L)
                    </label>
                  </div>

                  {simulateGsm ? (
                    <div style={S.subCard}>
                      <Field label="ID Perangkat (Device ID)">
                        <input
                          style={S.input}
                          value={deviceIdInput}
                          onChange={(e) => setDeviceIdInput(e.target.value)}
                          placeholder="e.g. ESP-3C124B00"
                        />
                      </Field>
                      <Field label="APN Operator">
                        <input
                          style={S.input}
                          value={gsmApn}
                          onChange={(e) => setGsmApn(e.target.value)}
                          placeholder="e.g. Internet"
                        />
                      </Field>
                      <Field label={`Kuat Sinyal GSM: ${gsmSignalPercent}%`}>
                        <input
                          type="range"
                          min={0}
                          max={100}
                          value={gsmSignalPercent}
                          onChange={(e) => setGsmSignalPercent(Number(e.target.value))}
                          style={{ width: "100%", accentColor: "#38bdf8" }}
                        />
                      </Field>
                      <Field label="Status Kartu SIM">
                        <select
                          style={S.input}
                          value={gsmSimStatusText}
                          onChange={(e) => setGsmSimStatusText(e.target.value)}
                        >
                          <option value="SIM_READY">SIM Ready</option>
                          <option value="SIM_NOT_INSERTED">SIM Not Inserted</option>
                          <option value="SIM_PIN_REQUIRED">SIM PIN Required</option>
                        </select>
                      </Field>
                      <Field label="Status MQTT Client">
                        <select
                          style={S.input}
                          value={gsmMqttStateText}
                          onChange={(e) => setGsmMqttStateText(e.target.value)}
                        >
                          <option value="MQTT_CONNECTED">MQTT Connected</option>
                          <option value="MQTT_DISCONNECTED">MQTT Disconnected</option>
                        </select>
                      </Field>
                      <Field label="IP Lokal Perangkat">
                        <input
                          style={S.input}
                          value={gsmLocalIp}
                          onChange={(e) => setGsmLocalIp(e.target.value)}
                          placeholder="e.g. 10.122.45.18"
                        />
                      </Field>
                      <Field label="Tipe Jaringan">
                        <input
                          style={S.input}
                          value={gsmNetworkType}
                          onChange={(e) => setGsmNetworkType(e.target.value)}
                          placeholder="e.g. GSM_GPRS"
                        />
                      </Field>
                      <div style={{ display: "flex", gap: 14, alignItems: "center", marginTop: 8, gridColumn: "1 / -1" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <input
                            type="checkbox"
                            id="gsmNetworkConnected"
                            checked={gsmNetworkConnected}
                            onChange={(e) => setGsmNetworkConnected(e.target.checked)}
                            style={{ accentColor: "#38bdf8", cursor: "pointer" }}
                          />
                          <label htmlFor="gsmNetworkConnected" style={{ ...S.label, cursor: "pointer" }}>
                            GSM Connected
                          </label>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <input
                            type="checkbox"
                            id="gsmGprsConnected"
                            checked={gsmGprsConnected}
                            onChange={(e) => setGsmGprsConnected(e.target.checked)}
                            style={{ accentColor: "#38bdf8", cursor: "pointer" }}
                          />
                          <label htmlFor="gsmGprsConnected" style={{ ...S.label, cursor: "pointer" }}>
                            GPRS Connected
                          </label>
                        </div>
                      </div>
                    </div>
                  ) : null}
                </>
              ) : (
                <Field label={`Jumlah armada: ${fleetCount}`}>
                  <input
                    style={{ width: "100%", accentColor: "#38bdf8" }}
                    type="range"
                    min={1}
                    max={Math.max(1, Math.min(8, buggyOptions.length || 5))}
                    value={fleetCount}
                    onChange={(event) => setFleetCount(Number(event.target.value))}
                  />
                </Field>
              )}

              <Field label={`Interval publish: ${intervalMs / 1000}s`}>
                <input
                  type="range"
                  min={1000}
                  max={10000}
                  step={500}
                  value={intervalMs}
                  onChange={(event) => setIntervalMs(Number(event.target.value))}
                  style={{ width: "100%", accentColor: "#38bdf8" }}
                />
              </Field>

              <Field label="Broker MQTT WebSocket">
                <input
                  style={S.input}
                  value={mqttBrokerUrl}
                  readOnly
                  title="Atur melalui NEXT_PUBLIC_MQTT_BROKER_WS_URL"
                />
              </Field>
            </div>
          </Card>
        ) : null}

        <Card title="Status Operasional">
          <div style={S.infoRows}>
            <span>Topic prefix: <code style={S.code}>{mqttTopicPrefix}</code></span>
            <span>Topic aktif: <code style={S.code}>{mqttTopicPrefix}/{"{buggyId}"}/data</code></span>
            <span>Waypoint rute resmi: <strong>{OFFICIAL_ROUTE_PATH.length}</strong></span>
            <span>Halte referensi ETA: <strong>{sortedHaltes.length}</strong></span>
            <span>Bridge target: <code style={S.code}>/api/gps-beacon</code></span>
          </div>
        </Card>

        {trackerMode === "fleet" && vehicles.length > 0 ? (
          <Card title="Armada Virtual">
            <div style={S.vehicleList}>
              {vehicles.map((vehicle) => (
                <div key={vehicle.buggyId} style={S.vehicleRow}>
                  <strong>{vehicle.code}</strong>
                  <span>{Math.round(vehicle.batteryLevel)}%</span>
                  <span>{vehicle.passengers}/{vehicle.capacity} penumpang</span>
                  <span>{vehicle.speedKmh.toFixed(1)} km/jam</span>
                </div>
              ))}
            </div>
          </Card>
        ) : null}

        {previewPayload ? (
          <Card title="Payload MQTT Terakhir">
            <pre style={S.pre}>{JSON.stringify(previewPayload, null, 2)}</pre>
          </Card>
        ) : null}

        <button
          type="button"
          onClick={isTracking ? () => void stopTracking() : () => void startTracking()}
          disabled={isBusy}
          style={{
            ...S.btn,
            background: isTracking
              ? "linear-gradient(135deg,#dc2626,#b91c1c)"
              : "linear-gradient(135deg,#0ea5e9,#0284c7)",
            opacity: isBusy ? 0.65 : 1,
          }}
        >
          {isBusy ? "Memulai..." : isTracking ? "Hentikan Simulator" : "Mulai Simulator"}
        </button>

        {log.length > 0 ? (
          <Card title="Log">
            <div style={S.logBox}>
              {log.map((line, index) => (
                <span key={`${line}-${index}`} style={S.logLine}>
                  {line}
                </span>
              ))}
            </div>
          </Card>
        ) : null}

        <Card title="Setup Lokal">
          <pre style={S.pre}>{`# Jalankan service MQTT di folder sibling
../simobi-mosquitto-broker
../mqtt-bridge-service
../mqtt-simulator-bridge-service

# Jalankan app utama
npm run dev`}</pre>
        </Card>
      </section>
    </main>
  );
}

function Card({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div style={S.card}>
      <p style={S.cardTitle}>{title}</p>
      {children}
    </div>
  );
}

function Pill({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div
      style={{
        ...S.pill,
        borderColor: highlight ? "rgba(56,189,248,.5)" : "rgba(255,255,255,.08)",
        background: highlight ? "rgba(14,165,233,.14)" : "rgba(255,255,255,.05)",
      }}
    >
      <span style={{ color: "#94a3b8" }}>{label}</span>
      <span style={{ color: highlight ? "#7dd3fc" : "#f8fafc", fontWeight: 800 }}>
        {value}
      </span>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <label style={S.label}>{label}</label>
      {children}
    </div>
  );
}

const S: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100dvh",
    background: "linear-gradient(135deg,#0f172a 0%,#1e293b 58%,#0f2027 100%)",
    color: "#f1f5f9",
    fontFamily: "'Inter',-apple-system,BlinkMacSystemFont,sans-serif",
    overflowX: "hidden",
  },
  header: {
    padding: "22px 20px 0",
    display: "flex",
    flexDirection: "column",
    gap: 12,
  },
  eyebrow: {
    margin: "0 0 4px",
    fontSize: 11,
    color: "#38bdf8",
    fontWeight: 800,
    letterSpacing: "0.14em",
    textTransform: "uppercase",
  },
  h1: {
    margin: 0,
    fontSize: 24,
    fontWeight: 800,
    color: "#f8fafc",
  },
  subtitle: {
    margin: "4px 0 0",
    fontSize: 13,
    color: "#94a3b8",
    lineHeight: 1.5,
  },
  pills: {
    display: "flex",
    flexWrap: "wrap",
    gap: 8,
  },
  pill: {
    display: "flex",
    alignItems: "center",
    gap: 7,
    border: "1px solid rgba(255,255,255,.08)",
    borderRadius: 999,
    padding: "6px 11px",
    fontSize: 12,
  },
  body: {
    padding: "16px 20px 22px",
    display: "flex",
    flexDirection: "column",
    gap: 14,
  },
  card: {
    background: "rgba(255,255,255,.055)",
    border: "1px solid rgba(255,255,255,.09)",
    borderRadius: 16,
    padding: "14px 16px",
    backdropFilter: "blur(12px)",
  },
  cardTitle: {
    margin: "0 0 11px",
    color: "#94a3b8",
    fontSize: 12,
    fontWeight: 800,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit,minmax(190px,1fr))",
    gap: 12,
  },
  label: {
    color: "#94a3b8",
    fontSize: 12,
    fontWeight: 700,
  },
  input: {
    width: "100%",
    boxSizing: "border-box",
    background: "rgba(255,255,255,.07)",
    border: "1px solid rgba(255,255,255,.14)",
    borderRadius: 10,
    color: "#f8fafc",
    fontSize: 14,
    outline: "none",
    padding: "10px 12px",
  },
  infoRows: {
    display: "flex",
    flexDirection: "column",
    gap: 5,
    color: "#cbd5e1",
    fontSize: 13,
  },
  code: {
    color: "#7dd3fc",
    fontFamily: "ui-monospace,SFMono-Regular,Menlo,monospace",
  },
  pre: {
    margin: 0,
    background: "rgba(0,0,0,.32)",
    border: "1px solid rgba(255,255,255,.08)",
    borderRadius: 10,
    color: "#cbd5e1",
    fontSize: 11,
    lineHeight: 1.6,
    overflowX: "auto",
    padding: "11px 12px",
  },
  errorBox: {
    background: "#450a0a",
    border: "1px solid #7f1d1d",
    borderRadius: 12,
    color: "#fecaca",
    fontSize: 13,
    padding: "11px 14px",
  },
  btn: {
    border: "none",
    borderRadius: 15,
    color: "#fff",
    cursor: "pointer",
    fontSize: 16,
    fontWeight: 800,
    padding: "16px",
    transition: "opacity .2s, transform .2s",
  },
  vehicleList: {
    display: "flex",
    flexDirection: "column",
    gap: 8,
  },
  vehicleRow: {
    display: "grid",
    gridTemplateColumns: "0.7fr 0.7fr 1.3fr 1fr",
    gap: 8,
    alignItems: "center",
    border: "1px solid rgba(255,255,255,.08)",
    borderRadius: 12,
    padding: "8px 10px",
    fontSize: 12,
    color: "#cbd5e1",
  },
  logBox: {
    display: "flex",
    flexDirection: "column",
    gap: 3,
    maxHeight: 170,
    overflowY: "auto",
  },
  logLine: {
    color: "#94a3b8",
    fontFamily: "ui-monospace,SFMono-Regular,Menlo,monospace",
    fontSize: 11,
  },
  subCard: {
    background: "rgba(0,0,0,.2)",
    border: "1px solid rgba(255,255,255,.05)",
    borderRadius: 12,
    padding: "12px 14px",
    marginTop: 8,
    gridColumn: "1 / -1",
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))",
    gap: 12,
  },
};
