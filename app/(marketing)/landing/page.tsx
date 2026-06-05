import Image from "next/image";
import Link from "next/link";
import {
  Activity,
  ArrowRight,
  BellRing,
  Database,
  MapPinned,
  RadioTower,
  Route,
  ShieldCheck,
  Smartphone,
  Users,
} from "lucide-react";
import buggyImage from "@/public/buggy.webp";
import logo from "@/public/logo.svg";

const capabilities = [
  {
    title: "Monitoring real-time",
    description:
      "Posisi buggy, status koneksi, halte saat ini, dan last seen ditampilkan langsung pada peta kampus.",
    icon: MapPinned,
  },
  {
    title: "Rute dan halte",
    description:
      "Pengguna dapat mencari tujuan, melihat panduan rute, serta memilih halte terdekat dari lokasi asal.",
    icon: Route,
  },
  {
    title: "Role-based dashboard",
    description:
      "Satu dashboard menyesuaikan akses untuk pengguna umum, driver, dan admin tanpa halaman operasional terpisah.",
    icon: ShieldCheck,
  },
  {
    title: "Telemetry IoT",
    description:
      "Data ESP masuk melalui MQTT bridge, divalidasi API, lalu disimpan ke Supabase untuk live map dan history.",
    icon: RadioTower,
  },
];

const workflow = [
  "ESP GPS Device",
  "MQTT Broker",
  "MQTT Bridge",
  "SIMOBI API",
  "Supabase",
  "Dashboard",
];

const roles = [
  {
    title: "Pengguna umum",
    text: "Melihat peta, halte, rute, buggy online, favorit, dan notifikasi buggy mendekat.",
    icon: Smartphone,
  },
  {
    title: "Driver",
    text: "Memantau buggy yang ditugaskan serta melihat statistik dan riwayat operasional secara terbatas.",
    icon: Users,
  },
  {
    title: "Admin",
    text: "Mengelola fleet, device assignment, geofence, akun, pengumuman, statistik, dan history.",
    icon: Database,
  },
];

export default function LandingPage() {
  return (
    <main className="min-h-svh overflow-x-hidden bg-[#edf3f8] text-slate-950">
      <section className="relative min-h-svh overflow-hidden px-4 pb-8 pt-4 sm:px-6 lg:px-8">
        <div className="absolute inset-0 bg-[linear-gradient(120deg,rgba(219,246,236,0.95)_0%,rgba(241,245,249,0.96)_42%,rgba(226,236,250,0.95)_100%)]" />
        <div className="absolute inset-x-0 top-0 h-24 bg-white/55" />

        <div className="relative z-10 mx-auto flex min-h-[calc(100svh-3rem)] max-w-7xl flex-col">
          <header className="flex items-center justify-between gap-4 rounded-[28px] border border-white/55 bg-white/60 px-4 py-3 shadow-[0_18px_48px_rgba(15,23,42,0.08)] backdrop-blur-xl">
            <Link href="/landing" className="flex items-center gap-3">
              <Image
                src={logo}
                alt="SIMOBI"
                width={46}
                height={46}
                className="rounded-full"
                priority
              />
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-slate-400">
                  UNDIP Smart Mobility
                </p>
                <p className="text-lg font-black tracking-tight text-[#0f1a3b]">
                  SIMOBI
                </p>
              </div>
            </Link>
            <nav className="hidden items-center gap-6 text-sm font-bold text-slate-600 md:flex">
              <a href="#fitur" className="transition hover:text-[#0f1a3b]">
                Fitur
              </a>
              <a href="#alur" className="transition hover:text-[#0f1a3b]">
                Alur Data
              </a>
              <a href="#akses" className="transition hover:text-[#0f1a3b]">
                Akses
              </a>
            </nav>
            <Link
              href="/id"
              className="inline-flex h-11 items-center gap-2 rounded-full bg-[#0f1a3b] px-4 text-sm font-black text-white shadow-[0_12px_28px_rgba(15,26,59,0.28)] transition hover:-translate-y-0.5 hover:bg-slate-900"
            >
              Buka Dashboard
              <ArrowRight className="h-4 w-4" />
            </Link>
          </header>

          <div className="grid flex-1 items-center gap-8 py-10 lg:grid-cols-[1.02fr_0.98fr] lg:py-12">
            <div className="max-w-3xl">
              <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-white/70 px-3 py-1.5 text-xs font-black uppercase tracking-[0.16em] text-emerald-700 shadow-sm">
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                Real-time Campus Fleet Monitoring
              </div>
              <h1 className="max-w-4xl text-5xl font-black leading-[0.96] tracking-normal text-[#0f1a3b] sm:text-6xl lg:text-7xl">
                Sistem monitoring buggy listrik kampus UNDIP.
              </h1>
              <p className="mt-6 max-w-2xl text-base font-medium leading-8 text-slate-600 sm:text-lg">
                SIMOBI menggabungkan peta interaktif, telemetry GPS, MQTT,
                Supabase, dashboard operasional, dan notifikasi untuk membantu
                pengguna mengetahui posisi buggy serta membantu admin memantau
                armada secara lebih terstruktur.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link
                  href="/id"
                  className="inline-flex h-13 items-center justify-center gap-2 rounded-2xl bg-[#0f1a3b] px-6 text-sm font-black text-white shadow-[0_18px_36px_rgba(15,26,59,0.24)] transition hover:-translate-y-0.5 hover:bg-slate-900"
                >
                  Masuk ke Aplikasi
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <a
                  href="#fitur"
                  className="inline-flex h-13 items-center justify-center rounded-2xl border border-slate-200 bg-white/70 px-6 text-sm font-black text-[#0f1a3b] shadow-sm transition hover:border-[#0f1a3b]/30 hover:bg-white"
                >
                  Lihat Fitur
                </a>
              </div>
            </div>

            <div className="relative">
              <div className="rounded-[34px] border border-white/70 bg-white/62 p-4 shadow-[0_24px_80px_rgba(15,23,42,0.14)] backdrop-blur-2xl">
                <div className="rounded-[28px] border border-slate-200/80 bg-linear-to-b from-white to-slate-50 p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-black text-emerald-700">
                      Live Fleet
                    </span>
                    <span className="rounded-full bg-[#0f1a3b] px-3 py-1 text-xs font-black text-white">
                      Role-based
                    </span>
                  </div>
                  <div className="relative flex aspect-[1.1] items-center justify-center overflow-hidden rounded-[24px] bg-[radial-gradient(circle_at_50%_45%,rgba(16,185,129,0.18),rgba(241,245,249,0.2)_45%,rgba(226,232,240,0.78))]">
                    <Image
                      src={buggyImage}
                      alt="Buggy listrik SIMOBI"
                      className="relative z-10 w-[88%] object-contain drop-shadow-[0_24px_36px_rgba(15,23,42,0.22)]"
                      priority
                    />
                    <div className="absolute left-5 top-5 rounded-2xl border border-white/70 bg-white/75 px-3 py-2 shadow-sm backdrop-blur-md">
                      <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
                        Status
                      </p>
                      <p className="text-sm font-black text-emerald-700">
                        Online
                      </p>
                    </div>
                    <div className="absolute bottom-5 right-5 rounded-2xl border border-white/70 bg-white/80 px-3 py-2 shadow-sm backdrop-blur-md">
                      <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
                        Last Seen
                      </p>
                      <p className="text-sm font-black text-[#0f1a3b]">
                        Real-time
                      </p>
                    </div>
                  </div>
                  <div className="mt-4 grid grid-cols-3 gap-2">
                    {[
                      ["Telemetry", "MQTT"],
                      ["History", "GPS"],
                      ["Alert", "Push"],
                    ].map(([label, value]) => (
                      <div
                        key={label}
                        className="rounded-2xl border border-slate-200 bg-white px-3 py-3"
                      >
                        <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">
                          {label}
                        </p>
                        <p className="mt-1 text-base font-black text-[#0f1a3b]">
                          {value}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="fitur" className="bg-white px-4 py-18 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="mb-8 flex flex-col justify-between gap-4 md:flex-row md:items-end">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.22em] text-emerald-600">
                Fitur Utama
              </p>
              <h2 className="mt-3 max-w-2xl text-4xl font-black tracking-normal text-[#0f1a3b]">
                Dibangun untuk monitoring armada kampus yang bergerak.
              </h2>
            </div>
            <p className="max-w-xl text-sm font-medium leading-7 text-slate-500">
              Fokus SIMOBI bukan hanya menampilkan marker, tetapi menjaga alur
              data dari perangkat GPS sampai dashboard tetap tervalidasi,
              tersimpan, dan dapat dianalisis.
            </p>
          </div>

          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
            {capabilities.map(({ title, description, icon: Icon }) => (
              <article
                key={title}
                className="rounded-[26px] border border-slate-200 bg-slate-50 p-5 transition hover:-translate-y-1 hover:bg-white hover:shadow-[0_18px_44px_rgba(15,23,42,0.08)]"
              >
                <span className="grid h-11 w-11 place-items-center rounded-2xl bg-white text-[#0f1a3b] shadow-sm">
                  <Icon className="h-5 w-5" />
                </span>
                <h3 className="mt-5 text-lg font-black text-[#0f1a3b]">
                  {title}
                </h3>
                <p className="mt-2 text-sm font-medium leading-6 text-slate-500">
                  {description}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="alur" className="bg-[#edf3f8] px-4 py-18 sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[0.85fr_1.15fr] lg:items-center">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.22em] text-sky-600">
              Alur Data
            </p>
            <h2 className="mt-3 text-4xl font-black tracking-normal text-[#0f1a3b]">
              Dari perangkat GPS sampai tampil di peta.
            </h2>
            <p className="mt-4 text-sm font-medium leading-7 text-slate-600">
              ESP mengirim `deviceId`, bridge menormalisasi menjadi `devicesId`,
              API melakukan lookup assignment aktif, lalu data disimpan sebagai
              telemetry live dan history.
            </p>
          </div>

          <div className="rounded-[30px] border border-white/70 bg-white/70 p-4 shadow-[0_20px_60px_rgba(15,23,42,0.08)] backdrop-blur-xl">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {workflow.map((item, index) => (
                <div
                  key={item}
                  className="relative rounded-2xl border border-slate-200 bg-white px-4 py-4"
                >
                  <span className="mb-3 inline-grid h-8 w-8 place-items-center rounded-xl bg-[#0f1a3b] text-xs font-black text-white">
                    {index + 1}
                  </span>
                  <p className="text-sm font-black text-[#0f1a3b]">{item}</p>
                  {index < workflow.length - 1 ? (
                    <ArrowRight className="absolute right-4 top-5 hidden h-4 w-4 text-slate-300 lg:block" />
                  ) : null}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section id="akses" className="bg-white px-4 py-18 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="mb-8 max-w-2xl">
            <p className="text-xs font-black uppercase tracking-[0.22em] text-rose-500">
              Hak Akses
            </p>
            <h2 className="mt-3 text-4xl font-black tracking-normal text-[#0f1a3b]">
              Satu dashboard, akses berbeda untuk setiap role.
            </h2>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            {roles.map(({ title, text, icon: Icon }) => (
              <article
                key={title}
                className="rounded-[26px] border border-slate-200 bg-white p-5 shadow-[0_14px_34px_rgba(15,23,42,0.05)]"
              >
                <span className="grid h-11 w-11 place-items-center rounded-2xl bg-slate-100 text-[#0f1a3b]">
                  <Icon className="h-5 w-5" />
                </span>
                <h3 className="mt-5 text-lg font-black text-[#0f1a3b]">
                  {title}
                </h3>
                <p className="mt-2 text-sm font-medium leading-6 text-slate-500">
                  {text}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-[#0f1a3b] px-4 py-14 text-white sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-7xl flex-col justify-between gap-6 md:flex-row md:items-center">
          <div>
            <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-xs font-black uppercase tracking-[0.16em] text-emerald-200">
              <Activity className="h-4 w-4" />
              SIMOBI Dashboard
            </div>
            <h2 className="max-w-3xl text-3xl font-black tracking-normal">
              Mulai pantau armada buggy kampus secara real-time.
            </h2>
            <p className="mt-3 max-w-2xl text-sm font-medium leading-7 text-slate-300">
              Dashboard utama akan menyesuaikan fitur berdasarkan role akun yang
              digunakan.
            </p>
          </div>
          <Link
            href="/id"
            className="inline-flex h-13 shrink-0 items-center justify-center gap-2 rounded-2xl bg-white px-6 text-sm font-black text-[#0f1a3b] transition hover:-translate-y-0.5 hover:bg-slate-100"
          >
            Buka Dashboard
            <BellRing className="h-4 w-4" />
          </Link>
        </div>
      </section>
    </main>
  );
}
