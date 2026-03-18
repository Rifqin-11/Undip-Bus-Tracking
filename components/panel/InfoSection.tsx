export function InfoSection() {
  return (
    <div className="rounded-3xl border border-slate-200/80 bg-white/70 p-3">
      <h2 className="mb-3 text-[17px] font-semibold text-slate-900 xl:mb-2.5 xl:text-[16px]">
        Informasi Sistem
      </h2>
      <div className="space-y-2.5 text-[13px] text-slate-700 xl:space-y-2 xl:text-[12px]">
        <p className="rounded-2xl border-2 border-slate-200 bg-white p-3 xl:border xl:p-2.5">
          Monitoring posisi buggy realtime berbasis GPS + Google Maps.
        </p>
        <p className="rounded-2xl border-2 border-slate-200 bg-white p-3 xl:border xl:p-2.5">
          Estimasi ETA halte dihitung dari kecepatan dan posisi kendaraan.
        </p>
        <p className="rounded-2xl border-2 border-slate-200 bg-white p-3 xl:border xl:p-2.5">
          Crowd level berasal dari pengolahan citra kamera (longgar, hampir
          penuh, penuh).
        </p>
      </div>
    </div>
  );
}
