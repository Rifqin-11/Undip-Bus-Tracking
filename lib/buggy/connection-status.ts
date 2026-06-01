import type { Buggy, BuggyConnectionStatus } from "@/types/buggy";

const ONLINE_MAX_SECONDS = 10;
const SIGNAL_UNSTABLE_MAX_SECONDS = 30;
const CONNECTION_LOST_MAX_SECONDS = 60;

export function resolveBuggyConnectionStatus(
  lastSeenSecondsAgo: number | null | undefined,
): BuggyConnectionStatus {
  if (
    typeof lastSeenSecondsAgo !== "number" ||
    !Number.isFinite(lastSeenSecondsAgo)
  ) {
    return "offline";
  }
  if (lastSeenSecondsAgo <= ONLINE_MAX_SECONDS) return "online";
  if (lastSeenSecondsAgo <= SIGNAL_UNSTABLE_MAX_SECONDS) {
    return "signal_unstable";
  }
  if (lastSeenSecondsAgo <= CONNECTION_LOST_MAX_SECONDS) {
    return "connection_lost";
  }
  return "offline";
}

export function isBuggyRealtimeReachable(buggy: Buggy): boolean {
  return (
    buggy.connectionStatus === "online" ||
    buggy.connectionStatus === "signal_unstable" ||
    (buggy.connectionStatus === undefined && buggy.isActive)
  );
}

export function getBuggyConnectionLabel(
  status: BuggyConnectionStatus | undefined,
) {
  if (status === "online") return "Online";
  if (status === "signal_unstable") return "Signal unstable";
  if (status === "connection_lost") return "Connection lost";
  return "Offline";
}

export function getBuggyConnectionTone(
  status: BuggyConnectionStatus | undefined,
) {
  if (status === "online") {
    return {
      label: getBuggyConnectionLabel(status),
      bg: "#dcfce7",
      color: "#166534",
      border: "#86efac",
      dot: "#22c55e",
      marker: "#004aad",
      textClass: "text-emerald-700",
      bgClass: "bg-emerald-50",
      borderClass: "border-emerald-200",
      dotClass: "bg-emerald-500",
    };
  }
  if (status === "signal_unstable") {
    return {
      label: getBuggyConnectionLabel(status),
      bg: "#fef3c7",
      color: "#92400e",
      border: "#fde68a",
      dot: "#f59e0b",
      marker: "#f59e0b",
      textClass: "text-amber-700",
      bgClass: "bg-amber-50",
      borderClass: "border-amber-200",
      dotClass: "bg-amber-500",
    };
  }
  if (status === "connection_lost") {
    return {
      label: getBuggyConnectionLabel(status),
      bg: "#e2e8f0",
      color: "#334155",
      border: "#cbd5e1",
      dot: "#64748b",
      marker: "#64748b",
      textClass: "text-slate-700",
      bgClass: "bg-slate-100",
      borderClass: "border-slate-300",
      dotClass: "bg-slate-500",
    };
  }
  return {
    label: getBuggyConnectionLabel(status),
    bg: "#f1f5f9",
    color: "#475569",
    border: "#cbd5e1",
    dot: "#94a3b8",
    marker: "#94a3b8",
    textClass: "text-slate-500",
    bgClass: "bg-slate-100",
    borderClass: "border-slate-200",
    dotClass: "bg-slate-400",
  };
}

export function formatLastSeen(secondsAgo: number | null | undefined) {
  if (typeof secondsAgo !== "number" || !Number.isFinite(secondsAgo)) {
    return "belum ada data";
  }
  if (secondsAgo < 5) return "baru saja";
  if (secondsAgo < 60) return `${Math.round(secondsAgo)} detik lalu`;
  const minutes = Math.floor(secondsAgo / 60);
  if (minutes < 60) return `${minutes} menit lalu`;
  const hours = Math.floor(minutes / 60);
  return `${hours} jam lalu`;
}
