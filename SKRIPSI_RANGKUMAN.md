# Rangkuman Sistem SIMOBI untuk Penulisan Skripsi

> **Judul proyek:** Sistem Monitoring dan Tracking Real-Time Armada Buggy Listrik Kampus UNDIP
> **Nama aplikasi:** SIMOBI
> **Konteks:** Smart Mobility Universitas Diponegoro
> **Status dokumen:** Diperbarui sesuai kondisi repo dan data operasional terakhir, 19 Juni 2026
> **Tujuan dokumen:** Ringkasan teknis yang siap dipakai sebagai konteks untuk penulisan BAB skripsi, diskusi dengan dosen pembimbing, atau ditempel ke AI lain.

---

## 1. Gambaran Umum Sistem

SIMOBI adalah aplikasi web untuk memonitor armada buggy listrik secara real-time di lingkungan Universitas Diponegoro. Sistem ini membantu pengguna umum, driver, dan admin kampus dalam melihat posisi buggy, kondisi armada, halte, rute, riwayat perjalanan, serta area operasional melalui dashboard berbasis web.

Fokus utama sistem adalah:

- Menampilkan posisi buggy listrik secara real-time pada peta Google Maps.
- Menyediakan informasi operasional seperti ETA, kecepatan, halte saat ini, halte berikutnya, kapasitas, dan jumlah penumpang.
- Menampilkan posisi terakhir buggy (last known location) dan status koneksi ketika telemetry tidak lagi diterima akibat gangguan sinyal.
- Mengelola data buggy, halte, geofence, akun, notifikasi, dan riwayat perjalanan melalui panel admin pada dashboard utama.
- Mengatur visibilitas armada melalui fitur **Hide Fleet** agar armada tertentu dapat disembunyikan dari daftar operasional tanpa menghapus master data.
- Menyesuaikan tampilan dashboard berdasarkan role pengguna, termasuk akses driver berdasarkan buggy yang ditugaskan.
- Menerima data GPS dari simulator atau perangkat lapangan melalui MQTT bridge.
- Menerima data status GSM/MQTT dari topic status MQTT yang lebih ringan dan terpisah dari data posisi GPS.
- Menyimpan histori GPS dan sesi perjalanan ke Supabase PostgreSQL.
- Mendukung Progressive Web App (PWA) dasar melalui manifest, ikon aplikasi, service worker, dan Web Push Notification.
- Mendukung bahasa Indonesia dan Inggris melalui routing `/id` dan `/en`.

Sistem ini bukan hanya aplikasi peta, tetapi juga dashboard operasional yang menggabungkan web application, IoT-style telemetry, database, autentikasi, otorisasi, dan visualisasi peta.

---

## 2. Peran Pengguna

| Peran | Akses dan Fungsi |
| --- | --- |
| Pengguna umum | Melihat peta buggy, halte, rute, ETA, detail buggy, rekomendasi halte terdekat, dan fitur favorit jika sudah login. Pencarian rute/directions dapat digunakan tanpa login karena termasuk fitur publik. |
| Driver | Melihat dashboard terbatas sesuai buggy yang ditugaskan, termasuk statistik dan riwayat perjalanan khusus buggy tersebut. Driver tidak mendapat akses penuh seperti admin. |
| Admin | Mengelola buggy, halte, geofence, akun, notifikasi, statistik operasional, dan riwayat perjalanan. |

Pembagian peran dilakukan melalui Supabase Auth dan tabel `accounts`. Role yang dipakai pada aplikasi adalah `Admin`, `Driver`, dan `Pengguna umum`.

---

## 3. Fitur yang Sudah Ada pada Web

### 3.1 Dashboard Utama Role-Based

SIMOBI menggunakan satu dashboard utama berbasis role pada route `/id` dan `/en`.
Komponen route `app/[locale]/page.tsx` hanya menjadi wrapper server-side tipis,
sedangkan logic UI utama berada pada `components/dashboard/DashboardShell.tsx`.
Perbedaan akses pengguna umum, driver, dan admin ditentukan oleh helper permission
di `lib/auth/dashboard-permissions.ts`.

Fitur utama:

- Peta Google Maps berisi marker buggy dan halte.
- Daftar buggy dengan status koneksi, meliputi `Online`, `Signal unstable`, `Connection lost`, dan `Offline`.
- Detail buggy, termasuk kapasitas, penumpang, kecepatan, ETA, halte saat ini, dan halte berikutnya.
- Marker buggy tetap ditampilkan pada posisi terakhir ketika data GPS belum diperbarui.
- Pencarian rute/directions dari lokasi pengguna menuju tujuan tanpa wajib login.
- Rekomendasi halte terdekat.
- Notifikasi browser dan Web Push ketika buggy mendekati halte terdekat pengguna.
- Favorit buggy dan halte untuk pengguna yang sudah login.
- Tampilan responsif dengan top bar, sidebar desktop, dan bottom navigation mobile.

Perbedaan tampilan berdasarkan role:

| Role | Tampilan pada dashboard |
| --- | --- |
| Guest | Melihat peta, halte, buggy yang online, detail buggy, rekomendasi halte, dan pencarian rute/directions. Login dibuka melalui auth modal untuk fitur personal. |
| Pengguna umum | Melihat fitur publik, rute, favorit, dan buggy online. Favorit tetap membutuhkan akun/login. |
| Driver | Melihat buggy yang ditugaskan, statistik, riwayat perjalanan, dan detail operasional read-only. |
| Admin | Melihat seluruh panel operasional serta fitur pengelolaan data. |

### 3.2 Panel Admin

Panel admin muncul pada dashboard utama jika user memiliki role `Admin`.

- Statistik operasional armada.
- Data buggy dan detail operasional buggy.
- Penambahan dan pengelolaan buggy, termasuk fitur **Hide Fleet** untuk menyembunyikan fleet dari buggy list/map/history operasional tanpa menghapus data master.
- Assignment device GPS fisik ke buggy pada Edit Fleet, sehingga satu ESP dapat dipindahkan dari satu buggy ke buggy lain tanpa flash ulang firmware.
- Registry device otomatis, sehingga `devicesId` yang sudah pernah mengirim payload MQTT dapat muncul sebagai opsi assignment tanpa diketik manual.
- Data halte dan pengelolaan halte.
- Manajemen geofence berbasis titik pusat dan radius.
- Log event geofence, termasuk deteksi buggy masuk dan keluar area.
- Riwayat sesi perjalanan buggy berbasis kalender tanggal, dengan daftar buggy aktif pada tanggal yang dipilih.
- Detail sesi perjalanan yang menampilkan path GPS, titik berhenti di area halte, dan marker waktu pada peta.
- Manajemen akun admin dan driver.
- Manajemen notifikasi atau pengumuman.
- Pengaturan aplikasi, bahasa, tampilan peta, notifikasi browser, alert geofence, alert buggy offline terlalu lama, dan akun.
- Detail operasional buggy yang menampilkan muatan penumpang, kecepatan, status koneksi, last seen, serta status GSM/MQTT jika tersedia.
- Statistik operasional bulanan yang menghitung sesi unik, jarak, durasi, kecepatan, dan estimasi penumpang naik (**Estimated Passenger Boardings**) dari perubahan occupancy selama sesi.

### 3.3 Panel Driver

Panel driver muncul pada dashboard utama jika akun memiliki role `Driver`. Jika akun driver memiliki `buggy_id`, maka data dashboard difilter agar driver hanya melihat buggy yang ditugaskan.

Fitur utama:

- Monitoring buggy yang ditugaskan.
- Informasi posisi dan status operasional.
- Statistik dan riwayat perjalanan untuk buggy yang ditugaskan.
- Tampilan yang tidak memberikan akses penuh ke pengelolaan admin.

### 3.4 GPS Tracker Simulator

Halaman `/gps-tracker` digunakan untuk pengujian data GPS tanpa menunggu perangkat hardware final.

Fitur utama:

- Publish data GPS ke MQTT WebSocket.
- Mode simulasi satu device.
- Mode simulasi beberapa buggy.
- Payload legacy simulator masih dapat berisi `buggyId`, sedangkan alur perangkat lapangan menggunakan `deviceId`/`devicesId`, `lat`, `lng`, `speedKmh`, `heading`, `altitude`, `accuracy`, `batteryLevel`, `passengers`, `capacity`, `sessionStart`, `sessionEnd`, `timestamp`, dan `source`.
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
| Deployment model | Web app production di VPS dengan PM2, MQTT bridge sebagai worker/service terpisah |

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
2. MQTT bridge worker melakukan subscribe pada topic `buggy/+/data` dan `buggy/+/status`.
3. Worker mengubah atau menormalisasi payload, lalu meneruskannya ke endpoint `POST /api/gps-beacon`.
4. Endpoint ingest memvalidasi token, memuat data master buggy/halte dari Supabase, memperbarui live store, dan menyimpan telemetry ke database.
5. Endpoint ingest membaca assignment aktif `devicesId -> buggy_id`. Jika fleet sedang di-hide, payload tidak diterapkan ke live map.
6. Payload `buggy/{deviceId}/status` dapat memperbarui status GSM/MQTT tanpa harus menyertakan GPS dan tanpa menulis histori perjalanan.
7. Frontend membaca data terbaru melalui SSE event-driven `GET /api/buggy/stream` dengan fallback `GET /api/buggy`.
8. UI menampilkan posisi buggy pada Google Maps dan panel dashboard.
9. Saat pengguna mengaktifkan notifikasi, browser membuat Web Push subscription melalui service worker dan menyimpannya ke tabel `notification_subscriptions`.
10. Endpoint worker `/api/push/check-nearby` mengecek posisi buggy aktif terhadap halte terdekat dari posisi terakhir pengguna, lalu mengirim Web Push jika kondisi radius terpenuhi.

Frontend tidak membaca data langsung dari MQTT broker. Semua data masuk melalui backend agar validasi, keamanan, persistence, dan format data tetap konsisten.

---

## 6. Alur Data Realtime

### 6.1 Alur Data GPS

1. GPS tracker, simulator, atau perangkat ESP membuat payload telemetry.
2. Perangkat lapangan mengirim identitas fisik `deviceId`, misalnya `ESP-1A2B3C4D`, bersama data GPS.
3. MQTT bridge membaca payload dan menormalisasi identitas device menjadi `devicesId`.
4. Bridge meneruskan data ke `POST /api/gps-beacon` dengan header `Authorization: Bearer <BUGGY_INGEST_TOKEN>`.
5. API `gps-beacon` melakukan:
   - Validasi token ingest.
   - Validasi payload JSON.
   - Lazy bootstrap data `buggies` dan `haltes` dari Supabase.
   - Mencatat `devicesId` yang terlihat ke `device_registry` agar device baru dapat dipilih pada form assignment admin.
   - Lookup assignment aktif `devicesId -> buggy_id` pada tabel `device_assignments`.
   - Payload lama berbasis `buggyId` tetap diterima sebagai fallback kompatibilitas.
   - Menolak payload device yang belum memiliki assignment aktif agar data tidak masuk ke buggy yang salah.
   - Menolak penerapan payload ke live map jika fleet tujuan sedang di-hide oleh admin.
   - Update live store.
   - Upsert snapshot telemetry terbaru ke `latest_buggy_telemetry`.
   - Insert ke `buggy_history` dengan pembatasan 1 insert per 10 detik per buggy.
   - Akumulasi titik perjalanan ke session store.
   - Normalisasi jumlah penumpang agar tidak melebihi kapasitas buggy.
   - Pembersihan kualitas GPS agar titik no-fix, titik stagnan berulang, atau lonjakan tidak realistis tidak mencemari histori dan ringkasan sesi.
6. Jika `sessionStart` bernilai true, sistem memulai sesi perjalanan.
7. Jika `sessionEnd` bernilai true, sistem menutup sesi, menyimpan ringkasan ke `buggy_session_history`, dan menonaktifkan buggy pada live store.
8. Jika payload bertipe `statusOnly`, backend hanya memperbarui snapshot status GSM/MQTT pada `latest_buggy_telemetry` dan live store; payload ini tidak menulis `buggy_history` dan tidak masuk perhitungan sesi.

### 6.2 Alur Feed Frontend

Frontend memakai hook `useBuggyLiveFeed`.

Mode feed:

- `sse`: menggunakan `GET /api/buggy/stream` sebagai Server-Sent Events event-driven. Mode ini menjadi mode utama pada deployment VPS dengan PM2 `fork` satu instance.
- `poll`: mengambil data `GET /api/buggy` setiap 5 detik. Mode ini dipakai sebagai fallback jika koneksi SSE terputus atau jika aplikasi dijalankan pada platform serverless/free tier.

Pada deployment VPS dengan PM2 `fork` satu instance, SSE event-driven menjadi mode utama karena proses Node.js dapat mempertahankan koneksi stream dan broadcast in-memory. Jika aplikasi dijalankan pada platform serverless atau stream terputus di browser, fallback polling tetap tersedia.

Pada deployment serverless, data in-memory tidak selalu stabil. Karena itu `GET /api/buggy` dan stream SSE tetap menggabungkan snapshot live store dengan telemetry terbaru dari Supabase melalui `lib/supabase/latest-buggy-telemetry.ts`.

Pada mode SSE event-driven, endpoint `/api/gps-beacon` melakukan broadcast ke client dashboard setelah telemetry baru diterima. Stream juga memiliki refresh status lambat untuk menjaga perubahan status koneksi seperti `Online`, `Signal unstable`, dan `Offline`. Endpoint `GET /api/buggy` menggunakan cache snapshot singkat agar fallback polling tidak selalu membangun ulang data dari awal.

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

### 6.5 Alert Operasional Admin

Selain notifikasi buggy mendekati halte untuk pengguna umum, dashboard admin memiliki alert operasional yang berjalan saat halaman dashboard aktif.

Alert yang tersedia:

- **Buggy masuk atau keluar geofence**, yaitu event yang dihitung dari posisi buggy terhadap geofence aktif berbasis radius.
- **Buggy offline terlalu lama**, yaitu peringatan ketika buggy berstatus `Offline` dan tidak mengirim telemetry lebih dari 5 menit.

Preferensi alert tersebut tersedia pada App Settings admin dan disimpan di local storage perangkat. Master switch notifikasi browser tetap bergantung pada izin Notification API browser, sedangkan toggle alert granular mengatur apakah event operasional ditampilkan pada dashboard.

Event geofence saat ini digunakan sebagai in-app event log dan browser notification ketika izin tersedia. Penyimpanan permanen event geofence ke database masih dapat dikembangkan lebih lanjut apabila dibutuhkan audit operasional jangka panjang.

### 6.6 Alur Riwayat Sesi Perjalanan

Panel riwayat sesi perjalanan menampilkan data berbasis tanggal. Pengguna memilih tanggal melalui tampilan kalender; tanggal yang memiliki sesi ditandai dengan indikator titik. Setelah tanggal dipilih, sistem menampilkan buggy yang aktif pada tanggal tersebut.

Pembagian sesi operasional mengikuti waktu Asia/Jakarta:

- Sesi pagi: 05.00 sampai sebelum 12.00.
- Sesi siang/sore: 13.00 sampai 17.30.
- Di luar jam tersebut, sistem tetap dapat menyimpan perjalanan sebagai sesi luar jadwal jika data GPS memenuhi syarat jarak minimum.

Pada detail sesi, path GPS ditampilkan pada peta. Untuk mengurangi beban egress Supabase, daftar awal history mengambil metadata sesi terlebih dahulu, sedangkan path GPS detail dimuat saat pengguna membuka sesi tertentu. Sistem juga mendeteksi titik berhenti berdasarkan kedekatan titik GPS terhadap lokasi halte. Titik berhenti tersebut divisualisasikan sebagai marker pada peta dengan label waktu, sehingga admin atau driver dapat melihat konteks pergerakan buggy terhadap halte.

Path yang ditampilkan pada history menggunakan proses pembersihan/display path. Raw GPS tetap disimpan sebagai data dasar, tetapi path visual disanitasi dengan filtering outlier, smoothing, serta projection yang memperhatikan arah gerak dan cursor rute agar titik GPS yang menyimpang tidak langsung membuat garis menabrak gedung. Jika deviasi hanya 1-4 titik, data dianggap outlier; jika deviasi jauh berlangsung beruntun, sistem tidak memaksa snap brutal karena bisa jadi merupakan drift GPS yang berkelanjutan atau rute aktual di luar asumsi.

Penghapusan sesi perjalanan dilakukan lebih presisi dengan memanfaatkan ID sesi tersimpan atau `sourceSessionIds` pada sesi yang digabung, serta timestamp path GPS. Mekanisme ini mengurangi risiko penghapusan data sesi lain yang waktunya berdekatan dibanding pendekatan time-window yang terlalu longgar.

Jika session autentikasi pengguna habis ketika membuka panel history, frontend akan menangani respons `401` atau `403` dari API history dengan mengarahkan pengguna kembali ke halaman login dan membawa parameter `next`. Dengan demikian, pengguna tidak hanya melihat pesan error statis dan tidak perlu melakukan refresh manual untuk keluar dari state session yang sudah tidak valid.

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
buggy/{deviceId}/data
buggy/{deviceId}/status
buggy/{deviceId}/cmd
```

Contoh:

```text
username device: ESP-3C124B00
publish data:    buggy/ESP-3C124B00/data
publish status:  buggy/ESP-3C124B00/status
read command:    buggy/ESP-3C124B00/cmd
```

Bridge/backend menggunakan user khusus, misalnya `simobi_bridge`, untuk membaca data dari:

```text
buggy/+/data
buggy/+/status
```

Dengan pola ini, broker dapat menerima banyak perangkat tanpa perubahan kode pada aplikasi. Identitas pada topic dan payload merepresentasikan perangkat fisik (`deviceId`/`devicesId`), bukan lagi mengunci ESP langsung ke satu buggy tertentu. Hubungan perangkat fisik ke armada ditentukan oleh tabel assignment pada aplikasi web.

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

Dengan ACL ini, device `ESP-3C124B00` tidak boleh publish ke topic device lain. Hal ini penting untuk mencegah satu device mengirim data atas nama device lain.

### 7.3 Persistence pada Mosquitto

Mosquitto memiliki file internal `mosquitto.db`. File ini bukan database aplikasi dan bukan tempat menyimpan histori GPS SIMOBI.

Fungsi `mosquitto.db`:

- Menyimpan retained message.
- Menyimpan queued message.
- Menyimpan session/subscription state MQTT.
- Membantu broker memulihkan state internal setelah restart.

Histori perjalanan dan telemetry aplikasi tetap disimpan di Supabase, khususnya pada tabel:

- `device_assignments`
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
- Subscribe ke topic telemetry, misalnya `buggy/+/data`, dan topic status, misalnya `buggy/+/status`.
- Membaca payload JSON dari device.
- Memvalidasi bahwa `lat` dan `lng` tersedia untuk payload GPS pada topic `/data`.
- Menerima payload status GSM/MQTT pada topic `/status` tanpa mewajibkan `lat` dan `lng`.
- Membaca identitas perangkat dari `deviceId`/`devicesId` pada payload atau dari topic `buggy/{deviceId}/data` dan `buggy/{deviceId}/status`.
- Menormalisasi identitas perangkat menjadi field `devicesId` sebelum diteruskan ke backend.
- Menormalisasi field dari device, misalnya `speed` menjadi `speedKmh`.
- Meneruskan status GSM/MQTT sebagai payload `statusOnly` agar backend dapat memperbarui `latest_buggy_telemetry.gsm` tanpa menulis histori GPS.
- Melakukan throttling payload GPS agar backend dan database tidak menerima data berlebih.
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

Walaupun environment `MQTT_TOPIC` masih ditulis `buggy/+/data`, bridge terbaru dapat menambahkan topic pasangannya `buggy/+/status` secara otomatis. Dengan pemisahan ini, posisi GPS tetap dapat dikirim lebih sering, sedangkan status GSM/MQTT yang lebih berat cukup dikirim berkala, misalnya setiap 15 detik.

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
2. Device publish payload GPS ke topic `buggy/{deviceId}/data`, misalnya `buggy/ESP-3C124B00/data`.
3. Device dapat publish payload status GSM/MQTT ke topic `buggy/{deviceId}/status`, misalnya `buggy/ESP-3C124B00/status`.
4. Mosquitto broker menerima payload dan menerapkan autentikasi serta ACL.
5. `mqtt-bridge-service` membaca data dari broker.
6. Bridge meneruskan payload ke backend SIMOBI melalui endpoint protected.
7. Backend melakukan lookup assignment `devicesId -> buggy_id`, lalu menyimpan data GPS ke live store dan Supabase jika assignment valid dan fleet tidak sedang di-hide.
8. Payload status hanya memperbarui snapshot status GSM/MQTT, sehingga tidak menambah titik histori GPS.
9. Dashboard mengambil snapshot terbaru dari backend dan menampilkannya pada peta.

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

`numeric_id` tetap dipertahankan untuk kompatibilitas payload simulator atau payload lama yang masih mengirim ID numerik.

Field `is_active` pada konteks terbaru dipakai sebagai flag visibilitas fleet. Jika `is_active=false`, fleet dianggap **hidden**: tidak muncul pada buggy list, marker peta, dan daftar history operasional, walaupun akun yang digunakan adalah admin. Data master tetap disimpan sehingga admin masih dapat membuka Data > Buggy untuk mengubah kembali status hide tanpa perlu membuat armada baru.

### 8.3 `device_assignments`

Menyimpan assignment perangkat GPS fisik ke buggy.

Field penting:

- `id`
- `devices_id`
- `buggy_id`
- `label`
- `is_active`
- `created_at`
- `updated_at`

Tabel ini menjadi sumber kebenaran untuk menghubungkan identitas perangkat ESP (`deviceId`/`devicesId`) dengan armada buggy. Dengan model ini, satu device dapat dipindahkan dari Buggy 01 ke Buggy 02 melalui dashboard admin tanpa perlu flash ulang firmware ESP. Endpoint `/api/gps-beacon` akan menolak payload device yang belum memiliki assignment aktif agar data tidak masuk ke buggy yang salah.

### 8.4 `device_registry`

Menyimpan daftar perangkat fisik yang sudah pernah terlihat oleh backend, termasuk perangkat yang belum memiliki assignment aktif.

Field penting:

- `devices_id`
- `label`
- `last_seen_at`
- `last_payload`
- `created_at`
- `updated_at`

Tabel ini membuat alur assignment lebih ergonomis. Ketika MQTT bridge meneruskan payload dari device baru, `/api/gps-beacon` mencatat `devicesId` ke `device_registry`. Setelah itu, admin dapat memilih device tersebut pada Edit Fleet tanpa mengetik manual. Jika device belum di-assign, payload tetap tidak dimasukkan ke buggy mana pun sampai admin memilih target buggy.

### 8.5 `haltes`

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

### 8.6 `geofences`

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

Admin dapat menambahkan, mengedit, mengaktifkan, menonaktifkan, dan menghapus geofence. Proses edit mendukung perubahan nama zona, titik pusat, dan radius. Proses delete memvalidasi keberadaan ID geofence sehingga API tidak memberikan status berhasil ketika data yang dimaksud tidak ditemukan.

### 8.7 `announcements`

Menyimpan notifikasi atau pengumuman yang dapat dikelola admin dan ditampilkan pada dashboard.

### 8.8 `buggy_history`

Menyimpan raw telemetry GPS.

Data yang disimpan mencakup:

- ID buggy.
- ID numerik buggy.
- ID device fisik (`devices_id`) jika payload masuk melalui assignment device.
- Latitude dan longitude.
- Kecepatan.
- Akurasi.
- Heading.
- Altitude.
- Level baterai.
- Jumlah penumpang (`passengers`).
- Sumber data.
- Waktu perekaman.

Insert ke tabel ini dibatasi maksimal sekali setiap 10 detik per buggy agar database tidak terlalu berat. Payload status GSM/MQTT yang tidak membawa posisi GPS tidak masuk ke tabel ini. Endpoint pembaca raw history juga dibatasi dengan kolom eksplisit, urutan `recorded_at`, dan window default agar tidak mengambil data terlalu besar ketika dashboard hanya membutuhkan data terbaru.

Perubahan terbaru: kolom `passengers` ditambahkan melalui migrasi `20260526062537_add_passengers_to_buggy_history.sql` untuk memungkinkan pelacakan historis jumlah penumpang per titik GPS. Kolom kompatibilitas seperti `received_at`, `gsm`, `path_cursor`, dan `current_stop_index` tersedia pada schema, tetapi flow raw history utama saat ini fokus menyimpan data GPS, penumpang, baterai, dan waktu perekaman. Status GSM/MQTT dan waktu server menerima telemetry dipakai terutama pada `latest_buggy_telemetry`.

### 8.9 `buggy_session_history`

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
- Estimasi penumpang naik selama sesi (`passenger_boardings`).
- Path perjalanan.

Tabel ini digunakan oleh panel riwayat perjalanan dan statistik operasional. Admin dapat melihat seluruh data sesi, sedangkan driver hanya dapat melihat sesi dari buggy yang ditugaskan.

Perubahan terbaru: kolom `passenger_avg`, `passenger_peak`, dan `passenger_samples` ditambahkan melalui migrasi `20260526061902_add_passenger_metrics_to_buggy_sessions.sql` untuk mendukung analitik penumpang historis per sesi. Kolom `passenger_boardings` disiapkan melalui migrasi `20260619143000_add_passenger_boardings_to_buggy_sessions.sql` untuk menyimpan estimasi penumpang naik per sesi. Penyimpanan sesi memakai kunci unik logis berdasarkan `buggy_id`, `session_date`, dan `session_number` agar sesi yang sama tidak mudah tersimpan berulang. Index tambahan pada `buggy_session_history` dan `buggy_history` disiapkan melalui migrasi `20260619141417_add_history_performance_constraints.sql` untuk mempercepat query history dan mencegah duplikasi sesi. Endpoint statistik juga melakukan deduplikasi tambahan saat membaca data lama.

### 8.10 `latest_buggy_telemetry`

Menyimpan snapshot telemetry terbaru per buggy. Tabel ini dibuat khusus untuk mendukung `GET /api/buggy` agar data terbaru dapat dibaca dari database meskipun live store in-memory direset, misalnya saat proses server restart atau redeploy.

Fitur tabel:

- Satu baris per buggy (unique constraint pada `buggy_id`).
- Saat data baru masuk melalui `/api/gps-beacon`, baris untuk buggy tersebut di-upsert (update jika sudah ada, insert jika belum).
- Row Level Security (RLS) diaktifkan.

Data yang disimpan mencakup:

- `id` UUID primary key.
- `buggy_id` (unique, terhubung ke buggy aplikasi).
- `buggy_numeric_id` ID numerik device.
- `devices_id` ID perangkat fisik ESP.
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

Kolom `gsm` dapat diperbarui dari payload GPS maupun payload `statusOnly`. Contoh field yang dapat disimpan adalah `apn`, `signalCsq`, `signalDbm`, `signalPercent`, `simStatus`, `simStatusText`, `networkConnected`, `gprsConnected`, `localIp`, `networkType`, `mqttState`, dan `mqttStateText`.

### 8.11 `notification_subscriptions`

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
| `POST` | `/api/gps-beacon` | Ingest data GPS dari MQTT bridge atau simulator, termasuk payload `statusOnly` untuk status GSM/MQTT. |
| `POST` | `/api/buggy/ingest` | Ingest snapshot atau telemetry legacy. |
| `GET` | `/api/buggy-history` | Mengambil histori GPS. Admin melihat seluruh data, driver hanya data buggy yang ditugaskan. |
| `GET` | `/api/buggy-sessions` | Mengambil riwayat sesi perjalanan. Admin melihat seluruh data, driver hanya data buggy yang ditugaskan. |
| `POST` | `/api/buggy-sessions/delete` | Menghapus sesi perjalanan secara presisi berdasarkan ID/session source dan timestamp path, hanya untuk admin. |
| `POST` | `/api/buggy-sessions/maintenance` | Menjalankan maintenance sesi seperti finalisasi/cleanup yang dilindungi `CRON_SECRET`. |
| `GET/POST` | `/api/haltes` | Membaca dan menambah halte. |
| `GET/PATCH/DELETE` | `/api/haltes/[id]` | Mengelola detail halte. |
| `GET/POST` | `/api/geofences` | Membaca dan menambah geofence. |
| `GET/PATCH/DELETE` | `/api/geofences/[id]` | Mengelola status dan data geofence. |
| `GET` | `/api/announcements` | Membaca pengumuman publik. |
| `GET/POST/PATCH/DELETE` | `/api/admin/accounts` | Manajemen akun admin/driver. |
| `GET` | `/api/admin/buggies` | Mengambil seluruh master data buggy untuk admin, termasuk fleet yang di-hide. |
| `POST` | `/api/admin/buggies` | Menambah data buggy. |
| `PUT/DELETE` | `/api/admin/buggies/[id]` | Mengubah, hide/unhide, atau menghapus buggy. |
| `GET/POST` | `/api/admin/device-assignments` | Membaca dan menambah assignment `devicesId -> buggy`. |
| `PUT/DELETE` | `/api/admin/device-assignments/[id]` | Mengubah target assignment atau menonaktifkan assignment device. |
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

- `/gps-tracker`
- `/api/admin/*`
- `/api/geofences/*`
- `/api/buggy-sessions/*`
- `/api/buggy-history`

Route UI lama `/admin` dan `/driver` tidak lagi memiliki halaman dashboard terpisah. Jika URL tersebut dibuka, proxy mengarahkannya ke dashboard utama sesuai locale. Perbedaan tampilan admin, driver, dan pengguna umum ditentukan oleh role handler pada frontend dan tetap diperkuat oleh proteksi API di backend.

Aturan akses penting:

- Fitur publik seperti peta, detail buggy, halte, dan pencarian rute/directions dapat digunakan tanpa login.
- User yang belum login diarahkan ke halaman login hanya ketika membuka fitur yang memang dilindungi, seperti admin, driver/history terbatas, favorit, atau pengaturan akun.
- `/gps-tracker` hanya dapat diakses admin.
- API admin hanya dapat diakses admin.
- API history dapat diakses admin dan driver, tetapi driver hanya menerima data buggy yang ditugaskan melalui filter server-side.
- API geofence untuk method selain `GET` hanya dapat diakses admin.

### 10.3 Admin Guard

`lib/auth/admin-guard.ts` menyediakan fungsi `requireAdmin()`. Fungsi ini mengecek Supabase session, lalu membaca `accounts.role`. Jika user belum login, API membalas `401`. Jika bukan admin, API membalas `403`.

Untuk endpoint history yang juga dibuka bagi driver, route handler melakukan pengecekan session dan role secara eksplisit. Jika role adalah `Driver`, sistem membaca `accounts.buggy_id`, mencocokkannya dengan alias buggy seperti UUID, kode, nama, ID numerik, `buggy-N`, atau `bNN`, lalu membatasi query Supabase hanya pada buggy tersebut.

Pada sisi frontend, panel history menangani respons `401` atau `403` dengan redirect ke halaman login dan menyertakan parameter `next`. Hal ini menjaga pengalaman pengguna ketika session Supabase habis, karena user tidak perlu melakukan refresh manual setelah API history menolak request.

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
| `components/dashboard/DashboardShell.tsx` | Shell dashboard utama role-based untuk guest, pengguna umum, driver, dan admin. |
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
| `lib/auth/dashboard-permissions.ts` | Helper permission frontend untuk menentukan panel dan fitur berdasarkan role. |

---

## 12. Komponen Backend Penting

| File | Fungsi |
| --- | --- |
| `app/api/gps-beacon/route.ts` | Endpoint ingest GPS utama. |
| `app/api/buggy/route.ts` | Snapshot buggy terbaru untuk frontend. |
| `app/api/buggy/stream/route.ts` | SSE live feed. |
| `lib/realtime/buggy-live-store.ts` | Menyimpan snapshot live buggy di memori. |
| `lib/realtime/session-store.ts` | Mengelola sesi perjalanan dan finalisasi sesi. |
| `lib/realtime/buggy-api-snapshot.ts` | Membuat cache snapshot singkat untuk `GET /api/buggy`. |
| `lib/buggy/gsm-status.ts` | Normalisasi dan interpretasi status GSM/MQTT dari payload device. |
| `lib/buggy/gps-quality.ts` | Validasi kualitas titik GPS agar data no-fix atau lonjakan tidak mencemari histori. |
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
- Total penumpang berdasarkan estimasi penumpang naik per sesi unik.
- Waktu puncak penumpang berdasarkan agregasi per jam.
- Tren trip dibanding bulan sebelumnya.
- Tren jarak dibanding bulan sebelumnya.
- Tren penumpang dibanding bulan sebelumnya.
- Seri harian.
- Top buggy berdasarkan jarak.
- Akumulasi keterlambatan perjalanan dibanding durasi tipikal.

Catatan penting:

- Pada detail operasional buggy, metrik baterai tidak dijadikan indikator utama karena data baterai perangkat belum digunakan secara konsisten. Tampilan utama diganti menjadi muatan penumpang, kecepatan, status koneksi, dan last seen.
- Metrik penumpang historis tersedia melalui kolom `passenger_avg`, `passenger_peak`, `passenger_samples`, dan `passenger_boardings` pada tabel `buggy_session_history`.
- Statistik penumpang tidak memakai `passenger_samples` sebagai jumlah penumpang. Field tersebut hanya menunjukkan jumlah pembacaan penumpang selama sesi.
- `Total Passengers` pada statistik lebih tepat disebut **Estimated Passenger Boardings**, bukan jumlah penumpang unik. Perhitungannya adalah nilai penumpang awal pada sesi ditambah setiap kenaikan positif occupancy yang stabil minimal 3 sampel GPS. Dengan cara ini, sistem dapat memperkirakan penumpang yang naik selama sesi panjang, sekaligus mengurangi efek noise naik-turun sesaat dari sensor atau simulator.
- Jika kolom `passenger_boardings` belum tersedia pada data lama, endpoint statistik dapat menghitung fallback dari `path` yang menyimpan passenger count per titik. Jika path tidak memiliki data penumpang, fallback terakhir memakai `passenger_peak` atau `passenger_avg`.
- Endpoint statistik melakukan deduplikasi sesi berdasarkan kombinasi `buggy_id`, `session_date`, dan `session_number`, lalu memilih row terbaik dari data lama jika ada duplikasi.
- Nilai occupancy pada payload dinormalisasi agar tidak melebihi kapasitas buggy dari tabel `buggies.capacity`. Untuk `passenger_boardings`, total per sesi dapat lebih besar dari kapasitas karena merepresentasikan turnover penumpang sepanjang sesi, bukan jumlah penumpang yang duduk bersamaan.
- Tabel `latest_buggy_telemetry` juga menyimpan field `passengers` terbaru yang digunakan untuk merender kondisi penumpang secara real-time pada dashboard.
- Kapasitas buggy diambil dari data master `buggies.capacity`, bukan dari payload telemetry, untuk mencegah nilai stale device menimpa perubahan yang dilakukan dari admin panel.
- Statistik jarak mengabaikan sesi dengan kecepatan implisit tidak realistis, misalnya sesi dengan jarak/durasi yang menghasilkan kecepatan di atas ambang `60 km/jam`. Hal ini mencegah GPS jump historis membuat total kilometer bulanan tidak masuk akal.
- Rata-rata penumpang per hari menggunakan pembagi sesuai bulan yang dipilih: bulan historis dibagi jumlah hari bulan tersebut, sedangkan bulan berjalan dibagi hari berjalan.

Snapshot data operasional pada 19 Juni 2026 menunjukkan `buggy_session_history` berisi 54 row, tanpa duplicate group dan tanpa session outlier kecepatan. Ukuran estimasi data path tersimpan sekitar 1.04 MB. Untuk Mei 2026, terdapat 28 sesi dengan estimasi `Estimated Passenger Boardings` sekitar 1474 setelah memakai metode stable positive occupancy delta. Angka snapshot ini bersifat kondisi data saat verifikasi, bukan konstanta sistem.

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

Web production berjalan di VPS menggunakan PM2. Model ini dipilih karena aplikasi membutuhkan proses Node.js yang dapat berjalan terus, mempertahankan koneksi SSE, dan menerima broadcast telemetry secara event-driven. MQTT bridge production dan simulator tidak dijadikan bagian dari runtime Next.js. Keduanya dipisahkan sebagai worker/service terpisah karena bridge harus berjalan terus-menerus untuk subscribe MQTT.

Boundary penting:

- Web app dan API: Next.js.
- Database dan Auth: Supabase.
- MQTT bridge: worker/service terpisah untuk subscribe MQTT.
- PWA service worker: file browser-side `public/sw.js` untuk Web Push, bukan MQTT bridge.
- Push checker: endpoint server `/api/push/check-nearby` yang dapat dipanggil oleh cron VPS, scheduler eksternal, atau Vercel Cron jika deployment kembali ke Vercel.
- Session maintenance: endpoint server `/api/buggy-sessions/maintenance` yang dapat dipanggil cron VPS atau scheduler eksternal dan dilindungi `CRON_SECRET`.
- MQTT broker: service terpisah.
- Simulator GPS: halaman `/gps-tracker` dan/atau bridge simulator.

Pada deployment VPS, scheduler dapat dijalankan melalui cron server atau service worker terpisah sehingga interval maintenance tidak bergantung pada batas Vercel Free/Hobby. Jika deployment dikembalikan ke Vercel Free/Hobby, cron bawaan Vercel tetap memiliki batas interval sehingga scheduler eksternal atau plan yang lebih tinggi dapat dipertimbangkan.

---

## 16. Kesesuaian dengan Topik Skripsi

Topik skripsi dapat diarahkan sebagai:

> Perancangan dan Implementasi Sistem Monitoring Real-Time Armada Buggy Listrik Berbasis Web, MQTT, dan Supabase pada Lingkungan Kampus Universitas Diponegoro.

Alasan topik ini sesuai:

- Ada masalah nyata: pengguna membutuhkan informasi posisi dan ketersediaan buggy.
- Ada aspek IoT: data GPS/telemetry dikirim melalui MQTT.
- Ada aspek web engineering: dashboard role-based, API, auth, dan i18n.
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
- Implementasi dashboard role-based dan panel admin/driver.
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
- Live store in-memory tidak menjadi satu-satunya sumber kebenaran; data terbaru tetap dibaca dari tabel `latest_buggy_telemetry` di Supabase sebagai fallback, terutama ketika proses restart atau pada deployment serverless.
- Pada area dengan sinyal SIM800 lemah, sistem tetap menampilkan posisi terakhir buggy dan status koneksi. Namun, posisi aktual buggy tetap bergantung pada kapan telemetry terakhir berhasil diterima server.
- Notifikasi Web Push PWA memakai posisi terakhir pengguna yang berhasil disinkronkan saat aplikasi aktif. Browser web tidak menjamin pembacaan lokasi real-time ketika aplikasi tertutup total.
- Endpoint `/api/push/check-nearby` perlu dipanggil secara berkala oleh scheduler seperti cron VPS, Vercel Cron, atau worker eksternal agar push notification dapat dikirim otomatis.
- Statistik penumpang historis kini memakai estimasi `passenger_boardings` jika tersedia, atau fallback dari path/peak/avg pada data lama. Nilai ini adalah estimasi penumpang naik, bukan identitas penumpang unik, sehingga kualitas metrik tetap bergantung pada akurasi sensor jumlah penumpang dan kestabilan pembacaan occupancy.
- Alert geofence dan alert buggy offline terlalu lama sudah tersedia pada dashboard admin, tetapi event geofence belum disimpan permanen sebagai tabel audit terpisah.
- Data baterai masih dapat diterima pada payload telemetry, tetapi belum dijadikan indikator utama pada detail operasional karena belum menjadi data yang digunakan secara konsisten.
- Assignment device sudah fleksibel berbasis `devicesId`, tetapi device tetap harus diassign admin sebelum data GPS dapat memengaruhi posisi buggy pada dashboard.
- Fleet yang di-hide tidak tampil pada daftar operasional dan payload GPS-nya tidak diterapkan ke live map, tetapi data master tetap dapat dikelola admin melalui Data > Buggy.
- Status GSM/MQTT sudah dapat diterima melalui topic `/status`, tetapi informasi tersebut tetap bergantung pada interval publish device dan keberhasilan koneksi MQTT/GPRS.
- Pada VPS dengan PM2 `fork` satu instance, live feed dapat memakai SSE event-driven. Jika aplikasi dijalankan dengan lebih dari satu instance, broadcast SSE in-memory perlu diganti dengan mekanisme bersama seperti Redis Pub/Sub atau PostgreSQL LISTEN/NOTIFY.
- Remote engine cut-off dan command queue masih cocok diposisikan sebagai rencana pengembangan, bukan fitur utama yang sudah selesai.
- Akurasi ETA dan geofence bergantung pada kualitas data GPS, interval pengiriman, dan koneksi jaringan.

---

## 19. Rencana Pengembangan Lanjutan

Pengembangan berikutnya yang dapat ditulis sebagai saran:

- Integrasi hardware final pada buggy.
- Peningkatan konfigurasi broker production ke TLS penuh jika perangkat dan hosting sudah mendukung.
- Command queue untuk perintah jarak jauh seperti engine cut-off.
- ACK mechanism dari buggy ke server.
- Penyimpanan permanen event geofence dan alert operasional sebagai audit log.
- Integrasi cron production untuk Web Push checker dengan interval yang disesuaikan kebutuhan operasional.
- Peningkatan notifikasi menjadi preference per pengguna yang lebih lengkap, misalnya radius, halte favorit, jam aktif notifikasi, dan sinkronisasi preferensi ke database.
- Perhitungan ETA yang lebih cerdas berdasarkan histori perjalanan.
- Dashboard analitik penumpang historis.
- Pengujian lapangan dengan beberapa unit buggy.
- Optimasi performa ketika jumlah armada bertambah.

---

## 20. Ringkasan Singkat untuk Ditempel ke AI Lain

SIMOBI adalah sistem monitoring real-time armada buggy listrik kampus UNDIP berbasis Next.js 16, React 19, TypeScript, Supabase PostgreSQL/Auth, Google Maps API, MQTT, dan PWA Web Push Notification. Sistem memiliki tiga peran pengguna: pengguna umum, driver, dan admin. Aplikasi memakai satu dashboard utama berbasis role pada route `/id` dan `/en`, dengan `DashboardShell` sebagai pusat UI dan `dashboard-permissions` sebagai helper penentu akses. Guest dan pengguna umum dapat melihat peta buggy, halte, ETA, rute/directions, detail buggy, status koneksi, dan posisi terakhir buggy tanpa login. Fitur personal seperti favorit tetap membutuhkan login, sedangkan notifikasi mendekati halte memakai subscription pengguna/browser. Driver melihat panel terbatas sesuai buggy yang ditugaskan, termasuk statistik dan riwayat sesi untuk buggy tersebut. Admin melihat panel operasional penuh untuk mengelola buggy, hide/unhide fleet, assignment device GPS fisik ke buggy, halte, geofence, akun, notifikasi, statistik, riwayat perjalanan, alert geofence, dan alert buggy offline terlalu lama.

Alur data utama adalah GPS tracker/simulator/hardware mengirim telemetry ke MQTT broker pada topic `buggy/{deviceId}/data`, misalnya `buggy/ESP-3C124B00/data`. Device juga dapat mengirim status GSM/MQTT yang lebih ringan ke topic `buggy/{deviceId}/status`, misalnya `buggy/ESP-3C124B00/status`. Broker production menggunakan Mosquitto pada folder sibling `simobi-mosquitto-broker`, dengan autentikasi username/password, ACL per device, persistence internal `mosquitto.db`, dan deployment long-running. MQTT bridge production berada pada folder sibling `mqtt-bridge-service`; worker ini subscribe ke `buggy/+/data` dan `buggy/+/status`, menormalisasi payload menjadi `devicesId`, lalu meneruskan data ke endpoint protected `POST /api/gps-beacon`. Untuk data simulator `/gps-tracker`, payload legacy berbasis `buggyId` masih diterima sebagai fallback kompatibilitas. Endpoint ingest memvalidasi `BUGGY_INGEST_TOKEN`, mencatat device yang terlihat ke `device_registry`, melakukan lookup assignment aktif `devicesId -> buggy_id`, menolak device yang belum diassign, menolak penerapan payload untuk fleet yang sedang di-hide, memperbarui live buggy store, menyimpan raw telemetry ke `buggy_history`, meng-upsert snapshot ke `latest_buggy_telemetry`, mengelola sesi perjalanan ke `buggy_session_history`, dan melakukan broadcast SSE ke dashboard yang sedang aktif. Payload `statusOnly` dari topic `/status` hanya memperbarui status GSM/MQTT pada snapshot terbaru dan tidak menambah titik histori GPS. Setiap snapshot terbaru menyimpan `received_at` sebagai waktu server menerima telemetry. Field ini digunakan untuk menghitung status koneksi `Online`, `Signal unstable`, `Connection lost`, atau `Offline`, sehingga dashboard tetap dapat menampilkan last known location ketika sinyal SIM800 melemah. Frontend membaca data realtime melalui SSE event-driven pada `/api/buggy/stream`, dengan fallback polling `GET /api/buggy` setiap 5 detik jika stream terputus. Untuk notifikasi PWA, browser mendaftarkan service worker `/sw.js`, menyimpan push subscription ke `notification_subscriptions`, lalu endpoint `/api/push/check-nearby` mengirim Web Push ketika buggy dengan status `Online` atau `Signal unstable` mendekati halte terdekat pengguna.

Database utama terdiri dari `accounts`, `buggies`, `device_assignments`, `device_registry`, `haltes`, `geofences`, `announcements`, `buggy_history`, `buggy_session_history`, `latest_buggy_telemetry`, dan `notification_subscriptions`. Tabel `buggies.is_active` dipakai sebagai flag visibilitas fleet: fleet hidden tidak muncul pada buggy list/map/history operasional, tetapi tetap dapat dikelola admin. Tabel `device_assignments` menyimpan relasi aktif antara perangkat fisik ESP dan buggy, sedangkan `device_registry` menyimpan device yang pernah terlihat dari payload MQTT agar dapat dipilih pada Edit Fleet. Tabel `latest_buggy_telemetry` menyimpan satu baris snapshot telemetry terbaru per buggy untuk mendukung fallback saat live store in-memory direset atau proses server restart, termasuk kolom `received_at` untuk menentukan kesegaran data dan kolom `gsm` untuk status jaringan device. Tabel `notification_subscriptions` menyimpan endpoint Web Push, key subscription, posisi terakhir pengguna, radius alert, dan cooldown notifikasi. Tabel `buggy_history` menyimpan raw GPS telemetry dan jumlah penumpang per titik, sedangkan status GSM/MQTT terbaru disimpan pada `latest_buggy_telemetry`. Tabel `buggy_session_history` memiliki kolom `passenger_avg`, `passenger_peak`, `passenger_samples`, dan `passenger_boardings` untuk analitik penumpang per sesi perjalanan. Statistik operasional memakai sesi unik, filter outlier jarak/kecepatan, dan estimasi penumpang naik berbasis stable positive occupancy delta. Sistem membagi sesi operasional ke sesi pagi 05.00-12.00, sesi siang/sore 13.00-17.30, serta sesi luar jadwal. Sistem menggunakan `proxy.ts`, `requireAdmin()`, filter role server-side, dan permission helper frontend untuk role-based access; endpoint history dapat diakses admin dan driver, tetapi driver hanya menerima data buggy yang ditugaskan. Ketika session habis pada panel history, frontend menangani `401/403` dengan redirect ke login. Endpoint ingest dilindungi bearer token, sedangkan endpoint push checker dan session maintenance dilindungi token worker seperti `PUSH_WORKER_TOKEN` atau `CRON_SECRET`. Geofence saat ini berbasis center point dan radius serta dapat diedit atau dihapus melalui panel admin. Aplikasi mendukung bahasa Indonesia dan Inggris melalui route `/id` dan `/en`. Rencana pengembangan berikutnya meliputi integrasi hardware final, command queue, ACK mechanism, penyimpanan permanen event geofence, notifikasi berbasis preferensi pengguna yang tersinkron ke database, dan pengujian lapangan.
