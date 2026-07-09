# Catatan Belajar Sidang SIMOBI

Dokumen ini dibuat sebagai bahan belajar sidang untuk project web SIMOBI. Fokusnya adalah alur fitur dari UI, frontend, API/backend, database, sampai alasan teknis. Bahasa dibuat agar mudah diucapkan saat presentasi, tetapi tetap berdasarkan file yang ada di repository.

Catatan kejujuran repo:

- Tabel `accounts`, `buggies`, `haltes`, dan `geofences` dipakai jelas oleh kode, tetapi migration pembuatan awal tabel tersebut tidak ditemukan di folder `supabase/migrations` saat dokumen ini dibuat. Kemungkinan tabel dibuat lebih awal langsung di Supabase atau migration awal tidak ikut tersimpan.
- Migration yang ditemukan di repo mencakup `latest_buggy_telemetry`, `notification_subscriptions`, `device_assignments`, `device_registry`, beberapa perubahan `buggy_history`, beberapa perubahan `buggy_session_history`, dan index performa history.
- Simulator GPS ada di `app/[locale]/gps-tracker/page.tsx`, bersifat client component dan publish telemetry ke MQTT WebSocket. Data simulator masuk ke alur utama jika MQTT bridge meneruskan payload ke `/api/gps-beacon`.

## Gambaran Arsitektur Singkat

Alur besar sistem:

```text
User browser
  -> Next.js App Router UI
  -> API Route Next.js
  -> Supabase Auth / Supabase PostgreSQL
  -> UI dashboard, map, history, notification

Perangkat GPS / Simulator
  -> MQTT Broker
  -> MQTT Bridge Service
  -> POST /api/gps-beacon
  -> live store + latest_buggy_telemetry + buggy_history + session-store
  -> /api/buggy atau /api/buggy/stream
  -> useBuggyLiveFeed
  -> DashboardShell
  -> MapCanvas
```

## 1. Login dan Role User

Nama fitur:
Login dan Role User.

Tujuan:
Memastikan hanya user terdaftar yang bisa masuk, lalu sistem membedakan hak akses Admin, Driver, dan Pengguna umum.

File utama:

- `components/auth/AuthForm.tsx`
- `components/auth/LoginForm.tsx`
- `app/api/auth/callback/route.ts`
- `hooks/useUserRole.ts`
- `lib/auth/dashboard-permissions.ts`
- `lib/auth/admin-guard.ts`
- `proxy.ts`
- `app/api/admin/accounts/route.ts`

Alur kerja:
User membuka login, mengisi email dan password, lalu `AuthForm` memanggil Supabase Auth `signInWithPassword`. Setelah login berhasil, browser punya session Supabase. Di sisi client, `useUserRole` membaca user aktif dari Supabase Auth, lalu mengambil profil aplikasi dari tabel `accounts` berisi `name`, `role`, dan `buggy_id`. Role tersebut dikirim ke `getDashboardPermissions` agar dashboard tahu menu dan fitur apa yang boleh tampil. Untuk API admin, server memakai `requireAdmin` sehingga validasi tidak hanya terjadi di tampilan, tetapi juga di backend.

Data yang digunakan:

- Email dan password dari Supabase Auth.
- `accounts.id`, `accounts.name`, `accounts.role`, `accounts.buggy_id`.
- Role: `Admin`, `Driver`, `Pengguna umum`.

Tabel database yang terlibat:

- `accounts`
- Supabase Auth users

API / endpoint yang terlibat:

- `/api/auth/callback`
- `/api/admin/accounts`
- Supabase Auth API

Alasan teknis:
Authentication menjawab "siapa user ini", sedangkan authorization menjawab "apa yang boleh dilakukan user ini". Supabase Auth dipakai untuk login/session karena sudah menyediakan mekanisme auth yang aman. Tabel `accounts` dipakai sebagai profil aplikasi karena role SIMOBI adalah kebutuhan domain aplikasi, bukan sekadar data login. API admin tetap dicek server-side agar user tidak bisa membuka fitur admin hanya dengan memanipulasi UI.

Pertanyaan dosen yang mungkin muncul:

- Apa beda authentication dan authorization?
- Dari mana sistem tahu user itu admin atau driver?
- Apakah user biasa bisa memanggil API admin?

Jawaban singkat untuk sidang:
Login SIMOBI memakai Supabase Auth untuk membuktikan identitas user. Setelah user valid, sistem membaca tabel `accounts` untuk menentukan role aplikasi, yaitu Admin, Driver, atau Pengguna umum. Role ini dipakai di frontend untuk mengatur tampilan dan di backend untuk melindungi API. Jadi keamanan tidak hanya bergantung pada tombol yang disembunyikan di UI.

File yang perlu saya buka saat menjelaskan:

- `hooks/useUserRole.ts`
- `lib/auth/dashboard-permissions.ts`
- `lib/auth/admin-guard.ts`
- `proxy.ts`

Tingkat prioritas belajar:
WAJIB.

## 2. Dashboard Utama Role-Based

Nama fitur:
Dashboard utama berbasis role untuk route `/id` dan `/en`.

Tujuan:
Menampilkan dashboard yang sama secara struktur, tetapi isi fiturnya berbeda sesuai role user.

File utama:

- `app/[locale]/page.tsx`
- `components/dashboard/DashboardShell.tsx`
- `components/dashboard/DashboardSidePanel.tsx`
- `lib/auth/dashboard-permissions.ts`
- `hooks/useDashboardFleetData.ts`
- `hooks/useDashboardViewState.ts`
- `hooks/useUserRole.ts`

Alur kerja:
Route `/id` atau `/en` membuka `app/[locale]/page.tsx`. File page ini sederhana karena hanya menjadi server wrapper yang menampilkan `DashboardShell`. Interaksi utama berada di client component karena dashboard memakai state browser, Google Maps, geolocation, notification, dan realtime feed. `DashboardShell` membaca role lewat `useUserRole`, menghitung izin lewat `dashboard-permissions`, mengambil data fleet/halte lewat `useDashboardFleetData`, lalu mengirim data ke `MapCanvas` dan `DashboardSidePanel`.

Data yang digunakan:

- Role user.
- Data buggy live dan master buggy.
- Data halte.
- Data geofence, history, setting, favorite, dan user location.

Tabel database yang terlibat:

- `accounts`
- `buggies`
- `haltes`
- `geofences`
- `latest_buggy_telemetry`

API / endpoint yang terlibat:

- `/api/buggy`
- `/api/buggy/stream`
- `/api/haltes`
- `/api/admin/buggies`
- `/api/geofences`

Alasan teknis:
`page.tsx` dibuat ringan karena Next.js App Router memisahkan server route dengan client interaction. Dashboard perlu client component karena banyak fitur bergantung pada browser. Pembagian permission dibuat di `dashboard-permissions.ts` agar aturan role tidak tersebar di banyak komponen.

Pertanyaan dosen yang mungkin muncul:

- Kenapa `page.tsx` isinya pendek?
- Kenapa dashboard harus client component?
- Apa beda tampilan Admin, Driver, dan Pengguna umum?

Jawaban singkat untuk sidang:
`page.tsx` hanya menjadi entry point route karena dashboard SIMOBI bersifat sangat interaktif. Logic utamanya ada di `DashboardShell`, yang membaca role user lalu mengatur fitur berdasarkan permission. Admin bisa mengelola data dan melihat semua armada, Driver lebih fokus pada buggy yang ditugaskan, sedangkan Pengguna umum melihat informasi operasional untuk kebutuhan transportasi.

File yang perlu saya buka saat menjelaskan:

- `app/[locale]/page.tsx`
- `components/dashboard/DashboardShell.tsx`
- `lib/auth/dashboard-permissions.ts`

Tingkat prioritas belajar:
WAJIB.

## 3. Monitoring Buggy Realtime

Nama fitur:
Monitoring posisi buggy realtime di Google Maps.

Tujuan:
Menampilkan posisi, status, dan pergerakan buggy secara realtime di dashboard.

File utama:

- `app/api/gps-beacon/route.ts`
- `lib/server/gps-beacon/ingest-route.ts`
- `lib/realtime/buggy-live-store.ts`
- `lib/realtime/buggy-api-snapshot.ts`
- `lib/realtime/buggy-sse-bus.ts`
- `app/api/buggy/route.ts`
- `app/api/buggy/stream/route.ts`
- `hooks/useBuggyLiveFeed.ts`
- `components/dashboard/DashboardShell.tsx`
- `components/map/MapCanvas.tsx`

Alur kerja:
Perangkat GPS atau simulator mengirim payload ke MQTT broker. MQTT bridge membaca pesan dari broker lalu mengirim HTTP POST ke `/api/gps-beacon`. API ini memvalidasi token ingest, menormalisasi payload, menyelesaikan assignment device ke buggy, lalu menyimpan update ke live store dan `latest_buggy_telemetry`. Untuk tampilan realtime, browser membaca `/api/buggy/stream` dengan SSE. Jika SSE gagal beberapa kali, `useBuggyLiveFeed` otomatis fallback ke polling `/api/buggy`. Data live dikirim ke `DashboardShell`, lalu marker ditampilkan oleh `MapCanvas`.

Data yang digunakan:

- `devicesId` atau `deviceId`.
- `lat`, `lng`, `speedKmh`, `heading`, `accuracy`, `altitude`.
- `batteryLevel`, `passengers`, `capacity`, `etaMinutes`.
- `gsm`, `timestamp`, `sessionStart`, `sessionEnd`.

Tabel database yang terlibat:

- `device_registry`
- `device_assignments`
- `buggies`
- `latest_buggy_telemetry`
- `buggy_history`
- `buggy_session_history`

API / endpoint yang terlibat:

- `POST /api/gps-beacon`
- `GET /api/buggy`
- `GET /api/buggy/stream`

Alasan teknis:
Browser tidak langsung membaca MQTT karena MQTT broker dan credential sebaiknya tidak diekspos ke publik, dan format telemetry perlu divalidasi dulu. Next.js API route menjadi gerbang validasi, normalisasi, dan penyimpanan. Live store dipakai agar update realtime cepat, sedangkan Supabase dipakai untuk data durable. SSE dipakai karena ringan untuk server-to-browser streaming, sedangkan polling menjadi fallback jika koneksi streaming bermasalah.

Pertanyaan dosen yang mungkin muncul:

- Kenapa tidak langsung MQTT ke browser?
- Apa fungsi live store?
- Apa bedanya SSE dan polling?

Jawaban singkat untuk sidang:
Data GPS tidak langsung dibaca browser, tetapi masuk lewat MQTT bridge ke API `/api/gps-beacon`. API ini memvalidasi token, menghubungkan device ke buggy, lalu memperbarui live store dan Supabase. Dashboard membaca data lewat SSE agar marker bisa berubah realtime. Jika SSE gagal, sistem tetap berjalan dengan fallback polling.

File yang perlu saya buka saat menjelaskan:

- `lib/server/gps-beacon/ingest-route.ts`
- `hooks/useBuggyLiveFeed.ts`
- `lib/realtime/buggy-live-store.ts`
- `components/map/MapCanvas.tsx`

Tingkat prioritas belajar:
WAJIB.

## 4. Detail Buggy Realtime

Nama fitur:
Detail buggy realtime.

Tujuan:
Menampilkan kondisi operasional satu buggy secara detail.

File utama:

- `components/buggy/BuggyDetailView.tsx`
- `components/admin/fleet/BuggyOperationalDetail.tsx`
- `components/buggy/PanelActive.tsx`
- `lib/realtime/buggy-live-store.ts`
- `lib/supabase/latest-buggy-telemetry.ts`
- `lib/transit/buggy-route-utils.ts`

Alur kerja:
User memilih marker atau card buggy. `DashboardShell` menyimpan selected buggy, lalu detail ditampilkan oleh `BuggyDetailView` atau panel admin. Data detail berasal dari live feed yang sudah digabung dengan master data dan latest telemetry. Komponen menampilkan kecepatan, penumpang, kapasitas, ETA, halte saat ini, halte berikutnya, status koneksi, last seen, serta status GSM/MQTT jika role mengizinkan.

Data yang digunakan:

- `speed`, `speedKmh`.
- `passengers`, `capacity`, `crowdLevel`.
- `currentStop`, `nextStop`, `etaMinutes`.
- `connectionStatus`, `lastSeen`, `updatedAt`.
- `gsm.apn`, `signalPercent`, `networkConnected`, `mqttStateText`.

Tabel database yang terlibat:

- `buggies`
- `latest_buggy_telemetry`

API / endpoint yang terlibat:

- `/api/buggy`
- `/api/buggy/stream`
- `/api/eta/predict-segment`

Alasan teknis:
Detail buggy dipisahkan dari marker map agar UI map tetap fokus pada lokasi, sedangkan informasi operasional ditampilkan di panel. Data realtime dan master data digabung agar UI tetap punya nama, kode, kapasitas, dan status terbaru sekaligus.

Pertanyaan dosen yang mungkin muncul:

- Dari mana ETA dan next stop berasal?
- Kenapa status GSM hanya ditampilkan untuk role tertentu?
- Bagaimana sistem menentukan buggy offline?

Jawaban singkat untuk sidang:
Detail buggy menampilkan gabungan data master dari tabel `buggies` dan telemetry terbaru dari live feed. Posisi dan status realtime diperbarui melalui `/api/buggy/stream`, lalu UI menghitung halte saat ini dan halte berikutnya berdasarkan rute. Status koneksi ditentukan dari waktu update terakhir, sehingga sistem bisa membedakan online, sinyal tidak stabil, dan offline.

File yang perlu saya buka saat menjelaskan:

- `components/buggy/BuggyDetailView.tsx`
- `lib/realtime/buggy-live-store.ts`
- `lib/supabase/latest-buggy-telemetry.ts`

Tingkat prioritas belajar:
WAJIB.

## 5. Melihat Data Halte

Nama fitur:
Data halte pada map dan panel.

Tujuan:
Menampilkan titik halte kampus sebagai marker, referensi rute, ETA, notifikasi, dan pencarian.

File utama:

- `app/api/haltes/route.ts`
- `app/api/haltes/[id]/route.ts`
- `lib/transit/halte-runtime.ts`
- `lib/transit/buggy-data.ts`
- `hooks/useDashboardFleetData.ts`
- `components/map/MapCanvas.tsx`
- `components/halte/HalteDetailView.tsx`

Alur kerja:
Saat dashboard dibuka, `useDashboardFleetData` memanggil `/api/haltes`. API membaca tabel `haltes`, mengubah row database menjadi format `HaltePoint`, lalu mengembalikan ke frontend. Jika Supabase tidak tersedia atau data kosong, sistem masih punya fallback data statis dari `buggy-data.ts`. `MapCanvas` menggambar marker halte, sedangkan fitur route, ETA, dan notifikasi memakai daftar halte yang sama.

Data yang digunakan:

- `id`, `name`, `lat`, `lng`.
- `is_active`, `is_optional`.
- Urutan halte dalam rute.

Tabel database yang terlibat:

- `haltes`

API / endpoint yang terlibat:

- `GET /api/haltes`
- `POST /api/haltes`
- `PUT /api/haltes/[id]`
- `DELETE /api/haltes/[id]`

Alasan teknis:
Halte disimpan di database agar admin dapat mengubah titik operasional tanpa mengubah kode. Fallback statis dipakai agar map tetap bisa hidup saat database kosong atau belum siap.

Pertanyaan dosen yang mungkin muncul:

- Kenapa halte perlu disimpan di database?
- Apa dampak perubahan halte?
- Bagaimana jika data halte kosong?

Jawaban singkat untuk sidang:
Data halte adalah titik referensi utama untuk map, rute, ETA, dan notifikasi. Dashboard mengambil data halte dari `/api/haltes`, lalu marker ditampilkan di Google Maps. Jika admin mengubah halte, perubahan akan berpengaruh ke map dan fitur pencarian rute. Sistem juga punya fallback data statis agar dashboard tidak kosong saat database belum siap.

File yang perlu saya buka saat menjelaskan:

- `app/api/haltes/route.ts`
- `lib/transit/halte-runtime.ts`
- `components/map/MapCanvas.tsx`

Tingkat prioritas belajar:
PENTING.

## 6. Pencarian Rute dan Rekomendasi Halte Terdekat

Nama fitur:
Pencarian rute dan rekomendasi halte terdekat.

Tujuan:
Membantu pengguna menentukan halte asal, halte tujuan, dan buggy aktif yang relevan.

File utama:

- `components/search/LiveSearchBar.tsx`
- `hooks/useDirectionSearch.ts`
- `hooks/useNearestHaltes.ts`
- `lib/transit/route-search.ts`
- `lib/services/google-maps-service.ts`
- `components/panel/DirectionPanel.tsx`
- `components/layout/NearestHalteChips.tsx`

Alur kerja:
User mengisi asal dan tujuan pada `LiveSearchBar`. `useDirectionSearch` mencoba mencocokkan input dengan halte. Jika user memilih lokasi saya, hook memakai geolocation lalu mencari halte terdekat lewat service map. Setelah origin dan destination ditemukan, sistem menyusun daftar halte yang dilalui dan mencari buggy aktif yang paling relevan. Hasilnya dikirim ke `DirectionPanel` dan `MapCanvas` untuk menampilkan rute serta rekomendasi.

Data yang digunakan:

- Input asal dan tujuan.
- Lokasi user.
- Daftar halte aktif.
- Daftar buggy aktif.
- Hasil geocoding atau nearest halte.

Tabel database yang terlibat:

- `haltes`
- `latest_buggy_telemetry`
- `buggies`

API / endpoint yang terlibat:

- `/api/haltes`
- `/api/buggy`
- `/api/buggy/stream`

Alasan teknis:
Pencarian dibuat di frontend karena respons harus cepat dan datanya sudah ada di dashboard. Google Maps service membantu geocoding dan perhitungan jarak, sementara data halte resmi memastikan hasil tetap sesuai rute kampus.

Pertanyaan dosen yang mungkin muncul:

- Bagaimana sistem menentukan halte terdekat?
- Apakah user harus mengetik nama halte persis?
- Bagaimana memilih buggy yang direkomendasikan?

Jawaban singkat untuk sidang:
Pencarian rute dimulai dari input asal dan tujuan pengguna. Sistem mencocokkan input dengan daftar halte, atau memakai lokasi user untuk mencari halte terdekat. Setelah itu, sistem menyusun rute halte dan memilih buggy aktif yang paling relevan. Hasilnya ditampilkan sebagai arahan di panel dan visual di map.

File yang perlu saya buka saat menjelaskan:

- `hooks/useDirectionSearch.ts`
- `lib/transit/route-search.ts`
- `components/search/LiveSearchBar.tsx`

Tingkat prioritas belajar:
PENTING.

## 7. History Perjalanan Buggy

Nama fitur:
History perjalanan buggy.

Tujuan:
Menampilkan riwayat perjalanan buggy berdasarkan tanggal, buggy, sesi, statistik, dan path di map.

File utama:

- `components/history/HistoryPanel.tsx`
- `components/history/HistoryDateBuggyList.tsx`
- `components/history/HistorySessionList.tsx`
- `components/history/HistorySessionDetail.tsx`
- `app/api/buggy-sessions/route.ts`
- `lib/server/buggy-sessions/get-sessions.ts`
- `lib/server/buggy-sessions/access.ts`
- `lib/server/buggy-sessions/session-rows.ts`
- `components/map/hooks/useHistoryTrail.ts`

Alur kerja:
User membuka panel history. `HistoryPanel` memanggil `/api/buggy-sessions?limit=200`. API memeriksa akses user, lalu membaca `buggy_session_history`. Untuk sesi yang sedang berjalan, API juga bisa membaca raw `buggy_history` agar history hari ini tetap terlihat sebelum sesi selesai. Ketika user memilih sesi, panel menampilkan statistik dan mengirim path ke `MapCanvas`, lalu `useHistoryTrail` menggambar polyline perjalanan.

Data yang digunakan:

- Tanggal sesi.
- `buggy_id`, `session_number`, `started_at`, `ended_at`.
- `total_distance_km`, `duration_minutes`, `avg_speed_kmh`.
- `passenger_avg`, `passenger_peak`, `passenger_boardings`.
- `path`.

Tabel database yang terlibat:

- `buggy_session_history`
- `buggy_history`
- `buggies`
- `accounts`

API / endpoint yang terlibat:

- `GET /api/buggy-sessions`
- `DELETE /api/buggy-sessions/delete`
- `GET /api/buggy-history`

Alasan teknis:
History ringkasan dipisah dari telemetry mentah agar UI tidak harus menghitung ulang ribuan titik setiap kali dibuka. Raw history tetap disimpan sebagai bahan audit dan untuk sesi yang belum selesai.

Pertanyaan dosen yang mungkin muncul:

- Apa beda `buggy_history` dan `buggy_session_history`?
- Kenapa path history bisa muncul di map?
- Apakah driver bisa melihat semua history?

Jawaban singkat untuk sidang:
History SIMOBI terdiri dari raw GPS point dan ringkasan sesi. `buggy_history` menyimpan titik GPS mentah, sedangkan `buggy_session_history` menyimpan hasil rekap seperti jarak, durasi, dan rata-rata kecepatan. `HistoryPanel` mengambil data lewat API yang memeriksa role user, lalu path perjalanan dikirim ke map untuk digambar sebagai garis rute.

File yang perlu saya buka saat menjelaskan:

- `components/history/HistoryPanel.tsx`
- `lib/server/buggy-sessions/get-sessions.ts`
- `components/map/hooks/useHistoryTrail.ts`

Tingkat prioritas belajar:
WAJIB.

## 8. Cara Data Masuk ke History

Nama fitur:
Pipeline telemetry menjadi history perjalanan.

Tujuan:
Menjelaskan bagaimana GPS realtime akhirnya menjadi raw history dan ringkasan sesi operasional.

File utama:

- `lib/server/gps-beacon/ingest-route.ts`
- `lib/server/gps-beacon/history-throttle.ts`
- `lib/server/gps-beacon/status-only.ts`
- `lib/realtime/session-store.ts`
- `lib/realtime/session/session-bucket.ts`
- `lib/buggy/gps-quality.ts`
- `app/api/buggy-sessions/route.ts`

Alur kerja:
Setiap payload GPS masuk ke `/api/gps-beacon`. Payload yang valid dipakai untuk update live store dan latest telemetry. Untuk raw history, sistem mengecek apakah titik layak disimpan: bukan no-fix, bukan koordinat sama terus, tidak terlalu dekat, dan tidak terlalu sering. Titik yang lolos masuk ke `buggy_history`. Di saat yang sama `session-store` mengumpulkan titik menjadi sesi. Saat ada `sessionStart`, `sessionEnd`, atau idle terlalu lama, sesi direkap menjadi `buggy_session_history` berisi durasi, jarak, average speed, battery, penumpang, boardings, dan path.

Data yang digunakan:

- Raw GPS point: latitude, longitude, speed, heading, accuracy, timestamp.
- Session marker: `sessionStart`, `sessionEnd`.
- Battery dan passenger metrics.
- Path dan stop points.
- Operational bucket pagi, siang, dan luar jadwal.

Tabel database yang terlibat:

- `buggy_history`
- `buggy_session_history`
- `latest_buggy_telemetry`

API / endpoint yang terlibat:

- `POST /api/gps-beacon`
- `GET /api/buggy-sessions`

Alasan teknis:
Raw GPS dan ringkasan sesi dipisah karena kebutuhan datanya berbeda. Raw GPS cocok untuk audit dan rekonstruksi path, tetapi berat jika selalu dihitung ulang. Ringkasan sesi cocok untuk dashboard history dan statistik karena sudah berisi angka final. Filter GPS diperlukan supaya titik rusak, no-fix, dan outlier tidak merusak jarak dan statistik.

Pertanyaan dosen yang mungkin muncul:

- Bagaimana sistem membersihkan data GPS?
- Kenapa tidak semua payload masuk history?
- Kapan satu sesi dianggap selesai?

Jawaban singkat untuk sidang:
Payload GPS valid masuk ke `/api/gps-beacon`, lalu sistem menyimpannya sebagai latest telemetry dan sebagian sebagai raw history. Tidak semua titik disimpan karena ada throttle dan filter kualitas agar data tidak penuh titik duplikat atau GPS rusak. `session-store` mengumpulkan titik menjadi sesi, lalu menyimpan ringkasan ke `buggy_session_history`. Pemisahan ini membuat history lebih cepat dibaca dan statistik lebih stabil.

File yang perlu saya buka saat menjelaskan:

- `lib/server/gps-beacon/ingest-route.ts`
- `lib/realtime/session-store.ts`
- `lib/buggy/gps-quality.ts`

Tingkat prioritas belajar:
WAJIB.

## 9. Pengaturan Bahasa

Nama fitur:
Route bahasa `/id` dan `/en`.

Tujuan:
Menyediakan dashboard dalam bahasa Indonesia dan Inggris dengan route yang jelas.

File utama:

- `app/[locale]/layout.tsx`
- `app/[locale]/page.tsx`
- `lib/i18n/config.ts`
- `lib/i18n/routing.ts`
- `lib/i18n/client.tsx`
- `lib/i18n/browser.ts`
- `proxy.ts`

Alur kerja:
User membuka `/id` atau `/en`. `proxy.ts` memastikan path memiliki locale yang valid dan melakukan redirect jika perlu. `layout.tsx` membaca locale, memasang `I18nProvider`, metadata, dan font. Komponen client memakai i18n client untuk menampilkan teks sesuai bahasa. Route berbasis locale membuat URL dashboard jelas untuk bahasa Indonesia dan Inggris.

Data yang digunakan:

- Locale `id` dan `en`.
- Cookie `NEXT_LOCALE`.
- Translation namespace.

Tabel database yang terlibat:

- Tidak ada tabel khusus.

API / endpoint yang terlibat:

- Tidak ada endpoint khusus, routing ditangani `proxy.ts` dan App Router.

Alasan teknis:
Route berbasis locale memudahkan SEO, sharing link, dan pengalaman user karena bahasa terlihat langsung di URL. Layout tetap server-side, sedangkan teks interaktif dipakai di client component.

Pertanyaan dosen yang mungkin muncul:

- Kenapa memakai `/id` dan `/en`?
- Apa peran `proxy.ts`?
- Apakah page utama server-side atau client-side?

Jawaban singkat untuk sidang:
SIMOBI memakai route berbasis locale, yaitu `/id` dan `/en`, agar bahasa terlihat jelas dari URL. `proxy.ts` memastikan user diarahkan ke locale yang valid. `layout.tsx` memasang provider i18n, sedangkan dashboard tetap client component karena interaktif. Dengan struktur ini, routing tetap rapi dan UI bisa berganti bahasa.

File yang perlu saya buka saat menjelaskan:

- `app/[locale]/layout.tsx`
- `lib/i18n/routing.ts`
- `proxy.ts`

Tingkat prioritas belajar:
PENTING.

## 10. Mengaktifkan Notifikasi

Nama fitur:
Web Push Notification.

Tujuan:
Mengirim peringatan ke user ketika buggy mendekati halte terdekat user.

File utama:

- `hooks/useBrowserNotificationToggle.ts`
- `lib/push/client.ts`
- `app/api/push/subscribe/route.ts`
- `app/api/push/unsubscribe/route.ts`
- `app/api/push/check-nearby/route.ts`
- `lib/push/nearby-alerts.ts`
- `lib/push/web-push.ts`
- `public/sw.js`

Alur kerja:
User mengaktifkan notifikasi dari dashboard. Browser meminta permission Notification API. Jika diizinkan, `subscribeToWebPush` mendaftarkan service worker `/sw.js`, membuat Push Subscription memakai VAPID public key, lalu mengirim subscription ke `/api/push/subscribe`. API menyimpan endpoint, key, lokasi user, radius, dan user agent ke tabel `notification_subscriptions`. Worker backend memanggil `/api/push/check-nearby` untuk mengecek buggy terdekat dan mengirim Web Push.

Data yang digunakan:

- Notification permission.
- Push endpoint, `p256dh`, `auth`.
- User id jika login.
- Lokasi user dan radius.
- VAPID public/private key.

Tabel database yang terlibat:

- `notification_subscriptions`

API / endpoint yang terlibat:

- `POST /api/push/subscribe`
- `POST /api/push/unsubscribe`
- `GET/POST /api/push/check-nearby`

Alasan teknis:
Foreground notification hanya muncul saat halaman aktif dan script browser sedang berjalan. Web Push dengan service worker tetap bisa menerima notifikasi meskipun tab tidak sedang aktif, selama browser mendukung dan user memberi izin. VAPID dipakai untuk membuktikan server pengirim push yang sah.

Pertanyaan dosen yang mungkin muncul:

- Apa fungsi service worker?
- Apa beda Notification API dan Web Push?
- Kenapa subscription perlu disimpan di database?

Jawaban singkat untuk sidang:
Notifikasi SIMOBI memakai Web Push agar peringatan bisa dikirim melalui service worker. Saat user mengaktifkan notifikasi, browser membuat push subscription dan server menyimpannya di `notification_subscriptions`. Worker backend kemudian mengecek buggy yang mendekati halte user dan mengirim push dengan VAPID. Jadi notifikasi tidak hanya bergantung pada halaman dashboard yang sedang aktif.

File yang perlu saya buka saat menjelaskan:

- `hooks/useBrowserNotificationToggle.ts`
- `lib/push/client.ts`
- `lib/push/nearby-alerts.ts`
- `public/sw.js`

Tingkat prioritas belajar:
WAJIB.

## 11. Radius Peringatan Notifikasi

Nama fitur:
Radius peringatan buggy mendekati halte.

Tujuan:
Memberi peringatan jika buggy aktif mendekati halte terdekat user dalam radius tertentu.

File utama:

- `hooks/useBrowserNotificationToggle.ts`
- `app/api/push/subscribe/route.ts`
- `lib/push/nearby-alerts.ts`
- `hooks/useNearbyBusAlert.ts`

Alur kerja:
Saat notifikasi aktif, frontend menyimpan posisi user dan radius ke server lewat `/api/push/subscribe`. Di backend, `processNearbyPushAlerts` membaca subscription yang punya latitude dan longitude. Sistem mencari halte terdekat user, lalu membandingkan jarak buggy aktif terhadap halte tersebut. Hanya buggy dengan status realtime reachable, yaitu Online atau Signal unstable, yang dipakai. Jika jarak masuk radius dan belum terkena cooldown, server mengirim push.

Data yang digunakan:

- `user_lat`, `user_lng`.
- `nearby_radius_meters`.
- Posisi buggy latest.
- Posisi halte terdekat.
- Cooldown alert.

Tabel database yang terlibat:

- `notification_subscriptions`
- `latest_buggy_telemetry`
- `haltes`

API / endpoint yang terlibat:

- `/api/push/subscribe`
- `/api/push/check-nearby`

Alasan teknis:
Buggy offline tidak dipakai untuk notifikasi karena posisinya bisa basi dan menyesatkan. Radius disimpan per subscription agar setiap user bisa punya jarak peringatan yang berbeda.

Pertanyaan dosen yang mungkin muncul:

- Kenapa hanya Online dan Signal unstable?
- Bagaimana radius disimpan?
- Kenapa memakai halte terdekat user?

Jawaban singkat untuk sidang:
Radius notifikasi disimpan di `notification_subscriptions` bersama lokasi user. Backend mencari halte terdekat user, lalu mengecek apakah ada buggy aktif yang mendekati halte tersebut. Buggy offline tidak dipakai karena datanya tidak cukup terpercaya. Dengan begitu notifikasi lebih relevan dan tidak banyak false alarm.

File yang perlu saya buka saat menjelaskan:

- `lib/push/nearby-alerts.ts`
- `app/api/push/subscribe/route.ts`

Tingkat prioritas belajar:
PENTING.

## 12. CRUD Data Buggy

Nama fitur:
Admin mengelola data buggy.

Tujuan:
Memungkinkan admin menambah, mengubah, dan menghapus data master buggy.

File utama:

- `app/api/admin/buggies/route.ts`
- `app/api/admin/buggies/[id]/route.ts`
- `components/admin/fleet/AdminDataSection.tsx`
- `components/admin/fleet/AdminBuggyFormPanel.tsx`
- `components/admin/fleet/AdminBuggyCard.tsx`
- `lib/auth/admin-guard.ts`

Alur kerja:
Admin membuka data fleet. Frontend mengambil daftar buggy lewat `/api/admin/buggies`. Saat admin menambah data, form mengirim POST ke endpoint admin dan server menyimpan row ke tabel `buggies`. Saat update, server mengubah `code`, `name`, `capacity`, dan `is_active`. Saat delete, server menghapus row dan menghapus buggy dari live store. Semua operasi dicek dengan `requireAdmin`.

Data yang digunakan:

- `code`, `name`, `capacity`.
- `is_active`.
- `numeric_id`.
- Data latest telemetry untuk status.

Tabel database yang terlibat:

- `buggies`
- `latest_buggy_telemetry`

API / endpoint yang terlibat:

- `GET /api/admin/buggies`
- `POST /api/admin/buggies`
- `PUT /api/admin/buggies/[id]`
- `DELETE /api/admin/buggies/[id]`

Alasan teknis:
Data master buggy dipisahkan dari telemetry supaya identitas kendaraan tetap stabil walaupun telemetry berubah terus. API admin diberi guard karena perubahan master data berdampak pada seluruh dashboard.

Pertanyaan dosen yang mungkin muncul:

- Apa yang terjadi setelah buggy diupdate?
- Apakah user umum bisa menambah buggy?
- Kenapa master buggy dipisah dari telemetry?

Jawaban singkat untuk sidang:
CRUD buggy hanya bisa dilakukan admin melalui API yang dilindungi `requireAdmin`. Data master seperti nama, kode, dan kapasitas disimpan di tabel `buggies`, sedangkan status realtime berasal dari telemetry. Setelah data berubah, server juga memperbarui live store agar dashboard segera mengikuti perubahan.

File yang perlu saya buka saat menjelaskan:

- `app/api/admin/buggies/route.ts`
- `app/api/admin/buggies/[id]/route.ts`
- `components/admin/fleet/AdminBuggyFormPanel.tsx`

Tingkat prioritas belajar:
PENTING.

## 13. CRUD Data Halte

Nama fitur:
Admin mengelola data halte.

Tujuan:
Memungkinkan admin mengubah titik operasional halte yang dipakai map, rute, dan notifikasi.

File utama:

- `app/api/haltes/route.ts`
- `app/api/haltes/[id]/route.ts`
- `components/admin/fleet/AdminDataSection.tsx`
- `components/map/MapCanvas.tsx`
- `lib/transit/halte-runtime.ts`

Alur kerja:
Admin membuka panel data dan membuat atau mengubah halte. Frontend mengirim POST, PUT, atau DELETE ke API halte. Server memvalidasi admin, menulis perubahan ke tabel `haltes`, lalu reload runtime halte agar dashboard memakai data terbaru. Frontend kemudian mengambil ulang data dan marker map berubah.

Data yang digunakan:

- `name`, `lat`, `lng`.
- `is_active`, `is_optional`.

Tabel database yang terlibat:

- `haltes`

API / endpoint yang terlibat:

- `GET /api/haltes`
- `POST /api/haltes`
- `PUT /api/haltes/[id]`
- `DELETE /api/haltes/[id]`

Alasan teknis:
Halte mempengaruhi banyak fitur, sehingga perubahan harus lewat API yang terkontrol. Runtime halte dipakai agar fungsi rute dan map bisa membaca daftar halte yang sama.

Pertanyaan dosen yang mungkin muncul:

- Apa efek menghapus halte?
- Kenapa halte aktif dan opsional dipisah?
- Bagaimana map tahu halte berubah?

Jawaban singkat untuk sidang:
CRUD halte dipakai agar admin bisa mengelola titik pemberhentian tanpa mengubah kode. Data disimpan di tabel `haltes` dan diambil lewat `/api/haltes`. Setelah halte berubah, runtime halte diperbarui sehingga marker map, pencarian rute, ETA, dan notifikasi memakai data terbaru.

File yang perlu saya buka saat menjelaskan:

- `app/api/haltes/route.ts`
- `app/api/haltes/[id]/route.ts`
- `lib/transit/halte-runtime.ts`

Tingkat prioritas belajar:
PENTING.

## 14. Hide Fleet

Nama fitur:
Menyembunyikan buggy tanpa menghapus data master.

Tujuan:
Membuat buggy tidak tampil di live dashboard saat tidak dipakai, tanpa kehilangan data master dan history.

File utama:

- `app/api/admin/buggies/[id]/route.ts`
- `app/api/admin/buggies/route.ts`
- `lib/realtime/buggy-api-snapshot.ts`
- `lib/server/gps-beacon/ingest-route.ts`
- `components/admin/fleet/AdminBuggyFormPanel.tsx`

Alur kerja:
Admin mengubah status aktif buggy melalui form. API update menyimpan `is_active` ke tabel `buggies`. Jika `is_active` false, buggy dihapus dari live store dan `buggy-api-snapshot` tidak memasukkannya ke snapshot publik. Jika payload GPS masuk untuk buggy yang hidden, ingest route mengecek `buggies.is_active` dan menolak update operasional. Data master tetap ada di admin list dan history lama tetap bisa dipahami.

Data yang digunakan:

- `buggies.is_active`.
- Id buggy dan latest telemetry.

Tabel database yang terlibat:

- `buggies`
- `latest_buggy_telemetry`
- `buggy_history`
- `buggy_session_history`

API / endpoint yang terlibat:

- `PUT /api/admin/buggies/[id]`
- `GET /api/admin/buggies`
- `/api/buggy`
- `/api/gps-beacon`

Alasan teknis:
Hide fleet lebih aman daripada delete karena data operasional dan relasi history tidak hilang. Fitur ini cocok untuk buggy rusak, maintenance, atau tidak dipakai sementara.

Pertanyaan dosen yang mungkin muncul:

- Apa bedanya hide dan delete?
- Apakah history buggy hidden hilang?
- Apakah GPS dari buggy hidden tetap diterima?

Jawaban singkat untuk sidang:
Hide fleet memakai field `is_active` di tabel `buggies`. Jika buggy di-hide, kendaraan tidak tampil di live map dan update GPS operasionalnya ditolak, tetapi data master dan history lama tidak hilang. Ini lebih aman untuk kondisi maintenance dibanding menghapus kendaraan permanen.

File yang perlu saya buka saat menjelaskan:

- `app/api/admin/buggies/[id]/route.ts`
- `lib/realtime/buggy-api-snapshot.ts`
- `lib/server/gps-beacon/ingest-route.ts`

Tingkat prioritas belajar:
PENTING.

## 15. Device Assignment

Nama fitur:
Assignment device GPS ke buggy.

Tujuan:
Menghubungkan perangkat GPS fisik dengan kendaraan tanpa hardcode.

File utama:

- `app/api/admin/device-assignments/route.ts`
- `app/api/admin/device-assignments/[id]/route.ts`
- `lib/buggy/device-assignment.ts`
- `hooks/useDeviceAssignments.ts`
- `components/admin/device-assignment/DeviceAssignmentPanel.tsx`
- `lib/server/gps-beacon/ingest-route.ts`

Alur kerja:
Device mengirim payload dengan `devicesId` atau `deviceId`. `ingest-route` mencatat device ke `device_registry`, lalu mencari assignment aktif di `device_assignments`. Jika ditemukan, sistem tahu payload tersebut milik buggy mana. Admin dapat membuat atau mengganti assignment lewat panel device assignment. Saat membuat assignment baru, API menonaktifkan assignment aktif lama untuk device yang sama agar satu device tidak ambigu.

Data yang digunakan:

- `devicesId` atau `deviceId`.
- `buggy_id`.
- `label`, `is_active`.
- `last_seen_at`.

Tabel database yang terlibat:

- `device_registry`
- `device_assignments`
- `buggies`
- `latest_buggy_telemetry`
- `buggy_history`

API / endpoint yang terlibat:

- `GET /api/admin/device-assignments`
- `POST /api/admin/device-assignments`
- `PUT /api/admin/device-assignments/[id]`
- `DELETE /api/admin/device-assignments/[id]`
- `POST /api/gps-beacon`

Alasan teknis:
Device tidak di-hardcode ke satu buggy karena perangkat bisa dipindah saat maintenance atau penggantian hardware. Assignment membuat sistem fleksibel dan data GPS tetap bisa dipetakan ke kendaraan yang benar.

Pertanyaan dosen yang mungkin muncul:

- Bagaimana sistem tahu payload GPS milik buggy mana?
- Kenapa tidak memakai `buggyId` saja?
- Apa fungsi `device_registry`?

Jawaban singkat untuk sidang:
Payload GPS membawa `devicesId`, lalu backend mencari assignment aktif di `device_assignments`. Dari situ sistem mengetahui device tersebut sedang dipasang di buggy mana. `device_registry` mencatat device yang pernah terlihat, sedangkan `device_assignments` mencatat hubungan device ke buggy. Dengan cara ini device bisa dipindah tanpa mengubah firmware.

File yang perlu saya buka saat menjelaskan:

- `lib/buggy/device-assignment.ts`
- `app/api/admin/device-assignments/route.ts`
- `lib/server/gps-beacon/ingest-route.ts`

Tingkat prioritas belajar:
WAJIB.

## 16. Geofence

Nama fitur:
Geofence area monitoring.

Tujuan:
Memantau apakah buggy masuk atau keluar area radius tertentu di map.

File utama:

- `app/api/geofences/route.ts`
- `app/api/geofences/[id]/route.ts`
- `lib/geofence-store.ts`
- `hooks/useDashboardGeofences.ts`
- `components/admin/geofence/GeofenceManager.tsx`
- `components/admin/geofence/GeofenceEventLog.tsx`
- `components/map/hooks/useGeofenceOverlays.ts`

Alur kerja:
Admin membuat geofence dengan memilih titik pusat dan radius di map. Frontend mengirim data ke `/api/geofences`, server memvalidasi admin dan menyimpan lewat `geofence-store`. Dashboard mengambil daftar geofence, lalu `useDashboardGeofences` membandingkan posisi buggy live dengan radius setiap geofence. Saat status berubah dari luar ke dalam atau sebaliknya, event alert dibuat dan dapat muncul di log admin.

Data yang digunakan:

- `name`, `center.lat`, `center.lng`.
- `radiusMeters`.
- `enabled`.
- Posisi buggy live.

Tabel database yang terlibat:

- `geofences`

API / endpoint yang terlibat:

- `GET /api/geofences`
- `POST /api/geofences`
- `PATCH /api/geofences/[id]`
- `DELETE /api/geofences/[id]`

Alasan teknis:
Geofence diproses di dashboard karena posisi buggy live sudah tersedia di client dan alert visual harus responsif. Penyimpanan tetap di server agar konfigurasi area tidak hilang dan bisa dikelola admin.

Pertanyaan dosen yang mungkin muncul:

- Bagaimana sistem mendeteksi masuk/keluar geofence?
- Kenapa geofence menggunakan radius?
- Siapa yang boleh membuat geofence?

Jawaban singkat untuk sidang:
Geofence adalah area berbentuk radius yang dibuat admin di map. Data area disimpan dan diambil lewat API geofence. Dashboard membandingkan jarak buggy live terhadap pusat geofence untuk mengetahui masuk atau keluar area. Event tersebut dipakai sebagai alert operasional untuk admin.

File yang perlu saya buka saat menjelaskan:

- `hooks/useDashboardGeofences.ts`
- `components/map/hooks/useGeofenceOverlays.ts`
- `app/api/geofences/route.ts`

Tingkat prioritas belajar:
PENTING.

## 17. Statistik Operasional

Nama fitur:
Statistik operasional armada.

Tujuan:
Memberikan ringkasan performa armada seperti jumlah trip, jarak, durasi, kecepatan, penumpang, dan top buggy.

File utama:

- `app/api/admin/statistics/route.ts`
- `components/admin/statistics/AdminStatisticsPanel.tsx`
- `components/admin/statistics/statistics-helpers.ts`
- `components/admin/statistics/StatCharts.tsx`
- `lib/supabase/server.ts`

Alur kerja:
Admin membuka panel statistik. `AdminStatisticsPanel` memanggil `/api/admin/statistics`. API admin membaca `buggy_session_history` untuk bulan yang dipilih dan bulan sebelumnya. Server menghapus duplikasi sesi, membuang outlier kecepatan yang tidak wajar, menghitung total trip, total jarak, durasi, average speed, battery used, passenger boardings, dan perbandingan tren. UI menampilkan angka dan chart.

Data yang digunakan:

- `total_distance_km`, `duration_minutes`, `avg_speed_kmh`.
- `passenger_avg`, `passenger_peak`, `passenger_samples`, `passenger_boardings`.
- `battery_used`.
- `session_date`, `started_at`.
- Kapasitas buggy.

Tabel database yang terlibat:

- `buggy_session_history`
- `buggies`

API / endpoint yang terlibat:

- `GET /api/admin/statistics`

Alasan teknis:
Statistik memakai session summary, bukan live telemetry, karena statistik harus stabil dan tidak berubah karena server restart. Data sesi sudah melewati pembersihan GPS dan rekap, sehingga lebih cocok untuk laporan.

Pertanyaan dosen yang mungkin muncul:

- Statistik diambil dari data apa?
- Kenapa memakai session history?
- Bagaimana sistem mencegah outlier merusak statistik?

Jawaban singkat untuk sidang:
Statistik operasional dihitung dari `buggy_session_history`, bukan dari live telemetry langsung. Data ini sudah berupa ringkasan perjalanan, sehingga lebih stabil untuk laporan admin. API statistik juga melakukan deduplikasi dan filter outlier agar angka seperti jarak dan kecepatan tidak rusak oleh GPS yang tidak valid.

File yang perlu saya buka saat menjelaskan:

- `app/api/admin/statistics/route.ts`
- `components/admin/statistics/AdminStatisticsPanel.tsx`

Tingkat prioritas belajar:
PENTING.

## 18. ETA dan XGBoost

Nama fitur:
ETA deterministik dan ETA prediktif XGBoost.

Tujuan:
Memberikan estimasi waktu kedatangan buggy ke halte berikutnya atau segmen rute.

File utama:

- `components/buggy/BuggyDetailView.tsx`
- `app/api/eta/predict-segment/route.ts`
- `lib/transit/buggy-route-utils.ts`
- `eta-vps/api_eta.py`
- `eta-vps/xgboost_eta_model.json`
- `eta-vps/dataroute.txt`
- `eta-vps/eta-api.service`

Alur kerja:
Saat detail buggy dibuka, `BuggyDetailView` menyusun segmen halte yang relevan. Untuk setiap segmen, frontend memanggil `/api/eta/predict-segment`. API Next.js memvalidasi format `from_halte`, `to_halte`, dan jumlah penumpang, lalu meneruskan request ke service Python melalui `ETA_API_URL`. Service Python memuat model XGBoost dan data jarak route, menghitung fitur seperti jarak, penumpang, jam, hari, weekend, peak hour, dan index halte, lalu mengembalikan ETA. Jika service ML error, UI tetap fallback ke ETA deterministik dari utility rute.

Data yang digunakan:

- `from_halte`, `to_halte`.
- `passengers`.
- `route_distance_m`.
- Jam, hari, weekend, peak hour.
- Posisi halte dan route order.

Tabel database yang terlibat:

- Tidak langsung. Data live berasal dari `latest_buggy_telemetry` dan `haltes`, tetapi prediksi ML memakai service Python dan file model.

API / endpoint yang terlibat:

- `POST /api/eta/predict-segment`
- Python service `/predict_segment`
- Python service `/health`

Alasan teknis:
Browser tidak langsung memanggil service Python karena alamat service dan konfigurasi backend sebaiknya tidak diekspos. API Next.js menjadi proxy server-side untuk validasi, timeout, dan fallback. ETA deterministik dipakai sebagai cadangan agar UI tetap berguna jika layanan ML tidak aktif.

Pertanyaan dosen yang mungkin muncul:

- Apa beda ETA deterministik dan XGBoost?
- Kenapa Python service tidak dipanggil langsung dari browser?
- Apa yang terjadi jika service ML mati?

Jawaban singkat untuk sidang:
SIMOBI punya dua pendekatan ETA. ETA deterministik menghitung estimasi berdasarkan jarak dan aturan rute, sedangkan XGBoost memprediksi waktu berdasarkan fitur seperti jarak, halte asal-tujuan, waktu, dan penumpang. Frontend memanggil API Next.js, lalu API tersebut meneruskan ke service Python. Jika ML gagal, sistem fallback ke ETA deterministik agar tampilan tetap berjalan.

File yang perlu saya buka saat menjelaskan:

- `components/buggy/BuggyDetailView.tsx`
- `app/api/eta/predict-segment/route.ts`
- `eta-vps/api_eta.py`

Tingkat prioritas belajar:
WAJIB.

## 19. GPS Tracker Simulator

Nama fitur:
GPS Tracker Simulator.

Tujuan:
Menguji alur telemetry tanpa harus selalu memakai perangkat GPS fisik.

File utama:

- `app/[locale]/gps-tracker/page.tsx`
- `app/[locale]/gps-tracker/GpsTrackerScrollFix.tsx`
- `proxy.ts`
- `lib/server/gps-beacon/ingest-route.ts`

Alur kerja:
Admin membuka `/id/gps-tracker` atau `/en/gps-tracker`. Halaman simulator membuat payload telemetry berisi `buggyId`, `devicesId`, posisi, speed, battery, passengers, ETA, session marker, dan GSM. Payload dipublish ke MQTT WebSocket dengan topic `${prefix}/{buggyId}/data`. MQTT bridge kemudian meneruskan payload ke `/api/gps-beacon`, sehingga simulator bisa masuk ke alur yang sama seperti hardware jika bridge aktif.

Data yang digunakan:

- `buggyId`, `devicesId`.
- `lat`, `lng`, `speedKmh`, `batteryLevel`, `passengers`.
- `sessionStart`, `sessionEnd`.
- `gsm`.
- MQTT broker URL dan topic prefix.

Tabel database yang terlibat:

- Sama seperti telemetry hardware: `device_registry`, `device_assignments`, `latest_buggy_telemetry`, `buggy_history`, `buggy_session_history`.

API / endpoint yang terlibat:

- `/api/haltes`
- `/api/buggy`
- `/api/admin/device-assignments`
- Bridge target: `/api/gps-beacon`

Alasan teknis:
Simulator dibuat untuk testing end-to-end, terutama saat hardware belum tersedia atau ingin menguji banyak buggy sekaligus. Aksesnya dibatasi admin karena simulator dapat mempengaruhi telemetry operasional.

Pertanyaan dosen yang mungkin muncul:

- Apakah data simulator sama dengan hardware?
- Kenapa simulator hanya admin?
- Apakah simulator langsung menulis database?

Jawaban singkat untuk sidang:
Simulator dipakai untuk menguji alur telemetry tanpa perangkat fisik. Halaman ini publish payload ke MQTT WebSocket, lalu MQTT bridge meneruskannya ke `/api/gps-beacon`. Karena masuk lewat endpoint yang sama, data simulator dapat menguji live map, history, dan status seperti hardware. Aksesnya admin karena data simulator bisa mempengaruhi dashboard operasional.

File yang perlu saya buka saat menjelaskan:

- `app/[locale]/gps-tracker/page.tsx`
- `proxy.ts`
- `lib/server/gps-beacon/ingest-route.ts`

Tingkat prioritas belajar:
TAMBAHAN.

## 20. Status GSM/MQTT

Nama fitur:
Status GSM dan MQTT perangkat.

Tujuan:
Menampilkan kondisi jaringan perangkat agar admin atau driver tahu kualitas koneksi hardware.

File utama:

- `lib/server/gps-beacon/status-only.ts`
- `lib/server/gps-beacon/ingest-route.ts`
- `lib/realtime/buggy-live-store.ts`
- `components/buggy/BuggyDetailView.tsx`
- `components/admin/fleet/BuggyOperationalDetail.tsx`

Alur kerja:
Perangkat bisa mengirim payload status-only berisi GSM/MQTT tanpa posisi GPS baru. `ingest-route` mendeteksi payload status-only dan memprosesnya lewat `handleStatusOnlyPayload`. Data GSM memperbarui live store dan `latest_buggy_telemetry`, lalu SSE broadcast dikirim agar UI berubah. Status-only tidak selalu masuk `buggy_history` karena bukan titik perjalanan.

Data yang digunakan:

- `gsm.apn`, `signalCsq`, `signalDbm`, `signalPercent`.
- `simStatus`, `simStatusText`.
- `networkConnected`, `gprsConnected`.
- `localIp`, `networkType`.
- `mqttState`, `mqttStateText`.

Tabel database yang terlibat:

- `latest_buggy_telemetry`
- `device_registry`

API / endpoint yang terlibat:

- `POST /api/gps-beacon`
- `/api/buggy`
- `/api/buggy/stream`

Alasan teknis:
Status jaringan penting untuk diagnosis perangkat, tetapi tidak selalu merepresentasikan perjalanan. Karena itu status GSM/MQTT diperbarui di latest telemetry dan live store, sedangkan history perjalanan tetap fokus pada titik GPS yang valid.

Pertanyaan dosen yang mungkin muncul:

- Apa itu payload status-only?
- Kenapa status GSM tidak selalu masuk history?
- Siapa yang melihat status GSM?

Jawaban singkat untuk sidang:
Status GSM/MQTT menunjukkan kondisi koneksi perangkat, seperti sinyal, GPRS, dan MQTT state. Jika perangkat hanya mengirim status tanpa GPS, sistem memperbarui latest telemetry dan live store. Data ini tidak selalu masuk history karena history perjalanan sebaiknya berisi titik GPS yang valid. Status ini berguna untuk admin dan driver saat mendiagnosis koneksi perangkat.

File yang perlu saya buka saat menjelaskan:

- `lib/server/gps-beacon/status-only.ts`
- `components/buggy/BuggyDetailView.tsx`

Tingkat prioritas belajar:
PENTING.

## 21. Database Utama Supabase

Nama fitur:
Database utama SIMOBI di Supabase PostgreSQL.

Tujuan:
Menyimpan profil user, data master, telemetry terbaru, history, subscription notifikasi, device assignment, dan geofence.

File utama:

- `lib/supabase/server.ts`
- `lib/supabase/client.ts`
- `lib/supabase/data-loader.ts`
- `lib/supabase/latest-buggy-telemetry.ts`
- `supabase/migrations/*.sql`

Alur kerja:
Frontend dan API memakai Supabase untuk membaca dan menulis data sesuai kebutuhan. Client Supabase dipakai untuk session user dan query ringan yang sesuai akses. Untuk operasi admin atau server, API route memakai server/admin client. Data yang sering berubah seperti telemetry terbaru disimpan ke `latest_buggy_telemetry`, sedangkan data operasional jangka panjang masuk ke history.

Data yang digunakan dan tabel penting:

- `accounts`: profil aplikasi user, role, `buggy_id` driver, favorite.
- `buggies`: master kendaraan, kode, nama, kapasitas, `is_active`.
- `haltes`: titik halte, koordinat, aktif/opsional.
- `geofences`: area radius monitoring.
- `device_registry`: daftar device GPS yang pernah terlihat.
- `device_assignments`: hubungan aktif device ke buggy.
- `latest_buggy_telemetry`: kondisi terakhir setiap buggy.
- `buggy_history`: raw GPS point yang sudah lolos filter.
- `buggy_session_history`: ringkasan perjalanan per sesi.
- `notification_subscriptions`: endpoint Web Push dan lokasi/radius user.

Tabel database yang terlibat:

- Semua tabel di atas.

API / endpoint yang terlibat:

- Hampir semua endpoint SIMOBI, terutama `/api/gps-beacon`, `/api/buggy`, `/api/haltes`, `/api/admin/*`, `/api/buggy-sessions`, `/api/push/*`.

Alasan teknis:
Supabase PostgreSQL dipakai karena cocok untuk data relasional seperti user, buggy, halte, assignment, dan history. Supabase Auth menyederhanakan login, sedangkan PostgreSQL memberi query dan constraint yang kuat. Pemisahan tabel membuat data realtime, master, dan history tidak saling bercampur.

Pertanyaan dosen yang mungkin muncul:

- Tabel mana yang paling penting?
- Kenapa latest telemetry dipisah dari history?
- Apakah semua tabel punya migration di repo?

Jawaban singkat untuk sidang:
Database SIMOBI dibagi berdasarkan fungsi. `accounts` menyimpan role user, `buggies` dan `haltes` menyimpan data master, `latest_buggy_telemetry` menyimpan kondisi terbaru, sedangkan `buggy_history` dan `buggy_session_history` menyimpan riwayat. Untuk notifikasi ada `notification_subscriptions`, dan untuk perangkat ada `device_registry` serta `device_assignments`. Beberapa tabel utama dipakai jelas di kode, meskipun migration awalnya tidak semua ditemukan di repo.

File yang perlu saya buka saat menjelaskan:

- `lib/supabase/server.ts`
- `lib/supabase/data-loader.ts`
- `supabase/migrations/20260526054636_create_latest_buggy_telemetry.sql`
- `supabase/migrations/20260603093000_create_device_assignments.sql`
- `supabase/migrations/20260601122722_create_notification_subscriptions.sql`

Tingkat prioritas belajar:
WAJIB.

## 22. Keamanan API dan Token

Nama fitur:
Keamanan API, route protected, dan token server.

Tujuan:
Mencegah akses tidak sah, perubahan data oleh user biasa, dan pengiriman GPS palsu dari publik.

File utama:

- `proxy.ts`
- `lib/auth/admin-guard.ts`
- `lib/auth/ingest-token.ts`
- `lib/server/gps-beacon/ingest-route.ts`
- `lib/server/buggy-sessions/access.ts`
- `app/api/push/check-nearby/route.ts`
- `lib/supabase/server.ts`

Alur kerja:
Route sensitif dilindungi oleh `proxy.ts` dan guard server. API admin memakai `requireAdmin`. History memakai access context sehingga driver hanya melihat buggy yang ditugaskan. Endpoint `/api/gps-beacon` memvalidasi bearer token `BUGGY_INGEST_TOKEN`, sehingga publik tidak bisa sembarang mengirim payload GPS. Worker push dilindungi dengan `PUSH_WORKER_TOKEN` atau `CRON_SECRET`.

Data yang digunakan:

- Supabase session.
- `accounts.role` dan `accounts.buggy_id`.
- Bearer token ingest.
- Worker token push atau cron secret.

Tabel database yang terlibat:

- `accounts`
- `buggies`
- `device_assignments`
- `notification_subscriptions`

API / endpoint yang terlibat:

- `/api/admin/*`
- `/api/gps-beacon`
- `/api/buggy-sessions`
- `/api/push/check-nearby`
- `/gps-tracker`

Alasan teknis:
UI permission saja tidak cukup karena user bisa memanggil endpoint manual. Karena itu validasi role dan token dilakukan di backend. `BUGGY_INGEST_TOKEN` menjadi lapisan penting agar hanya bridge/hardware terpercaya yang dapat mengirim telemetry.

Pertanyaan dosen yang mungkin muncul:

- Bagaimana mencegah GPS palsu?
- Apakah driver bisa melihat semua buggy?
- Kenapa perlu token worker?

Jawaban singkat untuk sidang:
Keamanan SIMOBI dibagi menjadi session user, role aplikasi, dan token server. Admin API hanya bisa diakses admin, driver dibatasi pada buggy yang ditugaskan, dan endpoint GPS memakai `BUGGY_INGEST_TOKEN`. Worker notifikasi juga memakai token agar tidak bisa dipicu sembarang pihak. Jadi validasi dilakukan di backend, bukan hanya menyembunyikan tombol di frontend.

File yang perlu saya buka saat menjelaskan:

- `proxy.ts`
- `lib/auth/admin-guard.ts`
- `lib/auth/ingest-token.ts`
- `lib/server/buggy-sessions/access.ts`

Tingkat prioritas belajar:
WAJIB.

## A. Ringkasan 1 Menit

SIMOBI adalah sistem monitoring buggy listrik kampus berbasis web. Sistem ini menampilkan posisi buggy secara realtime di Google Maps, menyediakan pencarian rute dan halte, menampilkan detail kondisi buggy, menyimpan history perjalanan, serta mengirim notifikasi saat buggy mendekati halte pengguna. Data GPS dari perangkat atau simulator masuk melalui MQTT broker dan MQTT bridge, lalu divalidasi oleh API Next.js sebelum disimpan ke Supabase dan ditampilkan ke dashboard. Akses sistem dibedakan berdasarkan role Admin, Driver, dan Pengguna umum agar fitur operasional tetap aman.

## B. Ringkasan 3 Menit Arsitektur

SIMOBI dibangun dengan Next.js App Router, React, TypeScript, Supabase Auth, Supabase PostgreSQL, Google Maps, MQTT bridge, Web Push, dan service worker. Dari sisi user, route utama berada di `/id` dan `/en`, lalu `DashboardShell` menjadi pusat dashboard client-side karena fitur map, geolocation, notification, dan realtime membutuhkan API browser. Login memakai Supabase Auth, sedangkan role aplikasi dibaca dari tabel `accounts`.

Untuk telemetry, perangkat GPS atau simulator publish data ke MQTT broker. MQTT bridge meneruskan data ke `POST /api/gps-beacon`. Endpoint ini memvalidasi `BUGGY_INGEST_TOKEN`, menyelesaikan `devicesId` ke buggy melalui `device_assignments`, memperbarui live store, menyimpan kondisi terakhir ke `latest_buggy_telemetry`, menyimpan sebagian titik ke `buggy_history`, dan membangun ringkasan sesi ke `buggy_session_history`. Browser membaca data realtime lewat SSE `/api/buggy/stream`, dengan fallback polling `/api/buggy`.

Untuk fitur tambahan, halte dan buggy dikelola admin melalui API CRUD. History dibaca lewat `/api/buggy-sessions` dan path digambar di map. Notifikasi memakai service worker dan VAPID, subscription disimpan di `notification_subscriptions`, lalu worker backend mengecek buggy yang mendekati halte user. ETA menggunakan dua pendekatan: deterministik dari utility rute dan prediktif XGBoost melalui API Next.js yang meneruskan request ke service Python.

## C. 30 Pertanyaan Dosen dan Jawaban Singkat

1. Apa inti SIMOBI?
   SIMOBI memonitor buggy listrik kampus secara realtime, menampilkan lokasi di map, history perjalanan, rute halte, dan notifikasi.

2. Kenapa memakai Next.js?
   Karena Next.js menyediakan UI React dan API route dalam satu project, sehingga dashboard dan backend ringan bisa dikelola bersama.

3. Kenapa `page.tsx` pendek?
   Karena route page hanya entry point, sedangkan dashboard interaktif ada di `DashboardShell` sebagai client component.

4. Apa beda authentication dan authorization?
   Authentication memastikan identitas user, sedangkan authorization menentukan hak akses berdasarkan role.

5. Dari mana role user diambil?
   Role diambil dari tabel `accounts`, bukan langsung dari Supabase Auth.

6. Apa saja role SIMOBI?
   Admin, Driver, dan Pengguna umum.

7. Kenapa browser tidak langsung membaca MQTT?
   Agar credential broker tidak terekspos dan payload bisa divalidasi di backend.

8. Apa fungsi `/api/gps-beacon`?
   Endpoint ini menjadi gerbang masuk telemetry GPS dari bridge ke sistem web.

9. Apa fungsi `BUGGY_INGEST_TOKEN`?
   Token ini mencegah publik mengirim GPS palsu ke endpoint ingest.

10. Apa itu live store?
    Live store adalah cache server memory untuk data buggy terbaru agar realtime dashboard cepat.

11. Kenapa tetap perlu Supabase jika ada live store?
    Live store cepat tetapi tidak durable; Supabase menyimpan data permanen.

12. Apa beda `/api/buggy` dan `/api/buggy/stream`?
    `/api/buggy` mengembalikan snapshot biasa, sedangkan `/api/buggy/stream` mengirim update dengan SSE.

13. Apa itu SSE?
    SSE adalah koneksi server-to-browser untuk mengirim event realtime satu arah.

14. Apa fallback jika SSE gagal?
    `useBuggyLiveFeed` fallback ke polling `/api/buggy`.

15. Apa beda `buggy_history` dan `buggy_session_history`?
    `buggy_history` berisi titik GPS mentah, sedangkan `buggy_session_history` berisi ringkasan perjalanan.

16. Kenapa tidak semua titik GPS disimpan?
    Untuk menghindari data duplikat, no-fix, outlier, dan beban database berlebihan.

17. Bagaimana session history dibuat?
    `session-store` mengumpulkan titik GPS, lalu menghitung jarak, durasi, speed, battery, penumpang, dan path.

18. Kenapa halte penting?
    Halte menjadi referensi marker, rute, ETA, dan notifikasi.

19. Apa efek admin mengubah halte?
    Marker, pencarian rute, ETA, dan notifikasi dapat ikut berubah karena memakai data halte yang sama.

20. Apa itu hide fleet?
    Hide fleet menyembunyikan buggy dari live dashboard tanpa menghapus master data dan history.

21. Kenapa device assignment diperlukan?
    Agar device GPS bisa dipindah antar buggy tanpa mengubah firmware.

22. Bagaimana sistem tahu GPS milik buggy mana?
    Backend membaca `devicesId`, lalu mencari assignment aktif di `device_assignments`.

23. Apa fungsi geofence?
    Geofence memantau apakah buggy masuk atau keluar area radius tertentu.

24. Statistik diambil dari data apa?
    Statistik diambil dari `buggy_session_history`.

25. Kenapa statistik tidak dari live telemetry?
    Live telemetry berubah cepat dan tidak stabil untuk laporan historis.

26. Apa beda ETA deterministik dan XGBoost?
    Deterministik menghitung dari jarak/aturan, XGBoost memprediksi dari fitur historis dan kondisi.

27. Kenapa Python ETA tidak dipanggil langsung dari browser?
    Agar URL service, timeout, dan validasi tetap dikontrol backend.

28. Apa fungsi service worker?
    Service worker menerima Web Push dan menampilkan notifikasi meskipun tab tidak aktif.

29. Kenapa notifikasi hanya memakai buggy Online atau Signal unstable?
    Karena posisi buggy offline bisa basi dan berisiko memberi peringatan salah.

30. Bagaimana membatasi akses driver?
    Driver punya `buggy_id` di `accounts`, lalu API history membatasi data berdasarkan assignment tersebut.

## D. Tabel Prioritas Belajar

| Prioritas | Nama fitur | Kenapa penting | File yang harus dibuka | Tabel database yang harus dipahami | Jawaban singkat yang harus dihafalkan |
|---|---|---|---|---|---|
| WAJIB | Login dan Role User | Dasar akses sistem | `hooks/useUserRole.ts`, `lib/auth/dashboard-permissions.ts`, `lib/auth/admin-guard.ts` | `accounts` | Auth menentukan user, role menentukan hak akses. |
| WAJIB | Dashboard Role-Based | Menjelaskan UI utama | `components/dashboard/DashboardShell.tsx`, `DashboardSidePanel.tsx` | `accounts`, `buggies`, `haltes` | Dashboard menampilkan fitur sesuai permission role. |
| WAJIB | Monitoring Realtime | Fitur inti SIMOBI | `lib/server/gps-beacon/ingest-route.ts`, `hooks/useBuggyLiveFeed.ts` | `latest_buggy_telemetry`, `device_assignments` | GPS masuk lewat API, lalu tampil realtime via SSE. |
| WAJIB | Detail Buggy | Menjelaskan data operasional | `components/buggy/BuggyDetailView.tsx` | `buggies`, `latest_buggy_telemetry` | Detail menggabungkan master buggy dan telemetry terbaru. |
| PENTING | Data Halte | Dasar rute dan notifikasi | `app/api/haltes/route.ts`, `lib/transit/halte-runtime.ts` | `haltes` | Halte adalah referensi map, rute, ETA, dan notifikasi. |
| PENTING | Pencarian Rute | Fitur pengguna | `hooks/useDirectionSearch.ts`, `lib/transit/route-search.ts` | `haltes`, `buggies` | Sistem menentukan origin, destination, dan buggy relevan. |
| WAJIB | History Perjalanan | Bahan laporan operasional | `components/history/HistoryPanel.tsx`, `lib/server/buggy-sessions/get-sessions.ts` | `buggy_history`, `buggy_session_history` | Raw GPS dan ringkasan sesi dipisah agar history efisien. |
| WAJIB | GPS ke History | Menjelaskan pipeline data | `lib/realtime/session-store.ts`, `lib/buggy/gps-quality.ts` | `buggy_history`, `buggy_session_history` | Titik GPS difilter lalu direkap menjadi sesi. |
| PENTING | Bahasa | Menjelaskan route `/id` dan `/en` | `proxy.ts`, `lib/i18n/routing.ts` | Tidak ada | Locale route membuat bahasa jelas di URL. |
| WAJIB | Notifikasi | Fitur browser modern | `lib/push/client.ts`, `lib/push/nearby-alerts.ts` | `notification_subscriptions` | Web Push memakai service worker dan VAPID. |
| PENTING | Radius Notifikasi | Menjelaskan logika alert | `lib/push/nearby-alerts.ts` | `notification_subscriptions` | Backend mengecek buggy aktif dekat halte user. |
| PENTING | CRUD Buggy | Operasional admin | `app/api/admin/buggies/route.ts` | `buggies` | Master buggy dikelola admin dan dipisah dari telemetry. |
| PENTING | CRUD Halte | Operasional admin | `app/api/haltes/route.ts` | `haltes` | Admin bisa mengubah titik halte tanpa mengubah kode. |
| PENTING | Hide Fleet | Maintenance kendaraan | `app/api/admin/buggies/[id]/route.ts` | `buggies` | Hide menyembunyikan tanpa menghapus history. |
| WAJIB | Device Assignment | Kunci hardware mapping | `lib/buggy/device-assignment.ts` | `device_registry`, `device_assignments` | `devicesId` dipetakan ke buggy lewat assignment aktif. |
| PENTING | Geofence | Monitoring area | `hooks/useDashboardGeofences.ts` | `geofences` | Sistem membandingkan posisi buggy dengan radius area. |
| PENTING | Statistik | Laporan operasional | `app/api/admin/statistics/route.ts` | `buggy_session_history` | Statistik dihitung dari ringkasan sesi. |
| WAJIB | ETA XGBoost | Nilai teknis ML | `app/api/eta/predict-segment/route.ts`, `eta-vps/api_eta.py` | Tidak langsung | Next.js menjadi proxy ke service Python dan punya fallback. |
| TAMBAHAN | GPS Simulator | Testing | `app/[locale]/gps-tracker/page.tsx` | Sama seperti GPS hardware | Simulator publish ke MQTT untuk menguji alur yang sama. |
| PENTING | GSM/MQTT Status | Diagnosis perangkat | `lib/server/gps-beacon/status-only.ts` | `latest_buggy_telemetry` | Status jaringan disimpan sebagai latest status, bukan selalu history. |
| WAJIB | Database Supabase | Dasar semua fitur | `lib/supabase/server.ts`, `supabase/migrations/*.sql` | Semua tabel utama | Tabel dipisah berdasarkan fungsi master, live, history, dan notification. |
| WAJIB | Keamanan API | Pertanyaan sidang umum | `proxy.ts`, `lib/auth/ingest-token.ts` | `accounts`, `device_assignments` | API sensitif divalidasi server-side dengan role dan token. |

## E. Diagram Alur Teks Fitur Inti

### 1. Login dan role

```text
User input email/password
  -> AuthForm
  -> Supabase Auth signInWithPassword
  -> session tersimpan
  -> useUserRole membaca Supabase user
  -> query accounts by user.id
  -> dashboard-permissions
  -> DashboardShell menampilkan fitur sesuai role
```

### 2. GPS realtime sampai marker tampil

```text
ESP/GPS atau Simulator
  -> MQTT Broker
  -> MQTT Bridge
  -> POST /api/gps-beacon
  -> validate BUGGY_INGEST_TOKEN
  -> resolve devicesId via device_assignments
  -> update live store + latest_buggy_telemetry
  -> broadcast SSE
  -> useBuggyLiveFeed
  -> DashboardShell
  -> MapCanvas marker bergerak
```

### 3. Data GPS masuk ke history

```text
POST /api/gps-beacon
  -> normalize telemetry
  -> filter no-fix, duplikat, outlier
  -> throttle raw GPS
  -> insert buggy_history
  -> session-store addPoint
  -> sessionEnd atau idle timeout
  -> sanitize path
  -> hitung durasi, jarak, avg speed, battery, passengers
  -> upsert buggy_session_history
  -> HistoryPanel menampilkan sesi
```

### 4. Notifikasi buggy mendekati halte

```text
User aktifkan notification
  -> browser permission
  -> register /sw.js
  -> create PushSubscription with VAPID
  -> POST /api/push/subscribe
  -> save notification_subscriptions
  -> worker calls /api/push/check-nearby
  -> read active buggies + haltes + subscriptions
  -> find nearest halte to user
  -> check Online/Signal unstable buggy within radius
  -> send Web Push
```

### 5. Device assignment

```text
Device sends payload with devicesId
  -> /api/gps-beacon
  -> recordSeenDevice to device_registry
  -> resolveActiveDeviceAssignment
  -> get buggy_id
  -> update telemetry for that buggy

Admin changes assignment
  -> DeviceAssignmentPanel
  -> /api/admin/device-assignments
  -> deactivate old active assignment
  -> insert/update new active assignment
```

### 6. ETA XGBoost

```text
BuggyDetailView
  -> build segment from halte route
  -> POST /api/eta/predict-segment
  -> validate request
  -> server calls ETA_API_URL /predict_segment
  -> eta-vps/api_eta.py
  -> xgboost_eta_model.json
  -> predicted ETA response
  -> UI display model ETA
  -> fallback deterministic ETA if error
```

## F. Daftar File yang Wajib Dipahami

File frontend:

- `app/[locale]/page.tsx`
- `app/[locale]/layout.tsx`
- `components/dashboard/DashboardShell.tsx`
- `components/dashboard/DashboardSidePanel.tsx`
- `components/buggy/BuggyDetailView.tsx`
- `components/buggy/PanelActive.tsx`
- `components/history/HistoryPanel.tsx`
- `components/search/LiveSearchBar.tsx`
- `components/admin/fleet/AdminDataSection.tsx`
- `components/admin/fleet/AdminBuggyFormPanel.tsx`
- `components/admin/statistics/AdminStatisticsPanel.tsx`
- `components/admin/geofence/GeofenceManager.tsx`
- `components/admin/device-assignment/DeviceAssignmentPanel.tsx`

File API/backend:

- `app/api/gps-beacon/route.ts`
- `lib/server/gps-beacon/ingest-route.ts`
- `app/api/buggy/route.ts`
- `app/api/buggy/stream/route.ts`
- `app/api/haltes/route.ts`
- `app/api/haltes/[id]/route.ts`
- `app/api/admin/buggies/route.ts`
- `app/api/admin/buggies/[id]/route.ts`
- `app/api/admin/accounts/route.ts`
- `app/api/admin/device-assignments/route.ts`
- `app/api/buggy-sessions/route.ts`
- `lib/server/buggy-sessions/get-sessions.ts`
- `app/api/admin/statistics/route.ts`
- `app/api/eta/predict-segment/route.ts`

File database/Supabase:

- `lib/supabase/server.ts`
- `lib/supabase/client.ts`
- `lib/supabase/data-loader.ts`
- `lib/supabase/latest-buggy-telemetry.ts`
- `supabase/migrations/20260526054636_create_latest_buggy_telemetry.sql`
- `supabase/migrations/20260603093000_create_device_assignments.sql`
- `supabase/migrations/20260601122722_create_notification_subscriptions.sql`
- `supabase/migrations/20260619141417_add_history_performance_constraints.sql`

File auth/security:

- `proxy.ts`
- `hooks/useUserRole.ts`
- `lib/auth/dashboard-permissions.ts`
- `lib/auth/admin-guard.ts`
- `lib/auth/ingest-token.ts`
- `lib/server/buggy-sessions/access.ts`

File realtime/GPS:

- `hooks/useBuggyLiveFeed.ts`
- `lib/realtime/buggy-live-store.ts`
- `lib/realtime/buggy-api-snapshot.ts`
- `lib/realtime/buggy-sse-bus.ts`
- `lib/realtime/session-store.ts`
- `lib/realtime/session/session-bucket.ts`
- `lib/server/gps-beacon/history-throttle.ts`
- `lib/server/gps-beacon/status-only.ts`
- `lib/buggy/gps-quality.ts`

File map:

- `components/map/MapCanvas.tsx`
- `components/map/hooks/useHistoryTrail.ts`
- `components/map/hooks/useGeofenceOverlays.ts`
- `components/map/hooks/useUserLocationMarker.ts`
- `lib/transit/buggy-data.ts`
- `lib/transit/buggy-route-utils.ts`
- `lib/transit/route-search.ts`
- `lib/services/google-maps-service.ts`

File notification:

- `hooks/useBrowserNotificationToggle.ts`
- `lib/push/client.ts`
- `lib/push/nearby-alerts.ts`
- `lib/push/web-push.ts`
- `app/api/push/subscribe/route.ts`
- `app/api/push/unsubscribe/route.ts`
- `app/api/push/check-nearby/route.ts`
- `public/sw.js`

File machine learning ETA:

- `components/buggy/BuggyDetailView.tsx`
- `app/api/eta/predict-segment/route.ts`
- `eta-vps/api_eta.py`
- `eta-vps/xgboost_eta_model.json`
- `eta-vps/dataroute.txt`
- `eta-vps/eta-api.service`

## G. File yang Tidak Wajib Dihafal Detail

Cukup tahu fungsinya saja:

- File styling global dan class UI kecil, misalnya `app/globals.css`.
- Komponen UI kecil untuk tombol, badge, chip, card, empty state, icon, atau tooltip.
- Helper formatting tanggal, angka, dan label yang tidak mengubah alur bisnis.
- File chart kecil di `components/admin/statistics/*` selain panel dan helper utama.
- File i18n client kecil seperti `lib/i18n/browser.ts`, cukup tahu dipakai untuk bahasa.
- File constant kecil jika hanya menyimpan label, warna, atau teks.
- Komponen presentasional di history seperti item/card kecil, cukup pahami dari `HistoryPanel`.
- Komponen presentasional admin seperti card kecil, cukup pahami dari `AdminDataSection` dan form utama.
- `GpsTrackerScrollFix.tsx`, cukup tahu untuk memperbaiki scroll halaman simulator.

## H. Versi Bahasa Sidang Per Fitur

1. Login dan Role User:
Pada SIMOBI, proses login menggunakan Supabase Auth untuk memastikan identitas user. Setelah user berhasil login, sistem membaca tabel `accounts` untuk mengetahui role aplikasi, yaitu Admin, Driver, atau Pengguna umum. Role ini kemudian dipakai untuk menentukan menu yang tampil dan juga divalidasi ulang di API backend. Jadi konsepnya, Supabase Auth menangani authentication, sedangkan tabel `accounts` menangani authorization aplikasi.

2. Dashboard Role-Based:
Dashboard utama SIMOBI berada pada route `/id` dan `/en`. File `page.tsx` sengaja sederhana karena hanya menjadi entry point, sedangkan logic interaktif ada di `DashboardShell`. Di dalam dashboard, sistem membaca role user lalu menampilkan fitur sesuai permission. Admin dapat mengelola data dan melihat semua armada, Driver fokus pada buggy yang ditugaskan, dan Pengguna umum fokus pada informasi transportasi.

3. Monitoring Buggy Realtime:
Data GPS dari perangkat atau simulator masuk ke MQTT broker, kemudian diteruskan oleh MQTT bridge ke endpoint `/api/gps-beacon`. Endpoint ini memvalidasi token, memetakan device ke buggy, lalu memperbarui live store dan Supabase. Browser tidak langsung membaca MQTT karena perlu keamanan dan validasi backend. Dashboard menerima update realtime lewat SSE, dan jika koneksi SSE gagal sistem fallback ke polling.

4. Detail Buggy Realtime:
Saat user memilih buggy, dashboard menampilkan detail seperti kecepatan, jumlah penumpang, kapasitas, ETA, halte saat ini, halte berikutnya, status koneksi, dan status GSM/MQTT. Data ini berasal dari gabungan master buggy dan telemetry terbaru. Dengan cara ini, user tidak hanya melihat posisi di map, tetapi juga kondisi operasional kendaraan.

5. Data Halte:
Halte pada SIMOBI disimpan di tabel `haltes` dan diambil melalui endpoint `/api/haltes`. Data halte digunakan sebagai marker map, referensi pencarian rute, perhitungan ETA, dan notifikasi. Jika data database belum tersedia, sistem masih memiliki fallback data statis agar dashboard tetap bisa berjalan.

6. Pencarian Rute:
Pencarian rute dimulai ketika user mengisi asal dan tujuan. Sistem mencocokkan input dengan daftar halte, atau memakai lokasi user untuk mencari halte terdekat. Setelah origin dan destination ditemukan, sistem menyusun rute dan memilih buggy aktif yang relevan. Hasilnya ditampilkan di panel arah dan divisualisasikan di map.

7. History Perjalanan:
History perjalanan ditampilkan melalui `HistoryPanel` dengan data dari `/api/buggy-sessions`. Sistem membedakan raw GPS point pada `buggy_history` dan ringkasan sesi pada `buggy_session_history`. Ringkasan sesi berisi jarak, durasi, rata-rata kecepatan, data baterai, penumpang, dan path. Path tersebut dapat digambar kembali di map untuk melihat rute perjalanan.

8. Data GPS Menjadi History:
Saat data GPS masuk ke `/api/gps-beacon`, sistem tidak langsung menyimpan semua titik. Titik GPS difilter dari no-fix, duplikat, dan outlier, lalu sebagian disimpan sebagai raw history. `session-store` mengumpulkan titik tersebut menjadi sesi perjalanan dan menghitung ringkasan seperti durasi, jarak, average speed, battery, passenger, dan path. Pemisahan raw dan summary membuat data tetap lengkap tetapi dashboard history tetap cepat.

9. Pengaturan Bahasa:
SIMOBI menggunakan route `/id` dan `/en` untuk membedakan bahasa. `proxy.ts` memastikan user berada pada route locale yang valid, lalu `layout.tsx` memasang provider i18n. Pendekatan ini membuat link dashboard jelas berdasarkan bahasa dan memudahkan pengembangan multi-bahasa.

10. Mengaktifkan Notifikasi:
Notifikasi SIMOBI memakai Notification API, service worker, Push Subscription, dan VAPID. Saat user mengaktifkan notifikasi, browser mendaftarkan service worker dan membuat subscription, lalu server menyimpannya di `notification_subscriptions`. Worker backend kemudian mengecek kondisi buggy dan mengirim Web Push jika ada buggy yang mendekati halte terdekat user.

11. Radius Peringatan Notifikasi:
Radius peringatan disimpan bersama subscription user. Backend mencari halte terdekat dari posisi user, lalu mengecek buggy aktif yang mendekati halte tersebut dalam radius yang ditentukan. Buggy offline tidak dipakai karena datanya bisa basi. Ini membuat notifikasi lebih relevan dan mengurangi peringatan palsu.

12. CRUD Data Buggy:
Admin dapat menambah, mengubah, dan menghapus data buggy melalui API admin. Data master seperti kode, nama, kapasitas, dan status aktif disimpan di tabel `buggies`. Perubahan ini mempengaruhi dashboard karena data master digabung dengan telemetry terbaru. API CRUD buggy dilindungi oleh validasi role admin.

13. CRUD Data Halte:
Admin dapat mengelola halte melalui endpoint `/api/haltes`. Perubahan halte akan mempengaruhi marker map, pencarian rute, ETA, dan notifikasi karena semua fitur tersebut memakai referensi halte yang sama. Oleh karena itu operasi tulis halte dilindungi admin.

14. Hide Fleet:
Hide fleet digunakan untuk menyembunyikan buggy dari live dashboard tanpa menghapus data master. Field yang dipakai adalah `is_active` di tabel `buggies`. Jika buggy tidak aktif, sistem tidak menampilkannya di live map dan dapat menolak telemetry operasionalnya. History lama tetap aman karena data tidak dihapus.

15. Device Assignment:
Device assignment menghubungkan perangkat GPS fisik dengan buggy. Payload membawa `devicesId`, lalu backend mencari assignment aktif di tabel `device_assignments`. Dengan cara ini, device dapat dipindah ke buggy lain tanpa mengubah firmware atau hardcode. `device_registry` mencatat device yang pernah terlihat oleh sistem.

16. Geofence:
Geofence adalah area radius yang dibuat admin di map untuk memantau buggy. Data geofence disimpan dan ditampilkan sebagai overlay. Dashboard membandingkan posisi buggy live dengan radius geofence untuk mendeteksi masuk atau keluar area. Event ini membantu admin memantau area operasional penting.

17. Statistik Operasional:
Statistik operasional diambil dari `buggy_session_history`, bukan dari live telemetry. Data sesi sudah berupa ringkasan perjalanan sehingga cocok untuk menghitung total trip, jarak, durasi, average speed, passenger boardings, dan top buggy. API statistik juga memfilter outlier agar laporan lebih akurat.

18. ETA dan XGBoost:
ETA SIMOBI memiliki dua mekanisme, yaitu deterministik dan prediktif XGBoost. ETA deterministik menghitung berdasarkan rute dan jarak, sedangkan XGBoost menggunakan fitur seperti segmen halte, jarak, waktu, dan penumpang. Frontend memanggil API Next.js, lalu API meneruskan ke service Python. Jika service ML bermasalah, sistem fallback ke ETA deterministik.

19. GPS Tracker Simulator:
Simulator GPS digunakan untuk testing telemetry tanpa perangkat fisik. Halaman ini membuat payload seperti device asli dan publish ke MQTT WebSocket. Jika MQTT bridge berjalan, payload simulator masuk ke `/api/gps-beacon` dan mengikuti alur yang sama dengan hardware. Karena dapat mempengaruhi data operasional, akses simulator dibatasi untuk admin.

20. Status GSM/MQTT:
Status GSM/MQTT memberi informasi kualitas koneksi perangkat, seperti sinyal, GPRS, APN, IP lokal, dan status MQTT. Payload status-only memperbarui latest telemetry dan live store, tetapi tidak selalu masuk history karena bukan titik perjalanan. Informasi ini berguna untuk troubleshooting perangkat oleh admin atau driver.

21. Database Supabase:
Supabase dipakai untuk authentication dan database PostgreSQL. Tabel penting SIMOBI dipisah berdasarkan fungsi: `accounts` untuk role, `buggies` dan `haltes` untuk master data, `latest_buggy_telemetry` untuk kondisi terbaru, `buggy_history` dan `buggy_session_history` untuk riwayat, serta tabel device dan notifikasi untuk integrasi hardware dan Web Push. Pemisahan ini membuat sistem lebih mudah dijelaskan dan dipelihara.

22. Keamanan API dan Token:
Keamanan SIMOBI dilakukan di frontend dan backend, tetapi keputusan penting tetap divalidasi di backend. API admin memakai `requireAdmin`, driver dibatasi berdasarkan `accounts.buggy_id`, dan endpoint GPS dilindungi `BUGGY_INGEST_TOKEN`. Worker notifikasi juga dilindungi token seperti `PUSH_WORKER_TOKEN` atau `CRON_SECRET`. Tujuannya agar user publik tidak bisa mengubah data atau mengirim GPS palsu.
