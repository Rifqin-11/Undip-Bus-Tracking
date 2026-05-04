import React from "react";
import { MapPinIcon, BuggyIcon } from "@/components/ui/Icons";

export function InfoPanel() {
  return (
    <div className="rounded-3xl border border-slate-200/80 bg-white/70 p-3">
      {/* Header */}
      <div className="mb-3 flex items-start justify-between gap-2">
        <div>
          <h2 className="text-[17px] font-bold tracking-tight text-slate-900">
            Informasi Bus Kampus
          </h2>
          <p className="text-[11px] text-slate-400">
            Solusi Nyaman & Ramah Lingkungan
          </p>
        </div>
      </div>

      <div className="space-y-2">
        {/* Tentang */}
        <div className="rounded-[20px] border border-slate-200/80 bg-white p-3.5">
          <p className="text-[12px] leading-relaxed text-slate-500">
            Universitas Diponegoro (UNDIP) berkomitmen untuk memberikan pelayanan terbaik bagi civitas akademika dengan menyediakan Bus Kampus. Solusi transportasi yang nyaman, ramah lingkungan, dan <strong className="text-slate-800">bebas biaya</strong>.
          </p>
        </div>

        {/* Jam Operasional & Armada */}
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-[20px] border border-slate-200/80 bg-white p-3.5">
            <div className="mb-1.5 flex items-center gap-1.5 text-indigo-500">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
              <h3 className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Jadwal</h3>
            </div>
            <p className="text-[13px] font-bold text-slate-800">Senin - Jumat</p>
            <p className="text-[11px] text-slate-500">07.00 – 17.00 WIB</p>
          </div>
          <div className="rounded-[20px] border border-slate-200/80 bg-white p-3.5">
            <div className="mb-1.5 flex items-center gap-1.5 text-emerald-500">
              <BuggyIcon className="h-3.5 w-3.5" />
              <h3 className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Armada</h3>
            </div>
            <p className="text-[13px] font-bold text-slate-800">4 Bus EV</p>
            <p className="text-[11px] text-slate-500">2 Rute Aktif</p>
          </div>
        </div>

        {/* Rute Details */}
        <div className="rounded-[20px] border border-slate-200/80 bg-white p-3.5">
          <h3 className="mb-2.5 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-slate-400">
            <MapPinIcon className="h-3.5 w-3.5" /> Rute Tersedia
          </h3>
          <div className="space-y-2.5">
            <div className="flex items-start gap-2.5">
              <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-100 text-[10px] font-bold text-blue-600">1</div>
              <div>
                <p className="text-[13px] font-bold text-slate-800">Lingkar Kampus</p>
                <p className="text-[11px] text-slate-500">Putar keliling Tembalang</p>
              </div>
            </div>
            <div className="flex items-start gap-2.5">
              <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-rose-100 text-[10px] font-bold text-rose-600">2</div>
              <div>
                <p className="text-[13px] font-bold text-slate-800">Pusat Kota</p>
                <p className="text-[11px] text-slate-500">Tembalang – Simpang Lima (PP)</p>
              </div>
            </div>
          </div>
        </div>

        {/* Tata Cara */}
        <div className="rounded-[20px] border border-slate-200/80 bg-white p-3.5">
          <h3 className="mb-2.5 text-[10px] font-bold uppercase tracking-widest text-slate-400">
            Tata Cara Naik
          </h3>
          <ul className="space-y-1.5 text-[11px] leading-relaxed text-slate-500">
            <li className="flex items-start gap-2">
              <span className="text-emerald-500 mt-0.5 font-bold">✓</span>
              <span>Tunjukkan <b>KTM/KTD</b> ke petugas.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-emerald-500 mt-0.5 font-bold">✓</span>
              <span>Naik/turun <b>hanya</b> di halte resmi.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-emerald-500 mt-0.5 font-bold">✓</span>
              <span>Jaga kebersihan fasilitas (AC, CCTV, dll).</span>
            </li>
          </ul>
        </div>

        {/* Kontak */}
        <div className="rounded-[20px] bg-[#0f1a3b] p-4 text-white shadow-[0_8px_20px_rgba(15,26,59,0.15)]">
          <h3 className="mb-2.5 text-[10px] font-bold uppercase tracking-widest text-slate-400">Kontak Info</h3>
          <div className="space-y-2 text-[11px]">
            <div className="flex items-center gap-2">
              <svg className="h-3.5 w-3.5 text-slate-400" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>
              <a href="tel:0247460024" className="text-blue-200 hover:text-white">(024) 7460024</a>
            </div>
            <div className="flex items-center gap-2">
              <svg className="h-3.5 w-3.5 text-slate-400" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path><polyline points="22,6 12,13 2,6"></polyline></svg>
              <a href="mailto:humas@undip.ac.id" className="text-blue-200 hover:text-white">humas@undip.ac.id</a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
