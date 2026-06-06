import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  Bell,
  BusFront,
  Clock3,
  Gauge,
  LocateFixed,
  MapPin,
  MapPinned,
  Navigation,
  Route,
  Signal,
  Users,
} from "lucide-react";
import heroImage from "@/public/ChatGPT Image Jun 6 2026.png";
import logo from "@/public/logo.svg";

const serviceInformation = [
  {
    title: "Posisi buggy real-time",
    description:
      "Lihat armada yang sedang aktif, lokasi terakhir, arah pergerakan, dan waktu pembaruan data.",
    icon: LocateFixed,
  },
  {
    title: "Rute dan halte kampus",
    description:
      "Kenali jalur layanan serta titik halte yang menghubungkan fakultas dan fasilitas utama UNDIP.",
    icon: Route,
  },
  {
    title: "Kondisi penumpang",
    description:
      "Periksa kapasitas penumpang sebelum menuju halte agar perjalanan dapat direncanakan lebih nyaman.",
    icon: Users,
  },
  {
    title: "Panduan perjalanan",
    description:
      "Tentukan lokasi asal dan tujuan untuk memperoleh panduan berjalan serta halte yang perlu digunakan.",
    icon: Navigation,
  },
];

const featuredStops = [
  "Rusunawa Undip",
  "Student Center",
  "Fakultas Hukum & Fisip",
  "Widya Puraya",
  "Fakultas Psikologi",
  "Bundaran Undip",
];

const fleetStatuses = [
  {
    status: "Online",
    color: "bg-emerald-500",
    description:
      "Buggy sedang mengirim data dan posisinya dapat dipantau secara langsung.",
  },
  {
    status: "Pembaruan tertunda",
    color: "bg-amber-500",
    description:
      "Data terbaru belum diterima. Periksa waktu pembaruan sebelum menggunakan posisi pada peta.",
  },
  {
    status: "Offline",
    color: "bg-slate-400",
    description:
      "Buggy tidak sedang aktif. Posisi terakhir tetap disimpan sebagai informasi operasional.",
  },
];

const dashboardInformation = [
  {
    label: "Lokasi terkini",
    detail: "Posisi buggy dan halte pada peta kampus.",
    icon: MapPinned,
  },
  {
    label: "Status koneksi",
    detail: "Kondisi online atau offline setiap armada.",
    icon: Signal,
  },
  {
    label: "Kecepatan",
    detail: "Kecepatan terakhir yang diterima dari perangkat GPS.",
    icon: Gauge,
  },
  {
    label: "Penumpang",
    detail: "Jumlah dan persentase keterisian kursi buggy.",
    icon: Users,
  },
];

export default function LandingPage() {
  return (
    <main className="min-h-svh overflow-x-hidden bg-white text-slate-950">
      <header className="sticky top-0 z-50 border-b border-slate-200 bg-white/95 backdrop-blur-xl">
        <div className="mx-auto flex h-18 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
          <Link href="/landing" className="flex items-center gap-3">
            <Image
              src={logo}
              alt="SIMOBI"
              width={44}
              height={44}
              className="rounded-full"
              priority
            />
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">
                UNDIP Smart Mobility
              </p>
              <p className="text-lg font-black text-[#0f1a3b]">SIMOBI</p>
            </div>
          </Link>

          <nav className="hidden items-center gap-7 text-sm font-semibold text-slate-600 md:flex">
            <a href="#layanan" className="transition hover:text-[#0f1a3b]">
              Layanan
            </a>
            <a href="#rute" className="transition hover:text-[#0f1a3b]">
              Rute & Halte
            </a>
            <a href="#status" className="transition hover:text-[#0f1a3b]">
              Status Armada
            </a>
            <a href="#cara-pakai" className="transition hover:text-[#0f1a3b]">
              Cara Menggunakan
            </a>
          </nav>

          <Link
            href="/id"
            className="inline-flex h-10 items-center gap-2 rounded-lg bg-[#0f1a3b] px-4 text-sm font-bold text-white transition hover:bg-slate-900"
          >
            Buka Peta
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </header>

      <section className="border-b border-slate-200 bg-[#f4f4f2]">
        <h1 className="sr-only">
          Pantau mobilitas kampus dengan web SIMOBI
        </h1>
        <div className="overflow-hidden">
          <Image
            src={heroImage}
            alt="Ilustrasi fitur SIMOBI untuk memantau lokasi buggy, kepadatan penumpang, rute kampus, dan notifikasi geofence"
            className="h-auto min-h-[330px] w-full object-cover object-left sm:min-h-0"
            sizes="100vw"
            priority
          />
        </div>

        <div className="mx-auto my-10 max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid border-x border-t border-slate-200 bg-white lg:grid-cols-[0.72fr_1.28fr]">
            <div className="border-b border-slate-200 p-6 sm:p-8 lg:border-b-0 lg:border-r">
              <div className="flex items-center gap-3">
                <span className="flex h-11 w-11 items-center justify-center rounded-full bg-emerald-50 text-emerald-700">
                  <BusFront className="h-5 w-5" />
                </span>
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">
                    Layanan Utama
                  </p>
                  <h2 className="mt-1 text-xl font-black text-[#0f1a3b]">
                    Rute Kampus UNDIP
                  </h2>
                </div>
              </div>
              <p className="mt-6 text-sm font-medium leading-7 text-slate-600">
                Jalur buggy menghubungkan area hunian, fasilitas mahasiswa,
                fakultas, dan pusat layanan kampus.
              </p>
              <div className="mt-7 grid grid-cols-2 gap-6 border-t border-slate-200 pt-6">
                <div>
                  <p className="text-3xl font-black text-[#0f1a3b]">15</p>
                  <p className="mt-1 text-xs font-semibold text-slate-500">
                    titik halte
                  </p>
                </div>
                <div>
                  <p className="text-3xl font-black text-[#0f1a3b]">Real-time</p>
                  <p className="mt-1 text-xs font-semibold text-slate-500">
                    pembaruan armada
                  </p>
                </div>
              </div>
            </div>

            <div className="p-6 sm:p-8">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">
                    Beberapa Titik Layanan
                  </p>
                  <p className="mt-1 text-sm font-semibold text-slate-600">
                    Buka peta untuk melihat seluruh halte dan jalur.
                  </p>
                </div>
                <MapPin className="h-6 w-6 shrink-0 text-emerald-700" />
              </div>
              <div className="mt-7 grid gap-x-8 gap-y-0 sm:grid-cols-2">
                {featuredStops.map((stop, index) => (
                  <div
                    key={stop}
                    className="relative flex min-h-14 items-center gap-4 border-b border-slate-200 py-3"
                  >
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 border-emerald-600 bg-white text-[10px] font-black text-emerald-700">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <p className="text-sm font-bold text-[#0f1a3b]">{stop}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="layanan" className="px-4 py-20 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="grid gap-8 border-b border-slate-200 pb-10 lg:grid-cols-[0.8fr_1.2fr]">
            <div>
              <p className="text-sm font-bold uppercase tracking-[0.18em] text-emerald-700">
                Informasi Layanan
              </p>
              <h2 className="mt-3 text-4xl font-black tracking-normal text-[#0f1a3b]">
                Siapkan perjalanan sebelum menuju halte.
              </h2>
            </div>
            <p className="max-w-2xl text-base font-medium leading-8 text-slate-600 lg:justify-self-end">
              Dashboard publik dapat dibuka tanpa login untuk melihat armada
              yang aktif. Informasi disajikan langsung pada peta agar pengguna
              dapat menentukan halte dan perjalanan dengan lebih mudah.
            </p>
          </div>

          <div className="mt-10 grid border-l border-t border-slate-200 sm:grid-cols-2 lg:grid-cols-4">
            {serviceInformation.map(
              ({ title, description, icon: Icon }) => (
                <article
                  key={title}
                  className="min-h-64 border-b border-r border-slate-200 p-6"
                >
                  <Icon className="h-7 w-7 text-emerald-700" />
                  <h3 className="mt-8 text-lg font-black text-[#0f1a3b]">
                    {title}
                  </h3>
                  <p className="mt-3 text-sm font-medium leading-7 text-slate-500">
                    {description}
                  </p>
                </article>
              ),
            )}
          </div>
        </div>
      </section>

      <section id="rute" className="bg-[#0f1a3b] px-4 py-20 text-white sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-7xl gap-12 lg:grid-cols-[0.72fr_1.28fr]">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.18em] text-emerald-300">
              Rute & Halte
            </p>
            <h2 className="mt-3 text-4xl font-black tracking-normal">
              Terhubung ke berbagai area utama kampus.
            </h2>
            <p className="mt-5 text-sm font-medium leading-7 text-slate-300">
              Halte ditempatkan di area hunian mahasiswa, pusat kegiatan,
              fakultas, dan fasilitas akademik. Posisi lengkap tersedia pada
              dashboard interaktif.
            </p>
            <Link
              href="/id"
              className="mt-8 inline-flex h-11 items-center gap-2 rounded-lg bg-white px-5 text-sm font-bold text-[#0f1a3b] transition hover:bg-slate-100"
            >
              Temukan Halte Terdekat
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          <div className="grid gap-x-8 border-t border-white/15 sm:grid-cols-2">
            {[
              "Rusunawa Undip",
              "Pos Satpam Astina Undip",
              "Student Center",
              "Teknik Arsitektur",
              "Fakultas Hukum & Fisip",
              "Sekolah Vokasi & FIB",
              "Widya Puraya",
              "SA-MWA & FSM Barat",
              "Fakultas Psikologi",
              "Fakultas Ekonomika dan Bisnis",
              "Fakultas Kesehatan Masyarakat",
              "Fakultas Perikanan dan Kelautan",
              "Fakultas Peternakan dan Pertanian",
              "UPT Laboratorium Terpadu",
              "Bundaran Undip",
            ].map((stop, index) => (
              <div
                key={stop}
                className="flex min-h-15 items-center gap-4 border-b border-white/15 py-3"
              >
                <span className="text-xs font-black text-emerald-300">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <span className="text-sm font-semibold text-slate-100">
                  {stop}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="status" className="bg-slate-50 px-4 py-20 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="grid gap-10 lg:grid-cols-[0.72fr_1.28fr]">
            <div>
              <p className="text-sm font-bold uppercase tracking-[0.18em] text-sky-700">
                Status Armada
              </p>
              <h2 className="mt-3 text-4xl font-black tracking-normal text-[#0f1a3b]">
                Baca kondisi layanan sebelum berangkat.
              </h2>
              <p className="mt-5 text-sm font-medium leading-7 text-slate-600">
                Selalu periksa label status dan waktu pembaruan. Keduanya
                membantu memastikan apakah posisi buggy masih relevan.
              </p>
            </div>

            <div className="border-t border-slate-300">
              {fleetStatuses.map(({ status, color, description }) => (
                <article
                  key={status}
                  className="grid gap-3 border-b border-slate-300 py-6 sm:grid-cols-[180px_1fr]"
                >
                  <div className="flex items-center gap-3">
                    <span className={`h-2.5 w-2.5 rounded-full ${color}`} />
                    <h3 className="text-base font-black text-[#0f1a3b]">
                      {status}
                    </h3>
                  </div>
                  <p className="text-sm font-medium leading-7 text-slate-600">
                    {description}
                  </p>
                </article>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="px-4 py-20 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="mb-10 max-w-3xl">
            <p className="text-sm font-bold uppercase tracking-[0.18em] text-emerald-700">
              Informasi pada Dashboard
            </p>
            <h2 className="mt-3 text-4xl font-black tracking-normal text-[#0f1a3b]">
              Informasi penting ditampilkan secara ringkas.
            </h2>
          </div>

          <div className="grid border-l border-t border-slate-200 md:grid-cols-2 lg:grid-cols-4">
            {dashboardInformation.map(({ label, detail, icon: Icon }) => (
              <article
                key={label}
                className="border-b border-r border-slate-200 p-6"
              >
                <Icon className="h-6 w-6 text-[#0f1a3b]" />
                <h3 className="mt-8 text-base font-black text-[#0f1a3b]">
                  {label}
                </h3>
                <p className="mt-2 text-sm font-medium leading-6 text-slate-500">
                  {detail}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section
        id="cara-pakai"
        className="border-y border-slate-200 bg-[#eef5f8] px-4 py-20 sm:px-6 lg:px-8"
      >
        <div className="mx-auto max-w-7xl">
          <div className="grid gap-10 lg:grid-cols-[0.72fr_1.28fr]">
            <div>
              <p className="text-sm font-bold uppercase tracking-[0.18em] text-emerald-700">
                Cara Menggunakan
              </p>
              <h2 className="mt-3 text-4xl font-black tracking-normal text-[#0f1a3b]">
                Rencanakan perjalanan dalam tiga langkah.
              </h2>
              <p className="mt-5 text-sm font-medium leading-7 text-slate-600">
                Tidak perlu login untuk melihat armada aktif dan halte pada
                peta SIMOBI.
              </p>
            </div>

            <div className="divide-y divide-slate-300 border-y border-slate-300">
              {[
                {
                  number: "01",
                  title: "Buka peta SIMOBI",
                  text: "Lihat buggy yang sedang online beserta seluruh titik halte kampus.",
                  icon: MapPinned,
                },
                {
                  number: "02",
                  title: "Masukkan tujuan",
                  text: "Gunakan pencarian untuk menentukan lokasi asal, tujuan, dan halte yang sesuai.",
                  icon: Route,
                },
                {
                  number: "03",
                  title: "Periksa kondisi buggy",
                  text: "Pastikan status armada, waktu pembaruan, dan kapasitas penumpang sebelum berjalan ke halte.",
                  icon: Clock3,
                },
              ].map(({ number, title, text, icon: Icon }) => (
                <div
                  key={number}
                  className="grid gap-4 py-6 sm:grid-cols-[54px_44px_1fr] sm:items-start"
                >
                  <span className="text-sm font-black text-emerald-700">
                    {number}
                  </span>
                  <Icon className="h-6 w-6 text-[#0f1a3b]" />
                  <div>
                    <h3 className="text-lg font-black text-[#0f1a3b]">
                      {title}
                    </h3>
                    <p className="mt-2 text-sm font-medium leading-7 text-slate-600">
                      {text}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="bg-white px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[1fr_auto] lg:items-center">
          <div>
            <div className="flex items-center gap-3 text-emerald-700">
              <Bell className="h-6 w-6" />
              <span className="text-sm font-bold uppercase tracking-[0.18em]">
                Informasi Perjalanan Kampus
              </span>
            </div>
            <h2 className="mt-4 max-w-3xl text-3xl font-black tracking-normal text-[#0f1a3b]">
              Lihat kondisi layanan buggy sebelum memulai perjalanan.
            </h2>
          </div>
          <Link
            href="/id"
            className="inline-flex h-12 items-center justify-center gap-2 rounded-lg bg-[#0f1a3b] px-6 text-sm font-bold text-white transition hover:bg-slate-900"
          >
            Buka Dashboard SIMOBI
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      <footer className="bg-[#081126] px-4 py-12 text-white sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-7xl gap-10 md:grid-cols-[1fr_auto_auto]">
          <div className="max-w-lg">
            <div className="flex items-center gap-3">
              <Image
                src={logo}
                alt="SIMOBI"
                width={44}
                height={44}
                className="rounded-full"
              />
              <div>
                <p className="text-lg font-black">SIMOBI</p>
                <p className="text-xs font-medium text-slate-400">
                  UNDIP Smart Mobility
                </p>
              </div>
            </div>
            <p className="mt-5 text-sm font-medium leading-7 text-slate-400">
              Layanan informasi dan monitoring armada buggy di lingkungan
              Universitas Diponegoro.
            </p>
          </div>

          <div>
            <p className="text-sm font-black">Informasi</p>
            <div className="mt-4 space-y-3 text-sm font-medium text-slate-400">
              <a href="#layanan" className="block hover:text-white">
                Informasi layanan
              </a>
              <a href="#rute" className="block hover:text-white">
                Rute dan halte
              </a>
              <a href="#status" className="block hover:text-white">
                Status armada
              </a>
              <a href="#cara-pakai" className="block hover:text-white">
                Cara menggunakan
              </a>
            </div>
          </div>

          <div>
            <p className="text-sm font-black">Dashboard</p>
            <div className="mt-4 space-y-3 text-sm font-medium text-slate-400">
              <Link href="/id" className="block hover:text-white">
                Bahasa Indonesia
              </Link>
              <Link href="/en" className="block hover:text-white">
                English
              </Link>
              <span className="flex items-center gap-2">
                <BusFront className="h-4 w-4" />
                Rute Kampus UNDIP
              </span>
            </div>
          </div>
        </div>

        <div className="mx-auto mt-10 flex max-w-7xl flex-col justify-between gap-2 border-t border-white/10 pt-6 text-xs font-medium text-slate-500 sm:flex-row">
          <p>SIMOBI - Smart Mobility Universitas Diponegoro</p>
          <p>Informasi layanan buggy kampus</p>
        </div>
      </footer>
    </main>
  );
}
