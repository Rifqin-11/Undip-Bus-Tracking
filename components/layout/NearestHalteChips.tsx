import { MapPinSolidIcon } from "@/components/ui/Icons";
import type { HaltePoint } from "@/types/buggy";

type NearestHalteChipsProps = {
  haltes: Array<HaltePoint & { distanceMeters?: number }>;
  onPick: (halteId: string) => void;
  /** Tailwind class untuk posisi top (default: "top-28"). */
  topClass?: string;
};

/**
 * Daftar chip horizontal halte rekomendasi (mobile only).
 * Klik chip → panggil `onPick(halteId)`.
 */
export function NearestHalteChips({
  haltes,
  onPick,
  topClass = "top-28",
}: NearestHalteChipsProps) {
  if (haltes.length === 0) return null;

  return (
    <section
      className={`absolute left-1/2 z-40 w-[min(92vw,420px)] -translate-x-1/2 xl:hidden ${topClass}`}
    >
      <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {haltes.map((halte) => (
          <button
            key={halte.id}
            type="button"
            className="shrink-0 flex items-center gap-2 rounded-full border border-white/35 bg-slate-900/50 px-3 py-1.5 text-white backdrop-blur-md transition active:scale-[0.98]"
            onClick={() => onPick(halte.id)}
          >
            <MapPinSolidIcon className="h-4 w-4 shrink-0 text-white" />
            <p className="text-[12px] font-bold leading-none">{halte.name}</p>
          </button>
        ))}
      </div>
    </section>
  );
}
