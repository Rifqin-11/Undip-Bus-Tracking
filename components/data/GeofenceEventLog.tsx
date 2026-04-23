import type { GeofenceEvent } from "@/types/geofence";

type GeofenceEventLogProps = {
  events: GeofenceEvent[];
};

export function GeofenceEventLog({ events }: GeofenceEventLogProps) {
  return (
    <div className="rounded-3xl border border-slate-200/80 bg-white/70 p-3">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-[17px] font-semibold text-slate-900">Event Geofence</h2>
        {events.length > 0 && (
          <span className="rounded-full bg-[#0f1a3b] px-2.5 py-1 text-[10px] font-semibold text-white">
            {events.length}
          </span>
        )}
      </div>
      <div className="max-h-72 space-y-1.5 overflow-y-auto pr-1">
        {events.length === 0 ? (
          <p className="py-2 text-[12px] text-slate-400">Belum ada event.</p>
        ) : (
          events.map((event) => (
            <div
              key={event.id}
              className="flex items-start gap-3 rounded-2xl border border-slate-100 bg-white px-3 py-2.5"
            >
              <div
                className={`mt-0.5 h-2 w-2 shrink-0 rounded-full ${
                  event.type === "ENTER" ? "bg-emerald-500" : "bg-rose-400"
                }`}
              />
              <div className="min-w-0 flex-1">
                <p className="text-[12px] font-semibold text-slate-800">
                  {event.buggyName}{" "}
                  <span className={event.type === "ENTER" ? "text-emerald-600" : "text-rose-500"}>
                    {event.type === "ENTER" ? "masuk" : "keluar"}
                  </span>{" "}
                  {event.geofenceName}
                </p>
                <p className="mt-0.5 text-[10px] text-slate-400">
                  {new Date(event.timestamp).toLocaleString("id-ID", { hour12: false })}
                </p>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
