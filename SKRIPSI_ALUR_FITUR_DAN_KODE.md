# Alur Fitur SIMOBI dan Referensi Kode

Dokumen ini menjelaskan alur kerja fitur SIMOBI dari data pertama kali diterima, diproses backend, disimpan ke database, sampai tampil di dashboard. Format ini disiapkan untuk kebutuhan sidang, sehingga setiap alur disertai referensi file dan nomor baris.

> Catatan: nomor baris sesuai kondisi kode saat dokumen ini dibuat. Jika ada perubahan file, nomor baris dapat bergeser.

## 1. Gambaran Arsitektur Alur Data

Alur utama sistem:

```text
Perangkat GPS buggy (ESP32 / SIM800L)
  -> MQTT broker
  -> MQTT bridge service
  -> POST /api/gps-beacon
  -> live store in-memory
  -> latest_buggy_telemetry
  -> buggy_history
  -> session-store
  -> buggy_session_history
  -> /api/buggy atau /api/buggy/stream
  -> useBuggyLiveFeed
  -> DashboardShell
  -> MapCanvas, BuggyCard, HistoryPanel, AdminStatisticsPanel
```

Secara konsep, sistem memisahkan dua jenis data:

1. Data realtime: dipakai untuk posisi buggy saat ini di peta.
2. Data historis: dipakai untuk riwayat perjalanan, statistik operasional, dan evaluasi sesi.

Raw GPS tetap disimpan di `buggy_history`, sedangkan ringkasan perjalanan disimpan di `buggy_session_history`.

## 2. Alur Telemetri GPS Sampai Marker Buggy Tampil

### Tujuan

Menjelaskan bagaimana data GPS dari perangkat buggy masuk ke sistem sampai marker buggy bergerak di Google Maps.

### Langkah Alur

1. Data GPS diterima oleh API utama `POST /api/gps-beacon`.

   File: `app/api/gps-beacon/route.ts`

   Referensi:

   - Baris 1-7: komentar menjelaskan bahwa file ini adalah entry point utama telemetry MQTT bridge.
   - Baris 121-130: format endpoint dan payload yang diterima.
   - Baris 131-140: request divalidasi dengan ingest token dan JSON body dibaca.
   - Baris 142-147: payload dapat berbentuk langsung atau `{ topic, data }`, lalu status GSM dinormalisasi.

2. Sistem menentukan identitas buggy.

   File: `app/api/gps-beacon/route.ts`

   Referensi:

   - Baris 35-39: import helper assignment device.
   - Baris 240-251: fallback identitas dari `buggyId` lama jika `devicesId` tidak tersedia.
   - Baris 253-260: request ditolak jika tidak ada identitas device atau buggy.

   File: `lib/buggy/device-assignment.ts`

   Referensi:

   - Baris 1-7: konsep bahwa `devicesId` fisik tidak di-hardcode ke satu buggy.
   - Baris 42-46: normalisasi `devicesId`.
   - Baris 75-112: mencari assignment aktif dari tabel device assignment.
   - Baris 114-138: mencatat device yang pernah mengirim telemetry ke registry.

3. Sistem mengecek apakah fleet sedang di-hide.

   File: `app/api/gps-beacon/route.ts`

   Referensi:

   - Baris 285-311: baca `buggies.is_active`; jika `false`, payload tidak diterapkan ke live map.

4. Titik GPS diterapkan ke live store.

   File: `app/api/gps-beacon/route.ts`

   Referensi:

   - Baris 388-402: normalisasi speed, timestamp, dan jumlah penumpang.
   - Baris 404-407: satu titik GPS dipakai untuk empat kebutuhan: live map, latest telemetry, raw history, dan session aggregation.
   - Baris 408-428: bentuk payload telemetry lalu panggil `ingestBuggyPayload`.

   File: `lib/realtime/buggy-live-store.ts`

   Referensi:

   - Baris 305-312: telemetry diproses terhadap state buggy saat ini.
   - Baris 319-330: buggy baru dapat auto-register saat GPS pertama masuk.
   - Baris 333-348: capacity diambil dari master data, passengers dibatasi capacity, dan cursor rute dihitung heading-aware.
   - Baris 359-365: ETA dihitung ulang dari rute resmi dan halte berikutnya.
   - Baris 367-381: posisi, speed, passengers, crowd level, ETA, stop index, dan GSM diperbarui.
   - Baris 399-404: state live store disimpan kembali.
   - Baris 414-421: `ingestBuggyPayload` menerima snapshot atau telemetry.

5. Posisi terakhir disimpan ke tabel durable `latest_buggy_telemetry`.

   File: `app/api/gps-beacon/route.ts`

   Referensi:

   - Baris 442-466: bentuk row latest telemetry.
   - Baris 468-477: upsert ke tabel latest telemetry dengan conflict `buggy_id`.
   - Baris 479-502: fallback jika schema lama belum punya kolom baru.

   Fungsi tabel ini: menyimpan posisi terakhir agar dashboard tetap bisa recover setelah server restart atau request masuk ke proses server berbeda.

6. Raw GPS disimpan ke tabel `buggy_history`.

   File: `app/api/gps-beacon/route.ts`

   Referensi:

   - Baris 44-51: konfigurasi throttle insert history.
   - Baris 65-91: `shouldInsertHistoryPoint` mencegah koordinat no-fix, titik sama, dan insert terlalu rapat.
   - Baris 505-519: titik GPS hanya disimpan jika bukan stationary heartbeat dan lolos threshold.
   - Baris 521-538: bentuk `historyRow` lalu insert ke tabel history.
   - Baris 540-571: fallback schema lama dan penanda titik berhasil disimpan.

7. Titik masuk ke akumulator sesi.

   File: `app/api/gps-beacon/route.ts`

   Referensi:

   - Baris 583-586: jika `sessionStart=true`, session dimulai.
   - Baris 588-604: titik GPS ditambahkan ke session-store.
   - Baris 605-607: stationary heartbeat hanya menyentuh waktu sesi tanpa menambah titik.

   File: `lib/realtime/session-store.ts`

   Referensi:

   - Baris 1-10: lifecycle session: start, addPoint, sessionEnd, auto-finalize.
   - Baris 256-289: `startSession`.
   - Baris 302-359: `addPoint`, termasuk filter GPS invalid dan pending jump outlier.

8. Backend mengirim sinyal realtime ke dashboard.

   File: `app/api/gps-beacon/route.ts`

   Referensi:

   - Baris 609-613: `broadcastBuggySnapshot` dipanggil setelah GPS diterima.
   - Baris 615-634: response API mengembalikan status diterima, identitas buggy, posisi, GSM, dan `updatedAt`.

9. Frontend menerima update melalui SSE atau polling.

   File: `app/api/buggy/stream/route.ts`

   Referensi:

   - Baris 1-7: SSE stream digerakkan oleh broadcast dari `/api/gps-beacon`.
   - Baris 20-31: client SSE didaftarkan, snapshot awal dikirim, heartbeat 15 detik.
   - Baris 50-56: response dikirim sebagai `text/event-stream`.

   File: `hooks/useBuggyLiveFeed.ts`

   Referensi:

   - Baris 3-9: SSE adalah transport utama, polling hanya fallback.
   - Baris 53-58: mode feed dari env `NEXT_PUBLIC_BUGGY_FEED_MODE`.
   - Baris 60-80: fallback fetch ke `/api/buggy`.
   - Baris 83-112: status koneksi buggy dihitung lokal dari `lastSeenAt`.
   - Baris 198-223: `EventSource("/api/buggy/stream")` menerima snapshot.
   - Baris 225-246: jika SSE gagal berulang, pindah ke polling.
   - Baris 254-260: aging status tetap berjalan tanpa request server.

10. Snapshot live digabung dengan master data dan latest telemetry.

    File: `app/api/buggy/route.ts`

    Referensi:

    - Baris 1-7: endpoint mengembalikan fleet state hasil gabungan live store, master data, dan latest telemetry.
    - Baris 14-22: `GET /api/buggy` memanggil `getBuggyApiSnapshot`.

    File: `lib/realtime/buggy-api-snapshot.ts`

    Referensi:

    - Baris 1-8: alasan perlu overlay durable latest telemetry.
    - Baris 32-33: TTL cache snapshot dan master data.
    - Baris 55-83: mengambil master data `buggies` dan menyaring fleet yang di-hide.
    - Baris 102-116: capacity dan passenger count disinkronkan dengan master data.
    - Baris 120-155: build snapshot final dari live store + master data + latest telemetry.

    File: `lib/supabase/latest-buggy-telemetry.ts`

    Referensi:

    - Baris 1-6: latest telemetry dipakai untuk recovery setelah restart.
    - Baris 95-98: query tabel latest telemetry.
    - Baris 105-113: pilih row telemetry terbaru per buggy.
    - Baris 145-156: capacity tidak boleh dioverride payload device; status koneksi dihitung dari last seen.
    - Baris 158-173: route cursor dan current stop dihitung ulang jika tidak ada di row.
    - Baris 175-199: object `Buggy` final berisi posisi, speed, passengers, status, GSM, dan stop index.

11. Dashboard menerima data dan meneruskannya ke map serta panel.

    File: `components/dashboard/DashboardShell.tsx`

    Referensi:

    - Baris 127: memanggil `useBuggyLiveFeed`.
    - Baris 153-160: memilih data live dari feed atau fallback lokal.
    - Baris 990-999: menentukan data yang dikirim ke map sesuai view aktif.
    - Baris 1006-1036: render `MapCanvas` dengan `buggies`, `routePath`, `historyPath`, geofence, dan marker callback.
    - Baris 1113-1134: render `BuggyList` dengan daftar buggy, halte, status APN, dan konten panel.

12. Marker buggy digambar di Google Maps.

    File: `components/map/MapCanvas.tsx`

    Referensi:

    - Baris 72-104: load Google Maps JavaScript API.
    - Baris 431-462: inisialisasi map di area Undip.
    - Baris 559-570: menggambar polyline rute resmi.
    - Baris 984-1040: render marker buggy dari prop `buggies`.
    - Baris 1132-1158: jika ada buggy terpilih, info window dibuka dan map dapat pan ke posisi buggy.

13. Card buggy menampilkan informasi operasional.

    File: `components/buggy/PanelActive.tsx`

    Referensi:

    - Baris 22-55: props `BuggyList`, termasuk data buggy dan permission status APN.
    - Baris 113-149: daftar buggy diurutkan berdasarkan jarak dari user atau origin halte.
    - Baris 151-163: buggy favorit diprioritaskan di atas.
    - Baris 237-258: setiap buggy dirender sebagai `BuggyCard`.

    File: `components/buggy/BuggyCard.tsx`

    Referensi:

    - Baris 44-50: current stop, next stop, APN state, dan connection tone dihitung.
    - Baris 105-129: tampil last seen, favorite, dan APN.
    - Baris 132-152: tampil ETA atau status offline.
    - Baris 157-164: tombol detail buggy.
    - Baris 188-194: tampil kode, nama buggy, dan current stop.

## 3. Alur Status GSM, APN, dan MQTT Client

### Tujuan

Menjelaskan bagaimana status modem SIM800L masuk tanpa harus mengirim koordinat GPS.

### Langkah Alur

1. Payload status masuk ke `/api/gps-beacon`.

   File: `app/api/gps-beacon/route.ts`

   Referensi:

   - Baris 145-147: sistem mengenali `statusOnly` jika payload tidak memiliki lat/lng tetapi memiliki data GSM.
   - Baris 314-318: status GSM diterapkan ke live store.
   - Baris 320-360: update status GSM pada tabel `latest_buggy_telemetry`.
   - Baris 363-385: broadcast snapshot dan response status-only.

2. Frontend menampilkan status APN/GSM.

   File: `components/buggy/BuggyCard.tsx`

   Referensi:

   - Baris 47-50: status APN dihitung dari data GSM.
   - Baris 117-128: badge APN tampil jika user admin atau driver.

3. Status koneksi buggy dihitung dari last seen.

   File: `hooks/useBuggyLiveFeed.ts`

   Referensi:

   - Baris 83-112: status `online`, unstable, lost, atau offline dihitung lokal dari `lastSeenAt`.
   - Baris 254-260: aging status tetap berjalan walaupun tidak ada event baru.

## 4. Alur Pembersihan GPS, Snapping, dan Outlier

### Tujuan

Menjelaskan mengapa titik GPS yang keluar rute tidak langsung mengubah database secara brutal, tetapi dibersihkan di layer history/display.

### Prinsip

1. Raw GPS tetap disimpan selama lolos throttle dasar.
2. Untuk history dan statistik, titik difilter dari invalid coordinate, no-fix coordinate, duplicate, dan loncatan speed tidak realistis.
3. Untuk tampilan history, path dapat di-snap ke rute resmi jika dekat dan konsisten arah.
4. Jika titik jauh tetapi beruntun cukup lama, dianggap sustained drift atau kemungkinan rute aktual, sehingga tidak dipaksa snap.

### Referensi Kode

File: `lib/buggy/gps-quality.ts`

Referensi:

- Baris 1-6: utilitas ini mencegah titik invalid mencemari session history, route distance, CSV export, dan map playback.
- Baris 25-33: konfigurasi threshold outlier, sustained drift, dan no-fix coordinate.
- Baris 61-63: deteksi koordinat no-fix yang diketahui.
- Baris 141-205: `findRouteProjection` mencari projection ke rute resmi dengan heading dan cursor sebelumnya.
- Baris 173-191: skor projection mempertimbangkan heading dan mencegah lompat mundur ke ruas berlawanan.
- Baris 241-285: `buildDisplayGpsPoints` melakukan display snapping jika dekat rute; titik jauh dikumpulkan sebagai drift candidates.
- Baris 268-270: jika jarak dari rute melebihi threshold display, titik tidak langsung di-snap.
- Baris 250-255 dan 282: sustained drift baru dimasukkan jika cukup banyak titik.
- Baris 297-345: `sanitizeGpsPoints` membuang invalid/no-fix/duplicate dan loncatan speed yang tidak realistis, kecuali loncatan sustained.
- Baris 347-380: `sanitizePath` menggabungkan sanitasi data dengan display snapping.
- Baris 382-393: jarak path dihitung dari path yang sudah dibersihkan.

File: `lib/realtime/session-store.ts`

Referensi:

- Baris 345-359: session-store menyimpan jump outlier sementara sebagai pending; jika tidak valid, titik diabaikan.
- Baris 391-465: summary sesi dibangun dari titik yang sudah disanitasi.
- Baris 475-498: saat finalisasi, titik disanitasi dan sesi terlalu pendek tidak disimpan.

File: `app/api/buggy-sessions/route.ts`

Referensi:

- Baris 306-345: row history dimapping menjadi `BuggySession` dengan path yang disanitasi.
- Baris 318-334: total distance untuk UI dihitung ulang dari sanitized path, bukan sekadar percaya nilai DB lama.
- Baris 190-207: sesi dengan speed implisit atau avg speed lebih dari 60 km/jam dianggap tidak eligible untuk history.

## 5. Alur Session History

### Tujuan

Menjelaskan bagaimana sistem mengubah raw titik GPS menjadi sesi perjalanan yang bisa dibuka di panel history.

### Langkah Alur

1. Titik GPS masuk ke session-store.

   File: `app/api/gps-beacon/route.ts`

   Referensi:

   - Baris 583-607: session start, add point, atau touch session.

   File: `lib/realtime/session-store.ts`

   Referensi:

   - Baris 23-28: timeout sesi 5 menit, minimum titik, minimum jarak, timezone Jakarta, dan stable passenger samples.
   - Baris 175-211: pembagian bucket sesi operasional, pagi 05:00-12:00, siang 13:00-17:30, dan outside.
   - Baris 217-222: sesi harus memiliki jarak minimum agar dianggap perjalanan nyata.
   - Baris 224-248: auto-finalize sesi yang stale.
   - Baris 302-359: `addPoint`.

2. Saat sesi selesai, data diringkas.

   File: `lib/realtime/session-store.ts`

   Referensi:

   - Baris 391-465: `buildSessionSummary` menghitung point count, durasi, jarak, avg speed, baterai, passenger avg, passenger peak, passenger boardings, dan path.
   - Baris 418-428: passenger metrics dihitung dari nilai occupancy per titik.
   - Baris 430-445: path dan total distance dibuat dari titik yang sudah dibersihkan.
   - Baris 466-505: `finalizeSession` menyimpan sesi jika lolos validasi minimum.

3. Sesi disimpan ke Supabase.

   File: `lib/realtime/session-store.ts`

   Referensi:

   - Baris 511-518: entry point `saveSessionPointsToDb`.
   - Baris 523-577: menghitung statistik sesi.
   - Baris 579-585: menghitung durasi dan tanggal sesi.
   - Baris 587-610: path di-downsample maksimal 500 titik agar row tidak terlalu berat.
   - Baris 614-620: ambil Supabase admin client dan nama tabel session.
   - Baris 622-654: guard duplicate berdasarkan `buggy_id|session_date|session_number`.
   - Baris 656-677: bentuk row `buggy_session_history`.
   - Baris 679-684: upsert dengan conflict `buggy_id,session_date,session_number`.
   - Baris 686-693: fallback conflict lama.
   - Baris 696-734: fallback schema lama jika kolom passenger belum tersedia.

4. Panel history mengambil daftar sesi ringan.

   File: `components/history/HistoryPanel.tsx`

   Referensi:

   - Baris 18-30: props panel history, termasuk `enabled` agar fetch hanya aktif saat panel dibuka.
   - Baris 212-244: fetch `/api/buggy-sessions?limit=200`.
   - Baris 299-300: komentar bahwa fetch hanya berjalan saat panel aktif.

   File: `app/api/buggy-sessions/route.ts`

   Referensi:

   - Baris 32-36: kolom summary session tidak menyertakan path secara default agar egress lebih hemat.
   - Baris 548-565: endpoint membaca query `limit`, `ids`, dan `includePath`.
   - Baris 614-620: query metadata session tanpa path.
   - Baris 634-640: row dedupe dan path baru dilampirkan jika diminta.
   - Baris 654-657: row dimapping menjadi response `BuggySession`.

5. Detail sesi mengambil path hanya saat dibuka.

   File: `components/history/HistoryPanel.tsx`

   Referensi:

   - Baris 246-297: `loadSessionDetail` fetch `/api/buggy-sessions?ids=...` hanya ketika detail dibuka dan path belum ada.
   - Baris 436-445: saat session dipilih, detail dimuat, stop point dideteksi, dan path dikirim ke map.
   - Baris 492-514: render `HistorySessionDetail` atau `HistorySessionList`.

   File: `app/api/buggy-sessions/route.ts`

   Referensi:

   - Baris 582-611: jika ada `ids`, API mengambil detail session beserta `path`.

6. Path history digambar di map.

   File: `components/dashboard/DashboardShell.tsx`

   Referensi:

   - Baris 997-999: `historyPath` dan `historyStopPoints` hanya dikirim ke map saat active view adalah history.
   - Baris 1034-1035: prop `historyPath` dan `historyStopPoints` diteruskan ke `MapCanvas`.

   File: `components/map/MapCanvas.tsx`

   Referensi:

   - Baris 632-649: menggambar polyline GPS history.
   - Baris 651-698: menggambar marker start dan finish.
   - Baris 700-750: menggambar marker stop halte dari history.

7. Jika sesi belum selesai, history dapat dibuat dari raw GPS terbaru.

   File: `app/api/buggy-sessions/route.ts`

   Referensi:

   - Baris 668-695: raw GPS hanya diambil sejak awal hari operasional untuk hemat egress.
   - Baris 696-739: raw points dikelompokkan per buggy.
   - Baris 741-805: raw points disintesis menjadi sesi ongoing atau completed.
   - Baris 809-817: ongoing dan completed digabung lalu dikirim ke frontend.

## 6. Alur Statistik Admin

### Tujuan

Menjelaskan bagaimana angka statistik seperti total trips, total distance, total passengers, avg speed, dan peak time dihitung.

### Langkah Alur

1. Panel statistik meminta data berdasarkan bulan.

   File: `components/data/AdminStatisticsPanel.tsx`

   Referensi:

   - Baris 351-361: state panel statistik dan bulan terpilih.
   - Baris 363-381: fetch `/api/admin/statistics?date=YYYY-MM`.
   - Baris 399-413: fallback live passengers jika data historis belum ada.
   - Baris 425-435: mengambil total trips, jarak, waktu, speed, dan baterai dari API.
   - Baris 501-528: render header dan pilihan bulan.
   - Baris 579-609: render total passengers.

2. API statistik membaca session history.

   File: `app/api/admin/statistics/route.ts`

   Referensi:

   - Baris 1-7: statistik admin membaca durable history agar stabil.
   - Baris 18-19: threshold speed outlier dan minimum stable samples.
   - Baris 64-67: kolom session yang dibaca, termasuk `passenger_boardings`.
   - Baris 290-292: hanya admin yang boleh mengakses.
   - Baris 303-317: baca capacity buggy dari tabel `buggies`.
   - Baris 319-347: menentukan rentang bulan ini dan bulan sebelumnya lalu fetch session rows.

3. Duplicate dan outlier dibersihkan sebelum agregasi.

   File: `app/api/admin/statistics/route.ts`

   Referensi:

   - Baris 149-162: session key dibentuk dari `buggy_id`, `session_date`, dan `session_number`.
   - Baris 164-195: memilih row terbaik jika ada duplicate.
   - Baris 197-215: sesi dengan speed implisit atau avg speed lebih dari 60 km/jam tidak dipakai.
   - Baris 349-360: data bulan ini dan bulan lalu di-dedupe lalu difilter outlier.
   - Baris 361-364: jumlah outlier yang dikeluarkan dicatat sebagai data quality.

4. Total passengers dihitung sebagai estimasi penumpang naik.

   File: `lib/realtime/session-store.ts`

   Referensi:

   - Baris 103-130: rumus `passenger_boardings = initial occupancy + positive occupancy deltas` yang stabil minimal 3 sampel.
   - Baris 567-577: passenger avg, peak, dan boardings dihitung saat sesi disimpan.
   - Baris 671-675: hasil disimpan ke kolom `passenger_boardings`.

   File: `app/api/admin/statistics/route.ts`

   Referensi:

   - Baris 93-120: fungsi menghitung boardings dari deret nilai occupancy.
   - Baris 122-130: fallback menghitung boardings dari `path` lama.
   - Baris 136-147: prioritas perhitungan: `passenger_boardings`, lalu path, lalu fallback bounded load.
   - Baris 390: total passengers bulan ini menambahkan estimasi boardings per session.
   - Baris 402-407: total passengers bulan lalu dihitung dengan metode yang sama.
   - Baris 537-545: response API menjelaskan kualitas data dan metode passenger metric.

   Jawaban singkat untuk sidang:

   ```text
   Total passengers bukan jumlah occupancy setiap GPS sample, karena itu akan menghitung orang yang sama berkali-kali.
   Sistem menghitung estimasi penumpang naik per sesi: occupancy awal ditambah kenaikan occupancy positif yang stabil minimal 3 sampel GPS.
   Jika data lama belum memiliki kolom passenger_boardings, sistem fallback ke path atau passenger peak/avg yang dibatasi capacity.
   ```

5. Statistik bulanan dikirim ke frontend.

   File: `app/api/admin/statistics/route.ts`

   Referensi:

   - Baris 366-391: agregasi total distance, duration, speed, battery, passengers.
   - Baris 410-415: trend terhadap bulan sebelumnya.
   - Baris 417-471: daily series dan top buggies.
   - Baris 472-512: hourly passenger demand.
   - Baris 514-563: response JSON lengkap.

## 7. Alur Master Data Buggy dan Hide Fleet

### Tujuan

Menjelaskan bagaimana admin menambah, mengubah, menghapus, atau menyembunyikan fleet.

### Backend

File: `app/api/admin/buggies/route.ts`

Referensi:

- Baris 1-5: route membuat dan mengambil master data buggy.
- Baris 56-70: `GET` mengambil data dari tabel `buggies`.
- Baris 86-120: `POST` menambah buggy baru ke tabel `buggies`.

File: `app/api/admin/buggies/[id]/route.ts`

Referensi:

- Baris 1-5: update/hide/delete satu buggy dan sinkronisasi live store.
- Baris 19-54: `PUT` update data buggy.
- Baris 99-120: `DELETE` menghapus buggy.

### Efek ke Realtime

File: `lib/realtime/buggy-api-snapshot.ts`

Referensi:

- Baris 55-83: master data dibaca dari `buggies`, lalu fleet dengan `is_active=false` disaring.
- Baris 102-116: capacity, name, code, dan passenger count disesuaikan dengan master data.

File: `app/api/gps-beacon/route.ts`

Referensi:

- Baris 285-311: jika fleet di-hide, payload GPS ditolak agar tidak muncul di live map.

## 8. Alur Device Assignment

### Tujuan

Menjelaskan bagaimana device fisik dapat dipindahkan ke buggy tertentu tanpa hardcode di firmware.

### Langkah Alur

1. Device mengirim `devicesId`.

   File: `app/api/gps-beacon/route.ts`

   Referensi:

   - Baris 35-39: helper device assignment digunakan di ingest endpoint.
   - Baris 253-260: request wajib memiliki identitas device atau buggy lama.

2. Sistem mencari assignment aktif.

   File: `lib/buggy/device-assignment.ts`

   Referensi:

   - Baris 75-112: mengambil assignment aktif dan join ke tabel `buggies`.
   - Baris 114-138: device yang pernah terlihat dicatat.

3. Admin mengelola assignment.

   File: `app/api/admin/device-assignments/route.ts`

   Referensi:

   - Baris 82-149: `GET` mengambil assignment aktif, device registry, dan latest telemetry.
   - Baris 169-221: `POST` membuat assignment baru; assignment lama untuk device/buggy yang sama dinonaktifkan.

   File: `app/api/admin/device-assignments/[id]/route.ts`

   Referensi:

   - Baris 16-75: `PUT` mengubah assignment.
   - Baris 88-111: `DELETE` melakukan soft delete dengan `is_active=false`.

Jawaban singkat untuk sidang:

```text
Identitas fisik alat tidak dikunci di kode. ESP mengirim devicesId, lalu backend mencari assignment aktif di database. Dengan begitu device bisa dipindahkan dari Buggy 01 ke Buggy 02 cukup lewat panel admin, tanpa flash ulang firmware.
```

## 9. Alur Halte dan Rute

### Tujuan

Menjelaskan bagaimana data halte diambil, diubah, dan digunakan untuk ETA serta tampilan.

### Backend

File: `app/api/haltes/route.ts`

Referensi:

- Baris 1-6: route halte mengupdate Supabase dan runtime halte cache.
- Baris 19-32: `GET /api/haltes` mengambil halte aktif dari database.
- Baris 71-134: `POST /api/haltes` menambah halte baru.

File: `app/api/haltes/[id]/route.ts`

Referensi:

- Baris 1-5: update/delete halte lalu reload runtime cache.
- Baris 55-97: `PUT` mengupdate halte.
- Baris 115-142: `DELETE` menghapus halte dan update runtime list.

### Frontend

File: `components/dashboard/DashboardShell.tsx`

Referensi:

- Baris 195-211: dashboard fetch `/api/haltes`.
- Baris 1008-1009: halte dan route path dikirim ke `MapCanvas`.
- Baris 1113-1127: halte dikirim ke panel `BuggyList`.

File: `components/map/MapCanvas.tsx`

Referensi:

- Baris 559-570: menggambar route polyline.
- Baris 1044-1111: menggambar marker halte.

## 10. Alur Geofence dan Notifikasi Operasional

### Tujuan

Menjelaskan bagaimana admin membuat zona geofence dan dashboard mendeteksi buggy masuk/keluar zona.

### Backend

File: `app/api/geofences/route.ts`

Referensi:

- Baris 14-21: `GET` mengambil daftar geofence.
- Baris 21-71: `POST` membuat geofence baru dan memvalidasi payload.

File: `app/api/geofences/[id]/route.ts`

Referensi:

- Baris 19-109: `PATCH` update geofence.
- Baris 112-117: `DELETE` hapus geofence.

### Frontend

File: `components/dashboard/DashboardShell.tsx`

Referensi:

- Baris 467-486: load daftar geofence.
- Baris 649-790: handler simpan, toggle, edit, dan delete geofence.
- Baris 856-907: menghitung membership buggy terhadap geofence dan mencatat event.
- Baris 909-964: alert jika buggy offline terlalu lama.
- Baris 1019-1028: geofence dan draft geofence dikirim ke `MapCanvas`.

File: `components/map/MapCanvas.tsx`

Referensi:

- Baris 814-840: menggambar lingkaran geofence di peta.

## 11. Alur Push Notification Halte Terdekat

### Tujuan

Menjelaskan bagaimana browser notification didaftarkan dan dicek terhadap halte terdekat.

### Backend

File: `app/api/push/subscribe/route.ts`

Referensi:

- Baris 64-109: menyimpan subscription browser ke tabel `notification_subscriptions`.

File: `app/api/push/unsubscribe/route.ts`

Referensi:

- Baris 13-41: menghapus subscription dari tabel.

File: `app/api/push/check-nearby/route.ts`

Referensi:

- Baris 22-36: endpoint check nearby dapat dipanggil via `POST` atau `GET`.

## 12. Alur Role, Auth, dan Hak Akses Dashboard

### Tujuan

Menjelaskan siapa boleh mengakses fitur apa.

### Route Guard

File: `proxy.ts`

Referensi:

- Baris 42-53: normalisasi locale sebelum auth.
- Baris 87-90: membaca user Supabase Auth.
- Baris 95-110: menentukan route yang dilindungi.
- Baris 112-130: role diambil dari tabel `accounts`, bukan metadata auth.
- Baris 135-147: route protected wajib login.
- Baris 149-160: halaman GPS tracker dan API admin hanya untuk Admin.
- Baris 162-167: history API hanya untuk Admin dan Driver.
- Baris 169-174: write geofence hanya untuk Admin.
- Baris 199-210: daftar matcher route yang dilindungi.

### Permission UI

File: `lib/auth/dashboard-permissions.ts`

Referensi:

- Baris 13-18: permission UI hanya mengatur rendering panel, bukan security boundary.
- Baris 19-35: Admin bisa manage dashboard; Driver bisa lihat operator panels/history/data; user login bisa favorit.

### History Access

File: `app/api/buggy-sessions/route.ts`

Referensi:

- Baris 78-120: Admin mendapat semua history.
- Baris 122-164: Driver dibatasi ke alias buggy yang ditugaskan.
- Baris 576-578: driver tanpa filter assignment mendapat response kosong.

## 13. Tabel Database Utama dan Pemakaiannya

| Tabel | Fungsi | Ditulis dari | Dibaca dari |
| --- | --- | --- | --- |
| `buggies` | Master data fleet: code, name, capacity, active/hidden | `app/api/admin/buggies/route.ts`, `app/api/admin/buggies/[id]/route.ts` | `lib/realtime/buggy-api-snapshot.ts`, `app/api/admin/statistics/route.ts` |
| `latest_buggy_telemetry` | Posisi/status terakhir per buggy | `app/api/gps-beacon/route.ts` baris 468-477 | `lib/supabase/latest-buggy-telemetry.ts` baris 95-98 |
| `buggy_history` | Raw GPS point historis | `app/api/gps-beacon/route.ts` baris 521-538 | `app/api/buggy-sessions/route.ts` baris 696-739 |
| `buggy_session_history` | Ringkasan sesi perjalanan | `lib/realtime/session-store.ts` baris 656-684 | `app/api/buggy-sessions/route.ts`, `app/api/admin/statistics/route.ts` |
| `device_assignments` | Mapping device fisik ke buggy | `app/api/admin/device-assignments/route.ts` | `lib/buggy/device-assignment.ts` |
| `device_registry` | Device yang pernah terlihat | `lib/buggy/device-assignment.ts` baris 114-138 | `app/api/admin/device-assignments/route.ts` |
| `haltes` | Master data halte | `app/api/haltes/route.ts`, `app/api/haltes/[id]/route.ts` | `components/dashboard/DashboardShell.tsx` via `/api/haltes` |
| `accounts` | Role dan assignment user | Auth/profile flow dan admin accounts | `proxy.ts`, `app/api/buggy-sessions/route.ts` |
| `notification_subscriptions` | Browser push subscription | `app/api/push/subscribe/route.ts` | push notification flow |

## 14. Optimasi Backend dan Egress Supabase

Optimasi yang sudah diterapkan:

1. History panel tidak langsung mengambil path besar.

   Referensi:

   - `components/history/HistoryPanel.tsx` baris 212-244: load list ringan.
   - `components/history/HistoryPanel.tsx` baris 246-297: path detail baru diminta saat session dibuka.
   - `app/api/buggy-sessions/route.ts` baris 32-36: summary columns tidak menyertakan `path`.
   - `app/api/buggy-sessions/route.ts` baris 582-611: path hanya dimuat untuk detail by `ids`.

2. Raw GPS untuk ongoing session dibatasi sejak awal hari operasional.

   Referensi:

   - `app/api/buggy-sessions/route.ts` baris 668-695: raw history tidak mengambil 24 jam penuh.

3. Insert raw history dithrottle.

   Referensi:

   - `app/api/gps-beacon/route.ts` baris 44-51: interval, jarak, dan delta speed threshold.
   - `app/api/gps-beacon/route.ts` baris 65-91: logic insert history.

4. Session durable dibuat idempotent.

   Referensi:

   - `lib/realtime/session-store.ts` baris 622-654: cek duplicate sebelum insert.
   - `lib/realtime/session-store.ts` baris 679-684: upsert dengan unique conflict.
   - `supabase/migrations/20260619141417_add_history_performance_constraints.sql` baris 1-10: unique index session dan index history.

5. Snapshot realtime memakai cache pendek.

   Referensi:

   - `lib/realtime/buggy-api-snapshot.ts` baris 32-33: TTL snapshot 3 detik dan master data 60 detik.
   - `app/api/buggy/stream/route.ts` baris 26-27: client SSE baru menerima cached snapshot agar tidak query Supabase tiap tab.

## 15. Jawaban Singkat yang Bisa Dipakai Saat Sidang

### Pertanyaan: Data dari buggy pertama masuk ke mana?

Jawaban:

```text
Data dari perangkat buggy masuk melalui MQTT bridge, lalu dikirim ke endpoint POST /api/gps-beacon. Di endpoint ini token divalidasi, identitas device dicocokkan ke buggy aktif, lalu data diproses menjadi live state, latest telemetry, raw history, dan session history.
```

Kode utama:

- `app/api/gps-beacon/route.ts` baris 121-140 dan 404-428.

### Pertanyaan: Kenapa ada `latest_buggy_telemetry` dan `buggy_history`?

Jawaban:

```text
latest_buggy_telemetry hanya menyimpan posisi/status terakhir per buggy untuk tampilan realtime dan recovery setelah restart. buggy_history menyimpan raw titik GPS historis untuk membentuk session, history playback, dan audit data.
```

Kode utama:

- Latest telemetry: `app/api/gps-beacon/route.ts` baris 442-477.
- Raw history: `app/api/gps-beacon/route.ts` baris 505-538.

### Pertanyaan: Bagaimana data realtime muncul di peta?

Jawaban:

```text
Setelah GPS diterima, backend memperbarui live store dan broadcast snapshot ke SSE. Frontend membuka EventSource ke /api/buggy/stream lewat useBuggyLiveFeed. Data itu diteruskan ke DashboardShell, kemudian MapCanvas menggambar marker buggy di Google Maps.
```

Kode utama:

- Broadcast: `app/api/gps-beacon/route.ts` baris 609-613.
- SSE: `app/api/buggy/stream/route.ts` baris 20-58.
- Hook frontend: `hooks/useBuggyLiveFeed.ts` baris 198-223.
- Map: `components/map/MapCanvas.tsx` baris 984-1040.

### Pertanyaan: Bagaimana history perjalanan dibuat?

Jawaban:

```text
Setiap GPS point dimasukkan ke session-store. Session-store mengelompokkan titik berdasarkan sesi operasional, membersihkan outlier, menghitung jarak, durasi, speed, baterai, dan penumpang, lalu menyimpan ringkasan ke buggy_session_history saat session selesai atau stale.
```

Kode utama:

- Accumulate point: `lib/realtime/session-store.ts` baris 302-359.
- Build summary: `lib/realtime/session-store.ts` baris 391-465.
- Save session: `lib/realtime/session-store.ts` baris 656-684.

### Pertanyaan: Kenapa titik GPS yang keluar rute tidak langsung dihapus semua?

Jawaban:

```text
Karena raw GPS tetap dibutuhkan untuk audit. Sistem membersihkan titik untuk history dan display: titik invalid, no-fix, duplicate, dan loncatan tidak realistis dibuang. Untuk tampilan, titik yang dekat rute dan konsisten arah di-snap ke rute resmi, tetapi titik jauh yang beruntun cukup lama dianggap sustained drift atau kemungkinan rute aktual sehingga tidak dipaksa snap.
```

Kode utama:

- `lib/buggy/gps-quality.ts` baris 241-285 dan 297-345.

### Pertanyaan: Total passengers dihitung dari apa?

Jawaban:

```text
Total passengers adalah estimasi jumlah penumpang naik per sesi, bukan penjumlahan semua sample occupancy. Rumusnya: occupancy awal + kenaikan occupancy positif yang stabil minimal 3 sample. Ini menghindari orang yang sama dihitung berkali-kali.
```

Kode utama:

- `lib/realtime/session-store.ts` baris 103-130.
- `app/api/admin/statistics/route.ts` baris 93-147 dan 390.

### Pertanyaan: Bagaimana sistem mencegah data duplicate?

Jawaban:

```text
Session history memiliki identitas bucket: buggy_id, session_date, dan session_number. Saat menyimpan, sistem mengecek row existing dan memakai upsert dengan conflict key yang sama. Di API history/statistik juga ada dedupe tambahan agar data lama yang pernah double tidak memengaruhi tampilan dan statistik.
```

Kode utama:

- Save guard: `lib/realtime/session-store.ts` baris 622-654.
- Upsert: `lib/realtime/session-store.ts` baris 679-684.
- Dedupe statistik: `app/api/admin/statistics/route.ts` baris 149-195.
- Dedupe history: `app/api/buggy-sessions/route.ts` baris 239-245.

### Pertanyaan: Bagaimana role admin dan driver dibedakan?

Jawaban:

```text
Supabase Auth hanya membuktikan user login. Hak akses aplikasi diambil dari tabel accounts.role. Proxy membatasi API admin hanya untuk Admin, history untuk Admin dan Driver, dan write geofence hanya untuk Admin. Di frontend, permission map menentukan panel apa yang dirender.
```

Kode utama:

- `proxy.ts` baris 112-174.
- `lib/auth/dashboard-permissions.ts` baris 19-35.
