# Rangkuman Sistem SIMOBI untuk Penulisan Skripsi

> **Judul proyek:** Sistem Monitoring dan Tracking Real-Time Armada Buggy Listrik Kampus UNDIP
> **Nama aplikasi:** SIMOBI
> **Konteks:** Smart Mobility Universitas Diponegoro
> **Status dokumen:** Diperbarui sesuai kondisi repo saat ini, 1 Juni 2026
> **Tujuan dokumen:** Ringkasan teknis yang siap dipakai sebagai konteks untuk penulisan BAB skripsi, diskusi dengan dosen pembimbing, atau ditempel ke AI lain.

---

## 1. Gambaran Umum Sistem

SIMOBI adalah aplikasi web untuk memonitor armada buggy listrik secara real-time di lingkungan Universitas Diponegoro. Sistem ini membantu pengguna umum, driver, dan admin kampus dalam melihat posisi buggy, kondisi armada, halte, rute, riwayat perjalanan, serta area operasional melalui dashboard berbasis web.

Fokus utama sistem adalah:

- Menampilkan posisi buggy listrik secara real-time pada peta Google Maps.
- Menyediakan informasi operasional seperti ETA, kecepatan, halte saat ini, halte berikutnya, kapasitas, dan jumlah penumpang.
- Menampilkan posisi terakhir buggy (last known location) dan status koneksi ketika telemetry tidak lagi diterima akibat gangguan sinyal.
- Mengelola data buggy, halte, geofence, akun, notifikasi, dan riwayat perjalanan melalui dashboard admin.
- Memberikan tampilan khusus untuk driver berdasarkan buggy yang ditugaskan.
- Menerima data GPS dari simulator atau perangkat lapangan melalui MQTT bridge.
- Menyimpan histori GPS dan sesi perjalanan ke Supabase PostgreSQL.
- Mendukung Progressive Web App (PWA) dasar melalui manifest, ikon aplikasi, service worker, dan Web Push Notification.
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
- Daftar buggy dengan status koneksi, meliputi `Online`, `Signal unstable`, `Connection lost`, dan `Offline`.
- Detail buggy, termasuk kapasitas, penumpang, kecepatan, ETA, halte saat ini, dan halte berikutnya.
- Marker buggy tetap ditampilkan pada posisi terakhir ketika data GPS belum diperbarui.
- Pencarian rute dari lokasi pengguna menuju tujuan.
- Rekomendasi halte terdekat.
- Notifikasi browser dan Web Push ketika buggy mendekati halte terdekat pengguna.
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
| PWA dan push notification | Web App Manifest, Service Worker, Web Push API, VAPID, `web-push` |
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

Alur PWA Web Push berjalan paralel dengan alur monitoring:

```text
Browser Pengguna
        |
        v
Service Worker + Push Subscription
        |
        v
POST /api/push/subscribe
        |
        v
notification_subscriptions
        |
        v
POST /api/push/check-nearby
        |
        v
Web Push Notification
```

Penjelasan arsitektur:

1. Perangkat GPS, simulator, atau hardware buggy mengirim data ke broker MQTT.
2. MQTT bridge worker melakukan subscribe pada topic `buggy/+/data`.
3. Worker mengubah atau menormalisasi payload, lalu meneruskannya ke endpoint `POST /api/gps-beacon`.
4. Endpoint ingest memvalidasi token, memuat data master buggy/halte dari Supabase, memperbarui live store, dan menyimpan telemetry ke database.
5. Frontend membaca data terbaru melalui `GET /api/buggy`.
6. UI menampilkan posisi buggy pada Google Maps dan panel dashboard.
7. Saat pengguna mengaktifkan notifikasi, browser membuat Web Push subscription melalui service worker dan menyimpannya ke tabel `notification_subscriptions`.
8. Endpoint worker `/api/push/check-nearby` mengecek posisi buggy aktif terhadap halte terdekat dari posisi terakhir pengguna, lalu mengirim Web Push jika kondisi radius terpenuhi.

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
   - Upsert snapshot telemetry terbaru ke `latest_buggy_telemetry`.
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

### 6.3 Last Known Location dan Status Koneksi Buggy

Pada implementasi perangkat lapangan, modul SIM800 dapat mengalami kehilangan sinyal pada area tertentu, misalnya area yang tertutup banyak pohon. Untuk mengurangi dampak tersebut, SIMOBI menerapkan mekanisme **last known location**, yaitu tetap menampilkan posisi terakhir buggy yang berhasil diterima backend.

Setiap data GPS yang diterima `/api/gps-beacon` disimpan dengan dua konteks waktu:

- `recorded_at`, yaitu waktu data direkam oleh device atau payload.
- `received_at`, yaitu waktu server/backend menerima telemetry.
- `updated_at`, yaitu waktu baris terakhir diperbarui pada database.

Status koneksi buggy dihitung secara dinamis berdasarkan selisih waktu sekarang terhadap `received_at`. Jika data lama belum memiliki `received_at`, sistem memakai fallback ke `updated_at`, lalu `recorded_at`.

| Selisih dari `received_at` | Status |
| --- | --- |
| 0-10 detik | `Online` |
| 10-30 detik | `Signal unstable` |
| 30-60 detik | `Connection lost` |
| Lebih dari 60 detik | `Offline` |

Dengan mekanisme ini, buggy tidak langsung hilang dari dashboard ketika sinyal terputus. UI tetap menampilkan marker pada posisi terakhir, tetapi status koneksi berubah sehingga pengguna dapat membedakan antara buggy yang benar-benar bergerak dan buggy yang datanya belum diperbarui.

### 6.4 Alur Notifikasi Buggy Mendekati Halte

Sistem notifikasi buggy mendekati halte memiliki dua mode:

1. **Foreground browser notification**, yaitu notifikasi yang muncul ketika halaman SIMOBI masih aktif dan JavaScript frontend berjalan.
2. **PWA Web Push notification**, yaitu notifikasi yang dikirim melalui service worker dan Push API agar tetap dapat diterima ketika aplikasi web tidak sedang dibuka secara aktif, selama browser dan sistem operasi masih mengizinkan notifikasi.

Alur Web Push:

1. Pengguna mengaktifkan notifikasi pada pengaturan aplikasi.
2. Browser meminta izin Notification API.
3. Jika izin diberikan, service worker `/sw.js` didaftarkan.
4. Browser membuat Push Subscription menggunakan VAPID public key.
5. Frontend mengirim subscription, posisi terakhir pengguna, dan radius alert ke `POST /api/push/subscribe`.
6. Backend menyimpan data ke tabel `notification_subscriptions`.
7. Worker terjadwal atau cron memanggil `POST /api/push/check-nearby` dengan token `PUSH_WORKER_TOKEN` atau `CRON_SECRET`.
8. Backend membaca buggy yang masih layak dianggap realtime, halte, dan subscription pengguna.
9. Sistem mencari halte terdekat dari posisi terakhir pengguna dalam radius 500 meter.
10. Jika buggy dengan status `Online` atau `Signal unstable` berada dalam radius alert halte tersebut, backend mengirim Web Push Notification.
11. Sistem menyimpan `last_notified_key` dan `last_notified_at` untuk mencegah spam notifikasi.

Catatan penting: PWA web tidak dapat menjamin pembacaan lokasi pengguna secara real-time ketika aplikasi tertutup total. Karena itu, server menggunakan posisi terakhir yang berhasil disinkronkan saat aplikasi web aktif.

Buggy dengan status `Connection lost` atau `Offline` tidak digunakan sebagai dasar pengiriman notifikasi mendekati halte karena posisi tersebut berpotensi sudah tidak aktual.

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
- `latest_buggy_telemetry`

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
- Jumlah penumpang (`passengers`).
- Kapasitas.
- Sumber data.
- Waktu perekaman.

Insert ke tabel ini dibatasi maksimal sekali setiap 10 detik per buggy agar database tidak terlalu berat.

Perubahan terbaru: kolom `passengers` ditambahkan melalui migrasi `20260526062537_add_passengers_to_buggy_history.sql` untuk memungkinkan pelacakan historis jumlah penumpang per titik GPS.

### 8.7 `buggy_session_history`

Menyimpan ringkasan sesi perjalanan.

Data yang disimpan mencakup:

- Buggy ID.
- ID numerik buggy.
- Tanggal sesi.
- Nomor sesi buggy pada tanggal tersebut.
- Waktu mulai dan selesai.
- Durasi perjalanan.
- Jumlah titik GPS.
- Total jarak.
- Kecepatan rata-rata dan maksimum.
- Baterai awal dan akhir.
- Estimasi baterai terpakai.
- Rata-rata penumpang selama sesi (`passenger_avg`).
- Puncak penumpang tertinggi selama sesi (`passenger_peak`).
- Jumlah sampel pembacaan penumpang (`passenger_samples`).
- Path perjalanan.

Tabel ini digunakan oleh panel riwayat perjalanan dan statistik operasional admin.

Perubahan terbaru: kolom `passenger_avg`, `passenger_peak`, dan `passenger_samples` ditambahkan melalui migrasi `20260526061902_add_passenger_metrics_to_buggy_sessions.sql` untuk mendukung analitik penumpang historis per sesi.

### 8.8 `latest_buggy_telemetry`

Menyimpan snapshot telemetry terbaru per buggy. Tabel ini dibuat khusus untuk mendukung `GET /api/buggy` agar data terbaru dapat dibaca dari database meskipun live store in-memory direset (misalnya saat Vercel serverless cold start).

Fitur tabel:

- Satu baris per buggy (unique constraint pada `buggy_id`).
- Saat data baru masuk melalui `/api/gps-beacon`, baris untuk buggy tersebut di-upsert (update jika sudah ada, insert jika belum).
- Row Level Security (RLS) diaktifkan.

Data yang disimpan mencakup:

- `id` UUID primary key.
- `buggy_id` (unique, terhubung ke buggy aplikasi).
- `buggy_numeric_id` ID numerik device.
- `lat` dan `lng` posisi terbaru.
- `speed_kmh` kecepatan terbaru.
- `accuracy` akurasi GPS.
- `heading` arah pergerakan.
- `altitude` ketinggian.
- `battery_level` level baterai 0-100.
- `passengers` jumlah penumpang terbaru.
- `gsm` data status modul GSM (disimpan sebagai JSONB).
- `source` sumber data.
- `recorded_at` waktu data perangkat direkam.
- `received_at` waktu server menerima telemetry. Kolom ini digunakan untuk menghitung status koneksi dan kesegaran data.
- `updated_at` waktu baris terakhir diperbarui di database.

Tabel ini dibuat melalui migrasi `20260526054636_create_latest_buggy_telemetry.sql`. Kolom `received_at` ditambahkan melalui migrasi `20260601154749_add_received_at_to_latest_buggy_telemetry.sql`.

### 8.9 `notification_subscriptions`

Menyimpan data subscription Web Push untuk pengguna yang mengaktifkan notifikasi browser/PWA. Tabel ini digunakan oleh backend untuk mengirim notifikasi ketika buggy dengan data yang masih cukup segar mendekati halte terdekat dari posisi terakhir pengguna.

Fitur tabel:

- Satu endpoint push bersifat unique agar subscription browser tidak tersimpan ganda.
- Menyimpan kunci publik push (`p256dh`) dan authentication secret (`auth`) yang diperlukan untuk Web Push.
- Menyimpan posisi terakhir pengguna (`user_lat`, `user_lng`) sebagai dasar pencarian halte terdekat.
- Menyimpan radius alert per subscription melalui `nearby_radius_meters`.
- Menyimpan cooldown notifikasi melalui `last_notified_key` dan `last_notified_at`.
- Row Level Security (RLS) diaktifkan, sedangkan operasi tulis/baca dilakukan melalui server route menggunakan Supabase service role.

Data yang disimpan mencakup:

- `id` UUID primary key.
- `endpoint` URL endpoint Push API, unique per subscription.
- `p256dh` public key subscription.
- `auth` authentication secret subscription.
- `user_id` optional, mengarah ke `auth.users` jika pengguna sedang login.
- `user_agent` informasi browser/perangkat.
- `user_lat` dan `user_lng` posisi terakhir pengguna.
- `nearby_radius_meters` radius buggy dianggap mendekati halte.
- `last_notified_key` kombinasi buggy dan halte terakhir yang diberi notifikasi.
- `last_notified_at` waktu notifikasi terakhir.
- `created_at` dan `updated_at`.

Tabel ini dibuat melalui migrasi `20260601122722_create_notification_subscriptions.sql`.

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
| `POST` | `/api/push/subscribe` | Menyimpan atau memperbarui Web Push subscription pengguna. |
| `POST` | `/api/push/unsubscribe` | Menghapus Web Push subscription ketika pengguna menonaktifkan notifikasi. |
| `GET/POST` | `/api/push/check-nearby` | Worker endpoint untuk mengecek buggy mendekati halte pengguna dan mengirim Web Push Notification. |

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

### 10.5 Web Push Token dan VAPID

Fitur Web Push menggunakan VAPID key untuk mengirim notifikasi dari server ke browser. Konfigurasi environment yang digunakan:

- `NEXT_PUBLIC_WEB_PUSH_VAPID_PUBLIC_KEY` untuk public key yang dipakai browser saat membuat subscription.
- `WEB_PUSH_VAPID_PRIVATE_KEY` untuk private key yang dipakai server saat menandatangani pengiriman Web Push.
- `WEB_PUSH_VAPID_SUBJECT` sebagai identitas pengirim, misalnya email admin sistem.
- `PUSH_WORKER_TOKEN` atau `CRON_SECRET` untuk melindungi endpoint worker `/api/push/check-nearby`.

Endpoint worker push bersifat fail-closed. Jika token tidak cocok atau tidak dikirim, endpoint membalas `401 Unauthorized`. Hal ini mencegah pihak luar memicu proses pengecekan dan pengiriman notifikasi secara bebas.

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
| `hooks/useBrowserNotificationToggle.ts` | Mengelola izin Notification API, toggle notifikasi, dan sinkronisasi Web Push subscription. |
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
| `lib/push/client.ts` | Mendaftarkan service worker dan Web Push subscription dari sisi browser. |
| `lib/push/web-push.ts` | Konfigurasi VAPID dan pengiriman Web Push dari server. |
| `lib/push/nearby-alerts.ts` | Logika worker untuk mengecek buggy mendekati halte pengguna dan mengirim notifikasi. |
| `lib/geofence-store.ts` | Operasi baca/tulis geofence ke Supabase. |
| `lib/auth/admin-guard.ts` | Guard admin untuk route handler. |
| `lib/auth/ingest-token.ts` | Validasi bearer token untuk endpoint ingest. |
| `proxy.ts` | Routing locale, refresh session Supabase, dan proteksi route. |
| `public/sw.js` | Service worker untuk menerima push event dan membuka aplikasi saat notifikasi diklik. |

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

- Metrik penumpang historis kini tersedia melalui kolom `passenger_avg`, `passenger_peak`, dan `passenger_samples` pada tabel `buggy_session_history`.
- Tabel `latest_buggy_telemetry` juga menyimpan field `passengers` terbaru yang digunakan untuk merender kondisi penumpang secara real-time pada dashboard.
- Kapasitas buggy diambil dari data master `buggies.capacity`, bukan dari payload telemetry, untuk mencegah nilai stale device menimpa perubahan yang dilakukan dari admin panel.

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
- `public/icon-192.png`
- `public/icon-512.png`

Fitur PWA dan Web Push yang tersedia:

- Manifest aplikasi dengan mode `standalone`.
- Ikon aplikasi 192x192 dan 512x512.
- Service worker pada `public/sw.js`.
- Push event handler untuk menampilkan notifikasi melalui `showNotification`.
- Notification click handler untuk membuka kembali aplikasi.
- Subscription Web Push melalui endpoint `/api/push/subscribe`.
- Unsubscribe melalui endpoint `/api/push/unsubscribe`.
- Worker endpoint `/api/push/check-nearby` untuk mengecek kondisi buggy mendekati halte dan mengirim push.

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
- MQTT bridge: worker/service terpisah untuk subscribe MQTT.
- PWA service worker: file browser-side `public/sw.js` untuk Web Push, bukan MQTT bridge.
- Push checker: endpoint server `/api/push/check-nearby` yang dapat dipanggil oleh Vercel Cron atau scheduler eksternal.
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
- Progressive Web App.
- Service Worker dan Web Push Notification.
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
- Implementasi PWA, service worker, dan Web Push Notification.
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
- Live store in-memory tidak menjadi satu-satunya sumber kebenaran pada deployment serverless; data terbaru dibaca dari tabel `latest_buggy_telemetry` di Supabase sebagai fallback.
- Pada area dengan sinyal SIM800 lemah, sistem tetap menampilkan posisi terakhir buggy dan status koneksi. Namun, posisi aktual buggy tetap bergantung pada kapan telemetry terakhir berhasil diterima server.
- Notifikasi Web Push PWA memakai posisi terakhir pengguna yang berhasil disinkronkan saat aplikasi aktif. Browser web tidak menjamin pembacaan lokasi real-time ketika aplikasi tertutup total.
- Endpoint `/api/push/check-nearby` perlu dipanggil secara berkala oleh scheduler seperti Vercel Cron atau worker eksternal agar push notification dapat dikirim otomatis.
- Statistik penumpang historis kini sudah tersedia melalui kolom `passenger_avg`, `passenger_peak`, dan `passenger_samples` pada `buggy_session_history`; namun tampilan analitiknya di endpoint statistik masih dapat dikembangkan lebih lanjut.
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
- Integrasi cron production untuk Web Push checker dengan interval yang disesuaikan kebutuhan operasional.
- Peningkatan notifikasi menjadi preference per pengguna, misalnya radius, halte favorit, dan jam aktif notifikasi.
- Perhitungan ETA yang lebih cerdas berdasarkan histori perjalanan.
- Dashboard analitik penumpang historis.
- Pengujian lapangan dengan beberapa unit buggy.
- Optimasi performa ketika jumlah armada bertambah.

---

## 20. Ringkasan Singkat untuk Ditempel ke AI Lain

SIMOBI adalah sistem monitoring real-time armada buggy listrik kampus UNDIP berbasis Next.js 16, React 19, TypeScript, Supabase PostgreSQL/Auth, Google Maps API, MQTT, dan PWA Web Push Notification. Sistem memiliki tiga peran pengguna: pengguna umum, driver, dan admin. Pengguna umum dapat melihat peta buggy, halte, ETA, rute, detail buggy, status koneksi, posisi terakhir buggy, favorit, serta menerima notifikasi ketika buggy mendekati halte terdekat dari posisi terakhir pengguna. Driver melihat dashboard terbatas sesuai buggy yang ditugaskan. Admin dapat mengelola buggy, halte, geofence, akun, notifikasi, statistik, dan riwayat perjalanan.

Alur data utama adalah GPS tracker/simulator/hardware mengirim telemetry ke MQTT broker pada topic `buggy/{id}/data`. Broker production menggunakan Mosquitto pada folder sibling `simobi-mosquitto-broker`, dengan autentikasi username/password, ACL per device, persistence internal `mosquitto.db`, dan deployment long-running. MQTT bridge production berada pada folder sibling `mqtt-bridge-service`; worker ini subscribe ke `buggy/+/data`, menormalisasi payload, lalu meneruskan data ke endpoint protected `POST /api/gps-beacon`. Untuk data simulator `/gps-tracker`, terdapat service terpisah `mqtt-simulator-bridge-service` agar data testing tidak mengganggu pipeline production. Endpoint ingest memvalidasi `BUGGY_INGEST_TOKEN`, memperbarui live buggy store, menyimpan raw telemetry ke `buggy_history`, meng-upsert snapshot ke `latest_buggy_telemetry`, dan mengelola sesi perjalanan ke `buggy_session_history`. Setiap snapshot terbaru menyimpan `received_at` sebagai waktu server menerima telemetry. Field ini digunakan untuk menghitung status koneksi `Online`, `Signal unstable`, `Connection lost`, atau `Offline`, sehingga dashboard tetap dapat menampilkan last known location ketika sinyal SIM800 melemah. Frontend membaca data terbaru melalui `GET /api/buggy` dengan mode polling default setiap 1,5 detik atau alternatif SSE melalui `/api/buggy/stream`. Untuk notifikasi PWA, browser mendaftarkan service worker `/sw.js`, menyimpan push subscription ke `notification_subscriptions`, lalu endpoint `/api/push/check-nearby` mengirim Web Push ketika buggy dengan status `Online` atau `Signal unstable` mendekati halte terdekat pengguna.

Database utama terdiri dari `accounts`, `buggies`, `haltes`, `geofences`, `announcements`, `buggy_history`, `buggy_session_history`, `latest_buggy_telemetry`, dan `notification_subscriptions`. Tabel `latest_buggy_telemetry` menyimpan satu baris snapshot telemetry terbaru per buggy untuk mendukung fallback saat live store in-memory direset pada serverless deployment, termasuk kolom `received_at` untuk menentukan kesegaran data. Tabel `notification_subscriptions` menyimpan endpoint Web Push, key subscription, posisi terakhir pengguna, radius alert, dan cooldown notifikasi. Tabel `buggy_history` kini memiliki kolom `passengers` untuk pelacakan historis penumpang per titik GPS. Tabel `buggy_session_history` memiliki kolom `passenger_avg`, `passenger_peak`, dan `passenger_samples` untuk analitik penumpang per sesi perjalanan. Sistem menggunakan `proxy.ts` dan `requireAdmin()` untuk role-based access, sedangkan endpoint ingest dilindungi bearer token. Endpoint push checker dilindungi `PUSH_WORKER_TOKEN` atau `CRON_SECRET`. Geofence saat ini berbasis center point dan radius. Aplikasi mendukung bahasa Indonesia dan Inggris melalui route `/id` dan `/en`. Rencana pengembangan berikutnya meliputi integrasi hardware final, command queue, ACK mechanism, alert geofence permanen, notifikasi berbasis preferensi pengguna, dan pengujian lapangan.
