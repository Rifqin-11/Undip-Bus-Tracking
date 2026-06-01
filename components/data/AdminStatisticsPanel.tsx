"use client";

import {
  useState,
  useEffect,
  useMemo,
  useRef,
  type ReactNode,
} from "react";
import { useTranslation } from "react-i18next";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  XAxis,
} from "recharts";
import { SkeletonStat, Skeleton } from "@/components/ui/Skeleton";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { useLocale } from "@/lib/i18n/client";
import { isBuggyRealtimeReachable } from "@/lib/buggy/connection-status";
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
const IDLE_SPEED_THRESHOLD_KMH = 1;

function formatDelta(current: number, previous: number, newLabel: string): string {
  if (previous <= 0) return current > 0 ? newLabel : "0%";
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
  value: ReactNode;
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

function formatMinutes(value: number, minuteLabel: string, hourLabel: string) {
  if (value < 60) return `${Math.round(value)} ${minuteLabel}`;
  const hours = Math.floor(value / 60);
  const minutes = Math.round(value % 60);
  return `${hours}${hourLabel} ${minutes}m`;
}

function easeOutCubic(progress: number) {
  return 1 - Math.pow(1 - progress, 3);
}

function useAnimatedNumber(value: number, durationMs = 900) {
  const [displayValue, setDisplayValue] = useState(0);
  const previousValueRef = useRef(0);

  useEffect(() => {
    if (
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ||
      durationMs <= 0
    ) {
      previousValueRef.current = value;
      const frameId = window.requestAnimationFrame(() => {
        setDisplayValue(value);
      });
      return () => {
        window.cancelAnimationFrame(frameId);
      };
    }

    const startValue = previousValueRef.current;
    const delta = value - startValue;
    const startedAt = performance.now();
    let frameId = 0;

    const animate = (time: number) => {
      const progress = Math.min(1, (time - startedAt) / durationMs);
      const nextValue = startValue + delta * easeOutCubic(progress);
      setDisplayValue(nextValue);

      if (progress < 1) {
        frameId = window.requestAnimationFrame(animate);
        return;
      }

      previousValueRef.current = value;
      setDisplayValue(value);
    };

    frameId = window.requestAnimationFrame(animate);

    return () => {
      window.cancelAnimationFrame(frameId);
    };
  }, [durationMs, value]);

  return displayValue;
}

function AnimatedStatNumber({
  value,
  formatter,
  durationMs,
}: {
  value: number;
  formatter: (value: number) => string;
  durationMs?: number;
}) {
  const animatedValue = useAnimatedNumber(value, durationMs);
  return <>{formatter(animatedValue)}</>;
}

function getNearestHalteName(lat: number, lng: number, unknownArea: string) {
  if (HALTE_LOCATIONS.length === 0) return unknownArea;

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

function getSessionPassengerLoad(session: BuggySession): number {
  const peak = session.passengerPeak;
  if (typeof peak === "number" && Number.isFinite(peak) && peak > 0) {
    return peak;
  }

  const average = session.passengerAvg;
  if (typeof average === "number" && Number.isFinite(average) && average > 0) {
    return average;
  }

  return 0;
}

function SmoothAreaChart({
  data,
  color = "#0f1a3b",
}: {
  data: ChartDatum[];
  color?: string;
}) {
  return (
    <div>
      <ChartContainer
        config={{ value: { label: "Value", color } }}
        className="h-24 w-full aspect-auto"
      >
        <AreaChart
          data={data}
          margin={{ left: 2, right: 2, top: 8, bottom: 0 }}
        >
          <defs>
            <linearGradient
              id={`fill-${color.replace("#", "")}`}
              x1="0"
              y1="0"
              x2="0"
              y2="1"
            >
              <stop offset="5%" stopColor={color} stopOpacity={0.26} />
              <stop offset="95%" stopColor={color} stopOpacity={0.03} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} strokeDasharray="3 3" />
          <XAxis
            dataKey="label"
            tickLine={false}
            axisLine={false}
            tick={false}
            height={4}
          />
          <ChartTooltip
            cursor={false}
            content={
              <ChartTooltipContent
                valueFormatter={(value) =>
                  Number(value).toLocaleString(undefined, {
                    maximumFractionDigits: 1,
                  })
                }
              />
            }
          />
          <Area
            dataKey="value"
            type="monotone"
            fill={`url(#fill-${color.replace("#", "")})`}
            stroke={color}
            strokeWidth={2.5}
            dot={false}
            activeDot={{ r: 4, strokeWidth: 0 }}
            isAnimationActive
            animationDuration={900}
            animationEasing="ease-out"
          />
        </AreaChart>
      </ChartContainer>
      <div className="-mt-1 flex justify-between text-[9px] font-bold text-slate-400">
        <span>{data[0]?.label ?? "-"}</span>
        <span>{data[Math.floor(data.length / 2)]?.label ?? "-"}</span>
        <span>{data[data.length - 1]?.label ?? "-"}</span>
      </div>
    </div>
  );
}

function SmoothBarChart({
  data,
  color = "#0f1a3b",
}: {
  data: ChartDatum[];
  color?: string;
}) {
  return (
    <ChartContainer
      config={{ value: { label: "Trip", color } }}
      className="h-16 w-full aspect-auto"
    >
      <BarChart data={data} margin={{ left: 0, right: 0, top: 4, bottom: 0 }}>
        <XAxis dataKey="label" tickLine={false} axisLine={false} tick={false} />
        <ChartTooltip
          cursor={{ fill: "rgba(15, 23, 42, 0.04)" }}
          content={<ChartTooltipContent />}
        />
        <Bar
          dataKey="value"
          fill={color}
          radius={[3, 3, 0, 0]}
          minPointSize={2}
          isAnimationActive
          animationDuration={850}
          animationEasing="ease-out"
        />
      </BarChart>
    </ChartContainer>
  );
}

function RankingBars({
  data,
  maxItems = 5,
  emptyLabel,
  localeTag,
}: {
  data: ChartDatum[];
  maxItems?: number;
  emptyLabel: string;
  localeTag: string;
}) {
  const visible = data.slice(0, maxItems);
  const maxValue = Math.max(1, ...visible.map((item) => item.value));

  if (visible.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-3 py-5 text-center text-[12px] font-semibold text-slate-400">
        {emptyLabel}
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
              {item.helper ?? item.value.toLocaleString(localeTag)}
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
  const { t } = useTranslation("admin");
  const locale = useLocale();
  const localeTag = locale === "id" ? "id-ID" : "en-US";
  const now = useMemo(() => new Date(), []);

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
      } catch {
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

  const activeBuggies = buggies.filter(isBuggyRealtimeReachable);
  const movingBuggies = activeBuggies.filter(
    (buggy) => Math.max(0, buggy.speedKmh) > IDLE_SPEED_THRESHOLD_KMH,
  );
  const idleBuggies = activeBuggies.filter(
    (buggy) => Math.max(0, buggy.speedKmh) <= IDLE_SPEED_THRESHOLD_KMH,
  );
  const stoppedBuggies = buggies.filter(
    (buggy) => !isBuggyRealtimeReachable(buggy),
  );
  const totalCapacity = buggies.reduce(
    (sum, buggy) => sum + Math.max(0, buggy.capacity),
    0,
  );
  const totalPassengers = buggies.reduce(
    (sum, buggy) => sum + Math.max(0, buggy.passengers),
    0,
  );
  const historicalPassengerTotal = filteredSessions.reduce(
    (sum, session) => sum + getSessionPassengerLoad(session),
    0,
  );
  const displayTotalPassengers =
    historicalPassengerTotal > 0 ? historicalPassengerTotal : totalPassengers;
  const averagePassengersPerDay =
    displayTotalPassengers / elapsedDaysInMonth;
  const activeRate =
    buggies.length > 0 ? (activeBuggies.length / buggies.length) * 100 : 0;
  const occupancyRate =
    totalCapacity > 0 ? (totalPassengers / totalCapacity) * 100 : 0;
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

  const busiestDay = dailyTrends.reduce(
    (best, item) => (item.count > best.count ? item : best),
    { day: 0, count: 0 },
  );

  const hourlyPassengerDemand = useMemo(() => {
    const buckets = Array.from({ length: 24 }, (_, hour) => ({
      label: `${String(hour).padStart(2, "0")}:00`,
      value: 0,
    }));

    for (const session of filteredSessions) {
      const startedAt = new Date(session.startedAt);
      if (Number.isNaN(startedAt.getTime())) continue;
      const hour = startedAt.getHours();
      buckets[hour].value += getSessionPassengerLoad(session);
    }

    const currentHour = new Date().getHours();
    buckets[currentHour].value += totalPassengers;

    return buckets.map((item) => ({
      ...item,
      value: Math.round(item.value),
    }));
  }, [filteredSessions, totalPassengers]);

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
        const areaName = getNearestHalteName(lat, lng, t("unknownArea"));
        areaCounts.set(areaName, (areaCounts.get(areaName) ?? 0) + 1);
      }
    }

    return Array.from(areaCounts.entries())
      .map(([label, value]) => ({
        label,
        value,
        helper: `${value.toLocaleString(localeTag)} ${t("points")}`,
      }))
      .sort((a, b) => b.value - a.value);
  }, [filteredSessions, localeTag, t]);

  const dominantStopRanking = useMemo(() => {
    const stopCounts = new Map<string, number>();

    for (const session of filteredSessions) {
      const points = session.path;
      if (points.length === 0) continue;

      const endpointCandidates = [points[0], points[points.length - 1]];
      for (const [lat, lng] of endpointCandidates) {
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
        const stopName = getNearestHalteName(lat, lng, t("unknownArea"));
        stopCounts.set(stopName, (stopCounts.get(stopName) ?? 0) + 1);
      }
    }

    return Array.from(stopCounts.entries())
      .map(([label, value]) => ({
        label,
        value,
        helper: `${value.toLocaleString(localeTag)} ${t("stops")}`,
      }))
      .sort((a, b) => b.value - a.value);
  }, [filteredSessions, localeTag, t]);

  const mostVisitedArea = areaTrafficRanking[0];
  const dominantStop = dominantStopRanking[0];

  // Generate month options (e.g. current month and past 5 months)
  const monthOptions = useMemo(() => {
    const opts = [];
    for (let i = 0; i < 6; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const val = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const label = d.toLocaleDateString(localeTag, {
        month: "long",
        year: "numeric",
      });
      opts.push({ value: val, label });
    }
    return opts;
  }, [localeTag, now]);

  return (
    <section className="space-y-3">
      <div className="rounded-3xl border border-slate-200/80 bg-white/70 p-4 lg:p-5">
        {/* Header */}
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-[18px] font-bold tracking-tight text-[#0f1a3b]">
              {t("operationalStatistics")}
            </h2>
            <p className="text-[11px] font-medium text-slate-500">
              {t("operationalStatisticsSummary")}
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

        <div className="mb-3 grid grid-cols-3 gap-2">
          <div className="rounded-[18px] border border-emerald-100 bg-emerald-50/70 p-3 shadow-[0_8px_20px_rgba(15,23,42,0.02)]">
            <div className="mb-2 flex items-center gap-1.5 text-emerald-600">
              <Activity className="h-4 w-4 shrink-0" />
              <p className="min-w-0 text-[9px] font-black uppercase tracking-widest">
                {t("activeVehicles")}
              </p>
            </div>
            <p className="text-[24px] font-black leading-none text-black">
              <AnimatedStatNumber
                value={movingBuggies.length}
                formatter={(value) => Math.round(value).toLocaleString(localeTag)}
              />
            </p>
          </div>

          <div className="rounded-[18px] border border-amber-100 bg-amber-50/70 p-3 shadow-[0_8px_20px_rgba(15,23,42,0.02)]">
            <div className="mb-2 flex items-center gap-1.5 text-amber-600">
              <Clock className="h-4 w-4 shrink-0" />
              <p className="min-w-0 text-[9px] font-black uppercase tracking-widest">
                {t("idleVehicles")}
              </p>
            </div>
            <p className="text-[24px] font-black leading-none text-black">
              <AnimatedStatNumber
                value={idleBuggies.length}
                formatter={(value) => Math.round(value).toLocaleString(localeTag)}
              />
            </p>
          </div>

          <div className="rounded-[18px] border border-red-200 bg-red-50 p-3 shadow-[0_8px_20px_rgba(15,23,42,0.02)]">
            <div className="mb-2 flex items-center gap-1.5 text-red-500">
              <Bus className="h-4 w-4 shrink-0" />
              <p className="min-w-0 text-[9px] font-black uppercase tracking-widest">
                {t("stoppedVehicles")}
              </p>
            </div>
            <p className="text-[24px] font-black leading-none text-black">
              <AnimatedStatNumber
                value={stoppedBuggies.length}
                formatter={(value) => Math.round(value).toLocaleString(localeTag)}
              />
            </p>
          </div>
        </div>

        {/* Top Card: Penumpang */}
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
                {t("total")}
                <br />
                {t("passengers")}
              </p>
            </div>
            <div className="flex items-end gap-2">
              <span className="text-[36px] font-black leading-none text-[#0f1a3b] tracking-tighter">
                <AnimatedStatNumber
                  value={displayTotalPassengers}
                  formatter={(value) =>
                    Math.round(value).toLocaleString(localeTag)
                  }
                />
              </span>
              <span className="mb-1.5 rounded-full bg-slate-100 px-1.5 py-0.5 text-[9px] font-bold text-slate-600">
                {historicalPassengerTotal > 0 ? selectedMonth : "live"}
              </span>
            </div>
          </div>

          <div className="h-16 w-px bg-slate-100/80 mx-2" />

          <div className="relative z-10 flex w-1/2 flex-col pl-3">
            <p className="mb-1 text-[10px] font-bold uppercase tracking-widest text-slate-400 leading-tight">
              {t("dailyAverage")}
            </p>
            <div className="flex items-end gap-1.5">
              <span className="text-[28px] font-black leading-none text-[#0f1a3b] tracking-tighter">
                <AnimatedStatNumber
                  value={averagePassengersPerDay}
                  formatter={(value) => Math.round(value).toLocaleString(localeTag)}
                />
              </span>
              <span className="mb-1 text-[11px] font-bold text-slate-400">
                {t("peoplePerDay")}
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
                  {t("passengerPeakTime")}
                </p>
              </div>
              <p className="text-[11px] font-medium leading-snug text-slate-400">
                {t("passengerPeakDescription")}
              </p>
            </div>
            <span className="shrink-0 rounded-full bg-slate-100 px-2 py-1 text-[9px] font-black text-[#0f1a3b]">
              {peakPassengerHour.value > 0
                ? (
                    <>
                      {peakPassengerHour.label} ·{" "}
                      <AnimatedStatNumber
                        value={peakPassengerHour.value}
                        formatter={(value) => Math.round(value).toLocaleString(localeTag)}
                      />{" "}
                      {t("peopleShort")}
                    </>
                  )
                : "-"}
            </span>
          </div>
          <SmoothAreaChart data={hourlyPassengerDemand} />
        </div>

        {/* Grid Bawah: Statistik Operasional */}
        <div className="overflow-hidden rounded-[20px] border border-slate-100 bg-white shadow-[0_8px_20px_rgba(15,23,42,0.02)] mb-3">
          <div className="grid grid-cols-2 border-b border-slate-100">
            <div className="border-r border-slate-100 p-3.5">
              <div className="mb-2 flex items-center gap-1.5">
                <Waypoints className="h-4 w-4 text-slate-400" />
                <p className="text-[9px] font-bold uppercase tracking-widest text-slate-500">
                  {t("totalTrips")}
                </p>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[20px] font-black text-[#0f1a3b]">
                  {isLoadingSessions ? (
                    <SkeletonStat width="w-14" height="h-5" />
                  ) : (
                    <AnimatedStatNumber
                      value={totalPerjalanan}
                      formatter={(value) =>
                        Math.round(value).toLocaleString(localeTag)
                      }
                    />
                  )}
                </span>
                <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[9px] font-bold text-slate-600">
                  {formatDelta(totalPerjalanan, previousTotalPerjalanan, t("new"))}
                </span>
              </div>
            </div>
            <div className="p-3.5">
              <div className="mb-2 flex items-center gap-1.5">
                <Zap className="h-4 w-4 text-slate-400" />
                <p className="text-[9px] font-bold uppercase tracking-widest text-slate-500">
                  {t("totalDistance")}
                </p>
              </div>
              <div className="flex items-center justify-between">
                <span className="flex items-baseline gap-1">
                  <span className="text-[20px] font-black text-[#0f1a3b]">
                    {isLoadingSessions ? (
                      <SkeletonStat width="w-12" height="h-5" />
                    ) : (
                      <AnimatedStatNumber
                        value={totalJarakKm}
                        formatter={(value) => value.toFixed(1)}
                      />
                    )}
                  </span>
                  <span className="text-[10px] font-bold text-slate-400">
                    km
                  </span>
                </span>
                <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[9px] font-bold text-slate-600">
                  {formatDelta(totalJarakKm, previousTotalJarakKm, t("new"))}
                </span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2">
            <div className="border-r border-slate-100 p-3.5">
              <div className="mb-2 flex items-center gap-1.5">
                <Timer className="h-4 w-4 text-slate-400" />
                <p className="text-[9px] font-bold uppercase tracking-widest text-slate-500">
                  {t("averageSpeedShort")}
                </p>
              </div>
              <span className="flex items-baseline gap-1">
                <span className="text-[20px] font-black text-[#0f1a3b]">
                  {isLoadingSessions ? (
                    <SkeletonStat width="w-12" height="h-5" />
                  ) : (
                    <AnimatedStatNumber
                      value={averageSpeedKmh}
                      formatter={(value) => value.toFixed(1)}
                    />
                  )}
                </span>
                <span className="text-[10px] font-bold text-slate-400">
                  {t("speedUnit")}
                </span>
              </span>
            </div>
            <div className="p-3.5">
              <div className="mb-2 flex items-center gap-1.5">
                <Clock className="h-4 w-4 text-slate-400" />
                <p className="text-[9px] font-bold uppercase tracking-widest text-slate-500">
                  {t("totalTime")}
                </p>
              </div>
              <span className="text-[20px] font-black text-[#0f1a3b]">
                {isLoadingSessions ? (
                  <SkeletonStat width="w-16" height="h-5" />
                ) : (
                  <AnimatedStatNumber
                    value={totalWaktuMenit}
                    formatter={(value) => {
                      const minutes = Math.max(0, value);
                      const hours = Math.floor(minutes / 60);
                      const remainingMinutes = Math.round(minutes % 60);
                      return `${hours}${t("hoursShort")} ${remainingMinutes}m`;
                    }}
                  />
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
                  {t("tripDelay")}
                </p>
              </div>
              <p className="text-[11px] font-medium leading-snug text-slate-400">
                {t("tripDelayDescription", {
                  duration:
                    delayTrend.targetDuration > 0
                      ? formatMinutes(
                          delayTrend.targetDuration,
                          t("minutesShort"),
                          t("hoursShort"),
                        )
                      : "-",
                })}
              </p>
            </div>
            <span className="shrink-0 rounded-full bg-amber-50 px-2 py-1 text-[9px] font-black text-amber-600">
              {peakDelay.value > 0
                ? (
                    <>
                      {peakDelay.label} ·{" "}
                      <AnimatedStatNumber
                        value={peakDelay.value}
                        formatter={(value) =>
                          formatMinutes(
                            value,
                            t("minutesShort"),
                            t("hoursShort"),
                          )
                        }
                      />
                    </>
                  )
                : t("normal")}
            </span>
          </div>
          <SmoothAreaChart data={delayTrend.data} color="#f59e0b" />
        </div>

        <div className="mt-3 overflow-hidden rounded-[20px] border border-slate-100 bg-white shadow-[0_8px_20px_rgba(15,23,42,0.02)]">
          <div className="grid grid-cols-2 border-b border-slate-100">
            <StatTile
              icon={<Bus className="h-4 w-4" />}
              label={t("activeFleet")}
              value={
                <>
                  <AnimatedStatNumber
                    value={activeBuggies.length}
                    formatter={(value) => Math.round(value).toLocaleString(localeTag)}
                  />
                  /{buggies.length.toLocaleString(localeTag)}
                </>
              }
              helper={t("activeFleetHelper", { rate: activeRate.toFixed(0) })}
              className="border-r border-slate-100"
              tone={activeBuggies.length > 0 ? "emerald" : "rose"}
            />
            <StatTile
              icon={<Activity className="h-4 w-4" />}
              label={t("seatUtilization")}
              value={
                <>
                  <AnimatedStatNumber
                    value={occupancyRate}
                    formatter={(value) => Math.round(value).toLocaleString(localeTag)}
                  />
                  %
                </>
              }
              helper={t("seatsFilledShort", {
                passengers: totalPassengers,
                capacity: totalCapacity,
              })}
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
              label={t("averageLiveSpeed")}
              value={
                <AnimatedStatNumber
                  value={averageLiveSpeed}
                  formatter={(value) => value.toFixed(1)}
                />
              }
              helper={t("highestSpeed", {
                code: fastestBuggy?.code ?? "-",
                speed: fastestBuggy
                  ? `${fastestBuggy.speedKmh.toFixed(1)} ${t("speedUnit")}`
                  : "",
              })}
              className="border-r border-slate-100"
              tone="navy"
            />
            <StatTile
              icon={<Battery className="h-4 w-4" />}
              label={t("batteryDrainPerTrip")}
              value={
                averageBatteryUsed === null
                  ? "-"
                  : (
                      <>
                        <AnimatedStatNumber
                          value={averageBatteryUsed}
                          formatter={(value) => value.toFixed(1)}
                        />
                        %
                      </>
                    )
              }
              helper={t("batteryDrainHelper")}
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
                {t("dailyTripActivity")}
              </p>
              <span className="rounded-full bg-white px-2 py-1 text-[9px] font-bold text-slate-500">
                {t("busiestDay", {
                  day:
                    busiestDay.count > 0
                      ? t("dayLabel", { day: busiestDay.day })
                      : "-",
                })}
              </span>
            </div>
            <SmoothBarChart
              data={dailyTrends.map((trend) => ({
                label: t("dayLabel", { day: trend.day }),
                value: trend.count,
              }))}
            />
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
                      {t("frequentArea")}
                    </p>
                  </div>
                  <p className="text-[11px] font-medium leading-snug text-slate-400">
                    {t("frequentAreaDescription")}
                  </p>
                </div>
              </div>
              <RankingBars
                data={areaTrafficRanking}
                emptyLabel={t("noData")}
                localeTag={localeTag}
              />
              {mostVisitedArea ? (
                <p className="mt-3 rounded-2xl bg-slate-50 px-3 py-2 text-[10px] font-semibold text-slate-500">
                  {t("dominantArea")}{" "}
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
                      {t("dominantStopTitle")}
                    </p>
                  </div>
                  <p className="text-[11px] font-medium leading-snug text-slate-400">
                    {t("dominantStopDescription")}
                  </p>
                </div>
              </div>
              <RankingBars
                data={dominantStopRanking}
                emptyLabel={t("noData")}
                localeTag={localeTag}
              />
              {dominantStop ? (
                <p className="mt-3 rounded-2xl bg-emerald-50 px-3 py-2 text-[10px] font-semibold text-emerald-700">
                  {t("dominantStop")}{" "}
                  <span className="font-black">{dominantStop.label}</span>
                </p>
              ) : null}
            </div>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-3 gap-2 rounded-[20px] border border-slate-100 bg-slate-50/80 p-3">
          <div>
            <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400">
              {t("distancePerTrip")}
            </p>
            <div className="mt-1 text-[18px] font-black text-[#0f1a3b]">
              {isLoadingSessions ? (
                <SkeletonStat width="w-16" height="h-4" />
              ) : (
                <>
                  <AnimatedStatNumber
                    value={averageDistancePerTrip}
                    formatter={(value) => value.toFixed(1)}
                  />{" "}
                  km
                </>
              )}
            </div>
          </div>
          <div>
            <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400">
              {t("durationPerTrip")}
            </p>
            <div className="mt-1 text-[18px] font-black text-[#0f1a3b]">
              {isLoadingSessions ? (
                <SkeletonStat width="w-16" height="h-4" />
              ) : (
                <>
                  <AnimatedStatNumber
                    value={averageDurationPerTrip}
                    formatter={(value) => Math.round(value).toLocaleString(localeTag)}
                  />{" "}
                  {t("minutesShort")}
                </>
              )}
            </div>
          </div>
          <div>
            <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400">
              {t("tripsPerFleet")}
            </p>
            <div className="mt-1 text-[18px] font-black text-[#0f1a3b]">
              {isLoadingSessions ? (
                <SkeletonStat width="w-12" height="h-4" />
              ) : (
                <AnimatedStatNumber
                  value={sessionsPerBuggy}
                  formatter={(value) => value.toFixed(1)}
                />
              )}
            </div>
          </div>
        </div>

        {/* Footer info */}
        <p className="mt-4 text-center text-[10px] leading-relaxed text-slate-400">
          {t("monthlyStatsFootnote")}
        </p>
      </div>
    </section>
  );
}
