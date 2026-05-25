import type { Buggy, BuggyGsmStatus } from "@/types/buggy";

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function normalizeGsmStatus(value: unknown): BuggyGsmStatus | undefined {
  if (!isRecord(value)) return undefined;

  const gsm: BuggyGsmStatus = {};

  if (typeof value.apn === "string" && value.apn.trim()) {
    gsm.apn = value.apn.trim();
  }
  if (isFiniteNumber(value.signalCsq)) gsm.signalCsq = value.signalCsq;
  if (isFiniteNumber(value.signalDbm)) gsm.signalDbm = value.signalDbm;
  if (isFiniteNumber(value.signalPercent)) {
    gsm.signalPercent = Math.max(
      0,
      Math.min(100, Math.round(value.signalPercent)),
    );
  }
  if (isFiniteNumber(value.simStatus)) gsm.simStatus = value.simStatus;
  if (typeof value.simStatusText === "string") {
    gsm.simStatusText = value.simStatusText;
  }
  if (typeof value.networkConnected === "boolean") {
    gsm.networkConnected = value.networkConnected;
  }
  if (typeof value.gprsConnected === "boolean") {
    gsm.gprsConnected = value.gprsConnected;
  }
  if (typeof value.localIp === "string" && value.localIp.trim()) {
    gsm.localIp = value.localIp.trim();
  }
  if (typeof value.networkType === "string" && value.networkType.trim()) {
    gsm.networkType = value.networkType.trim();
  }
  if (isFiniteNumber(value.mqttState)) gsm.mqttState = value.mqttState;
  if (typeof value.mqttStateText === "string") {
    gsm.mqttStateText = value.mqttStateText;
  }

  return Object.keys(gsm).length > 0 ? gsm : undefined;
}

export function getApnConnectionState(
  buggy: Pick<Buggy, "gsm">,
): "connected" | "disconnected" | "unknown" {
  const gsm = buggy.gsm;
  if (!gsm) return "unknown";

  if (gsm.gprsConnected === true || gsm.networkConnected === true) {
    return "connected";
  }
  if (gsm.gprsConnected === false || gsm.networkConnected === false) {
    return "disconnected";
  }

  return "unknown";
}
