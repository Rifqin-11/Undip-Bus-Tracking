import type { Buggy } from "@/types/buggy";
import type { MapsApi } from "@/types/map-canvas";

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

// ─── Halte bus stop icon ────────────────────────────────────────────────────

type BusStopIconTone = "default" | "active";

const BUS_STOP_ICON_PATHS = `
<rect width="800" height="800" rx="172" fill="{bg}"/>

<path d="M633.926 0H166.074C74.5013 0 0 74.4992 0 166.072V633.906C0 725.491 74.5013 800 166.074 800H633.926C725.501 800 800 725.491 800 633.906V166.072C800 74.4992 725.501 0 633.926 0ZM769.62 633.906C769.62 708.739 708.749 769.62 633.926 769.62H166.074C91.2527 769.62 30.3797 708.739 30.3797 633.906V166.072C30.3797 91.2506 91.2527 30.3797 166.074 30.3797H633.926C708.749 30.3797 769.62 91.2506 769.62 166.072V633.906Z" fill="{icon}"/>

<path d="M693.956 522.86V391.666C693.956 391.666 684.119 315.561 679.354 277.507C674.981 245.596 659.119 196.395 507.417 196.395C355.71 196.395 339.532 245.604 335.155 277.507C330.386 315.561 325.63 353.614 320.869 391.666V522.864C317.513 525.406 315.334 529.422 315.334 533.953V554.005C315.334 561.685 321.57 567.923 329.252 567.923H359.157V592.128C359.157 597.282 363.332 601.454 368.484 601.454H398.317C403.459 601.454 407.643 597.282 407.643 592.128V567.923H607.178V592.128C607.178 597.282 611.356 601.454 616.504 601.454H646.337C651.492 601.454 655.67 597.282 655.67 592.128V567.923H685.576C693.256 567.923 699.492 561.685 699.492 554.005V533.953C699.496 529.42 697.314 525.404 693.956 522.86ZM446.829 230.994H567.992C572.996 230.994 577.037 235.05 577.037 240.047C577.037 245.039 572.996 249.094 567.992 249.094H446.829C441.831 249.094 437.79 245.039 437.79 240.047C437.79 235.05 441.831 230.994 446.829 230.994ZM415.091 499.263C399.639 499.263 387.121 486.734 387.121 471.291C387.121 455.836 399.639 443.32 415.091 443.32C430.538 443.32 443.058 455.838 443.058 471.291C443.058 486.732 430.538 499.263 415.091 499.263ZM599.741 499.263C584.286 499.263 571.767 486.734 571.767 471.291C571.767 455.836 584.286 443.32 599.741 443.32C615.184 443.32 627.708 455.838 627.708 471.291C627.71 486.732 615.184 499.263 599.741 499.263ZM627.117 377.906C621.406 377.906 615.224 377.906 608.67 377.906C606.767 371.02 604.413 365.795 601.44 361.604C592.425 348.875 578.714 347.818 566.586 347.818C554.451 347.818 540.747 348.873 531.741 361.604C528.768 365.795 526.414 371.02 524.51 377.906C474.631 377.904 422.536 377.904 387.718 377.908C379.799 377.908 373.762 371.684 374.246 363.994C375.735 340.03 377.237 316.067 378.74 292.103C379.214 284.415 385.655 278.179 393.106 278.179C451.216 278.179 563.611 278.179 621.726 278.179C629.177 278.179 635.613 284.415 636.097 292.103C637.59 316.067 639.087 340.03 640.581 363.994C641.061 371.684 635.028 377.906 627.117 377.906Z" fill="{icon}"/>

<path d="M539.623 307.38C538.823 310.009 538.378 312.792 538.378 315.68C538.378 331.257 551.008 343.875 566.584 343.875C582.163 343.875 594.797 331.259 594.797 315.68C594.797 312.792 594.347 310.009 593.537 307.38L601.847 293.132H531.322L539.623 307.38Z" fill="{icon}"/>

<path d="M191.949 432.079C221.551 425.331 243.654 398.866 243.654 367.216C243.654 330.461 213.857 300.665 177.108 300.665C140.356 300.665 110.556 330.461 110.556 367.216C110.556 398.866 132.66 425.333 162.266 432.079V573.92H100.504V603.605H253.703V573.92H191.949V432.079Z" fill="{icon}"/>
`;

function encodeSvg(svg: string) {
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

export function buildHalteIcon(
  maps: Pick<MapsApi, "Point" | "Size">,
  tone: BusStopIconTone,
  pixelSize = tone === "active" ? 28 : 24,
) {
  const active = tone === "active";

  const bgColor = active ? "#facc15" : "#103255";
  const iconColor = active ? "#111827" : "#ffffff";

  const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 800 800">
  ${BUS_STOP_ICON_PATHS.replaceAll("{bg}", bgColor).replaceAll(
    "{icon}",
    iconColor,
  )}
</svg>`;

  return {
    url: encodeSvg(svg),
    scaledSize: new maps.Size(pixelSize, pixelSize),
    anchor: new maps.Point(pixelSize / 2, pixelSize / 2),
  };
}

// ─── Search destination pin icon ────────────────────────────────────────────

export const DESTINATION_PIN_ICON = {
  path: "M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z",
  fillColor: "#ef4444",
  fillOpacity: 0.98,
  strokeColor: "#991b1b",
  strokeWeight: 1.2,
  scale: 1.25,
  labelOrigin: { x: 12, y: 10 },
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
              <div style="font-size: 12px; font-weight: 700; color: #0f172a;">${buggy.speedKmh} km/jam</div>
            </div>
          </div>

          <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px; font-size: 12px;">
            <span style="display: inline-flex; align-items: center; border: 1px solid ${tone.border}; border-radius: 999px; background: ${tone.bg}; color: ${tone.color}; font-weight: 700; padding: 2px 8px;">${crowd}</span>
            <span style="color: #334155;">Penumpang: <strong>${buggy.passengers}/${buggy.capacity}</strong> (${occupancy}%)</span>
          </div>

          <div style="font-size: 11px; color: #64748b;">Diperbarui ${buggy.updatedAt}</div>
        </div>
      </div>
    </div>
  `;
}
