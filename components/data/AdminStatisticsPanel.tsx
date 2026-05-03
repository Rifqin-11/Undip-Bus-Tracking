"use client";

import { useEffect, useState } from "react";
import { ChevronLeft, TrendingUp, TrendingDown, Users, Route, Zap, Timer, BarChart3 } from "lucide-react";

type StatisticsData = {
  currentMonth: {
    totalTrips: number;
    totalDistanceKm: number;
    avgSpeedKmh: number;
    totalDurationMin: number;
    totalPassengers: number;
    avgPassengersPerDay: number;
  };
  trends: {
    trips: number;
    distance: number;
    passengers: number;
  };
};

type AdminStatisticsPanelProps = {};

export function AdminStatisticsPanel() {
  const [selectedMonth, setSelectedMonth] = useState<string>(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });
  const [data, setData] = useState<StatisticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchStats() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/admin/statistics?date=${selectedMonth}`);
        if (!res.ok) throw new Error("Gagal mengambil data statistik");
        const json = await res.json();
        if (!json.success) throw new Error(json.error || "Terjadi kesalahan");
        setData(json.data);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    void fetchStats();
  }, [selectedMonth]);

  const getMonthName = () => {
    const [year, month] = selectedMonth.split("-");
    const d = new Date(Number(year), Number(month) - 1, 1);
    return d.toLocaleDateString("id-ID", { month: "long", year: "numeric" });
  };

  if (loading) {
    return (
      <section className="space-y-3">
        <div className="rounded-3xl border border-slate-200/80 bg-white/70 p-4 min-h-[300px] flex items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#0f1a3b] border-t-transparent" />
            <p className="text-[12px] font-medium text-slate-500 tracking-wide">Memuat statistik...</p>
          </div>
        </div>
      </section>
    );
  }

  if (error || !data) {
    return (
      <section className="space-y-3">
        <div className="rounded-3xl border border-slate-200/80 bg-white/70 p-4">
          <div className="mb-4 flex items-center gap-3">
            <h2 className="text-[17px] font-bold text-slate-900 tracking-tight">Statistik Operasional</h2>
          </div>
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-[13px] font-medium text-rose-700 text-center">
            {error || "Data tidak tersedia"}
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-3">
      <div className="rounded-3xl border border-slate-200/80 bg-white/70 p-3 lg:p-4">
        {/* Header */}
        <div className="mb-5 flex items-center justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-[17px] font-bold text-slate-900 tracking-tight">
              Statistik Operasional
            </h2>
            <p className="text-[11px] font-medium text-slate-500">
              Performa armada bulan ini dibandingkan bulan lalu
            </p>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-[12px] font-bold text-slate-700 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
            />
          </div>
        </div>

        {/* Hero Metric: Penumpang */}
        <div className="mb-3 flex flex-col sm:flex-row sm:items-center justify-between rounded-[20px] border border-slate-200/80 bg-white p-4 lg:p-5 shadow-sm relative overflow-hidden transition-all hover:border-[#0f1a3b]/20">
          <div className="absolute -right-4 -top-4 opacity-[0.03] pointer-events-none">
            <Users className="h-40 w-40" />
          </div>
          
          <div className="relative z-10 flex-1">
            <div className="flex items-center gap-2.5">
              <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#0f1a3b] text-white shadow-sm">
                <Users className="h-4.5 w-4.5" />
              </div>
              <h3 className="text-[12px] font-extrabold text-slate-500 uppercase tracking-widest">
                Total Penumpang
              </h3>
            </div>
            <div className="mt-3 flex items-end gap-3">
              <span className="text-[42px] font-black text-slate-800 tracking-tighter leading-none">
                {data.currentMonth.totalPassengers.toLocaleString("id-ID")}
              </span>
              <TrendBadge trend={data.trends.passengers} />
            </div>
          </div>

          <div className="my-4 hidden h-16 w-px bg-slate-200 sm:block mx-6"></div>

          <div className="relative z-10 flex-1 border-t border-slate-100 pt-4 sm:border-t-0 sm:pt-0">
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1">
              Rata-rata Harian
            </p>
            <div className="flex items-baseline gap-1.5">
              <span className="text-[28px] font-black text-slate-800 tracking-tight leading-none">
                {data.currentMonth.avgPassengersPerDay}
              </span>
              <span className="text-[13px] font-bold text-slate-400">
                org / hari
              </span>
            </div>
            <div className="mt-2.5 h-1.5 w-full max-w-[120px] rounded-full bg-slate-100 overflow-hidden">
              <div className="h-full rounded-full bg-[#0f1a3b]" style={{ width: '100%' }} />
            </div>
          </div>
        </div>

        {/* Secondary Metrics: 2x2 Grid for narrow sidebar */}
        <div className="grid grid-cols-2 gap-px rounded-[20px] border border-slate-200/80 bg-slate-100 shadow-sm overflow-hidden">
          <div className="bg-white">
            <SecondaryStat
              title="Total Perjalanan"
              value={data.currentMonth.totalTrips.toLocaleString("id-ID")}
              icon={<Route className="h-4 w-4" />}
              trend={data.trends.trips}
            />
          </div>
          <div className="bg-white">
            <SecondaryStat
              title="Total Jarak"
              value={data.currentMonth.totalDistanceKm.toString()}
              unit="km"
              icon={<Zap className="h-4 w-4" />}
              trend={data.trends.distance}
            />
          </div>
          <div className="bg-white">
            <SecondaryStat
              title="Rata-rata Kec."
              value={data.currentMonth.avgSpeedKmh.toString()}
              unit="km/h"
              icon={<Timer className="h-4 w-4" />}
              trend={null}
            />
          </div>
          <div className="bg-white">
            <SecondaryStat
              title="Total Waktu"
              value={`${Math.round(data.currentMonth.totalDurationMin / 60)}h ${data.currentMonth.totalDurationMin % 60}m`}
              icon={<Timer className="h-4 w-4" />}
              trend={null}
            />
          </div>
        </div>

        <p className="mt-4 text-center text-[10px] font-medium leading-relaxed text-slate-400">
          *Statistik dihitung berdasarkan data operasional buggy di bulan ini dibandingkan dengan bulan lalu.
        </p>
      </div>
    </section>
  );
}

function TrendBadge({ trend }: { trend: number | null }) {
  if (trend === null) return null;
  const isPositive = trend > 0;
  const isNegative = trend < 0;

  return (
    <div
      className={`mb-1 flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[10px] font-bold ${
        isPositive
          ? "bg-emerald-100/80 text-emerald-700"
          : isNegative
          ? "bg-rose-100/80 text-rose-700"
          : "bg-slate-100 text-slate-600"
      }`}
    >
      {isPositive && <TrendingUp className="h-3 w-3" />}
      {isNegative && <TrendingDown className="h-3 w-3" />}
      <span>{Math.abs(trend)}%</span>
    </div>
  );
}

function SecondaryStat({
  title,
  value,
  unit,
  icon,
  trend,
}: {
  title: string;
  value: string;
  unit?: string;
  icon: React.ReactNode;
  trend: number | null;
}) {
  return (
    <div className="flex h-full flex-col p-3 transition-colors hover:bg-slate-50/50">
      <div className="mb-2 flex items-center gap-1.5">
        <div className="text-slate-400">{icon}</div>
        <p className="truncate text-[10px] font-bold uppercase tracking-wider text-slate-500">
          {title}
        </p>
      </div>
      <div className="mt-auto flex flex-col items-start gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex items-baseline gap-1">
          <p className="leading-none tracking-tight text-[18px] font-black text-slate-800">
            {value}
          </p>
          {unit && (
            <span className="text-[11px] font-bold text-slate-400">{unit}</span>
          )}
        </div>
        {trend !== null && <TrendBadge trend={trend} />}
      </div>
    </div>
  );
}
