"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  XAxis,
} from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import type { ChartDatum } from "@/components/admin/statistics/types";

export function SmoothAreaChart({
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

export function SmoothBarChart({
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

export function RankingBars({
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
