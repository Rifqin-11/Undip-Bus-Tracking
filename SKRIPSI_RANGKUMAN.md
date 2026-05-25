# Rangkuman Sistem SIMOBI untuk Penulisan Skripsi

> **Judul proyek:** Sistem Monitoring dan Tracking Real-Time Armada Buggy Listrik Kampus UNDIP
> **Nama aplikasi:** SIMOBI
> **Konteks:** Smart Mobility Universitas Diponegoro
> **Status dokumen:** Diperbarui sesuai kondisi repo saat ini, 19 Mei 2026
> **Tujuan dokumen:** Ringkasan teknis yang siap dipakai sebagai konteks untuk penulisan BAB skripsi, diskusi dengan dosen pembimbing, atau ditempel ke AI lain.

---

## 1. Gambaran Umum Sistem

SIMOBI adalah aplikasi web untuk memonitor armada buggy listrik secara real-time di lingkungan Universitas Diponegoro. Sistem ini membantu pengguna umum, driver, dan admin kampus dalam melihat posisi buggy, kondisi armada, halte, rute, riwayat perjalanan, serta area operasional melalui dashboard berbasis web.

Fokus utama sistem adalah:

- Menampilkan posisi buggy listrik secara real-time pada peta Google Maps.
- Menyediakan informasi operasional seperti ETA, kecepatan, halte saat ini, halte berikutnya, kapasitas, dan jumlah penumpang.
- Mengelola data buggy, halte, geofence, akun, notifikasi, dan riwayat perjalanan melalui dashboard admin.
- Memberikan tampilan khusus untuk driver berdasarkan buggy yang ditugaskan.
- Menerima data GPS dari simulator atau perangkat lapangan melalui MQTT bridge.
- Menyimpan histori GPS dan sesi perjalanan ke Supabase PostgreSQL.
- Mendukung bahasa Indonesia dan Inggris melalui routing `/id` dan `/en`.

Sistem ini bukan hanya aplikasi peta, tetapi juga dashboard operasional yang menggabungkan web application, IoT-style telemetry, database, autentikasi, otorisasi, dan visualisasi peta.

---

## 2. Peran Pengguna

| Peran | Akses dan Fungsi |
| --- | --- |
| Pengguna umum | Melihat peta buggy, halte, rute, ETA, detail buggy, rekomendasi halte terdekat, dan fitur favorit jika sudah login. |
| Driver | Melihat dashboard terbatas sesuai buggy yang ditugaskan. Driver tidak mendapat akses penuh seperti admin. |
| Admin | Mengelola buggy, halte, geofence, akun, notifikasi, statistik operasional, dan riwayat perjalanan. |

Pembagian peran dilakukan melalui Supabase Auth dan tabel `accounts`. Role yang dipakai pada aplikasi adalah `Admin`, `Driver`, dan `Pengguna umum`.

---

## 3. Fitur yang Sudah Ada pada Web

### 3.1 Dashboard Publik

Dashboard publik digunakan oleh pengguna umum untuk melihat kondisi transportasi buggy kampus.

Fitur utama:

- Peta Google Maps berisi marker buggy dan halte.
- Daftar buggy aktif.
- Detail buggy, termasuk kapasitas, penumpang, kecepatan, ETA, halte saat ini, dan halte berikutnya.
- Pencarian rute dari lokasi pengguna menuju tujuan.
- Rekomendasi halte terdekat.
- Notifikasi browser ketika buggy mendekati halte.
- Favorit buggy dan halte untuk pengguna yang sudah login.
- Tampilan responsif dengan top bar, sidebar desktop, dan bottom navigation mobile.

### 3.2 Dashboard Admin

Dashboard admin berfungsi sebagai pusat pengelolaan operasional.

Fitur utama:

- Statistik operasional armada.
- Data buggy dan detail operasional buggy.
- Penambahan dan pengelolaan buggy.
- Data halte dan pengelolaan halte.
- Manajemen geofence berbasis titik pusat dan radius.
- Log event geofence.
- Riwayat sesi perjalanan buggy.
- Manajemen akun admin dan driver.
- Manajemen notifikasi atau pengumuman.
- Pengaturan aplikasi, bahasa, tampilan peta, notifikasi browser, dan akun.

### 3.3 Dashboard Driver

Dashboard driver memiliki akses terbatas. Jika akun memiliki role `Driver` dan memiliki `buggy_id`, maka tampilan dashboard akan difilter agar driver hanya melihat buggy yang ditugaskan.

Fitur utama:

- Monitoring buggy yang ditugaskan.
- Informasi posisi dan status operasional.
- Tampilan yang tidak memberikan akses penuh ke pengelolaan admin.

### 3.4 GPS Tracker Simulator

Halaman `/gps-tracker` digunakan untuk pengujian data GPS tanpa menunggu perangkat hardware final.

Fitur utama:

- Publish data GPS ke MQTT WebSocket.
- Mode simulasi satu device.
- Mode simulasi beberapa buggy.
- Payload berisi `buggyId`, `lat`, `lng`, `speedKmh`, `heading`, `altitude`, `accuracy`, `batteryLevel`, `passengers`, `capacity`, `sessionStart`, `sessionEnd`, `timestamp`, dan `source`.
- Halaman ini hanya boleh diakses admin.

---

## 4. Tech Stack

| Layer | Teknologi |
| --- | --- |
| Framework web | Next.js 16 App Router |
| UI runtime | React 19 |
| Bahasa | TypeScript |
| Styling | Tailwind CSS 4, custom glass-style UI, lucide-react |
| Backend API | Next.js Route Handlers |
| Database | Supabase PostgreSQL |
| Autentikasi | Supabase Auth dan `@supabase/ssr` |
| Realtime telemetry | MQTT, MQTT bridge worker, protected GPS ingest API |
| Peta | Google Maps JavaScript API |
| Internasionalisasi | i18next, react-i18next, routing `/id` dan `/en` |
| Deployment model | Web app di Vercel, MQTT bridge sebagai worker/service terpisah |

Script utama pada `package.json`:

- `npm run dev` untuk development server.
- `npm run build` untuk build production.
- `npm run start` untuk menjalankan build.
- `npm run lint` untuk ESLint.

---

## 5. Arsitektur Sistem

Arsitektur utama aplikasi:

```text
GPS Tracker / Simulator / Hardware
        |
        v
MQTT Broker
        |
        v
MQTT Bridge Worker
        |
        v
POST /api/gps-beacon
        |
        +--> Live Buggy Store
        |
        +--> Supabase PostgreSQL
                 |
                 v
GET /api/buggy
        |
        v
Dashboard Web SIMOBI
        |
        v
Google Maps UI
```

Penjelasan arsitektur:

1. Perangkat GPS, simulator, atau hardware buggy mengirim data ke broker MQTT.
2. MQTT bridge worker melakukan subscribe pada topic `buggy/+/data`.
3. Worker mengubah atau menormalisasi payload, lalu meneruskannya ke endpoint `POST /api/gps-beacon`.
4. Endpoint ingest memvalidasi token, memuat data master buggy/halte dari Supabase, memperbarui live store, dan menyimpan telemetry ke database.
5. Frontend membaca data terbaru melalui `GET /api/buggy`.
6. UI menampilkan posisi buggy pada Google Maps dan panel dashboard.

Frontend tidak membaca data langsung dari MQTT broker. Semua data masuk melalui backend agar validasi, keamanan, persistence, dan format data tetap konsisten.

---

## 6. Alur Data Realtime

### 6.1 Alur Data GPS

1. GPS tracker atau simulator membuat payload telemetry.
2. Payload dikirim ke MQTT topic `buggy/{numericId}/data`.
3. MQTT bridge subscribe ke `buggy/+/data`.
4. Bridge meneruskan data ke `POST /api/gps-beacon` dengan header `Authorization: Bearer <BUGGY_INGEST_TOKEN>`.
5. API `gps-beacon` melakukan:
   - Validasi token ingest.
   - Validasi payload JSON.
   - Lazy bootstrap data `buggies` dan `haltes` dari Supabase.
   - Mapping `buggyId` numerik ke ID buggy yang digunakan aplikasi.
   - Update live store.
   - Insert ke `buggy_history` dengan pembatasan 1 insert per 10 detik per buggy.
   - Akumulasi titik perjalanan ke session store.
6. Jika `sessionStart` bernilai true, sistem memulai sesi perjalanan.
7. Jika `sessionEnd` bernilai true, sistem menutup sesi, menyimpan ringkasan ke `buggy_session_history`, dan menonaktifkan buggy pada live store.

### 6.2 Alur Feed Frontend

Frontend memakai hook `useBuggyLiveFeed`.

Mode feed:

- `poll`: mengambil data `GET /api/buggy` setiap 1,5 detik. Mode ini menjadi default.
- `sse`: menggunakan `GET /api/buggy/stream` sebagai Server-Sent Events.

Pada deployment serverless, data in-memory tidak selalu stabil. Karena itu `GET /api/buggy` juga menggabungkan snapshot live store dengan telemetry terbaru dari Supabase melalui `lib/supabase/latest-buggy-telemetry.ts`.

---

## 7. Pembahasan MQTT Mosquitto dan MQTT Bridge

Bagian MQTT pada sistem SIMOBI dipisahkan menjadi beberapa service agar arsitektur lebih rapi dan sesuai kebutuhan produksi. Pemisahan ini penting karena aplikasi Next.js berjalan sebagai web app/API, sedangkan MQTT broker dan MQTT bridge harus berjalan sebagai proses long-running.

### 7.1 Mosquitto Broker

Mosquitto broker adalah service MQTT yang menerima publish data dari perangkat GPS atau simulator. Pada project ini broker ditempatkan pada folder sibling:

```text
../simobi-mosquitto-broker
```

Fungsi utama Mosquitto broker:

- Menerima data telemetry dari perangkat buggy.
- Menyediakan topic MQTT untuk data, status, dan command.
- Mengatur autentikasi username/password.
- Mengatur ACL agar setiap device hanya dapat publish ke topic miliknya.
- Menjadi titik komunikasi antara device dan MQTT bridge.

Konvensi topic yang digunakan:

```text
buggy/{buggyId}/data
buggy/{buggyId}/status
buggy/{buggyId}/cmd
```

Contoh:

```text
username device: 1
publish data:    buggy/1/data
read command:    buggy/1/cmd
```

Bridge/backend menggunakan user khusus, misalnya `simobi_bridge`, untuk membaca data dari:

```text
buggy/+/data
```

Dengan pola ini, broker dapat menerima banyak buggy tanpa perubahan kode pada aplikasi. Cukup menambah akun device dan memastikan `buggyId` atau `numeric_id` sesuai dengan data pada tabel `buggies`.

### 7.2 Keamanan Broker dan ACL

Konfigurasi broker menggunakan `allow_anonymous false`, sehingga client MQTT tidak bisa terhubung tanpa username dan password. File konfigurasi utama berada pada:

```text
../simobi-mosquitto-broker/config/mosquitto.conf
```

Konsep ACL yang digunakan:

- `simobi_bridge` boleh membaca `buggy/+/data` dan `buggy/+/status`.
- `simobi_bridge` boleh menulis ke `buggy/+/cmd` jika nantinya command queue diimplementasikan.
- Device hanya boleh menulis ke topic miliknya sendiri, misalnya `buggy/%u/data`.
- Device hanya boleh membaca command miliknya sendiri, misalnya `buggy/%u/cmd`.
- Frontend tidak memiliki user MQTT karena frontend tidak boleh connect langsung ke broker.

Dengan ACL ini, device `1` tidak boleh publish ke `buggy/2/data`. Hal ini penting untuk mencegah satu device mengirim data atas nama device lain.

### 7.3 Persistence pada Mosquitto

Mosquitto memiliki file internal `mosquitto.db`. File ini bukan database aplikasi dan bukan tempat menyimpan histori GPS SIMOBI.

Fungsi `mosquitto.db`:

- Menyimpan retained message.
- Menyimpan queued message.
- Menyimpan session/subscription state MQTT.
- Membantu broker memulihkan state internal setelah restart.

Histori perjalanan dan telemetry aplikasi tetap disimpan di Supabase, khususnya pada tabel:

- `buggy_history`
- `buggy_session_history`

Jadi, Mosquitto bertugas sebagai transport layer, sedangkan Supabase bertugas sebagai application database.

### 7.4 Deploy Mosquitto

Broker Mosquitto dibuat sebagai service Docker dengan struktur:

```text
simobi-mosquitto-broker/
├── Dockerfile
├── fly.toml
├── docker-entrypoint.sh
└── config/
    ├── mosquitto.conf
    └── aclfile
```

Pada konfigurasi Fly.io, broker membuka port TCP `1883` dan memakai persistent volume pada `/mosquitto/data`. Konfigurasi broker dibuat agar machine tidak auto-stop:

```text
auto_stop_machines = "off"
auto_start_machines = false
min_machines_running = 1
```

Alasannya, MQTT broker harus selalu hidup untuk menerima koneksi dari perangkat. Jika broker berhenti, device tidak dapat publish telemetry.

`docker-entrypoint.sh` membuat file password dari environment variable seperti `MQTT_USERNAME_1`, `MQTT_PASSWORD_1`, dan seterusnya. Script ini juga memastikan folder `/mosquitto/data` dan `/mosquitto/log` dimiliki user `mosquitto`, sehingga broker dapat menulis file persistence tanpa error permission.

### 7.5 MQTT Bridge Production

MQTT bridge production berada pada folder sibling:

```text
../mqtt-bridge-service
```

Bridge ini adalah worker Node.js yang menghubungkan MQTT broker dengan backend SIMOBI.

Fungsi utama bridge:

- Connect ke MQTT broker menggunakan `MQTT_SERVER`, `MQTT_USER`, dan `MQTT_PASS`.
- Subscribe ke topic telemetry, misalnya `buggy/+/data`.
- Membaca payload JSON dari device.
- Memvalidasi bahwa `lat` dan `lng` tersedia.
- Mengambil `buggyId` dari payload atau dari topic `buggy/{id}/data`.
- Menormalisasi field dari device, misalnya `speed` menjadi `speedKmh`.
- Forward data ke endpoint SIMOBI:

```text
POST /api/gps-beacon
Authorization: Bearer <BUGGY_INGEST_TOKEN>
```

Bridge juga memiliki health endpoint:

```text
GET /health
```

Health endpoint digunakan oleh platform deployment untuk memastikan service masih berjalan.

Environment penting untuk bridge production:

```text
MQTT_SERVER=mqtt://simobi-mosquitto-broker.fly.dev:1883
MQTT_USER=simobi_bridge
MQTT_PASS=<password_bridge>
MQTT_TOPIC=buggy/+/data
API_URL=https://www.simobi.my.id/api/gps-beacon
BUGGY_INGEST_TOKEN=<token_yang_sama_dengan_web>
PORT=8080
DEFAULT_ACCURACY=10
```

Bridge harus berjalan sebagai long-running worker. Service seperti ini tidak cocok dijalankan di Vercel serverless karena bridge perlu mempertahankan koneksi MQTT secara terus-menerus.

### 7.7 Alur Produksi yang Disarankan untuk Skripsi

Alur produksi yang dapat dijelaskan pada BAB III atau BAB IV:

```text
ESP32 / GPS device
  -> Mosquitto MQTT Broker
  -> mqtt-bridge-service
  -> POST /api/gps-beacon
  -> Live Buggy Store + Supabase PostgreSQL
  -> GET /api/buggy
  -> Dashboard SIMOBI
```

Penjelasan singkat:

1. Device membaca GPS dan telemetry.
2. Device publish payload ke topic `buggy/{id}/data`.
3. Mosquitto broker menerima payload dan menerapkan autentikasi serta ACL.
4. `mqtt-bridge-service` membaca data dari broker.
5. Bridge meneruskan payload ke backend SIMOBI melalui endpoint protected.
6. Backend menyimpan data ke live store dan Supabase.
7. Dashboard mengambil snapshot terbaru dari backend dan menampilkannya pada peta.

### 7.8 Alasan Menggunakan Broker dan Bridge Terpisah

Pemakaian Mosquitto dan MQTT bridge terpisah memberikan beberapa manfaat:

- Aplikasi web tidak perlu membuka koneksi langsung ke MQTT broker.
- Secret broker tidak terekspos ke browser.
- Format payload device dapat dinormalisasi sebelum masuk backend.
- Endpoint backend tetap menjadi satu pintu masuk data telemetry.
- Broker dan bridge dapat dideploy, dimonitor, dan diskalakan terpisah dari web app.
- Arsitektur lebih mudah dijelaskan dan diuji pada skripsi.

---

## 8. Database Supabase PostgreSQL

Database utama yang digunakan adalah Supabase PostgreSQL. Tabel-tabel berikut menjadi bagian penting sistem.

### 8.1 `accounts`

Menyimpan profil pengguna dan role.

Kegunaan:

- Menentukan role user: `Admin`, `Driver`, atau `Pengguna umum`.
- Menyimpan assignment driver melalui `buggy_id`.
- Menyimpan favorit pengguna melalui `favorite_haltes` dan `favorite_buggies`.
- Dipakai oleh dashboard untuk membatasi akses dan menyesuaikan tampilan.

### 8.2 `buggies`

Menyimpan master data armada buggy.

Field penting yang digunakan aplikasi:

- `id`
- `code`
- `name`
- `capacity`
- `is_active`
- `numeric_id`

`numeric_id` penting karena data GPS dari simulator atau hardware biasanya mengirim ID numerik, sedangkan data aplikasi memakai ID dari database.

### 8.3 `haltes`

Menyimpan data halte kampus.

Field penting:

- `id`
- `name`
- `lat`
- `lng`
- `sort_order`
- `is_active`
- `schedule`
- `facilities`

Data halte dimuat ke runtime agar peta, detail halte, dan pencarian rute dapat bekerja.

### 8.4 `geofences`

Menyimpan area operasional buggy.

Implementasi geofence saat ini berbasis titik pusat dan radius, bukan polygon kompleks.

Field penting:

- `id`
- `name`
- `center_lat`
- `center_lng`
- `radius_meters`
- `enabled`
- `created_at`

Admin dapat menambahkan, mengaktifkan, menonaktifkan, dan menghapus geofence.

### 8.5 `announcements`

Menyimpan notifikasi atau pengumuman yang dapat dikelola admin dan ditampilkan pada dashboard.

### 8.6 `buggy_history`

Menyimpan raw telemetry GPS.

Data yang disimpan mencakup:

- ID buggy.
- ID numerik buggy.
- Latitude dan longitude.
- Kecepatan.
- Akurasi.
- Heading.
- Altitude.
- Level baterai.
- Jumlah penumpang.
- Kapasitas.
- Sumber data.
- Waktu perekaman.

Insert ke tabel ini dibatasi maksimal sekali setiap 10 detik per buggy agar database tidak terlalu berat.

### 8.7 `buggy_session_history`

Menyimpan ringkasan sesi perjalanan.

Data yang disimpan mencakup:

- Buggy ID.
- Tanggal sesi.
- Waktu mulai dan selesai.
- Durasi perjalanan.
- Jumlah titik GPS.
- Total jarak.
- Kecepatan rata-rata.
- Baterai awal dan akhir.
- Estimasi baterai terpakai.
- Path perjalanan.

Tabel ini digunakan oleh panel riwayat perjalanan dan statistik operasional admin.

---

## 9. Endpoint API

| Method | Endpoint | Fungsi |
| --- | --- | --- |
| `GET` | `/api/buggy` | Mengambil snapshot buggy terbaru untuk frontend. |
| `GET` | `/api/buggy/stream` | Alternatif live feed menggunakan SSE. |
| `POST` | `/api/gps-beacon` | Ingest data GPS dari MQTT bridge atau simulator. |
| `POST` | `/api/buggy/ingest` | Ingest snapshot atau telemetry legacy. |
| `GET` | `/api/buggy-history` | Mengambil histori GPS, hanya untuk admin. |
| `GET` | `/api/buggy-sessions` | Mengambil riwayat sesi perjalanan, hanya untuk admin. |
| `POST` | `/api/buggy-sessions/delete` | Menghapus sesi perjalanan, hanya untuk admin. |
| `GET/POST` | `/api/haltes` | Membaca dan menambah halte. |
| `GET/PATCH/DELETE` | `/api/haltes/[id]` | Mengelola detail halte. |
| `GET/POST` | `/api/geofences` | Membaca dan menambah geofence. |
| `GET/PATCH/DELETE` | `/api/geofences/[id]` | Mengelola status dan data geofence. |
| `GET` | `/api/announcements` | Membaca pengumuman publik. |
| `GET/POST/PATCH/DELETE` | `/api/admin/accounts` | Manajemen akun admin/driver. |
| `POST` | `/api/admin/buggies` | Menambah data buggy. |
| `PATCH/DELETE` | `/api/admin/buggies/[id]` | Mengubah atau menghapus buggy. |
| `GET` | `/api/admin/statistics` | Statistik operasional bulanan. |
| `GET/POST` | `/api/admin/announcements` | Manajemen pengumuman admin. |
| `GET` | `/api/auth/callback` | Callback Supabase Auth. |

---

## 10. Autentikasi, Otorisasi, dan Keamanan

### 10.1 Supabase Auth

Sistem menggunakan Supabase Auth untuk login, register, reset password, dan session user. Client Supabase dibuat di:

- `lib/supabase/client.ts` untuk client component.
- `lib/supabase/server.ts` untuk server route dan server-side operation.

### 10.2 Role-Based Access

Role pengguna disimpan pada tabel `accounts`.

Route yang dilindungi oleh `proxy.ts`:

- `/admin`
- `/driver`
- `/gps-tracker`
- `/api/admin/*`
- `/api/geofences/*`
- `/api/buggy-sessions/*`
- `/api/buggy-history`

Aturan akses penting:

- User yang belum login diarahkan ke halaman login.
- User umum tidak boleh masuk ke admin atau driver page.
- `/gps-tracker` hanya dapat diakses admin.
- API admin dan history hanya dapat diakses admin.
- API geofence untuk method selain `GET` hanya dapat diakses admin.

### 10.3 Admin Guard

`lib/auth/admin-guard.ts` menyediakan fungsi `requireAdmin()`. Fungsi ini mengecek Supabase session, lalu membaca `accounts.role`. Jika user belum login, API membalas `401`. Jika bukan admin, API membalas `403`.

### 10.4 Ingest Token

Endpoint telemetry dilindungi oleh `BUGGY_INGEST_TOKEN`.

Endpoint yang membutuhkan token:

- `POST /api/gps-beacon`
- `POST /api/buggy/ingest`

Jika `BUGGY_INGEST_TOKEN` belum dikonfigurasi, endpoint akan fail-closed dengan status error agar sistem tidak menerima data telemetry secara terbuka.

---

## 11. Komponen Frontend Penting

| Komponen / Hook | Fungsi |
| --- | --- |
| `components/map/MapCanvas.tsx` | Render Google Maps, marker, route, dan visualisasi peta. |
| `components/buggy/PanelActive.tsx` | Daftar buggy aktif. |
| `components/buggy/BuggyDetailView.tsx` | Detail buggy yang dipilih. |
| `components/data/AdminDataSection.tsx` | Panel admin untuk Statistik, Buggy, dan Geofence. |
| `components/data/AdminStatisticsPanel.tsx` | Statistik operasional armada. |
| `components/data/GeofenceManager.tsx` | Manajemen geofence. |
| `components/history/HistoryPanel.tsx` | Riwayat sesi perjalanan. |
| `components/settings/AppSettingsPanel.tsx` | Pengaturan aplikasi, bahasa, akun, dan preferensi. |
| `components/sidebar/FloatingSidebar.tsx` | Sidebar desktop. |
| `components/sidebar/MobileBottomNav.tsx` | Navigasi mobile. |
| `hooks/useBuggyLiveFeed.ts` | Mengambil data buggy realtime. |
| `hooks/useDirectionSearch.ts` | Pencarian rute. |
| `hooks/useNearestHaltes.ts` | Rekomendasi halte terdekat. |
| `hooks/useNearbyBusAlert.ts` | Notifikasi buggy mendekat. |
| `hooks/useFavorites.ts` | Favorit halte dan buggy. |
| `hooks/useUserRole.ts` | Membaca role user aktif. |

---

## 12. Komponen Backend Penting

| File | Fungsi |
| --- | --- |
| `app/api/gps-beacon/route.ts` | Endpoint ingest GPS utama. |
| `app/api/buggy/route.ts` | Snapshot buggy terbaru untuk frontend. |
| `app/api/buggy/stream/route.ts` | SSE live feed. |
| `lib/realtime/buggy-live-store.ts` | Menyimpan snapshot live buggy di memori. |
| `lib/realtime/session-store.ts` | Mengelola sesi perjalanan dan finalisasi sesi. |
| `lib/supabase/data-loader.ts` | Lazy bootstrap data buggy dan halte dari Supabase. |
| `lib/supabase/latest-buggy-telemetry.ts` | Menggabungkan data terbaru dari history untuk frontend. |
| `lib/geofence-store.ts` | Operasi baca/tulis geofence ke Supabase. |
| `lib/auth/admin-guard.ts` | Guard admin untuk route handler. |
| `lib/auth/ingest-token.ts` | Validasi bearer token untuk endpoint ingest. |
| `proxy.ts` | Routing locale, refresh session Supabase, dan proteksi route. |

---

## 13. Statistik dan Riwayat Operasional

Sistem menyimpan dua jenis data historis:

1. Raw telemetry pada `buggy_history`.
2. Ringkasan sesi pada `buggy_session_history`.

Panel statistik admin mengambil data dari sesi perjalanan. Statistik yang dihitung saat ini meliputi:

- Total trip bulan berjalan.
- Total jarak bulan berjalan.
- Kecepatan rata-rata.
- Total durasi perjalanan.
- Tren trip dibanding bulan sebelumnya.
- Tren jarak dibanding bulan sebelumnya.
- Seri harian.
- Top buggy berdasarkan jarak.

Catatan penting:

- Metrik penumpang historis pada endpoint statistik saat ini belum dihitung dari sesi, sehingga ditandai sebagai unavailable.
- Jumlah penumpang tetap dapat muncul pada data live buggy karena payload telemetry mendukung field `passengers` dan `capacity`.

---

## 14. Internasionalisasi dan PWA

Sistem mendukung dua locale:

- `/id` untuk bahasa Indonesia.
- `/en` untuk bahasa Inggris.

Pengaturan locale dilakukan melalui:

- `lib/i18n/config.ts`
- `lib/i18n/resources.ts`
- `lib/i18n/routing.ts`
- `app/[locale]/layout.tsx`
- `proxy.ts`

Locale dipilih berdasarkan URL, cookie `NEXT_LOCALE`, dan fallback browser language.

PWA metadata tersedia melalui:

- `app/manifest.ts`
- `app/favicon.ico`
- `public/logo.svg`

---

## 15. Deployment dan Batas Repo

Runtime aplikasi Next.js berada di repo `real_web`, terutama folder:

- `app`
- `components`
- `hooks`
- `lib`
- `types`
- `data`

MQTT bridge production dan simulator tidak dijadikan bagian dari runtime Next.js. Keduanya dipisahkan sebagai worker/service terpisah karena bridge harus berjalan terus-menerus untuk subscribe MQTT, sedangkan Vercel serverless tidak cocok untuk proses long-running.

Boundary penting:

- Web app dan API: Next.js.
- Database dan Auth: Supabase.
- MQTT bridge: service worker terpisah.
- MQTT broker: service terpisah.
- Simulator GPS: halaman `/gps-tracker` dan/atau bridge simulator.

---

## 16. Kesesuaian dengan Topik Skripsi

Topik skripsi dapat diarahkan sebagai:

> Perancangan dan Implementasi Sistem Monitoring Real-Time Armada Buggy Listrik Berbasis Web, MQTT, dan Supabase pada Lingkungan Kampus Universitas Diponegoro.

Alasan topik ini sesuai:

- Ada masalah nyata: pengguna membutuhkan informasi posisi dan ketersediaan buggy.
- Ada aspek IoT: data GPS/telemetry dikirim melalui MQTT.
- Ada aspek web engineering: dashboard publik, admin, driver, API, auth, dan i18n.
- Ada aspek database: penyimpanan master data, telemetry history, dan trip session.
- Ada aspek keamanan: role-based access dan protected ingest endpoint.
- Ada aspek pengujian: simulator GPS dapat digunakan untuk uji end-to-end tanpa hardware final.

---

## 17. Rekomendasi Struktur BAB Skripsi

### BAB I - Pendahuluan

Bahas:

- Latar belakang transportasi kampus.
- Masalah ketidakpastian posisi buggy dan informasi kedatangan.
- Kebutuhan sistem monitoring real-time.
- Rumusan masalah.
- Batasan masalah.
- Tujuan penelitian.
- Manfaat penelitian.

### BAB II - Tinjauan Pustaka

Sub-bab yang relevan:

- Penelitian terdahulu.
- Sistem informasi transportasi.
- Smart mobility.
- Buggy listrik sebagai transportasi kampus.
- GPS dan telemetry.
- Internet of Things.
- MQTT.
- Sistem real-time.
- Web application.
- Next.js, React, dan TypeScript.
- Supabase dan PostgreSQL.
- Autentikasi dan otorisasi.
- Google Maps API.
- Geofencing.
- Dashboard monitoring.
- Black-box testing.
- User Acceptance Test.
- Kerangka berpikir.

Catatan: detail alur implementasi seperti `GPS -> MQTT -> API -> Supabase -> Dashboard` lebih cocok dijelaskan mendalam di BAB III atau BAB IV.

### BAB III - Metodologi / Perancangan Sistem

Bahas:

- Metode pengembangan sistem.
- Kebutuhan fungsional dan nonfungsional.
- Use case pengguna umum, driver, dan admin.
- Arsitektur sistem.
- Alur data realtime.
- Perancangan database.
- Perancangan API.
- Perancangan antarmuka.
- Perancangan keamanan.
- Perancangan pengujian.

### BAB IV - Implementasi dan Pengujian

Bahas:

- Implementasi frontend Next.js.
- Implementasi peta Google Maps.
- Implementasi Supabase Auth.
- Implementasi role-based access.
- Implementasi endpoint ingest GPS.
- Implementasi MQTT bridge.
- Implementasi live feed polling/SSE.
- Implementasi histori perjalanan.
- Implementasi admin dashboard.
- Pengujian fungsi utama.
- Pengujian pipeline simulator.
- Pengujian akses role.
- Pengujian API.

### BAB V - Penutup

Bahas:

- Kesimpulan hasil implementasi.
- Keterbatasan sistem.
- Saran pengembangan.

---

## 18. Batasan Sistem Saat Ini

Batasan yang sebaiknya dijelaskan secara jujur di skripsi:

- Hardware final dapat digantikan simulator selama tahap pengujian.
- MQTT bridge harus berjalan sebagai service terpisah.
- Live store in-memory tidak menjadi satu-satunya sumber kebenaran pada deployment serverless; data terbaru juga dibaca dari Supabase history.
- Statistik penumpang historis belum dihitung sebagai metrik permanen pada endpoint statistik.
- Remote engine cut-off dan command queue masih cocok diposisikan sebagai rencana pengembangan, bukan fitur utama yang sudah selesai.
- Akurasi ETA dan geofence bergantung pada kualitas data GPS, interval pengiriman, dan koneksi jaringan.

---

## 19. Rencana Pengembangan Lanjutan

Pengembangan berikutnya yang dapat ditulis sebagai saran:

- Integrasi hardware final pada buggy.
- Peningkatan konfigurasi broker production ke TLS penuh jika perangkat dan hosting sudah mendukung.
- Command queue untuk perintah jarak jauh seperti engine cut-off.
- ACK mechanism dari buggy ke server.
- Alert geofence yang lebih formal dan tersimpan permanen.
- Perhitungan ETA yang lebih cerdas berdasarkan histori perjalanan.
- Dashboard analitik penumpang historis.
- Pengujian lapangan dengan beberapa unit buggy.
- Optimasi performa ketika jumlah armada bertambah.

---

## 20. Ringkasan Singkat untuk Ditempel ke AI Lain

SIMOBI adalah sistem monitoring real-time armada buggy listrik kampus UNDIP berbasis Next.js 16, React 19, TypeScript, Supabase PostgreSQL/Auth, Google Maps API, dan MQTT. Sistem memiliki tiga peran pengguna: pengguna umum, driver, dan admin. Pengguna umum dapat melihat peta buggy, halte, ETA, rute, detail buggy, dan favorit. Driver melihat dashboard terbatas sesuai buggy yang ditugaskan. Admin dapat mengelola buggy, halte, geofence, akun, notifikasi, statistik, dan riwayat perjalanan.

Alur data utama adalah GPS tracker/simulator/hardware mengirim telemetry ke MQTT broker pada topic `buggy/{id}/data`. Broker production menggunakan Mosquitto pada folder sibling `simobi-mosquitto-broker`, dengan autentikasi username/password, ACL per device, persistence internal `mosquitto.db`, dan deployment long-running. MQTT bridge production berada pada folder sibling `mqtt-bridge-service`; worker ini subscribe ke `buggy/+/data`, menormalisasi payload, lalu meneruskan data ke endpoint protected `POST /api/gps-beacon`. Untuk data simulator `/gps-tracker`, terdapat service terpisah `mqtt-simulator-bridge-service` agar data testing tidak mengganggu pipeline production. Endpoint ingest memvalidasi `BUGGY_INGEST_TOKEN`, memperbarui live buggy store, menyimpan raw telemetry ke `buggy_history`, dan mengelola sesi perjalanan ke `buggy_session_history`. Frontend membaca data terbaru melalui `GET /api/buggy` dengan mode polling default setiap 1,5 detik atau alternatif SSE melalui `/api/buggy/stream`.

Database utama terdiri dari `accounts`, `buggies`, `haltes`, `geofences`, `announcements`, `buggy_history`, dan `buggy_session_history`. Sistem menggunakan `proxy.ts` dan `requireAdmin()` untuk role-based access, sedangkan endpoint ingest dilindungi bearer token. Geofence saat ini berbasis center point dan radius. Aplikasi mendukung bahasa Indonesia dan Inggris melalui route `/id` dan `/en`. Rencana pengembangan berikutnya meliputi integrasi hardware final, command queue, ACK mechanism, alert geofence permanen, dan pengujian lapangan.
