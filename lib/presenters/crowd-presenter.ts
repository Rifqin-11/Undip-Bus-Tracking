import type { Buggy, CrowdLevel } from "@/types/buggy";

export type CrowdConfig = {
  label: string;
  dotClassName: string;
  badgeClassName: string;
};

const crowdConfigMap: Record<CrowdLevel, CrowdConfig> = {
  LONGGAR: {
    label: "Longgar",
    dotClassName: "bg-emerald-500",
    badgeClassName: "bg-emerald-100 text-emerald-800 border-emerald-300",
  },
  HAMPIR_PENUH: {
    label: "Hampir Penuh",
    dotClassName: "bg-violet-500",
    badgeClassName: "bg-violet-100 text-violet-800 border-violet-300",
  },
  PENUH: {
    label: "Penuh",
    dotClassName: "bg-rose-500",
    badgeClassName: "bg-rose-100 text-rose-800 border-rose-300",
  },
};

export const toCrowdConfig = (crowdLevel: CrowdLevel): CrowdConfig =>
  crowdConfigMap[crowdLevel];

export const activeFleetLabel = (buggies: Buggy[]): string =>
  `${buggies.length} unit`;
