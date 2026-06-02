import { useMemo, useState } from "react";
import Image from "next/image";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { SpinnerIcon } from "@/components/ui/Icons";
import { fmtDate, fmtTime } from "@/lib/utils/format-time";
import type { BuggySession } from "@/types/buggy-session";

type ActiveBuggyHistorySummary = {
  id: string;
  code: string;
  name: string;
  norm: string;
  sessions: BuggySession[];
};

type DailyHistorySummary = {
  activeBuggyCount: number;
  sessionCount: number;
  totalDistanceKm: number;
  totalDurationMinutes: number;
};

type HistoryDateBuggyListProps = {
  selectedDate: string;
  availableDates: string[];
  activeBuggySummaries: ActiveBuggyHistorySummary[];
  dailySummary: DailyHistorySummary;
  refreshing: boolean;
  onDateChange: (date: string) => void;
  onSelectBuggy: (buggyId: string) => void;
};

function parseDateInput(value: string): Date {
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return new Date();
  return new Date(year, month - 1, day);
}

function formatDateInput(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getMondayFirstOffset(date: Date): number {
  return (new Date(date.getFullYear(), date.getMonth(), 1).getDay() + 6) % 7;
}

function getMonthDays(date: Date): number[] {
  const days = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  return Array.from({ length: days }, (_, index) => index + 1);
}

export function HistoryDateBuggyList({
  selectedDate,
  availableDates,
  activeBuggySummaries,
  dailySummary,
  refreshing,
  onDateChange,
  onSelectBuggy,
}: HistoryDateBuggyListProps) {
  const { t, i18n } = useTranslation("history");
  const { t: tCommon } = useTranslation("common");
  const hasSessions = activeBuggySummaries.length > 0;
  const [visibleMonthOverride, setVisibleMonthOverride] =
    useState<Date | null>(null);
  const availableDateSet = useMemo(
    () => new Set(availableDates),
    [availableDates],
  );
  const selectedDateObject = useMemo(
    () => parseDateInput(selectedDate),
    [selectedDate],
  );
  const selectedMonthDate = useMemo(
    () =>
      new Date(
        selectedDateObject.getFullYear(),
        selectedDateObject.getMonth(),
        1,
      ),
    [selectedDateObject],
  );
  const visibleMonth = visibleMonthOverride ?? selectedMonthDate;
  const monthDays = useMemo(() => getMonthDays(visibleMonth), [visibleMonth]);
  const monthOffset = useMemo(
    () => getMondayFirstOffset(visibleMonth),
    [visibleMonth],
  );
  const monthLabel = visibleMonth.toLocaleDateString(
    i18n.language === "en" ? "en-US" : "id-ID",
    { month: "long", year: "numeric" },
  );
  const weekdayLabels =
    i18n.language === "en"
      ? ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
      : ["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"];
  const goToPreviousMonth = () => {
    setVisibleMonthOverride((current) => {
      const base = current ?? selectedMonthDate;
      return new Date(base.getFullYear(), base.getMonth() - 1, 1);
    });
  };
  const goToNextMonth = () => {
    setVisibleMonthOverride((current) => {
      const base = current ?? selectedMonthDate;
      return new Date(base.getFullYear(), base.getMonth() + 1, 1);
    });
  };
  const handleSelectDay = (day: number) => {
    const nextDate = formatDateInput(
      new Date(visibleMonth.getFullYear(), visibleMonth.getMonth(), day),
    );
    setVisibleMonthOverride(null);
    onDateChange(nextDate);
  };

  return (
    <section className="space-y-3">
      <div className="overflow-hidden rounded-[28px] border border-slate-200/80 bg-white shadow-[0_18px_45px_rgba(15,23,42,0.08)]">
        <div className="border-b border-slate-100 p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="mb-1 flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                <CalendarDays className="h-3.5 w-3.5 text-[#0f1a3b]" />
                {t("sessionHistory")}
              </p>
              <h2 className="text-[21px] font-bold leading-none text-slate-950">
                {monthLabel}
              </h2>
              <p className="mt-2 max-w-[260px] text-[11px] leading-relaxed text-slate-400">
                {t("dateBasedHistory")}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {refreshing && (
                <SpinnerIcon className="h-3.5 w-3.5 text-slate-400" />
              )}
              <span className="rounded-full bg-[#0f1a3b] px-2.5 py-1 text-[10px] font-bold text-white">
                {tCommon("units", { count: dailySummary.activeBuggyCount })}
              </span>
            </div>
          </div>

          <div className="mt-4 rounded-[24px] border border-slate-200 bg-slate-50/80 p-2.5">
            <div className="mb-3 flex items-center justify-between gap-2 px-1">
              <button
                type="button"
                onClick={goToPreviousMonth}
                className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 shadow-sm transition hover:border-slate-900 hover:bg-slate-900 hover:text-white active:scale-95"
                aria-label="Previous month"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <div className="text-center">
                <p className="text-[13px] font-bold text-slate-950">
                  {fmtDate(selectedDate)}
                </p>
                <p className="mt-0.5 text-[10px] font-medium text-slate-400">
                  {t("chooseDate")}
                </p>
              </div>
              <button
                type="button"
                onClick={goToNextMonth}
                className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 shadow-sm transition hover:border-slate-900 hover:bg-slate-900 hover:text-white active:scale-95"
                aria-label="Next month"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>

            <div className="grid grid-cols-7 gap-1">
              {weekdayLabels.map((label) => (
                <div
                  key={label}
                  className="flex h-6 items-center justify-center text-[9px] font-bold uppercase text-slate-400"
                >
                  {label}
                </div>
              ))}
              {Array.from({ length: monthOffset }).map((_, index) => (
                <div key={`blank-${index}`} className="h-10" />
              ))}
              {monthDays.map((day) => {
                const date = formatDateInput(
                  new Date(
                    visibleMonth.getFullYear(),
                    visibleMonth.getMonth(),
                    day,
                  ),
                );
                const isSelected = date === selectedDate;
                const hasSession = availableDateSet.has(date);

                return (
                  <button
                    key={date}
                    type="button"
                    onClick={() => handleSelectDay(day)}
                    className={`relative flex h-10 flex-col items-center justify-center rounded-2xl text-[12px] font-bold transition active:scale-95 ${
                      isSelected
                        ? "bg-[#0f1a3b] text-white shadow-[0_10px_22px_rgba(15,26,59,0.25)]"
                        : hasSession
                          ? "bg-white text-slate-900 shadow-sm hover:bg-slate-100"
                          : "text-slate-400 hover:bg-white"
                    }`}
                  >
                    <span>{day}</span>
                    <span
                      className={`mt-0.5 h-1.5 w-1.5 rounded-full ${
                        hasSession
                          ? isSelected
                            ? "bg-sky-300"
                            : "bg-sky-500"
                          : "bg-transparent"
                      }`}
                    />
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-[28px] border border-slate-200/80 bg-white/85 p-3 shadow-[0_14px_35px_rgba(15,23,42,0.06)]">
        <div className="mb-3 flex items-center justify-between gap-2 px-1">
          <div>
            <p className="text-[14px] font-bold text-slate-900">
              {t("activeBuggyOnDate")}
            </p>
            <p className="mt-0.5 text-[11px] text-slate-400">
              {t("sessions", { count: dailySummary.sessionCount })}
            </p>
          </div>
          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-semibold text-slate-500">
            {fmtDate(selectedDate)}
          </span>
        </div>

        {!hasSessions ? (
          <p className="py-5 text-center text-[12px] text-slate-400">
            {t("noSessionOnDate")}
          </p>
        ) : (
          <div className="space-y-2">
            {activeBuggySummaries.map((summary) => {
              const latestSession = summary.sessions[0];
              const latestActivityAt =
                latestSession?.endedAt || latestSession?.startedAt;

              return (
                <button
                  key={summary.id}
                  type="button"
                  onClick={() => onSelectBuggy(summary.id)}
                  className="group w-full rounded-[22px] border border-slate-200/80 bg-white p-2.5 text-left outline-none transition-all hover:border-[#0f1a3b]/30 hover:shadow-[0_12px_28px_rgba(15,23,42,0.08)] active:scale-[0.98]"
                >
                  <div className="flex items-center justify-between gap-2.5">
                    <div className="flex min-w-0 flex-1 items-center gap-3">
                      <div className="relative flex h-[52px] w-[70px] shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-slate-50 transition group-hover:bg-emerald-50">
                        <Image
                          src="/buggy.webp"
                          alt="buggy"
                          fill
                          sizes="54px"
                          className="h-full w-full object-contain p-1 opacity-90 mix-blend-multiply"
                        />
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-[17px] font-bold leading-none text-slate-900">
                          {summary.name}
                        </p>
                        <p className="mt-1.5 text-[10px] font-semibold text-slate-400">
                          {summary.code} · {t("sessions", { count: summary.sessions.length })}
                        </p>
                      </div>
                    </div>
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 shadow-sm transition-all group-hover:border-slate-900 group-hover:bg-slate-900 group-hover:text-white">
                      <ChevronRight className="h-3 w-3 text-slate-500 group-hover:text-white" />
                    </span>
                  </div>

                  <div className="mt-2.5 flex items-center justify-between gap-2 rounded-2xl bg-slate-50 px-3 py-2">
                    <p className="text-[10px] font-semibold text-slate-500">
                      {t("latest")} <span className="text-slate-900">{fmtTime(latestActivityAt)}</span>
                    </p>
                    {latestSession?.isOngoing && (
                      <span className="flex items-center gap-1 rounded-full border border-blue-100 bg-blue-50/80 px-2 py-0.5 text-[9px] font-bold uppercase text-blue-600">
                        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-blue-500" />
                        {t("live")}
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
