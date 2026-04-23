import type { Buggy } from "@/types/buggy";
import { getBuggyStopNameAtOffset } from "@/lib/transit/buggy-route-utils";

type AdminBuggyCardProps = {
  buggy: Buggy;
  activeZones: string[];
  onClick: () => void;
};

export function AdminBuggyCard({
  buggy,
  activeZones,
  onClick,
}: AdminBuggyCardProps) {
  const currentStop = getBuggyStopNameAtOffset(buggy, 0);
  const nextStop = getBuggyStopNameAtOffset(buggy, 1);

  // Example "108" -> "B02", "city bus" -> "Rute Kampus"
  const rawCode = buggy.code.replace(/\D/g, "") || buggy.code;

  return (
    <button
      type="button"
      onClick={onClick}
      className="group w-full rounded-[20px] border border-slate-200/80 bg-white py-2.5 px-3 text-left transition-all hover:bg-slate-50 hover:shadow-sm hover:border-[#0f1a3b]/20 active:scale-[0.98] outline-none"
    >
      <div className="flex items-center justify-between gap-2.5">
        {/* Left: Image & Titles */}
        <div className="flex flex-1 items-center gap-3">
           {/* Image Container */}
           <div className="h-[36px] w-[54px] shrink-0 overflow-hidden flex items-center justify-center grayscale-[0.2] transition group-hover:grayscale-0">
             <img src="/buggy.webp" alt="buggy" className="w-full h-full object-contain mix-blend-multiply opacity-90" />
           </div>
           
           {/* Titles */}
           <div className="flex flex-col justify-center">
             <div className="flex items-baseline gap-1.5">
                <span className="text-[17px] font-bold text-slate-800 tracking-tight leading-none">{buggy.name}</span>
             </div>
             
             {/* Geofence Zones (Optional) */}
             {activeZones.length > 0 && (
               <div className="mt-1 flex flex-wrap gap-1">
                 {activeZones.map(zone => (
                   <span key={zone} className="text-[8px] font-bold tracking-wider uppercase text-blue-600 bg-blue-50/80 px-1.5 py-0.5 rounded-md">
                     {zone}
                   </span>
                 ))}
               </div>
             )}
           </div>
        </div>

        {/* Right: Track/Detail Button */}
        <div className="shrink-0 self-start mt-0.5">
          <span className="rounded-full border-[1.5px] border-slate-200 bg-white px-3.5 py-1 text-[10px] font-bold text-slate-700 shadow-sm transition group-hover:border-slate-300">
            Track
          </span>
        </div>
      </div>

      {/* Bottom Track / Status Line */}
      <div className="mt-2.5 flex flex-wrap items-center gap-x-2 gap-y-1.5 pr-1">
         {/* The colored line & dot */}
         <div className="flex items-center shrink-0">
           <div className={`h-[2px] w-5 bg-gradient-to-r from-transparent ${buggy.isActive ? 'to-emerald-400' : 'to-slate-300'} rounded-full mr-1.5`} />
           <div className={`h-[6px] w-[6px] rounded-full ${buggy.isActive ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)]' : 'bg-slate-300'}`} />
         </div>
         {/* ETA Text */}
         {buggy.isActive ? (
           <p className="text-[10px] font-medium text-slate-600">
             Tiba dlm <span className="font-bold text-slate-800">{buggy.etaMinutes} mnt</span>
           </p>
         ) : (
           <p className="text-[10px] font-bold text-slate-400 italic">
             Sedang tidak beroperasi
           </p>
         )}
         
         {/* Loop/Refresh Icon & Interval */}
         {buggy.isActive && (
           <div className="ml-auto flex items-center gap-1.5 text-[9px] text-slate-400 font-semibold uppercase tracking-wide">
             <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
               <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
             </svg>
             <span>Tiap 5 mnt</span>
           </div>
         )}
      </div>
    </button>
  );
}
