export default function AdminProfilePage() {
  return (
    <main className="min-h-screen bg-[#f5f7fb] px-4 py-6 text-slate-900">
      <section className="mx-auto w-full max-w-md rounded-3xl border border-slate-200 bg-white p-5 shadow-[0_16px_50px_rgba(15,23,42,0.10)]">
        <div className="mb-5 flex items-center gap-3">
          <div className="grid size-12 place-items-center rounded-full bg-[#0f1a3b] text-lg font-black text-white">
            A
          </div>
          <div>
            <h1 className="text-lg font-extrabold tracking-tight">
              Manage Profile
            </h1>
            <p className="text-xs font-semibold text-slate-400">
              SIMOBI Operator
            </p>
          </div>
        </div>

        <div className="space-y-3">
          <div className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3">
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
              Nama
            </p>
            <p className="mt-1 text-sm font-bold text-slate-900">Admin</p>
          </div>
          <div className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3">
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
              Role
            </p>
            <p className="mt-1 text-sm font-bold text-slate-900">
              SIMOBI Operator
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
