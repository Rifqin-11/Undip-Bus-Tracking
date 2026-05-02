"use client";

import { useEffect, useRef, useState, useCallback, useMemo } from "react";

// ─── Configuration ─────────────────────────────────────────────────────────────
const DEFAULT_BUGGY_ID = 2;
const DEFAULT_INTERVAL_MS = 3000;
const EARTH_RADIUS_M = 6_371_000;

// ─── Types ─────────────────────────────────────────────────────────────────────
type GpsCoords = {
  lat: number; lng: number; accuracy: number;
  speed: number | null; heading: number | null; altitude: number | null;
};
type TrackStatus = "idle" | "requesting" | "tracking" | "error";
type ApiStatus  = "idle" | "sending" | "ok" | "error";
type HaltePoint = { id: string; name: string; lat: number; lng: number };
type HalteEta   = { halte: HaltePoint; distanceM: number; etaMin: number };

// ─── Haversine ─────────────────────────────────────────────────────────────────
function haversineM(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return EARTH_RADIUS_M * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

// ─── Component ─────────────────────────────────────────────────────────────────
export default function GpsTrackerPage() {
  const [trackStatus, setTrackStatus] = useState<TrackStatus>("idle");
  const [apiStatus,   setApiStatus]   = useState<ApiStatus>("idle");
  const [coords,      setCoords]      = useState<GpsCoords | null>(null);
  const [sendCount,   setSendCount]   = useState(0);
  const [lastSent,    setLastSent]    = useState<string | null>(null);
  const [errorMsg,    setErrorMsg]    = useState<string | null>(null);
  const [log,         setLog]         = useState<string[]>([]);
  const [batteryLevel, setBatteryLevel] = useState<number | null>(null);
  const [haltes,      setHaltes]      = useState<HaltePoint[]>([]);
  const [buggyId,     setBuggyId]     = useState(DEFAULT_BUGGY_ID);
  const [intervalMs,  setIntervalMs]  = useState(DEFAULT_INTERVAL_MS);

  const watchIdRef              = useRef<number | null>(null);
  const intervalRef             = useRef<ReturnType<typeof setInterval> | null>(null);
  const coordsRef               = useRef<GpsCoords | null>(null);
  const gpsSignalLostRef        = useRef(false);
  const forceResyncNextSendRef  = useRef(false);
  const batteryLevelRef         = useRef<number | null>(null);
  const sessionStartNextSendRef = useRef(false);

  // ── Fetch haltes ────────────────────────────────────────────────────────────
  useEffect(() => {
    fetch("/api/haltes", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => { if (Array.isArray(d)) setHaltes(d as HaltePoint[]); })
      .catch(() => {});
  }, []);

  // ── Battery ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (typeof navigator === "undefined" || !("getBattery" in navigator)) return;
    type BM = { level: number; addEventListener: (e: string, h: () => void) => void };
    void (navigator as unknown as { getBattery: () => Promise<BM> })
      .getBattery()
      .then((b) => {
        const upd = () => { const p = Math.round(b.level * 100); setBatteryLevel(p); batteryLevelRef.current = p; };
        upd();
        b.addEventListener("levelchange", upd);
      }).catch(() => {});
  }, []);

  // ── ETA calculation ─────────────────────────────────────────────────────────
  const halteEtas = useMemo<HalteEta[]>(() => {
    if (!coords || haltes.length === 0) return [];
    const speedMps = coords.speed !== null && coords.speed > 0.5 ? coords.speed : 5 / 3.6;
    return haltes.map((h) => {
      const distanceM = haversineM(coords, h);
      const etaMin = Math.max(1, Math.round(distanceM / speedMps / 60));
      return { halte: h, distanceM, etaMin };
    }).sort((a, b) => a.distanceM - b.distanceM);
  }, [coords, haltes]);

  const nearestEtaMin = halteEtas[0]?.etaMin ?? 5;

  const addLog = useCallback((msg: string) => {
    const t = new Date().toLocaleTimeString("id-ID");
    setLog((prev) => [`[${t}] ${msg}`, ...prev].slice(0, 50));
  }, []);

  // ── Send GPS ────────────────────────────────────────────────────────────────
  const sendGps = useCallback(async (c: GpsCoords, id: number, forceResync = false) => {
    const shouldStart = sessionStartNextSendRef.current;
    if (shouldStart) sessionStartNextSendRef.current = false;
    setApiStatus("sending");
    try {
      const speedKmh = c.speed !== null ? Number((c.speed * 3.6).toFixed(2)) : 0;
      const res = await fetch("/api/gps-beacon", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          buggyId: id,
          lat: c.lat, lng: c.lng,
          accuracy: c.accuracy,
          speedKmh,
          heading: c.heading,
          altitude: c.altitude,
          forceResync,
          batteryLevel: batteryLevelRef.current,
          etaMinutes: nearestEtaMin,
          sessionStart: shouldStart || undefined,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(`HTTP ${res.status}: ${(err as { error?: string }).error ?? res.statusText}`);
      }
      setApiStatus("ok");
      setSendCount((n) => n + 1);
      setLastSent(new Date().toLocaleTimeString("id-ID"));
      if (forceResync) { forceResyncNextSendRef.current = false; addLog("🔄 Resync halte berhasil"); }
    } catch (err) {
      setApiStatus("error");
      addLog(`❌ Gagal kirim: ${String(err)}`);
      if (forceResync) { forceResyncNextSendRef.current = true; addLog("⚠️ Resync tertunda"); }
    }
  }, [addLog, nearestEtaMin]);

  // ── Start / Stop ────────────────────────────────────────────────────────────
  const stopTracking = useCallback(() => {
    if (watchIdRef.current !== null) { navigator.geolocation.clearWatch(watchIdRef.current); watchIdRef.current = null; }
    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
    coordsRef.current = null;
    gpsSignalLostRef.current = false;
    forceResyncNextSendRef.current = false;
    sessionStartNextSendRef.current = false;
    setTrackStatus("idle"); setApiStatus("idle");
    addLog("🛑 Tracking dihentikan — menyimpan sesi...");
    void fetch("/api/gps-beacon", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ buggyId, sessionEnd: true }),
    }).then(() => addLog("💾 Sesi berhasil disimpan")).catch(() => addLog("⚠️ Gagal simpan sesi"));
  }, [addLog, buggyId]);

  const startTracking = useCallback(() => {
    setErrorMsg(null); setTrackStatus("requesting"); addLog("Meminta izin GPS...");
    if (!navigator.geolocation) { setErrorMsg("Browser tidak mendukung Geolocation."); setTrackStatus("error"); return; }
    gpsSignalLostRef.current = false;
    forceResyncNextSendRef.current = false;
    sessionStartNextSendRef.current = true;

    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const c: GpsCoords = {
          lat: pos.coords.latitude, lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy, speed: pos.coords.speed,
          heading: pos.coords.heading, altitude: pos.coords.altitude,
        };
        coordsRef.current = c; setCoords(c);
        if (gpsSignalLostRef.current) {
          gpsSignalLostRef.current = false; forceResyncNextSendRef.current = true;
          setErrorMsg(null); addLog("📶 GPS kembali — resync halte...");
          void sendGps(c, buggyId, true);
        }
        setTrackStatus("tracking");
      },
      (err) => {
        addLog(`⚠️ GPS error: ${err.message}`);
        if (err.code === 1) { setErrorMsg("Izin GPS ditolak."); setTrackStatus("error"); stopTracking(); return; }
        if (!gpsSignalLostRef.current) { gpsSignalLostRef.current = true; setErrorMsg("Sinyal GPS terputus sementara..."); addLog("📡 GPS hilang, menunggu..."); }
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 500 },
    );

    setTrackStatus("tracking");
    const id = buggyId;
    intervalRef.current = setInterval(() => {
      const c = coordsRef.current;
      if (!c) { addLog("⏳ Menunggu GPS fix..."); return; }
      void sendGps(c, id, forceResyncNextSendRef.current);
    }, intervalMs);
  }, [buggyId, intervalMs, sendGps, addLog, stopTracking]);

  useEffect(() => () => {
    if (watchIdRef.current !== null) navigator.geolocation.clearWatch(watchIdRef.current);
    if (intervalRef.current) clearInterval(intervalRef.current);
  }, []);

  // ── Derived ─────────────────────────────────────────────────────────────────
  const isTracking = trackStatus === "tracking";
  const isBusy     = trackStatus === "requesting";
  const speedKmh   = coords?.speed !== null && coords?.speed != null ? (coords.speed * 3.6).toFixed(1) : "–";
  const apiDot     = apiStatus === "ok" ? "🟢" : apiStatus === "sending" ? "🟡" : apiStatus === "error" ? "🔴" : "⚫";
  const gpsDot     = coords ? (coords.accuracy < 15 ? "🟢" : coords.accuracy < 50 ? "🟡" : "🟠") : "⚫";

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <main style={S.page}>
      {/* Header */}
      <header style={S.header}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 28 }}>📡</span>
          <div>
            <h1 style={S.h1}>GPS Tracker</h1>
            <p style={S.subtitle}>UNDIP Buggy #{buggyId} — Real GPS</p>
          </div>
        </div>
        <div style={S.pills}>
          <Pill label={`GPS ${gpsDot}`} value={coords ? `±${Math.round(coords.accuracy)}m` : "–"} />
          <Pill label={`API ${apiDot}`} value={apiStatus} />
          <Pill label="📤" value={`${sendCount}x`} highlight />
          <Pill label="⚡" value={`${speedKmh} km/h`} />
          {batteryLevel !== null && <Pill label={batteryLevel > 20 ? "🔋" : "🪫"} value={`${batteryLevel}%`} />}
        </div>
      </header>

      <div style={S.body}>
        {errorMsg && <div style={S.errorBox}>❌ {errorMsg}</div>}

        {/* Data GPS & Hardware */}
        <Card title="📍 Data Posisi & Sensor">
          {coords ? (
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <tbody>
                {[
                  ["Latitude",   coords.lat.toFixed(7)],
                  ["Longitude",  coords.lng.toFixed(7)],
                  ["Akurasi",    `±${Math.round(coords.accuracy)} m`],
                  ["Kecepatan",  `${speedKmh} km/h`],
                  ["Heading",    coords.heading !== null ? `${Math.round(coords.heading)}°` : "–"],
                  ["Altitude",   coords.altitude !== null ? `${Math.round(coords.altitude)} m` : "–"],
                  ["ETA Terdekat", `${nearestEtaMin} menit`],
                ].map(([label, value]) => (
                  <tr key={label}>
                    <td style={S.tdLabel}>{label}</td>
                    <td style={S.tdValue}>{value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p style={S.dimText}>{isTracking ? "⏳ Menunggu sinyal GPS..." : "Belum tracking"}</p>
          )}
        </Card>

        {/* ETA ke semua halte */}
        {halteEtas.length > 0 && coords && (
          <Card title="🛑 ETA ke Semua Halte">
            <p style={{ margin: "0 0 8px", fontSize: 11, color: "#64748b" }}>
              Dihitung dari kecepatan {speedKmh} km/h · {halteEtas.length} halte
            </p>
            <div style={{ maxHeight: 220, overflowY: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    <th style={{ ...S.tdLabel, fontSize: 11, paddingBottom: 6 }}>Halte</th>
                    <th style={{ ...S.tdValue, fontSize: 11, paddingBottom: 6, textAlign: "right" }}>Jarak</th>
                    <th style={{ ...S.tdValue, fontSize: 11, paddingBottom: 6, textAlign: "right", paddingLeft: 8 }}>ETA</th>
                  </tr>
                </thead>
                <tbody>
                  {halteEtas.map(({ halte, distanceM, etaMin }, i) => (
                    <tr key={halte.id} style={{ background: i === 0 ? "rgba(56,189,248,.08)" : "transparent" }}>
                      <td style={{ ...S.tdLabel, paddingRight: 8 }}>
                        {i === 0 && <span style={{ color: "#38bdf8", marginRight: 4 }}>→</span>}
                        {halte.name}
                      </td>
                      <td style={{ ...S.tdValue, textAlign: "right", fontSize: 13 }}>
                        {distanceM >= 1000 ? `${(distanceM / 1000).toFixed(1)} km` : `${Math.round(distanceM)} m`}
                      </td>
                      <td style={{ ...S.tdValue, textAlign: "right", fontSize: 13, paddingLeft: 8, color: i === 0 ? "#38bdf8" : "#f1f5f9" }}>
                        {etaMin} min
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        {/* Payload yang akan dikirim ke server (preview) */}
        {coords && (
          <Card title="📦 Payload Dikirim ke Server">
            <pre style={S.pre}>
{JSON.stringify({
  buggyId,
  lat: coords.lat,
  lng: coords.lng,
  accuracy: coords.accuracy,
  speedKmh: coords.speed !== null ? Number((coords.speed * 3.6).toFixed(2)) : 0,
  heading: coords.heading,
  altitude: coords.altitude,
  etaMinutes: nearestEtaMin,
  batteryLevel,
}, null, 2)}
            </pre>
            <p style={{ margin: "8px 0 0", fontSize: 11, color: "#475569" }}>
              Format ini kompatibel dengan hardware Raspberry Pi
            </p>
          </Card>
        )}

        {/* Status kirim */}
        {isTracking && lastSent && (
          <Card title="📤 Status Kirim">
            <div style={S.infoRows}>
              <span>Endpoint: <code style={S.code}>/api/gps-beacon</code></span>
              <span>Interval: <strong style={{ color: "#f1f5f9" }}>{intervalMs / 1000}s</strong></span>
              <span>Terakhir: <strong style={{ color: "#86efac" }}>{lastSent}</strong></span>
            </div>
          </Card>
        )}

        {/* Settings */}
        {!isTracking && (
          <Card title="⚙️ Pengaturan">
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <Field label={`Buggy ID: ${buggyId}`}>
                <input type="number" value={buggyId} onChange={(e) => setBuggyId(Number(e.target.value))}
                  style={S.input} min={1} max={99} />
              </Field>
              <Field label={`Interval kirim: ${intervalMs / 1000}s`}>
                <input type="range" min={1000} max={10000} step={500} value={intervalMs}
                  onChange={(e) => setIntervalMs(Number(e.target.value))}
                  style={{ width: "100%", accentColor: "#38bdf8" }} />
              </Field>
            </div>
          </Card>
        )}

        {/* Button */}
        <button
          onClick={isTracking ? stopTracking : startTracking}
          disabled={isBusy}
          style={{
            ...S.btn,
            background: isBusy ? "#334155" : isTracking
              ? "linear-gradient(135deg,#dc2626,#b91c1c)"
              : "linear-gradient(135deg,#0ea5e9,#0284c7)",
            boxShadow: isTracking ? "0 4px 24px rgba(220,38,38,.4)" : "0 4px 24px rgba(14,165,233,.4)",
            opacity: isBusy ? 0.6 : 1,
          }}
        >
          {isBusy ? "⏳ Memulai..." : isTracking ? "🛑 Stop Tracking" : "▶ Start Tracking"}
        </button>

        {/* Log */}
        {log.length > 0 && (
          <Card title="📋 Log">
            <div style={S.logBox}>
              {log.map((line, i) => <span key={i} style={S.logLine}>{line}</span>)}
            </div>
          </Card>
        )}

        {/* Cara pakai hardware */}
        <Card title="🔌 Format untuk Raspberry Pi">
          <p style={{ margin: "0 0 8px", fontSize: 12, color: "#64748b" }}>
            Raspy cukup POST ke endpoint berikut:
          </p>
          <pre style={S.pre}>{`POST /api/gps-beacon
Content-Type: application/json

{
  "buggyId": 2,
  "lat": -7.054518,
  "lng": 110.44413,
  "speedKmh": 12.5,
  "heading": 270,
  "altitude": 200,
  "accuracy": 5,
  "etaMinutes": 3,
  "batteryLevel": 85
}`}</pre>
        </Card>

        <p style={S.footer}>UNDIP Electric Buggy Tracking System</p>
      </div>
    </main>
  );
}

// ─── Sub-components ────────────────────────────────────────────────────────────
function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={S.card}>
      <p style={S.cardTitle}>{title}</p>
      {children}
    </div>
  );
}

function Pill({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div style={{
      display: "flex", gap: 6, alignItems: "center",
      background: highlight ? "rgba(14,165,233,.12)" : "rgba(255,255,255,.05)",
      border: `1px solid ${highlight ? "rgba(14,165,233,.3)" : "rgba(255,255,255,.08)"}`,
      borderRadius: 20, padding: "5px 11px", fontSize: 12,
    }}>
      <span style={{ color: "#64748b" }}>{label}</span>
      <span style={{ fontWeight: 700, color: highlight ? "#38bdf8" : "#f1f5f9" }}>{value}</span>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
      <label style={{ fontSize: 12, color: "#64748b", fontWeight: 500 }}>{label}</label>
      {children}
    </div>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const S: Record<string, React.CSSProperties> = {
  page:      { minHeight: "100dvh", background: "linear-gradient(135deg,#0f172a 0%,#1e293b 60%,#0f2027 100%)", color: "#f1f5f9", fontFamily: "'Inter',-apple-system,BlinkMacSystemFont,sans-serif", overflowX: "hidden" },
  header:    { padding: "20px 20px 0", display: "flex", flexDirection: "column", gap: 4 },
  h1:        { margin: 0, fontSize: 20, fontWeight: 700, letterSpacing: "-0.02em", color: "#f8fafc" },
  subtitle:  { margin: 0, fontSize: 12, color: "#94a3b8" },
  pills:     { display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" as const },
  body:      { padding: "16px 20px", display: "flex", flexDirection: "column", gap: 14 },
  errorBox:  { background: "#450a0a", border: "1px solid #7f1d1d", borderRadius: 12, padding: "12px 16px", color: "#fca5a5", fontSize: 14 },
  card:      { background: "rgba(255,255,255,.05)", border: "1px solid rgba(255,255,255,.08)", borderRadius: 14, padding: "14px 16px", backdropFilter: "blur(12px)" },
  cardTitle: { margin: "0 0 10px", fontSize: 12, fontWeight: 600, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.08em" },
  tdLabel:   { padding: "5px 0", color: "#94a3b8", fontSize: 13, width: "45%" },
  tdValue:   { padding: "5px 0", fontWeight: 600, fontSize: 14, fontVariantNumeric: "tabular-nums" },
  dimText:   { margin: 0, color: "#64748b", fontSize: 14 },
  infoRows:  { fontSize: 13, color: "#94a3b8", display: "flex", flexDirection: "column", gap: 4 },
  code:      { color: "#7dd3fc" },
  pre:       { margin: 0, fontSize: 11, color: "#94a3b8", background: "rgba(0,0,0,.3)", borderRadius: 8, padding: "10px 12px", overflowX: "auto", fontFamily: "monospace", lineHeight: 1.6 },
  input:     { background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.12)", borderRadius: 8, padding: "10px 12px", color: "#f1f5f9", fontSize: 14, outline: "none", width: "100%", boxSizing: "border-box" },
  btn:       { padding: "16px", borderRadius: 14, border: "none", fontSize: 16, fontWeight: 700, cursor: "pointer", color: "#fff", letterSpacing: "-0.01em", transition: "opacity .2s" },
  logBox:    { maxHeight: 160, overflowY: "auto", display: "flex", flexDirection: "column", gap: 2 },
  logLine:   { fontSize: 11, color: "#94a3b8", fontFamily: "monospace" },
  footer:    { textAlign: "center", fontSize: 11, color: "#475569", marginTop: 4 },
};
