import type { Buggy } from "@/types/buggy";

export function RuteSection({ buggies }: { buggies: Buggy[] }) {
  return (
    <div className="rounded-3xl border border-slate-200/80 bg-white/70 p-3">
      <h2 className="mb-3 text-[17px] font-semibold text-slate-900 xl:mb-2.5 xl:text-[16px]">
        Rute Aktif
      </h2>
      <div className="space-y-2.5 xl:space-y-2">
        {buggies.map((buggy) => (
          <div
            key={buggy.id}
            className="rounded-2xl border-2 border-slate-200 bg-white p-3 xl:border xl:p-2.5"
          >
            <p className="text-[14px] font-semibold text-slate-900 xl:text-[13px]">
              {buggy.name}
            </p>
            <p className="text-[13px] text-slate-600 xl:text-[12px]">
              Tujuan: {buggy.routeLabel}
            </p>
            <p className="text-[12px] text-slate-500 xl:text-[11px]">
              ETA {buggy.etaMinutes} menit • {buggy.speedKmh} km/h
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
