"use client";

import { useEffect, useRef, useState, useCallback } from "react";

// ─── Configuration ────────────────────────────────────────────────────────────

const DEFAULT_BUGGY_ID = 2;
const DEFAULT_INTERVAL_MS = 3000;

// ─── Types ────────────────────────────────────────────────────────────────────

type GpsCoords = {
  lat: number;
  lng: number;
  accuracy: number;
  speed: number | null;
  heading: number | null;
  altitude: number | null;
};

type TrackStatus = "idle" | "requesting" | "tracking" | "error";
type ApiStatus = "idle" | "sending" | "ok" | "error";

// ─── Component ────────────────────────────────────────────────────────────────

export default function GpsTrackerPage() {
  const [trackStatus, setTrackStatus] = useState<TrackStatus>("idle");
  const [apiStatus, setApiStatus] = useState<ApiStatus>("idle");
  const [coords, setCoords] = useState<GpsCoords | null>(null);
  const [sendCount, setSendCount] = useState(0);
  const [lastSent, setLastSent] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [log, setLog] = useState<string[]>([]);

  // Settings
  const [buggyId, setBuggyId] = useState(DEFAULT_BUGGY_ID);
  const [intervalMs, setIntervalMs] = useState(DEFAULT_INTERVAL_MS);

  const watchIdRef = useRef<number | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const coordsRef = useRef<GpsCoords | null>(null);
  const isTrackingRef = useRef(false);

  const addLog = useCallback((msg: string) => {
    const time = new Date().toLocaleTimeString("id-ID");
    setLog((prev) => [`[${time}] ${msg}`, ...prev].slice(0, 50));
  }, []);

  // ── Send GPS to API ───────────────────────────────────────────────────────

  const sendGps = useCallback(
    async (c: GpsCoords, id: number) => {
      setApiStatus("sending");
      try {
        const res = await fetch("/api/gps-beacon", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            buggyId: id,
            lat: c.lat,
            lng: c.lng,
            accuracy: c.accuracy,
            speedKmh:
              c.speed !== null ? Number((c.speed * 3.6).toFixed(2)) : 0,
            heading: c.heading,
            altitude: c.altitude,
          }),
        });

        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(
            `HTTP ${res.status}: ${(err as { error?: string }).error ?? res.statusText}`,
          );
        }

        setApiStatus("ok");
        setSendCount((n) => n + 1);
        setLastSent(new Date().toLocaleTimeString("id-ID"));
      } catch (err) {
        setApiStatus("error");
        addLog(`❌ Gagal kirim: ${String(err)}`);
      }
    },
    [addLog],
  );

  // ── Start Tracking ────────────────────────────────────────────────────────

  const startTracking = useCallback(() => {
    setErrorMsg(null);
    setTrackStatus("requesting");
    addLog("Meminta izin GPS...");

    if (!navigator.geolocation) {
      setErrorMsg("Browser tidak mendukung Geolocation API.");
      setTrackStatus("error");
      return;
    }

    isTrackingRef.current = true;

    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const c: GpsCoords = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          speed: pos.coords.speed,
          heading: pos.coords.heading,
          altitude: pos.coords.altitude,
        };
        coordsRef.current = c;
        setCoords(c);

        if (trackStatus !== "tracking") {
          setTrackStatus("tracking");
          addLog("✅ GPS berhasil — mulai tracking");
        }
      },
      (err) => {
        addLog(`⚠️ GPS error: ${err.message}`);
        if (err.code === 1) {
          setErrorMsg("Izin GPS ditolak. Buka Settings → Safari → Lokasi.");
          setTrackStatus("error");
          stopTracking();
        }
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 500 },
    );

    setTrackStatus("tracking");

    // Send GPS on interval
    const id = buggyId;
    intervalRef.current = setInterval(() => {
      const c = coordsRef.current;
      if (!c) {
        addLog("⏳ Menunggu GPS fix...");
        return;
      }
      sendGps(c, id);
    }, intervalMs);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [buggyId, intervalMs, sendGps, addLog]);

  // ── Stop Tracking ─────────────────────────────────────────────────────────

  const stopTracking = useCallback(() => {
    isTrackingRef.current = false;
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    coordsRef.current = null;
    setTrackStatus("idle");
    setApiStatus("idle");
    addLog("🛑 Tracking dihentikan");
  }, [addLog]);

  useEffect(
    () => () => {
      if (watchIdRef.current !== null)
        navigator.geolocation.clearWatch(watchIdRef.current);
      if (intervalRef.current) clearInterval(intervalRef.current);
    },
    [],
  );

  // ── Derived ───────────────────────────────────────────────────────────────

  const isTracking = trackStatus === "tracking";
  const isBusy = trackStatus === "requesting";

  const apiDot =
    apiStatus === "ok"
      ? "🟢"
      : apiStatus === "sending"
        ? "🟡"
        : apiStatus === "error"
          ? "🔴"
          : "⚫";

  const gpsDot = coords
    ? coords.accuracy < 15
      ? "🟢"
      : coords.accuracy < 50
        ? "🟡"
        : "🟠"
    : "⚫";

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <main style={styles.page}>
      {/* Header */}
      <header style={styles.header}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 28 }}>📡</span>
          <div>
            <h1 style={styles.h1}>GPS Tracker</h1>
            <p style={styles.subtitle}>UNDIP Buggy #{buggyId} — Real GPS</p>
          </div>
        </div>

        <div style={styles.pills}>
          <Pill label={`GPS ${gpsDot}`} value={coords ? `±${Math.round(coords.accuracy)}m` : "–"} />
          <Pill label={`API ${apiDot}`} value={apiStatus} />
          <Pill label="📤" value={`${sendCount}x`} highlight />
        </div>
      </header>

      <div style={styles.body}>
        {/* Error */}
        {errorMsg && <div style={styles.errorBox}>❌ {errorMsg}</div>}

        {/* GPS Coords */}
        <Card title="📍 Koordinat GPS">
          {coords ? (
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <tbody>
                {[
                  ["Latitude", coords.lat.toFixed(7)],
                  ["Longitude", coords.lng.toFixed(7)],
                  ["Akurasi", `±${Math.round(coords.accuracy)} m`],
                  [
                    "Kecepatan",
                    coords.speed !== null
                      ? `${(coords.speed * 3.6).toFixed(1)} km/h`
                      : "–",
                  ],
                  [
                    "Altitude",
                    coords.altitude !== null
                      ? `${Math.round(coords.altitude)} m`
                      : "–",
                  ],
                  [
                    "Heading",
                    coords.heading !== null
                      ? `${Math.round(coords.heading)}°`
                      : "–",
                  ],
                ].map(([label, value]) => (
                  <tr key={label}>
                    <td style={styles.tdLabel}>{label}</td>
                    <td style={styles.tdValue}>{value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p style={styles.dimText}>
              {isTracking ? "⏳ Menunggu sinyal GPS..." : "Belum tracking"}
            </p>
          )}
        </Card>

        {/* Publish status */}
        {isTracking && (
          <Card title="📤 Status Kirim">
            <div style={styles.infoRows}>
              <span>
                Endpoint:{" "}
                <code style={styles.code}>/api/gps-beacon</code>
              </span>
              <span>
                Interval:{" "}
                <strong style={{ color: "#f1f5f9" }}>
                  {intervalMs / 1000}s
                </strong>
              </span>
              {lastSent && (
                <span>
                  Terakhir kirim:{" "}
                  <strong style={{ color: "#86efac" }}>{lastSent}</strong>
                </span>
              )}
            </div>
          </Card>
        )}

        {/* Settings */}
        {!isTracking && (
          <Card title="⚙️ Pengaturan">
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <Field label={`Buggy ID (sekarang: ${buggyId})`}>
                <input
                  type="number"
                  value={buggyId}
                  onChange={(e) => setBuggyId(Number(e.target.value))}
                  style={styles.input}
                  min={1}
                  max={99}
                />
              </Field>
              <Field label={`Interval kirim: ${intervalMs / 1000}s`}>
                <input
                  type="range"
                  min={1000}
                  max={10000}
                  step={500}
                  value={intervalMs}
                  onChange={(e) => setIntervalMs(Number(e.target.value))}
                  style={{ width: "100%", accentColor: "#38bdf8" }}
                />
              </Field>
            </div>
          </Card>
        )}

        {/* Button */}
        <button
          onClick={isTracking ? stopTracking : startTracking}
          disabled={isBusy}
          style={{
            ...styles.btn,
            background: isBusy
              ? "#334155"
              : isTracking
                ? "linear-gradient(135deg,#dc2626,#b91c1c)"
                : "linear-gradient(135deg,#0ea5e9,#0284c7)",
            boxShadow: isTracking
              ? "0 4px 24px rgba(220,38,38,.4)"
              : "0 4px 24px rgba(14,165,233,.4)",
            opacity: isBusy ? 0.6 : 1,
          }}
        >
          {isBusy
            ? "⏳ Memulai..."
            : isTracking
              ? "🛑 Stop Tracking"
              : "▶ Start Tracking"}
        </button>

        {/* Log */}
        {log.length > 0 && (
          <Card title="📋 Log">
            <div style={styles.logBox}>
              {log.map((line, i) => (
                <span key={i} style={styles.logLine}>
                  {line}
                </span>
              ))}
            </div>
          </Card>
        )}

        {/* Help */}
        <Card title="ℹ️ Cara Pakai">
          <ol style={styles.ol}>
            <li>
              Pastikan Next.js sudah jalan di MacBook (
              <code style={styles.code}>npm run dev</code>)
            </li>
            <li>
              Buka halaman ini di iPhone:{" "}
              <code style={styles.code}>
                http://[IP MacBook]:3000/gps-tracker
              </code>
            </li>
            <li>
              Tekan <strong style={{ color: "#38bdf8" }}>Start Tracking</strong>{" "}
              → izinkan GPS
            </li>
            <li>
              GPS iPhone langsung dikirim ke server via HTTP (tidak perlu MQTT
              port 9001 🎉)
            </li>
            <li>
              Buggy {buggyId} di peta akan mengikuti posisi iPhone 📍
            </li>
          </ol>
        </Card>

        <p style={styles.footer}>UNDIP Electric Buggy Tracking System</p>
      </div>
    </main>
  );
}

// ─── Sub-components ────────────────────────────────────────────────────────────

function Card({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div style={styles.card}>
      <p style={styles.cardTitle}>{title}</p>
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
        display: "flex",
        gap: 6,
        alignItems: "center",
        background: highlight
          ? "rgba(14,165,233,.12)"
          : "rgba(255,255,255,.05)",
        border: `1px solid ${highlight ? "rgba(14,165,233,.3)" : "rgba(255,255,255,.08)"}`,
        borderRadius: 20,
        padding: "5px 11px",
        fontSize: 12,
      }}
    >
      <span style={{ color: "#64748b" }}>{label}</span>
      <span
        style={{ fontWeight: 700, color: highlight ? "#38bdf8" : "#f1f5f9" }}
      >
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
    <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
      <label style={{ fontSize: 12, color: "#64748b", fontWeight: 500 }}>
        {label}
      </label>
      {children}
    </div>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100dvh",
    background:
      "linear-gradient(135deg,#0f172a 0%,#1e293b 60%,#0f2027 100%)",
    color: "#f1f5f9",
    fontFamily:
      "'Inter',-apple-system,BlinkMacSystemFont,sans-serif",
    overflowX: "hidden",
  },
  header: {
    padding: "20px 20px 0",
    display: "flex",
    flexDirection: "column",
    gap: 4,
  },
  h1: {
    margin: 0,
    fontSize: 20,
    fontWeight: 700,
    letterSpacing: "-0.02em",
    color: "#f8fafc",
  },
  subtitle: { margin: 0, fontSize: 12, color: "#94a3b8" },
  pills: {
    display: "flex",
    gap: 8,
    marginTop: 12,
    flexWrap: "wrap" as const,
  },
  body: {
    padding: "16px 20px",
    display: "flex",
    flexDirection: "column",
    gap: 14,
  },
  errorBox: {
    background: "#450a0a",
    border: "1px solid #7f1d1d",
    borderRadius: 12,
    padding: "12px 16px",
    color: "#fca5a5",
    fontSize: 14,
  },
  card: {
    background: "rgba(255,255,255,.05)",
    border: "1px solid rgba(255,255,255,.08)",
    borderRadius: 14,
    padding: "14px 16px",
    backdropFilter: "blur(12px)",
  },
  cardTitle: {
    margin: "0 0 10px",
    fontSize: 12,
    fontWeight: 600,
    color: "#64748b",
    textTransform: "uppercase",
    letterSpacing: "0.08em",
  },
  tdLabel: {
    padding: "5px 0",
    color: "#94a3b8",
    fontSize: 13,
    width: "40%",
  },
  tdValue: {
    padding: "5px 0",
    fontWeight: 600,
    fontSize: 14,
    fontVariantNumeric: "tabular-nums",
  },
  dimText: { margin: 0, color: "#64748b", fontSize: 14 },
  infoRows: {
    fontSize: 13,
    color: "#94a3b8",
    display: "flex",
    flexDirection: "column",
    gap: 4,
  },
  code: { color: "#7dd3fc" },
  input: {
    background: "rgba(255,255,255,.06)",
    border: "1px solid rgba(255,255,255,.12)",
    borderRadius: 8,
    padding: "10px 12px",
    color: "#f1f5f9",
    fontSize: 14,
    outline: "none",
    width: "100%",
    boxSizing: "border-box",
  },
  btn: {
    padding: "16px",
    borderRadius: 14,
    border: "none",
    fontSize: 16,
    fontWeight: 700,
    cursor: "pointer",
    color: "#fff",
    letterSpacing: "-0.01em",
    transition: "opacity .2s",
  },
  logBox: {
    maxHeight: 160,
    overflowY: "auto",
    display: "flex",
    flexDirection: "column",
    gap: 2,
  },
  logLine: { fontSize: 11, color: "#94a3b8", fontFamily: "monospace" },
  ol: {
    margin: 0,
    paddingLeft: 18,
    color: "#94a3b8",
    fontSize: 13,
    lineHeight: 1.8,
  },
  footer: {
    textAlign: "center",
    fontSize: 11,
    color: "#475569",
    marginTop: 4,
  },
};
