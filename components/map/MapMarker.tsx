import type { Buggy } from "@/types/buggy";

// ─── Buggy pin icon ──────────────────────────────────────────────────────────

export const BUGGY_PIN_ICON = {
  path: "M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z",
  fillColor: "#2563eb",
  fillOpacity: 0.95,
  strokeColor: "#1e40af",
  strokeWeight: 1,
  scale: 1.25,
  labelOrigin: { x: 12, y: 10 },
};

export const BUGGY_SELECTED_PIN_ICON = {
  ...BUGGY_PIN_ICON,
  fillColor: "#dc2626",
  strokeColor: "#991b1b",
  scale: 1.35,
};

// ─── Halte pin icon ──────────────────────────────────────────────────────────

export const HALTE_PIN_ICON = {
  path: "M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z",
  fillColor: "#10b981",
  fillOpacity: 0.95,
  strokeColor: "#047857",
  strokeWeight: 1,
  scale: 1.05,
  labelOrigin: { x: 12, y: 10 },
};

export const HALTE_SELECTED_PIN_ICON = {
  ...HALTE_PIN_ICON,
  fillColor: "#f59e0b",
  strokeColor: "#b45309",
  scale: 1.2,
};

// ─── Info window content builder ─────────────────────────────────────────────

function crowdDescription(crowdLevel: Buggy["crowdLevel"]): string {
  if (crowdLevel === "LONGGAR") return "Longgar";
  if (crowdLevel === "HAMPIR_PENUH") return "Hampir Penuh";
  return "Penuh";
}

export function buildBuggyInfoContent(buggy: Buggy): string {
  return `
    <div style="font-family: system-ui, sans-serif; min-width: 210px; color:#0f172a;">
      <div style="font-size: 14px; font-weight: 700; margin-bottom: 4px;">${buggy.name}</div>
      <div style="font-size: 12px; color: #334155; margin-bottom: 6px;">Rute: ${buggy.routeLabel}</div>
      <div style="font-size: 12px; color: #475569;">ETA ${buggy.etaMinutes} menit • ${buggy.speedKmh} km/h</div>
      <div style="font-size: 12px; color: #475569;">Kepadatan: ${crowdDescription(buggy.crowdLevel)}</div>
      <div style="font-size: 12px; color: #475569;">Penumpang: ${buggy.passengers}/${buggy.capacity}</div>
      <div style="font-size: 12px; color: #64748b;">Update ${buggy.updatedAt}</div>
    </div>
  `;
}
