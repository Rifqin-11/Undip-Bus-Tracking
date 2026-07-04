import type { Locale } from "@/lib/i18n/config";
import type { HistoryStopPoint } from "@/lib/history/stop-points";

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export function formatHistoryStopTime(
  value: number | undefined,
  locale: Locale,
) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "--:--";
  return new Date(value).toLocaleTimeString(locale === "en" ? "en-US" : "id-ID", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Jakarta",
  });
}

export function buildHistoryStopInfoContent(
  activeStop: HistoryStopPoint,
  sameHalteStops: HistoryStopPoint[],
  locale: Locale,
) {
  const sortedStops = [...sameHalteStops].sort(
    (a, b) =>
      (a.startedAtMs ?? a.endedAtMs ?? 0) - (b.startedAtMs ?? b.endedAtMs ?? 0),
  );
  const rows = sortedStops
    .map((stop, index) => {
      const startLabel = formatHistoryStopTime(
        stop.startedAtMs ?? stop.endedAtMs,
        locale,
      );
      const endLabel =
        stop.endedAtMs && stop.endedAtMs !== stop.startedAtMs
          ? formatHistoryStopTime(stop.endedAtMs, locale)
          : null;
      const durationLabel =
        typeof stop.durationSeconds === "number"
          ? `${Math.max(1, Math.round(stop.durationSeconds / 60))} menit`
          : null;
      const meta = [
        endLabel ? `sampai ${endLabel}` : null,
        durationLabel,
        `${stop.pointCount} titik`,
        typeof stop.distanceMeters === "number"
          ? `${stop.distanceMeters} m dari halte`
          : null,
      ].filter(Boolean);

      return `
        <li style="display:grid;grid-template-columns:34px 1fr;gap:8px;padding:8px 0;border-top:${index === 0 ? "0" : "1px solid #e2e8f0"};">
          <span style="font-size:11px;font-weight:800;color:#2563eb;font-variant-numeric:tabular-nums;">${startLabel}</span>
          <span>
            <span style="display:block;font-size:12px;font-weight:700;color:#0f172a;">Kunjungan ${index + 1}</span>
            <span style="display:block;margin-top:2px;font-size:11px;color:#64748b;">${escapeHtml(meta.join(" · "))}</span>
          </span>
        </li>
      `;
    })
    .join("");

  const activeTime = formatHistoryStopTime(
    activeStop.startedAtMs ?? activeStop.endedAtMs,
    locale,
  );

  return `
    <div style="min-width:220px;max-width:280px;font-family:Inter,Arial,sans-serif;">
      <div style="padding-bottom:8px;border-bottom:1px solid #e2e8f0;">
        <div style="font-size:11px;font-weight:800;color:#64748b;text-transform:uppercase;letter-spacing:.08em;">Stop Halte</div>
        <div style="margin-top:3px;font-size:14px;font-weight:800;color:#0f172a;">${escapeHtml(activeStop.halteName)}</div>
        <div style="margin-top:3px;font-size:11px;color:#64748b;">Dipilih ${activeTime} · ${sortedStops.length} kali terdeteksi</div>
      </div>
      <ul style="list-style:none;margin:8px 0 0;padding:0;">
        ${rows}
      </ul>
    </div>
  `;
}
