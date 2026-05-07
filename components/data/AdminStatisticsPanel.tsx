"use client";

import { useState, useEffect, useMemo, type ReactNode } from "react";
import { SkeletonStat, Skeleton } from "@/components/ui/Skeleton";
import {
  Activity,
  AlertTriangle,
  Battery,
  Bus,
  Users,
  CalendarDays,
  Gauge,
  Waypoints,
  Zap,
  Timer,
  Clock,
  MapPin,
  Route,
} from "lucide-react";
import type { Buggy } from "@/types/buggy";
import type { BuggySession } from "@/types/buggy-session";
import { HALTE_LOCATIONS } from "@/lib/transit/buggy-data";
import { haversineMeters } from "@/lib/transit/buggy-route-utils";

type AdminStatisticsPanelProps = {
  buggies: Buggy[];
};

type StatTone = "navy" | "emerald" | "amber" | "rose" | "slate";
type ChartDatum = { label: string; value: number; helper?: string };

function formatDelta(current: number, previous: number): string {
  if (previous <= 0) return current > 0 ? "Baru" : "0%";
  const delta = ((current - previous) / previous) * 100;
  const prefix = delta >= 0 ? "+" : "";
  return `${prefix}${delta.toFixed(0)}%`;
}

function StatTile({
  icon,
  label,
  value,
  helper,
  className = "",
  tone = "slate",
}: {
  icon: ReactNode;
  label: string;
  value: string;
  helper: string;
  className?: string;
  tone?: StatTone;
}) {
  const toneClass: Record<StatTone, string> = {
    navy: "text-[#0f1a3b]",
    emerald: "text-emerald-500",
    amber: "text-amber-500",
    rose: "text-rose-500",
    slate: "text-slate-400",
  };

  return (
    <div className={`p-3.5 ${className}`}>
      <div className="mb-2 flex items-center gap-1.5">
        <span className={toneClass[tone]}>{icon}</span>
        <p className="min-w-0 text-[9px] font-bold uppercase tracking-widest text-slate-500">
          {label}
        </p>
      </div>
      <p className="text-[20px] font-black leading-none tracking-tight text-[#0f1a3b]">
        {value}
      </p>
      <p className="mt-1.5 text-[10px] font-medium leading-snug text-slate-400">
        {helper}
      </p>
    </div>
  );
}

function formatMinutes(value: number) {
  if (value < 60) return `${Math.round(value)} mnt`;
  const hours = Math.floor(value / 60);
  const minutes = Math.round(value % 60);
  return `${hours}j ${minutes}m`;
}

function getNearestHalteName(lat: number, lng: number) {
  if (HALTE_LOCATIONS.length === 0) return "Area tidak diketahui";

  let nearest = HALTE_LOCATIONS[0];
  let nearestDistance = haversineMeters({ lat, lng }, nearest);

  for (const halte of HALTE_LOCATIONS.slice(1)) {
    const distance = haversineMeters({ lat, lng }, halte);
    if (distance < nearestDistance) {
      nearest = halte;
      nearestDistance = distance;
    }
  }

  return nearest.name;
}

function getMedian(values: number[]) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[middle]
    : (sorted[middle - 1] + sorted[middle]) / 2;
}

function MiniAreaChart({
  data,
  color = "#0f1a3b",
}: {
  data: ChartDatum[];
  color?: string;
}) {
  const width = 280;
  const height = 86;
  const maxValue = Math.max(1, ...data.map((item) => item.value));
  const step = data.length > 1 ? width / (data.length - 1) : width;
  const points = data.map((item, index) => {
    const x = index * step;
    const y = height - (item.value / maxValue) * (height - 12) - 6;
    return { x, y, ...item };
  });
  const linePath = points
    .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`)
    .join(" ");
  const areaPath = `${linePath} L ${width} ${height} L 0 ${height} Z`;

  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="h-24 w-full overflow-visible"
        role="img"
      >
        <path d={areaPath} fill={color} opacity="0.12" />
        <path
          d={linePath}
          fill="none"
          stroke={color}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="3"
        />
        {points.map((point) => (
          <circle
            key={point.label}
            cx={point.x}
            cy={point.y}
            r={point.value > 0 ? 3 : 0}
            fill={color}
            opacity="0.8"
          />
        ))}
      </svg>
      <div className="-mt-1 flex justify-between text-[9px] font-bold text-slate-400">
        <span>{data[0]?.label ?? "-"}</span>
        <span>{data[Math.floor(data.length / 2)]?.label ?? "-"}</span>
        <span>{data[data.length - 1]?.label ?? "-"}</span>
      </div>
    </div>
  );
}

function RankingBars({
  data,
  maxItems = 5,
}: {
  data: ChartDatum[];
  maxItems?: number;
}) {
  const visible = data.slice(0, maxItems);
  const maxValue = Math.max(1, ...visible.map((item) => item.value));

  if (visible.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-3 py-5 text-center text-[12px] font-semibold text-slate-400">
        Belum ada data.
      </p>
    );
  }

  return (
    <div className="space-y-2.5">
      {visible.map((item) => (
        <div key={item.label}>
          <div className="mb-1 flex items-center justify-between gap-2">
            <p className="truncate text-[11px] font-bold text-slate-700">
              {item.label}
            </p>
            <p className="shrink-0 text-[10px] font-black text-[#0f1a3b]">
              {item.helper ?? item.value.toLocaleString("id-ID")}
            </p>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-[#0f1a3b]"
              style={{
                width: `${Math.max(5, (item.value / maxValue) * 100)}%`,
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

export function AdminStatisticsPanel({ buggies }: AdminStatisticsPanelProps) {
  const now = new Date();

  const [sessions, setSessions] = useState<BuggySession[]>([]);
  const [isLoadingSessions, setIsLoadingSessions] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState<string>(
    now.toISOString().slice(0, 7), // "YYYY-MM"
  );

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/buggy-sessions?limit=5000", {
          cache: "no-store",
        });
        if (res.ok) {
          const payload = await res.json();
          setSessions(payload.sessions || []);
        }
      } catch (e) {
        // ignore
      } finally {
        setIsLoadingSessions(false);
      }
    }
    load();
  }, []);

  // Filter sessions by selected month
  const filteredSessions = useMemo(() => {
    return sessions.filter((s) => s.sessionDate.startsWith(selectedMonth));
  }, [sessions, selectedMonth]);

  const previousMonth = useMemo(() => {
    const year = parseInt(selectedMonth.substring(0, 4), 10);
    const month = parseInt(selectedMonth.substring(5, 7), 10);
    const date = new Date(year, month - 2, 1);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
  }, [selectedMonth]);

  const previousMonthSessions = useMemo(() => {
    return sessions.filter((s) => s.sessionDate.startsWith(previousMonth));
  }, [sessions, previousMonth]);

  const elapsedDaysInMonth = Math.max(1, now.getDate()); // Approximate if viewing current month

  const activeBuggies = buggies.filter((buggy) => buggy.isActive);
  const inactiveBuggies = buggies.length - activeBuggies.length;
  const totalCapacity = buggies.reduce(
    (sum, buggy) => sum + Math.max(0, buggy.capacity),
    0,
  );
  const totalPassengers = buggies.reduce(
    (sum, buggy) => sum + Math.max(0, buggy.passengers),
    0,
  );
  const averagePassengersPerDay = totalPassengers / elapsedDaysInMonth;
  const activeRate =
    buggies.length > 0 ? (activeBuggies.length / buggies.length) * 100 : 0;
  const occupancyRate =
    totalCapacity > 0 ? (totalPassengers / totalCapacity) * 100 : 0;
  const availableSeats = Math.max(0, totalCapacity - totalPassengers);
  const nearFullBuggies = buggies.filter(
    (buggy) =>
      buggy.crowdLevel === "HAMPIR_PENUH" || buggy.crowdLevel === "PENUH",
  ).length;
  const averageLiveSpeed =
    activeBuggies.length > 0
      ? activeBuggies.reduce(
          (sum, buggy) => sum + Math.max(0, buggy.speedKmh),
          0,
        ) / activeBuggies.length
      : 0;
  const fastestBuggy = buggies.reduce<Buggy | null>((fastest, buggy) => {
    if (!fastest || buggy.speedKmh > fastest.speedKmh) return buggy;
    return fastest;
  }, null);
  const staleOrNeverUpdated = buggies.filter(
    (buggy) => !buggy.updatedAt || buggy.updatedAt === "--:--",
  ).length;

  // Real operational stats from filtered sessions
  const totalPerjalanan = filteredSessions.length;
  const previousTotalPerjalanan = previousMonthSessions.length;
  const totalJarakKm = filteredSessions.reduce(
    (sum, s) => sum + (s.totalDistanceKm || 0),
    0,
  );
  const previousTotalJarakKm = previousMonthSessions.reduce(
    (sum, s) => sum + (s.totalDistanceKm || 0),
    0,
  );
  const totalWaktuMenit = filteredSessions.reduce(
    (sum, s) => sum + (s.durationMinutes || 0),
    0,
  );

  const averageSpeedKmh =
    totalWaktuMenit > 0 ? totalJarakKm / (totalWaktuMenit / 60) : 0;
  const averageDistancePerTrip =
    totalPerjalanan > 0 ? totalJarakKm / totalPerjalanan : 0;
  const averageDurationPerTrip =
    totalPerjalanan > 0 ? totalWaktuMenit / totalPerjalanan : 0;
  const sessionsPerBuggy =
    buggies.length > 0 ? totalPerjalanan / buggies.length : 0;
  const averageBatteryUsed = (() => {
    const batterySessions = filteredSessions.filter(
      (s) => typeof s.batteryUsed === "number",
    );
    if (batterySessions.length === 0) return null;
    return (
      batterySessions.reduce(
        (sum, session) => sum + Math.max(0, session.batteryUsed ?? 0),
        0,
      ) / batterySessions.length
    );
  })();

  const totalWaktuHours = Math.floor(totalWaktuMenit / 60);
  const totalWaktuMins = Math.round(totalWaktuMenit % 60);

  // Daily Trend Data
  const dailyTrends = useMemo(() => {
    const year = parseInt(selectedMonth.substring(0, 4));
    const month = parseInt(selectedMonth.substring(5, 7));
    const daysInMonth = new Date(year, month, 0).getDate();

    const trends = Array.from({ length: daysInMonth }, (_, i) => ({
      day: i + 1,
      count: 0,
    }));

    filteredSessions.forEach((s) => {
      const dayStr = s.sessionDate.substring(8, 10);
      const day = parseInt(dayStr, 10);
      if (day >= 1 && day <= daysInMonth) {
        trends[day - 1].count++;
      }
    });

    return trends;
  }, [filteredSessions, selectedMonth]);

  const maxDailyCount = Math.max(1, ...dailyTrends.map((t) => t.count));
  const busiestDay = dailyTrends.reduce(
    (best, item) => (item.count > best.count ? item : best),
    { day: 0, count: 0 },
  );

  const hourlyPassengerDemand = useMemo(() => {
    const livePassengerBaseline =
      activeBuggies.length > 0
        ? totalPassengers / activeBuggies.length
        : buggies.length > 0
          ? totalPassengers / buggies.length
          : 0;
    const buckets = Array.from({ length: 24 }, (_, hour) => ({
      label: `${String(hour).padStart(2, "0")}:00`,
      value: 0,
    }));

    for (const session of filteredSessions) {
      const startedAt = new Date(session.startedAt);
      if (Number.isNaN(startedAt.getTime())) continue;
      const hour = startedAt.getHours();
      buckets[hour].value += Math.max(1, livePassengerBaseline);
    }

    const currentHour = new Date().getHours();
    buckets[currentHour].value += totalPassengers;

    return buckets.map((item) => ({
      ...item,
      value: Math.round(item.value),
    }));
  }, [activeBuggies.length, buggies.length, filteredSessions, totalPassengers]);

  const peakPassengerHour = hourlyPassengerDemand.reduce(
    (best, item) => (item.value > best.value ? item : best),
    hourlyPassengerDemand[0] ?? { label: "-", value: 0 },
  );

  const delayTrend = useMemo(() => {
    const validDurations = filteredSessions
      .map((session) => session.durationMinutes ?? 0)
      .filter((duration) => duration > 0);
    const typicalDuration = getMedian(validDurations);
    const targetDuration = typicalDuration > 0 ? typicalDuration * 1.15 : 0;
    const buckets = Array.from({ length: 24 }, (_, hour) => ({
      label: `${String(hour).padStart(2, "0")}:00`,
      value: 0,
    }));

    if (targetDuration === 0) return { data: buckets, targetDuration };

    for (const session of filteredSessions) {
      const startedAt = new Date(session.startedAt);
      const duration = session.durationMinutes ?? 0;
      if (Number.isNaN(startedAt.getTime()) || duration <= targetDuration) {
        continue;
      }

      buckets[startedAt.getHours()].value += duration - targetDuration;
    }

    return {
      data: buckets.map((item) => ({
        ...item,
        value: Number(item.value.toFixed(1)),
      })),
      targetDuration,
    };
  }, [filteredSessions]);

  const peakDelay = delayTrend.data.reduce(
    (best, item) => (item.value > best.value ? item : best),
    delayTrend.data[0] ?? { label: "-", value: 0 },
  );

  const areaTrafficRanking = useMemo(() => {
    const areaCounts = new Map<string, number>();

    for (const session of filteredSessions) {
      const sampledPoints = session.path.filter((_, index) => index % 4 === 0);
      for (const [lat, lng] of sampledPoints) {
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
        const areaName = getNearestHalteName(lat, lng);
        areaCounts.set(areaName, (areaCounts.get(areaName) ?? 0) + 1);
      }
    }

    return Array.from(areaCounts.entries())
      .map(([label, value]) => ({
        label,
        value,
        helper: `${value.toLocaleString("id-ID")} titik`,
      }))
      .sort((a, b) => b.value - a.value);
  }, [filteredSessions]);

  const dominantStopRanking = useMemo(() => {
    const stopCounts = new Map<string, number>();

    for (const session of filteredSessions) {
      const points = session.path;
      if (points.length === 0) continue;

      const endpointCandidates = [points[0], points[points.length - 1]];
      for (const [lat, lng] of endpointCandidates) {
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
        const stopName = getNearestHalteName(lat, lng);
        stopCounts.set(stopName, (stopCounts.get(stopName) ?? 0) + 1);
      }
    }

    return Array.from(stopCounts.entries())
      .map(([label, value]) => ({
        label,
        value,
        helper: `${value.toLocaleString("id-ID")} stop`,
      }))
      .sort((a, b) => b.value - a.value);
  }, [filteredSessions]);

  const mostVisitedArea = areaTrafficRanking[0];
  const dominantStop = dominantStopRanking[0];

  // Generate month options (e.g. current month and past 5 months)
  const monthOptions = useMemo(() => {
    const opts = [];
    for (let i = 0; i < 6; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const val = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const label = d.toLocaleDateString("id-ID", {
        month: "long",
        year: "numeric",
      });
      opts.push({ value: val, label });
    }
    return opts;
  }, [now]);

  return (
    <section className="space-y-3">
      <div className="rounded-3xl border border-slate-200/80 bg-white/70 p-4 lg:p-5">
        {/* Header */}
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-[18px] font-bold tracking-tight text-[#0f1a3b]">
              Statistik Operasional
            </h2>
            <p className="text-[11px] font-medium text-slate-500">
              Ringkasan untuk admin kampus dan pengelola buggy
            </p>
          </div>
          <div className="relative flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-bold text-[#0f1a3b] shadow-sm">
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="appearance-none bg-transparent outline-none pr-4 font-bold cursor-pointer"
            >
              {monthOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <CalendarDays className="absolute right-3 top-1/2 -translate-y-1/2 h-3 w-3 text-slate-500 pointer-events-none" />
          </div>
        </div>

        {/* Top Card: Passengers */}
        <div className="relative mb-3 flex items-center justify-between rounded-[20px] border border-slate-100 bg-white p-4 shadow-[0_8px_20px_rgba(15,23,42,0.02)] overflow-hidden">
          {/* Abstract BG Pattern */}
          <div className="absolute right-0 top-0 h-full w-1/2 opacity-[0.03] pointer-events-none">
            <div className="absolute -right-4 -top-4 h-24 w-24 rounded-full border-[12px] border-slate-900" />
            <div className="absolute bottom-0 right-10 h-16 w-16 rounded-full border-[10px] border-slate-900" />
          </div>

          <div className="flex w-1/2 flex-col">
            <div className="mb-2 flex items-center gap-2">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#0f1a3b] text-white">
                <Users className="h-5 w-5" />
              </div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 leading-tight">
                Total
                <br />
                Penumpang
              </p>
            </div>
            <div className="flex items-end gap-2">
              <span className="text-[36px] font-black leading-none text-[#0f1a3b] tracking-tighter">
                {totalPassengers.toLocaleString("id-ID")}
              </span>
              <span className="mb-1.5 rounded-full bg-slate-100 px-1.5 py-0.5 text-[9px] font-bold text-slate-600">
                live
              </span>
            </div>
          </div>

          <div className="h-16 w-px bg-slate-100/80 mx-2" />

          <div className="relative z-10 flex w-1/2 flex-col pl-3">
            <p className="mb-1 text-[10px] font-bold uppercase tracking-widest text-slate-400 leading-tight">
              Rata-rata
              <br />
              Harian
            </p>
            <div className="flex items-end gap-1.5">
              <span className="text-[28px] font-black leading-none text-[#0f1a3b] tracking-tighter">
                {averagePassengersPerDay.toFixed(0)}
              </span>
              <span className="mb-1 text-[11px] font-bold text-slate-400">
                org / hari
              </span>
            </div>
            <div className="mt-2 h-1.5 w-full max-w-[80px] rounded-full bg-[#0f1a3b]" />
          </div>
        </div>

        <div className="rounded-[20px] border border-slate-100 bg-white p-3.5 shadow-[0_8px_20px_rgba(15,23,42,0.02)] mb-3">
          <div className="mb-3 flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="mb-1 flex items-center gap-1.5">
                <Users className="h-4 w-4 text-[#0f1a3b]" />
                <p className="text-[9px] font-bold uppercase tracking-widest text-slate-500">
                  Peak Passenger Time
                </p>
              </div>
              <p className="text-[11px] font-medium leading-snug text-slate-400">
                Estimasi beban penumpang per jam dari trip bulanan dan okupansi
                live.
              </p>
            </div>
            <span className="shrink-0 rounded-full bg-slate-100 px-2 py-1 text-[9px] font-black text-[#0f1a3b]">
              {peakPassengerHour.value > 0
                ? `${peakPassengerHour.label} · ${peakPassengerHour.value} org`
                : "-"}
            </span>
          </div>
          <MiniAreaChart data={hourlyPassengerDemand} />
        </div>

        {/* Bottom Grid: Operational Stats */}
        <div className="overflow-hidden rounded-[20px] border border-slate-100 bg-white shadow-[0_8px_20px_rgba(15,23,42,0.02)] mb-3">
          <div className="grid grid-cols-2 border-b border-slate-100">
            <div className="border-r border-slate-100 p-3.5">
              <div className="mb-2 flex items-center gap-1.5">
                <Waypoints className="h-4 w-4 text-slate-400" />
                <p className="text-[9px] font-bold uppercase tracking-widest text-slate-500">
                  Total Perjalanan
                </p>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[20px] font-black text-[#0f1a3b]">
                  {isLoadingSessions ? (
                    <SkeletonStat width="w-14" height="h-5" />
                  ) : (
                    totalPerjalanan.toLocaleString("id-ID")
                  )}
                </span>
                <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[9px] font-bold text-slate-600">
                  {formatDelta(totalPerjalanan, previousTotalPerjalanan)}
                </span>
              </div>
            </div>
            <div className="p-3.5">
              <div className="mb-2 flex items-center gap-1.5">
                <Zap className="h-4 w-4 text-slate-400" />
                <p className="text-[9px] font-bold uppercase tracking-widest text-slate-500">
                  Total Jarak
                </p>
              </div>
              <div className="flex items-center justify-between">
                <span className="flex items-baseline gap-1">
                  <span className="text-[20px] font-black text-[#0f1a3b]">
                    {isLoadingSessions ? (
                      <SkeletonStat width="w-12" height="h-5" />
                    ) : (
                      totalJarakKm.toFixed(1)
                    )}
                  </span>
                  <span className="text-[10px] font-bold text-slate-400">
                    km
                  </span>
                </span>
                <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[9px] font-bold text-slate-600">
                  {formatDelta(totalJarakKm, previousTotalJarakKm)}
                </span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2">
            <div className="border-r border-slate-100 p-3.5">
              <div className="mb-2 flex items-center gap-1.5">
                <Timer className="h-4 w-4 text-slate-400" />
                <p className="text-[9px] font-bold uppercase tracking-widest text-slate-500">
                  Rata-rata Kec.
                </p>
              </div>
              <span className="flex items-baseline gap-1">
                <span className="text-[20px] font-black text-[#0f1a3b]">
                  {isLoadingSessions ? (
                    <SkeletonStat width="w-12" height="h-5" />
                  ) : (
                    averageSpeedKmh.toFixed(1)
                  )}
                </span>
                <span className="text-[10px] font-bold text-slate-400">
                  km/h
                </span>
              </span>
            </div>
            <div className="p-3.5">
              <div className="mb-2 flex items-center gap-1.5">
                <Clock className="h-4 w-4 text-slate-400" />
                <p className="text-[9px] font-bold uppercase tracking-widest text-slate-500">
                  Total Waktu
                </p>
              </div>
              <span className="text-[20px] font-black text-[#0f1a3b]">
                {isLoadingSessions ? (
                  <SkeletonStat width="w-16" height="h-5" />
                ) : (
                  `${totalWaktuHours}h ${totalWaktuMins}m`
                )}
              </span>
            </div>
          </div>
        </div>

        <div className="rounded-[20px] border border-slate-100 bg-white p-3.5 shadow-[0_8px_20px_rgba(15,23,42,0.02)] mb-3">
          <div className="mb-3 flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="mb-1 flex items-center gap-1.5">
                <AlertTriangle className="h-4 w-4 text-amber-500" />
                <p className="text-[9px] font-bold uppercase tracking-widest text-slate-500">
                  Keterlambatan Perjalanan
                </p>
              </div>
              <p className="text-[11px] font-medium leading-snug text-slate-400">
                Akumulasi durasi di atas target normal{" "}
                {delayTrend.targetDuration > 0
                  ? formatMinutes(delayTrend.targetDuration)
                  : "-"}
                .
              </p>
            </div>
            <span className="shrink-0 rounded-full bg-amber-50 px-2 py-1 text-[9px] font-black text-amber-600">
              {peakDelay.value > 0
                ? `${peakDelay.label} · ${formatMinutes(peakDelay.value)}`
                : "Normal"}
            </span>
          </div>
          <MiniAreaChart data={delayTrend.data} color="#f59e0b" />
        </div>

        <div className="mt-3 overflow-hidden rounded-[20px] border border-slate-100 bg-white shadow-[0_8px_20px_rgba(15,23,42,0.02)]">
          <div className="grid grid-cols-2 border-b border-slate-100">
            <StatTile
              icon={<Bus className="h-4 w-4" />}
              label="Armada aktif"
              value={`${activeBuggies.length}/${buggies.length}`}
              helper={`${activeRate.toFixed(0)}% armada mengirim GPS`}
              className="border-r border-slate-100"
              tone={activeBuggies.length > 0 ? "emerald" : "rose"}
            />
            <StatTile
              icon={<Activity className="h-4 w-4" />}
              label="Utilisasi kursi"
              value={`${occupancyRate.toFixed(0)}%`}
              helper={`${totalPassengers}/${totalCapacity} kursi terisi`}
              className="border-r border-slate-100"
              tone={
                occupancyRate >= 85
                  ? "rose"
                  : occupancyRate >= 60
                    ? "amber"
                    : "emerald"
              }
            />
          </div>
          <div className="grid grid-cols-2">
            <StatTile
              icon={<Gauge className="h-4 w-4" />}
              label="Kec. live rata-rata"
              value={`${averageLiveSpeed.toFixed(1)}`}
              helper={`Tertinggi ${fastestBuggy?.code ?? "-"} ${fastestBuggy ? `${fastestBuggy.speedKmh.toFixed(1)} km/h` : ""}`}
              className="border-r border-slate-100"
              tone="navy"
            />
            <StatTile
              icon={<Battery className="h-4 w-4" />}
              label="Drain baterai/trip"
              value={
                averageBatteryUsed === null
                  ? "-"
                  : `${averageBatteryUsed.toFixed(1)}%`
              }
              helper="Rata-rata pemakaian baterai per sesi"
              tone="slate"
            />
          </div>
        </div>

        {/* Trend Chart */}
        {isLoadingSessions ? (
          <div className="mt-3 rounded-[16px] bg-slate-50/80 p-3.5">
            <div className="mb-3 flex items-center justify-between gap-2">
              <Skeleton className="h-2.5 w-40" />
              <Skeleton className="h-5 w-16 rounded-full" />
            </div>
            <Skeleton className="h-14 w-full rounded-md" />
          </div>
        ) : null}
        {!isLoadingSessions && filteredSessions.length > 0 && (
          <div className="mt-3 rounded-[16px] bg-slate-50/80 p-3.5">
            <div className="mb-3 flex items-center justify-between gap-2">
              <p className="text-[9px] font-bold uppercase tracking-widest text-slate-500">
                Aktivitas Perjalanan Harian
              </p>
              <span className="rounded-full bg-white px-2 py-1 text-[9px] font-bold text-slate-500">
                Tersibuk: {busiestDay.count > 0 ? `tgl ${busiestDay.day}` : "-"}
              </span>
            </div>
            <div className="flex h-14 w-full items-end gap-[2px] sm:gap-1">
              {dailyTrends.map((t) => (
                <div
                  key={t.day}
                  title={`Tanggal ${t.day}: ${t.count} perjalanan`}
                  className="group relative flex w-full flex-col justify-end h-full"
                >
                  <div
                    className={`w-full rounded-t-sm transition-all ${
                      t.count > 0
                        ? "bg-[#0f1a3b]/30 group-hover:bg-[#0f1a3b]/60 cursor-pointer"
                        : "bg-transparent"
                    }`}
                    style={{
                      height: `${(t.count / maxDailyCount) * 100}%`,
                      minHeight: t.count > 0 ? "4px" : "0",
                    }}
                  />
                  {/* Tooltip on hover */}
                  <div className="pointer-events-none absolute -top-8 left-1/2 -translate-x-1/2 rounded bg-slate-800 px-2 py-1 text-[10px] font-bold text-white opacity-0 shadow-sm transition-opacity group-hover:opacity-100 whitespace-nowrap z-10">
                    Tgl {t.day}: {t.count}
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-1 flex justify-between text-[9px] font-bold text-slate-400">
              <span>1</span>
              <span>{dailyTrends.length}</span>
            </div>
          </div>
        )}

        <div className="mt-3 grid gap-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-[20px] border border-slate-100 bg-white p-3.5 shadow-[0_8px_20px_rgba(15,23,42,0.02)]">
              <div className="mb-3 flex items-start justify-between gap-2">
                <div>
                  <div className="mb-1 flex items-center gap-1.5">
                    <Route className="h-4 w-4 text-[#0f1a3b]" />
                    <p className="text-[9px] font-bold uppercase tracking-widest text-slate-500">
                      Area Sering Dilalui
                    </p>
                  </div>
                  <p className="text-[11px] font-medium leading-snug text-slate-400">
                    Berdasarkan titik GPS yang paling dekat ke area halte.
                  </p>
                </div>
              </div>
              <RankingBars data={areaTrafficRanking} />
              {mostVisitedArea ? (
                <p className="mt-3 rounded-2xl bg-slate-50 px-3 py-2 text-[10px] font-semibold text-slate-500">
                  Area dominan:{" "}
                  <span className="font-black text-[#0f1a3b]">
                    {mostVisitedArea.label}
                  </span>
                </p>
              ) : null}
            </div>

            <div className="rounded-[20px] border border-slate-100 bg-white p-3.5 shadow-[0_8px_20px_rgba(15,23,42,0.02)]">
              <div className="mb-3 flex items-start justify-between gap-2">
                <div>
                  <div className="mb-1 flex items-center gap-1.5">
                    <MapPin className="h-4 w-4 text-emerald-500" />
                    <p className="text-[9px] font-bold uppercase tracking-widest text-slate-500">
                      Titik Pemberhentian Dominan
                    </p>
                  </div>
                  <p className="text-[11px] font-medium leading-snug text-slate-400">
                    Dihitung dari titik awal dan akhir sesi perjalanan.
                  </p>
                </div>
              </div>
              <RankingBars data={dominantStopRanking} />
              {dominantStop ? (
                <p className="mt-3 rounded-2xl bg-emerald-50 px-3 py-2 text-[10px] font-semibold text-emerald-700">
                  Stop tersering:{" "}
                  <span className="font-black">{dominantStop.label}</span>
                </p>
              ) : null}
            </div>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-3 gap-2 rounded-[20px] border border-slate-100 bg-slate-50/80 p-3">
          <div>
            <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400">
              Jarak / trip
            </p>
            <p className="mt-1 text-[18px] font-black text-[#0f1a3b]">
              {isLoadingSessions ? (
                <SkeletonStat width="w-16" height="h-4" />
              ) : (
                `${averageDistancePerTrip.toFixed(1)} km`
              )}
            </p>
          </div>
          <div>
            <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400">
              Durasi / trip
            </p>
            <p className="mt-1 text-[18px] font-black text-[#0f1a3b]">
              {isLoadingSessions ? (
                <SkeletonStat width="w-16" height="h-4" />
              ) : (
                `${averageDurationPerTrip.toFixed(0)} mnt`
              )}
            </p>
          </div>
          <div>
            <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400">
              Trip / armada
            </p>
            <p className="mt-1 text-[18px] font-black text-[#0f1a3b]">
              {isLoadingSessions ? (
                <SkeletonStat width="w-12" height="h-4" />
              ) : (
                sessionsPerBuggy.toFixed(1)
              )}
            </p>
          </div>
        </div>

        {/* Footer info */}
        <p className="mt-4 text-center text-[10px] leading-relaxed text-slate-400">
          *Statistik bulanan dihitung dari sesi perjalanan, sedangkan status
          armada memakai data GPS live terbaru.
        </p>
      </div>
    </section>
  );
}
