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

function crowdTone(crowdLevel: Buggy["crowdLevel"]): {
  bg: string;
  color: string;
  border: string;
} {
  if (crowdLevel === "LONGGAR") {
    return { bg: "#dcfce7", color: "#166534", border: "#86efac" };
  }
  if (crowdLevel === "HAMPIR_PENUH") {
    return { bg: "#fef3c7", color: "#92400e", border: "#fde68a" };
  }
  return { bg: "#fee2e2", color: "#991b1b", border: "#fca5a5" };
}

export function buildBuggyInfoContent(buggy: Buggy): string {
  const crowd = crowdDescription(buggy.crowdLevel);
  const tone = crowdTone(buggy.crowdLevel);
  const occupancy = buggy.capacity
    ? Math.min(100, Math.round((buggy.passengers / buggy.capacity) * 100))
    : 0;

  return `
    <div style="font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif; min-width: 248px; color:#0f172a;">
      <div style="border: 1px solid #e2e8f0; border-radius: 14px; overflow: hidden; background: #ffffff; box-shadow: 0 10px 28px rgba(15, 23, 42, 0.12);">
        <div style="padding: 10px 12px; border-bottom: 1px solid #e2e8f0; background: linear-gradient(135deg, #eff6ff 0%, #f8fafc 100%);">
          <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px;">
            <div style="font-size: 14px; font-weight: 700; color: #0f172a; line-height: 1.2;">${buggy.name}</div>
            <span style="font-size: 10px; font-weight: 700; letter-spacing: 0.03em; color: #1e3a8a; background: #dbeafe; border: 1px solid #bfdbfe; border-radius: 999px; padding: 2px 7px;">${buggy.code}</span>
          </div>
          <div style="font-size: 12px; color: #475569; margin-top: 4px;">Rute: ${buggy.routeLabel}</div>
        </div>

        <div style="padding: 10px 12px; display: grid; gap: 8px;">
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
            <div style="border: 1px solid #e2e8f0; border-radius: 10px; padding: 7px 8px; background: #f8fafc;">
              <div style="font-size: 10px; color: #64748b; margin-bottom: 2px;">ETA</div>
              <div style="font-size: 12px; font-weight: 700; color: #0f172a;">${buggy.etaMinutes} menit</div>
            </div>
            <div style="border: 1px solid #e2e8f0; border-radius: 10px; padding: 7px 8px; background: #f8fafc;">
              <div style="font-size: 10px; color: #64748b; margin-bottom: 2px;">Kecepatan</div>
              <div style="font-size: 12px; font-weight: 700; color: #0f172a;">${buggy.speedKmh} km/h</div>
            </div>
          </div>

          <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px; font-size: 12px;">
            <span style="display: inline-flex; align-items: center; border: 1px solid ${tone.border}; border-radius: 999px; background: ${tone.bg}; color: ${tone.color}; font-weight: 700; padding: 2px 8px;">${crowd}</span>
            <span style="color: #334155;">Penumpang: <strong>${buggy.passengers}/${buggy.capacity}</strong> (${occupancy}%)</span>
          </div>

          <div style="font-size: 11px; color: #64748b;">Update ${buggy.updatedAt}</div>
        </div>
      </div>
    </div>
  `;
}
