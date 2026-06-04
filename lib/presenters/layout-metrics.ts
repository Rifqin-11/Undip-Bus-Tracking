/**
 * Shared layout measurements for map-overlay panels.
 *
 * Components import these constants to keep desktop and mobile positioning
 * aligned without duplicating pixel values.
 */
export const DESKTOP_LAYOUT = {
  topOffset: "1rem",
  sideOffset: "1rem",
  sidebarWidth: "4.5rem",
  gap: "1rem",
  panelWidth: "28rem",
  detailPanelLeft: "calc(1rem + 4.5rem + 1rem + 30rem + 1rem)", // sideOffset + sidebarWidth + gap + panelWidth + gap
};
