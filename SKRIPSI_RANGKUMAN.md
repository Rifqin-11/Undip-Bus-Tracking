# Rangkuman Sistem — Skripsi Tugas Akhir

> **Judul Proyek:** Sistem Monitoring & Tracking Real-Time Armada Buggy Listrik Kampus UNDIP (Smart Mobility Universitas Diponegoro)
> **Repository:** `Rifqin-11/Undip-Bus-Tracking` (folder kerja: `real_web`)
> **Dokumen ini** adalah ringkasan teknis lengkap yang siap di-paste ke ChatGPT / AI lain sebagai konteks untuk membantu penulisan skripsi.

---

## 1. Latar Belakang & Tujuan

Sistem dirancang untuk memonitor armada **buggy listrik** di lingkungan Universitas Diponegoro. Fokus utama:

- **Efisiensi transportasi kampus** lewat pelacakan posisi *real-time*.
- **Estimasi waktu kedatangan (ETA)** ke setiap halte.
- **Pemantauan kepadatan penumpang (*crowd level*)** — `LONGGAR` / `HAMPIR_PENUH` / `PENUH`.
- **Keamanan armada** lewat *geofencing* (deteksi keluar zona) dan *remote engine cut-off* dengan konfirmasi ACK.
- **Histori perjalanan** untuk audit dan analisis operasional.

Pengguna dibagi tiga peran: **Publik** (tanpa login), **Driver/Supir** (login), dan **Admin** (login + role check).

---

## 2. Tech Stack

| Layer | Teknologi |
|---|---|
| **Frontend / PWA** | Next.js 16 (App Router, React 19, TypeScript), Tailwind CSS v4, shadcn/ui, Lucide icons, Motion |
| **Internasionalisasi** | i18next + react-i18next (multi-locale via segmen URL `[locale]`) |
| **Backend (BaaS)** | Supabase (PostgreSQL + Auth + Row Level Security) |
| **Realtime messaging** | MQTT (broker Mosquitto untuk testing, broker TLS untuk produksi) + WebSocket (`ws://` / `wss://`) |
| **MQTT client (browser & node)** | `mqtt.js` |
| **Visualisasi peta** | Google Maps API |
| **Server runtime** | Node.js (Next.js API routes) + worker bridge MQTT terpisah |
| **Auth client** | `@supabase/ssr`, `@supabase/supabase-js` |

Skrip utama (`package.json`):

- `npm run dev` — Next.js dev server.
- `npm run build` / `npm run start` — production.

---

## 3. Arsitektur Sistem (Cara Kerja End-to-End)

Sistem memakai **dua jalur MQTT** yang terpisah agar data lapangan tidak tercemar data simulasi.

### 3.1 Pipeline Produksi (Data Asli)

```
┌────────────────────┐
│  Buggy Hardware    │
│ (RPi/ESP32 + GSM)  │
└─────────┬──────────┘
          │ MQTT publish (mqtts:// 8883, user/pass)
          │ topic: buggy/{numericId}/data
          ▼
┌────────────────────┐
│  MQTT Broker       │ ← TLS + auth
│  (cloud)           │
└─────────┬──────────┘
          │ subscribe buggy/+/data
          ▼
┌────────────────────────────┐
│  mqtt-bridge-service       │   ← di-deploy di RAILWAY (long-running)
│  (Node.js worker)          │
└─────────┬──────────────────┘
          │ HTTPS POST + Authorization: Bearer <BUGGY_INGEST_TOKEN>
          ▼
┌────────────────────────────┐        ┌──────────────────┐
│  https://www.simobi.my.id  │ ─────▶ │  Supabase        │
│  /api/gps-beacon           │        │  (PostgreSQL)    │
│  (Next.js on Vercel)       │ ◀───── │  buggies,        │
└────────────┬───────────────┘        │  buggy_history,  │
             │                        │  buggy_session_  │
             │ SSE / Poll             │  history, dll.   │
             ▼                        └──────────────────┘
   Dashboard publik / driver / admin
```

### 3.2 Pipeline Testing / Simulasi

Untuk pengembangan dan demo tanpa hardware:

- **Sumber data:** halaman `/gps-tracker` (browser publish via WebSocket) atau iPhone.
- **Broker:** Mosquitto terpisah di folder sibling `../simobi-mosquitto-broker/`.
- **Bridge:** folder sibling `../mqtt-bridge-service/` untuk produksi atau `../mqtt-simulator-bridge-service/` untuk simulator/staging.
- **Endpoint tujuan:** sama, `POST /api/gps-beacon` — dibedakan via field `source` di payload (mis. `"gps-tracker"`).

### 3.3 Perbandingan Dua Jalur

| Aspek | Produksi | Testing |
|---|---|---|
| Sumber data | Hardware buggy (RPi/ESP32 + GSM) | Browser `/gps-tracker` / iPhone |
| Broker | MQTT TLS (`mqtts://` 8883) + autentikasi user/pass | Mosquitto lokal, `allow_anonymous true` |
| Bridge | `../mqtt-bridge-service` di Fly.io / Railway | `../mqtt-simulator-bridge-service` |
| `source` payload | `gps_beacon` / hardware tag | `gps-tracker` / `mqtt_bridge` |
| Lingkungan | Production (Vercel + Supabase Cloud) | Local / Staging |

> Kedua jalur tetap berakhir di endpoint REST yang sama: `POST /api/gps-beacon`, dilindungi `BUGGY_INGEST_TOKEN`.

### 3.4 Alur Data Terurut (Produksi)

1. **Device buggy** (Raspberry Pi / ESP32 dengan modul GSM/GPS) membaca GPS + telemetry (kecepatan, heading, baterai, jumlah penumpang).
2. Data di-*publish* ke broker MQTT TLS pada topic `buggy/{numericId}/data` dengan payload JSON (`lat`, `lng`, `speedKmh`, `heading`, `altitude`, `accuracy`, `batteryLevel`, `passengers`, `capacity`, `sessionStart/End`, `timestamp`, `source`).
3. **MQTT Bridge** (worker Node.js di Railway) men-*subscribe* `buggy/+/data`, lalu mem-*forward* sebagai HTTPS `POST` ke `/api/gps-beacon` dengan header `Authorization: Bearer <BUGGY_INGEST_TOKEN>`.
4. **API `/api/gps-beacon`** (`app/api/gps-beacon/route.ts`):
   - Memvalidasi token ingest.
   - Memuat data master dari Supabase secara *lazy* (`bootstrapFromDatabase()`).
   - Memetakan `numericId` → UUID buggy.
   - Mengupdate **in-memory live store** (`lib/realtime/buggy-live-store.ts`) — sumber data dashboard publik.
   - Mengakumulasi titik perjalanan ke **session store** (`lib/realtime/session-store.ts`).
   - Mem-*persist* ke tabel `buggy_history` dengan throttle **maks 1 insert / 10 detik per buggy** (sesuai PRD).
   - Menangani `sessionStart` (mulai sesi) dan `sessionEnd` (finalize → simpan ke `buggy_session_history`, sekaligus menonaktifkan buggy di live store agar tampil offline seketika).
5. **Dashboard** (di `app/[locale]/page.tsx` dst.) membaca data via:
   - `GET /api/buggy` — *snapshot* JSON (mode polling), atau
   - `GET /api/buggy/stream` — Server-Sent Events (mode SSE).
   - Dipilih oleh env `NEXT_PUBLIC_BUGGY_FEED_MODE` (`poll` | `sse`).
6. UI me-render: peta Google Maps + marker buggy, daftar halte terdekat, ETA, crowd level, notifikasi "bus mendekat", panel admin/driver, dsb.

### 3.5 Komponen Realtime Penting

- **`lib/realtime/buggy-live-store.ts`** — state in-memory tunggal (disimpan di `globalThis` agar bertahan saat HMR dev). Menyimpan snapshot buggy aktif, melakukan *resync* otomatis bila perbedaan posisi > 50 m, dan mengelola progression halte berbasis jarak (radius 20 m dianggap "sampai").
- **`lib/realtime/session-store.ts`** — akumulator sesi perjalanan: mulai saat `sessionStart`, terus menambahkan titik, *auto-finalize* setelah 5 menit tidak ada ping, lalu disimpan ke Supabase. Sesi pendek (< 3 titik atau < 1 km) dibuang.
- **`lib/supabase/data-loader.ts`** — *lazy bootstrap* yang sekali per proses memuat halte & buggy dari Supabase ke memori.

---

## 4. Struktur Folder Utama

| Folder | Isi |
|---|---|
| `app/[locale]/` | Halaman ber-locale: `page.tsx` (dashboard publik), `admin/`, `driver/`, `gps-tracker/` (simulator admin-only), `login/`, `reset-password/` |
| `app/api/` | REST endpoint: `buggy`, `buggy/ingest`, `buggy/stream`, `gps-beacon`, `buggy-history`, `buggy-sessions`, `haltes`, `geofences`, `announcements`, `auth/callback`, `admin/*` |
| `components/` | UI: `map/`, `buggy/`, `halte/`, `history/`, `panel/`, `sidebar/`, `auth/`, `notification/`, `settings/`, `layout/`, `data/`, `ui/` |
| `hooks/` | `useBuggyLiveFeed`, `useUserPosition`, `useNearbyBusAlert`, `useNearestHaltes`, `useFavorites`, `useAdminSettings`, `useUserRole`, `useDirectionSearch`, dll. |
| `lib/` | `realtime/`, `supabase/`, `transit/`, `auth/`, `i18n/`, `services/google-maps-service.ts`, `geofence-store.ts` |
| `../mqtt-simulator-bridge-service/` | Worker bridge khusus simulator (Dockerfile + Fly.io config). Ada juga `../mqtt-bridge-service` produksi yang di-deploy terpisah |
| `types/` | TypeScript types (`buggy.ts`, `buggy-history.ts`, `buggy-session.ts`, `geofence.ts`, `announcement.ts`, `map-canvas.ts`) |
| `proxy.ts` | Middleware Next.js: deteksi locale + refresh sesi Supabase |

---

## 5. Database — Supabase (PostgreSQL)

Sumber: `supabase/migrations/*.sql`.

### 5.1 Tabel Utama

#### `buggies` — master armada

```sql
id           uuid PK (gen_random_uuid)
code         varchar(10) unique
name         varchar(50)
capacity     integer default 8
is_active    boolean default true
numeric_id   integer        -- dipakai GPS beacon untuk mapping ID
created_at   timestamptz default now()
updated_at   timestamptz default now()
```

#### `buggy_history` — log GPS (interval ±10 detik per buggy)

```sql
id                uuid PK
buggy_id          text not null             -- format "buggy-{numericId}"
buggy_numeric_id  integer
lat, lng          double precision not null
speed_kmh         double precision
accuracy          double precision
heading           double precision
altitude          double precision
battery_level     integer
passengers        integer
capacity          integer
source            text                      -- "gps_beacon", "mqtt_bridge", "gps-tracker"
recorded_at       timestamptz default now()
-- Indexes: buggy_id, recorded_at, (lat, lng)
-- RLS aktif; service role insert, anon & authenticated read
```

#### `buggy_session_history` — agregat per sesi perjalanan

Disimpan saat `finalizeSession()`. Berisi metadata (start/end, durasi, jarak total, kecepatan rata-rata, baterai awal/akhir, path) ditambah `unique index (buggy_id, started_at, ended_at)` untuk mencegah duplikat.

#### `haltes` — master halte (dimuat saat bootstrap)

Field: `id, name, lat, lng, sort_order, is_active, schedule (text[]), facilities (text[])`.

#### `accounts` — profil pengguna

Field tambahan: `role` (Admin/Driver/Public), `favorite_haltes text[]`, `favorite_buggies text[]` dengan index GIN dan RLS *"Users can update own favorites"* (`auth.uid() = id`).

#### `announcements` — pengumuman dashboard

Dikelola admin via `/api/admin/announcements`.

#### `geofences` (file `data/geofences.json` + endpoint `/api/geofences`)

Polygon zona operasional yang dapat dikonfigurasi admin.

#### `commands_queue` (rencana PRD)

Antrean perintah remote (mis. *engine cut-off*) dengan status `pending` / `sent` / `acked`.

### 5.2 Relasi (ERD)

```
buggies ||--o{ buggy_history          : "generates"
buggies ||--o{ buggy_session_history  : "completes"
buggies ||--o{ commands_queue         : "receives"
accounts }o--o{ buggies               : "favorites"
accounts }o--o{ haltes                : "favorites"
```

---

## 6. Autentikasi & Otorisasi

- **Supabase Auth** (email/password, magic link), client di `lib/supabase/client.ts`, server di `lib/supabase/server.ts`.
- Middleware `proxy.ts` me-*refresh* sesi cookie + menangani prefix locale.
- **`lib/auth/admin-guard.ts`** — `requireAdmin()`: mengecek `auth.getUser()` lalu query `accounts.role === "Admin"`. Membalas `401` (belum login) atau `403` (bukan admin).
- **`lib/auth/ingest-token.ts`** — `requireIngestToken()`: memvalidasi header `Authorization: Bearer <BUGGY_INGEST_TOKEN>` untuk semua endpoint ingest (`/api/gps-beacon`, `/api/buggy/ingest`). Jika env belum diset, endpoint *fail-closed* dengan `500`.
- **RLS Supabase** aktif di tiap tabel; service role key dipakai server untuk operasi admin, anon key untuk read publik.

---

## 7. Endpoint API (App Router)

| Method | Path | Fungsi |
|---|---|---|
| `GET` | `/api/buggy` | Snapshot semua buggy (digabung dengan telemetry terbaru). |
| `GET` | `/api/buggy/stream` | SSE stream realtime snapshot. |
| `POST` | `/api/buggy/ingest` | Ingest snapshot/telemetry (butuh token). |
| `POST` | `/api/gps-beacon` | Ingest GPS + telemetry dari device/bridge (butuh token). |
| `GET/POST` | `/api/haltes`, `/api/haltes/[id]` | CRUD halte. |
| `GET/POST` | `/api/geofences`, `/api/geofences/[id]` | CRUD geofence polygon. |
| `GET` | `/api/buggy-history` | Query histori GPS untuk analisis/replay. |
| `GET` | `/api/buggy-sessions`, `POST` `/api/buggy-sessions/delete` | Daftar & hapus sesi perjalanan. |
| `GET/POST` | `/api/announcements` | Pengumuman publik. |
| `*` | `/api/admin/{accounts,announcements,buggies,statistics}` | Operasi admin (di-*guard* `requireAdmin`). |
| `GET` | `/api/auth/callback` | Callback Supabase Auth. |

---

## 8. Konfigurasi Environment

### 8.1 Next.js (Vercel)

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=...   # (atau ANON_KEY)
SUPABASE_SERVICE_ROLE_KEY=...              # server-only
SUPABASE_BUGGY_HISTORY_TABLE=buggy_history
SUPABASE_BUGGY_SESSION_TABLE=buggy_session_history

# Realtime feed mode
NEXT_PUBLIC_BUGGY_FEED_MODE=sse            # poll | sse

# Ingest security (HARUS identik dengan env di Railway)
BUGGY_INGEST_TOKEN=your-secret-token
```

### 8.2 MQTT Bridge Produksi (Railway)

```text
MQTT_BROKER_URL=mqtts://<broker-host>:8883
MQTT_TOPIC=buggy/+/data
MQTT_USERNAME=<user>
MQTT_PASSWORD=<password>
NEXT_GPS_BEACON_URL=https://www.simobi.my.id/api/gps-beacon
BUGGY_INGEST_TOKEN=<sama-dengan-Vercel>
PORT=8080
```

### 8.3 MQTT Simulator / Testing (Local)

```bash
# Browser publisher (/gps-tracker)
NEXT_PUBLIC_MQTT_BROKER_WS_URL=ws://localhost:9001
NEXT_PUBLIC_MQTT_TOPIC_PREFIX=buggy

# Bridge simulator/staging berada di ../mqtt-simulator-bridge-service
MQTT_BROKER_URL=mqtt://<broker-host>:1883
MQTT_TOPIC=buggy/+/data
NEXT_GPS_BEACON_URL=https://www.simobi.my.id/api/gps-beacon
```

---

## 9. Fitur Utama (Mapping ke PRD)

1. **Dashboard Publik** — peta real-time, ETA per halte, indikator crowd level, daftar halte terdekat, notifikasi "bus mendekat" (`useNearbyBusAlert`).
2. **Dashboard Supir** — monitor baterai (tegangan/level), kecepatan, status sesi.
3. **Dashboard Admin** — manajemen buggy (CRUD), geofencing (polygon editor), pengumuman, statistik, riwayat sesi.
4. **Geofencing dinamis** — admin menggambar polygon → disimpan; deteksi keluar zona memunculkan notifikasi.
5. **Remote engine cut-off + ACK** *(direncanakan via `commands_queue`)* — admin kirim perintah, buggy *poll* saat reconnect, kirim ACK; status `pending → sent → acked`.
6. **Retry queue** untuk perintah saat GSM offline (PRD).
7. **Histori & sesi** — `buggy_history` (titik per 10 dtk) + `buggy_session_history` (agregat per perjalanan, untuk replay rute).
8. **Favorit** — pengguna login dapat membintangi halte/buggy (`accounts.favorite_haltes`, `favorite_buggies`), sinkron lintas device.
9. **PWA + i18n** — `app/manifest.ts`, segmen URL `[locale]`, deteksi bahasa via cookie & `Accept-Language`.
10. **GPS Tracker Simulator** (`/gps-tracker`, admin-only) — mode satu *device* (publish dari smartphone via WebSocket) atau *armada* (multi-buggy), untuk pengujian tanpa hardware.

---

## 10. Setup & Deploy

### 10.1 Pipeline Lokal (Testing)

1. `npm install`
2. Jalankan broker dari folder sibling `../simobi-mosquitto-broker`.
3. `npm run dev` (Next.js).
4. Jalankan bridge dari folder sibling `../mqtt-simulator-bridge-service` dengan env yang sesuai.
5. Login sebagai Admin, buka `/gps-tracker` di browser → publish data → verifikasi `curl /api/buggy`.

### 10.2 Produksi

| Komponen | Hosting | Catatan |
|---|---|---|
| Frontend + Next.js API | **Vercel** | Serverless, domain `www.simobi.my.id` |
| MQTT Bridge | **Railway** | Worker long-running, root = folder `mqtt-bridge-service` |
| Database + Auth | **Supabase Cloud** | PostgreSQL terkelola, RLS aktif |
| MQTT Broker | Cloud (TLS) | `mqtts://...:8883`, autentikasi user/pass |

Bridge **wajib long-running** (subscribe MQTT terus-menerus) → harus di Railway/Fly.io, **tidak boleh** di Vercel serverless. Health check tersedia di `GET /health`.

---

## 11. Pertimbangan Teknis

- **Idempotent migrations** — tiap SQL pakai `create … if not exists` / `do $$ … $$` agar aman dieksekusi ulang.
- **Throttling** — insert history dibatasi 1 record / 10 dtk / buggy demi menjaga kuota DB & sesuai requirement skala 1–5 unit, interval kirim 5 dtk.
- **Auto-resync** posisi buggy bila live state vs telemetry berbeda jauh (> 50 m atau > 3 stop), agar UI tidak "loncat-loncat".
- **Privacy** — payload citra dari Raspberry Pi tidak disimpan; hanya angka *crowd level* yang di-persist (efisiensi storage + privasi).
- **Fail-closed security** — endpoint ingest menolak request bila `BUGGY_INGEST_TOKEN` belum diset.
- **Hybrid feed** — frontend dapat memilih polling vs SSE via env, memudahkan fallback di jaringan kampus terbatas.
- **Isolasi data uji** — bridge simulator (`../mqtt-simulator-bridge-service`) dipisah dari bridge produksi agar payload `/gps-tracker` tidak mencemari telemetry hardware.

---

## 12. Skalabilitas (sesuai PRD)

- Target awal: **1–5 buggy**, interval ping 5 detik.
- Volume tulis Supabase: maks ~30 row/menit (5 buggy × 6 insert/menit setelah throttle 10 dtk).
- Realtime delivery: SSE 1-arah (server → client) cukup; tidak butuh full duplex.
- Broker MQTT mendukung penambahan buggy tanpa perubahan kode — cukup tambah baris di tabel `buggies` dengan `numeric_id` baru.

---

## 13. Saran Struktur Bab Skripsi

- **BAB I — Pendahuluan**
  Transportasi kampus UNDIP, masalah ketidakpastian jadwal buggy, kebutuhan real-time tracking.

- **BAB II — Tinjauan Pustaka**
  IoT, MQTT (QoS, retained message, TLS), GPS & GNSS, *geofencing* (point-in-polygon), PWA, Supabase/PostgreSQL, Row Level Security, Server-Sent Events vs WebSocket vs polling.

- **BAB III — Metodologi**
  PRD, ERD, sequence diagram (lihat `PRD.md`), use-case publik/driver/admin, **dua jalur MQTT (produksi vs simulasi)** dan alasan pemisahannya.

- **BAB IV — Implementasi**
  - Arsitektur (Bab 3 di atas).
  - Skema database (Bab 5).
  - Endpoint API (Bab 7).
  - Simulator GPS tracker admin-only (`/gps-tracker`).
  - **Deployment**: Vercel (frontend + API), Railway (MQTT bridge worker), Supabase Cloud (database + auth).
  - **Keamanan komunikasi**: MQTT atas TLS, autentikasi user/pass di broker, bearer token di REST ingest.

- **BAB V — Pengujian**
  Uji pipeline lokal (Bab 10), pengukuran latensi MQTT → UI, akurasi ETA, response time geofence breach. Gunakan Mosquitto lokal + `/gps-tracker` untuk uji end-to-end tanpa risiko mengganggu data lapangan.

- **BAB VI — Penutup**
  Kontribusi (sistem siap produksi untuk Smart Mobility UNDIP), keterbatasan (jumlah buggy, ketergantungan GSM, throughput dibatasi kualitas jaringan seluler kampus), rencana lanjutan (`commands_queue` ACK, integrasi pembayaran/QR, ML untuk prediksi ETA).
