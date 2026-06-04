# Dokumentasi Belajar Sistem SIMOBI

> Dokumen ini dibuat sebagai bahan belajar saat menjelaskan sistem SIMOBI kepada dosen. Fokusnya adalah memahami alur sistem secara menyeluruh: frontend, backend, API route, middleware/proxy, database, autentikasi, telemetry GPS, history, geofence, device assignment, dan push notification.

> Catatan dokumentasi: referensi `file:line` mengikuti snapshot kode saat dokumen diperbarui. Nomor baris dapat bergeser jika ada penambahan komentar, import, atau refactor kecil, tetapi nama file dan fungsi tetap menjadi acuan utama.

---

## 1. Gambaran Umum

SIMOBI adalah aplikasi web monitoring buggy listrik kampus UNDIP. Sistem ini menampilkan posisi buggy secara realtime pada Google Maps, menyediakan pencarian rute menuju halte/tujuan, menampilkan detail armada, mengelola data operasional oleh admin, memberi akses terbatas untuk driver, menyimpan riwayat perjalanan, dan menerima data GPS dari perangkat fisik melalui MQTT bridge.

Secara sederhana:

```text
ESP / GPS Device
  -> MQTT Broker
  -> MQTT Bridge
  -> POST /api/gps-beacon
  -> Live Store + Supabase
  -> GET /api/buggy atau /api/buggy-sessions
  -> UI Dashboard + Google Maps
```

Teknologi utama:

| Layer | Teknologi |
| --- | --- |
| Frontend | Next.js App Router, React, TypeScript |
| Styling | Tailwind CSS, lucide-react, custom component |
| Backend | Next.js Route Handlers di folder `app/api` |
| Database | Supabase PostgreSQL |
| Auth | Supabase Auth dan role pada tabel `accounts` |
| Realtime telemetry | MQTT bridge -> protected API ingest |
| Map | Google Maps JavaScript API |
| i18n | Locale route `/id` dan `/en`, i18next |
| Push | Web Push API, service worker, VAPID |

Referensi kode:

| Bagian | File |
| --- | --- |
| Entry dashboard utama | `app/[locale]/page.tsx` |
| Shell dashboard role-based | `components/dashboard/DashboardShell.tsx` |
| Permission dashboard | `lib/auth/dashboard-permissions.ts` |
| Middleware/proxy route | `proxy.ts:42` |
| API ingest GPS | `app/api/gps-beacon/route.ts:92` |
| Live store buggy | `lib/realtime/buggy-live-store.ts:311` |
| Session/history store | `lib/realtime/session-store.ts:1` |

---

## 2. Peran Pengguna

SIMOBI memiliki tiga peran utama.

| Role | Fungsi |
| --- | --- |
| Pengguna umum | Melihat peta, buggy online, halte, detail buggy, rute, rekomendasi halte, dan notifikasi jika diaktifkan. |
| Driver | Melihat dashboard terbatas berdasarkan buggy yang ditugaskan. Driver dapat melihat statistik/history buggy yang diassign saja. |
| Admin | Mengelola armada, halte, geofence, account, device assignment, statistik, history, dan pengaturan operasional. |

Role dicek melalui Supabase Auth dan tabel `accounts`.

Referensi kode:

| Fungsi | Lokasi |
| --- | --- |
| Proxy membaca session Supabase | `proxy.ts:64-85` |
| Proxy mengambil role dari `accounts` | `proxy.ts:107-123` |
| Proteksi halaman/admin API | `proxy.ts:125-170` |
| Guard khusus API admin | `lib/auth/admin-guard.ts:15-49` |
| Permission UI dashboard | `lib/auth/dashboard-permissions.ts` |
| Driver filter pada dashboard | `components/dashboard/DashboardShell.tsx` |

Penjelasan penting:

1. User login menggunakan Supabase Auth.
2. Setelah login, sistem membaca tabel `accounts` untuk mengetahui role.
3. Jika user membuka route protected tanpa login, proxy mengarahkan ke login.
4. Semua role membuka dashboard utama yang sama di `/id` atau `/en`.
5. Jika role bukan admin, API `/api/admin/*` ditolak dengan status 403.
6. Driver tetap boleh membuka history/statistik, tetapi data difilter sesuai `buggy_id`.

---

## 3. Routing dan Middleware

### 3.1 Locale Routing

Website memakai prefix bahasa:

```text
/id
/en
/id/login
/en/login
```

Jika user membuka path tanpa locale, proxy akan redirect ke locale yang sesuai cookie atau browser.

Referensi kode:

| Fungsi | Lokasi |
| --- | --- |
| Ambil locale dari path | `lib/i18n/routing.ts:5-8` |
| Menambah prefix locale | `lib/i18n/routing.ts:17-21` |
| Skip locale untuk API/assets | `lib/i18n/routing.ts:27-39` |
| Redirect path tanpa locale | `proxy.ts:42-49` |
| Simpan locale cookie | `proxy.ts:191-195` |

### 3.2 Proteksi Route

Proxy menentukan route protected:

```text
/gps-tracker
/api/admin/*
/api/geofences/*
/api/buggy-sessions
/api/buggy-history
```

Catatan: route UI lama `/admin` dan `/driver` sudah tidak memiliki file page.
Jika URL lama dibuka, proxy mengarahkannya ke dashboard utama `/id` atau `/en`.

Referensi kode:

| Fungsi | Lokasi |
| --- | --- |
| Identifikasi route protected | `proxy.ts:91-105` |
| Redirect unauthenticated ke login | `proxy.ts:125-136` |
| GPS tracker hanya admin | `proxy.ts:145-149` |
| Admin API hanya admin | `proxy.ts:151-156` |
| History API boleh admin/driver | `proxy.ts:158-163` |
| Geofence write hanya admin | `proxy.ts:165-170` |
| Redirect legacy `/admin` dan `/driver` ke dashboard utama | `proxy.ts` |

---

## 4. Struktur Halaman Frontend

### 4.1 Dashboard Utama Role-Based

Dashboard utama berada di `app/[locale]/page.tsx`, tetapi file tersebut hanya
menjadi entry tipis. Logic UI lengkap berada di `components/dashboard/DashboardShell.tsx`.
Semua role memakai dashboard yang sama; perbedaannya ditentukan oleh permission.

Fitur dasar untuk semua pengunjung:

- Menampilkan peta Google Maps.
- Menampilkan halte dan buggy yang boleh dilihat role tersebut.
- Search rute dari asal ke tujuan.
- Mengambil lokasi pengguna.
- Menampilkan rekomendasi halte terdekat.
- Login melalui auth modal.

Fitur tambahan berdasarkan role:

| Role | Data buggy | Panel tambahan |
| --- | --- | --- |
| Guest | Buggy online saja | Tidak ada |
| Pengguna umum | Buggy online saja + favorit | Tidak ada |
| Driver | Buggy yang di-assign | Statistik, history, detail operasional read-only |
| Admin | Semua buggy yang tidak di-hide | Statistik, history, CRUD fleet, geofence, device assignment, account management |

Referensi kode:

| Fungsi | Lokasi |
| --- | --- |
| Entry dashboard | `app/[locale]/page.tsx` |
| Shell dashboard utama | `components/dashboard/DashboardShell.tsx` |
| Permission role dashboard | `lib/auth/dashboard-permissions.ts` |
| Filter buggy berdasarkan role | `components/dashboard/DashboardShell.tsx` |
| Login modal dashboard | `components/dashboard/DashboardShell.tsx` |
| Sidebar berdasarkan permission | `components/sidebar/FloatingSidebar.tsx` |
| Mobile nav berdasarkan permission | `components/sidebar/MobileBottomNav.tsx` |

### 4.2 Legacy Route Admin dan Driver

Route UI `/admin` dan `/driver` tidak lagi memiliki file page karena dashboard
sudah menjadi satu. Jika URL lama dibuka, proxy mengarahkannya ke dashboard utama
sesuai locale. Nama `/api/admin/*` tetap dipakai untuk API backend admin.

Referensi kode:

| Fungsi | Lokasi |
| --- | --- |
| Redirect `/admin` dan `/driver` ke dashboard utama | `proxy.ts` |
| Driver history filter server-side | `app/api/buggy-sessions/route.ts:106-152` |

---

## 5. Pola Alur Data Frontend

Bagian ini penting karena banyak komponen React di SIMOBI tidak mengambil data langsung dari database. Umumnya data melewati beberapa lapisan:

```text
Database / API
  -> parent component fetch data
  -> data disimpan ke state
  -> user memilih item tertentu
  -> parent mencari selected item
  -> selected item dikirim ke child component sebagai props
  -> child component hanya menampilkan/mengelola UI
```

### 5.1 Perbedaan Type, State, dan Props

Dalam TypeScript React, ada tiga hal yang sering terlihat mirip tetapi fungsinya berbeda.

| Istilah | Fungsi | Contoh |
| --- | --- | --- |
| `type` | Menjelaskan bentuk data. Tidak mengambil data. | `selectedSession: BuggySession` |
| `state` | Data nyata yang disimpan komponen saat runtime. | `const [sessions, setSessions] = useState([])` |
| `props` | Data nyata yang dikirim dari parent ke child. | `<HistorySessionDetail selectedSession={selectedSession} />` |

Contoh:

```ts
type HistorySessionDetailProps = {
  selectedSession: BuggySession;
};
```

Kode di atas hanya berarti:

```text
Komponen HistorySessionDetail wajib menerima prop bernama selectedSession
yang bentuk datanya mengikuti type BuggySession.
```

Kode itu **bukan** query database, bukan import data, dan bukan fetch API.

### 5.2 Contoh Lengkap: HistoryPanel ke HistorySessionDetail

Pada fitur history, data diambil oleh `HistoryPanel`, bukan oleh `HistorySessionDetail`.

Alurnya:

```text
Supabase buggy_session_history
  -> GET /api/buggy-sessions
  -> HistoryPanel fetch()
  -> setSessions(payload.sessions)
  -> user klik session
  -> selectedSessionId disimpan
  -> selectedSession dicari dari state sessions
  -> HistorySessionDetail menerima selectedSession sebagai props
```

Kode penting:

```ts
const res = await fetch("/api/buggy-sessions?limit=200", {
  cache: "no-store",
});
```

Kode tersebut mengambil data session dari API.

```ts
setSessions(Array.isArray(payload.sessions) ? payload.sessions : []);
```

Kode tersebut menyimpan data API ke React state `sessions`.

```ts
const selectedSession = useMemo(
  () => sessions.find((s) => s.id === selectedSessionId) ?? null,
  [sessions, selectedSessionId],
);
```

Kode tersebut mencari session yang sedang dipilih user.

```tsx
<HistorySessionDetail
  selectedBuggy={selectedBuggy}
  selectedSession={selectedSession}
  onBack={goBackFromDetail}
/>
```

Kode tersebut mengirim data nyata dari `HistoryPanel` ke `HistorySessionDetail`.

Di `HistorySessionDetail`:

```ts
export function HistorySessionDetail({
  selectedBuggy,
  selectedSession: s,
  onBack,
}: HistorySessionDetailProps) {
```

`selectedSession: s` bukan type. Itu adalah **rename variable**. Artinya data prop `selectedSession` dipakai dengan nama lokal `s`.

Maka:

```ts
s.batteryStart
```

sama dengan:

```ts
selectedSession.batteryStart
```

Nilainya berasal dari API, bukan dibuat di file `HistorySessionDetail.tsx`.

### 5.3 Contoh Data dari Database sampai UI

Contoh field `batteryStart`:

```text
Tabel buggy_session_history.battery_start
  -> app/api/buggy-sessions/route.ts mapRow()
  -> batteryStart: asNum(row.battery_start)
  -> object BuggySession
  -> HistoryPanel state sessions
  -> selectedSession
  -> HistorySessionDetail props
  -> s.batteryStart
```

Contoh field `path`:

```text
Tabel buggy_session_history.path
  -> mapRow() parse JSON path
  -> sanitizePath(path)
  -> selectedSession.path
  -> HistoryPanel onShowPath()
  -> MapCanvas render garis history
  -> HistorySessionDetail export CSV
```

Contoh field `passengerAvg`:

```text
GPS payload passengers
  -> /api/gps-beacon addPoint()
  -> session-store buildSessionSummary()
  -> passenger_avg di buggy_session_history
  -> /api/buggy-sessions mapRow()
  -> selectedSession.passengerAvg
  -> tampil di detail history
```

### 5.4 Pola Parent dan Child di SIMOBI

Beberapa fitur menggunakan pola yang sama:

| Parent | Child | Data dari mana | Penjelasan |
| --- | --- | --- | --- |
| `HistoryPanel` | `HistorySessionDetail` | `/api/buggy-sessions` | Parent fetch session, child tampilkan detail. |
| `AdminDataSection` | `BuggyOperationalDetail` | `/api/buggy` dan master data | Parent memilih buggy, detail menampilkan telemetry. |
| `AdminBuggyFormPanel` | `DeviceAssignmentPanel` | `/api/admin/device-assignments` | Form fleet menampilkan pengaturan device untuk buggy yang sedang diedit. |
| `MapCanvas` | `MapMarker` | Props `buggies`, `haltes`, `historyPath` | Map menerima data dari page/admin lalu render visual. |
| `PanelActive` | `BuggyCard` | `liveBuggies` dari `useBuggyLiveFeed` | Panel list menerima data live, card hanya render satu item. |

Prinsip yang perlu dihafal:

1. Child component biasanya tidak tahu database.
2. Parent component atau hook biasanya yang fetch data.
3. API route mengubah row database menjadi object yang cocok untuk frontend.
4. TypeScript type hanya menjaga bentuk data, bukan mengambil data.
5. Jika bingung asal data, cari urutan: `props -> parent -> state -> fetch -> API -> database`.

---

## 6. Map dan Visualisasi Google Maps

Komponen peta utama adalah `MapCanvas`.

Fitur map:

- Load Google Maps script.
- Render marker buggy.
- Render marker halte.
- Render official route path.
- Render direction path.
- Render walking path.
- Render geofence circle.
- Render history path.
- Render marker titik awal/akhir history.
- Render marker stop halte pada history.
- Render user location marker dan pulse animation.

Referensi kode:

| Fungsi | Lokasi |
| --- | --- |
| Loader Google Maps script | `components/map/MapCanvas.tsx:34-104` |
| Mapping style map | `components/map/MapCanvas.tsx:108-116` |
| Endpoint start/end path | `components/map/MapCanvas.tsx:122-131` |
| Props map lengkap | `components/map/MapCanvas.tsx:147-172` |
| Ref marker/polyline/circle | `components/map/MapCanvas.tsx:181-211` |
| API key map | `components/map/MapCanvas.tsx:213-216` |
| Init map | `components/map/MapCanvas.tsx:263-280` |
| Icon marker/polyline | `components/map/MapMarker.tsx`, `components/map/MapPolyline.tsx` |

Hal yang perlu dijelaskan ke dosen:

1. Map tidak langsung dibuat di server, karena Google Maps membutuhkan browser.
2. `MapCanvas` adalah client component.
3. Google Maps script di-load dinamis menggunakan API key dari environment.
4. Data marker berasal dari state `liveBuggies` yang diambil dari API `/api/buggy`.

---

## 7. Panel Buggy, Halte, dan Direction

Panel utama kiri menggunakan `BuggyList`.

Fitur:

- List buggy.
- Detail buggy.
- List/detail halte.
- Direction panel.
- Notification section.
- Sorting buggy berdasarkan jarak dari lokasi pengguna atau halte asal.
- Favorite buggy/halte.

Referensi kode:

| Fungsi | Lokasi |
| --- | --- |
| Komponen panel utama | `components/buggy/PanelActive.tsx:56` |
| Props panel | `components/buggy/PanelActive.tsx:23-54` |
| Ambil lokasi user untuk sorting | `components/buggy/PanelActive.tsx:92-108` |
| Sorting buggy berdasarkan jarak | `components/buggy/PanelActive.tsx:110-146` |
| Favorite bubble ke atas | `components/buggy/PanelActive.tsx:148-160` |
| Render DirectionPanel | `components/buggy/PanelActive.tsx:200-210` |
| Render BuggyDetailView | `components/buggy/PanelActive.tsx:212-218` |
| Render list BuggyCard | `components/buggy/PanelActive.tsx:219-257` |

---

## 8. Search dan Rute Perjalanan

Pencarian rute dibagi menjadi dua bagian:

1. UI input di `LiveSearchBar`.
2. Logika pencarian di `useDirectionSearch`.

### 7.1 LiveSearchBar

Fitur:

- Input tujuan.
- Input asal setelah tujuan dipilih.
- Suggestion halte.
- Pilihan "Lokasi Saya".
- Menggunakan geolocation browser.
- Menampilkan loading/error lokasi.

Referensi kode:

| Fungsi | Lokasi |
| --- | --- |
| Props search bar | `components/search/LiveSearchBar.tsx:13-26` |
| State fokus/lokasi | `components/search/LiveSearchBar.tsx:42-49` |
| Suggestion halte | `components/search/LiveSearchBar.tsx:51-57` |
| Gunakan lokasi saya | `components/search/LiveSearchBar.tsx:62-132` |
| Geolocation fallback | `components/search/LiveSearchBar.tsx:89-111` |
| Form submit | `components/search/LiveSearchBar.tsx:158-170` |
| Dropdown suggestion | `components/search/LiveSearchBar.tsx:240-260` |

### 7.2 useDirectionSearch

Fitur:

- Step pertama memilih tujuan, step kedua memilih asal.
- Resolve asal: halte, lokasi saya, atau geocoding Google.
- Resolve tujuan: halte, lokasi saya, atau geocoding Google.
- Mencari halte terdekat dari origin/destination.
- Menghitung jalur buggy berdasarkan urutan halte.
- Mencari buggy aktif terdekat dari halte asal.
- Buggy offline tidak direkomendasikan.

Referensi kode:

| Fungsi | Lokasi |
| --- | --- |
| Tipe dan opsi hook | `hooks/useDirectionSearch.ts:18-32` |
| Cek Google Maps siap | `hooks/useDirectionSearch.ts:34-38` |
| State search | `hooks/useDirectionSearch.ts:56-61` |
| Mulai search | `hooks/useDirectionSearch.ts:69-83` |
| Resolve origin | `hooks/useDirectionSearch.ts:88-145` |
| Resolve destination | `hooks/useDirectionSearch.ts:146-197` |
| Route stop names | `hooks/useDirectionSearch.ts:199-209` |
| Route path antar halte | `hooks/useDirectionSearch.ts:211-217` |
| Filter buggy realtime reachable | `hooks/useDirectionSearch.ts:219-220` |
| Set result | `hooks/useDirectionSearch.ts:222-236` |
| Recommended halte direction | `hooks/useDirectionSearch.ts:256-320` |

---

## 9. Alur Realtime GPS

### 9.1 Payload dari Perangkat

Perangkat ESP mengirim payload ke MQTT dengan identitas fisik:

```json
{
  "deviceId": "ESP-3C124B00",
  "lat": -7.06884,
  "lng": 110.438639,
  "speed": 0.3,
  "passengers": 0,
  "gsm": {
    "signalPercent": 70,
    "mqttStateText": "MQTT_CONNECTED"
  }
}
```

MQTT bridge menormalisasi menjadi:

```json
{
  "devicesId": "ESP-3C124B00",
  "lat": -7.06884,
  "lng": 110.438639
}
```

### 9.2 API Ingest GPS

Endpoint utama:

```text
POST /api/gps-beacon
Authorization: Bearer BUGGY_INGEST_TOKEN
```

Referensi kode:

| Fungsi | Lokasi |
| --- | --- |
| Token ingest | `lib/auth/ingest-token.ts:3-25` |
| Handler POST gps-beacon | `app/api/gps-beacon/route.ts:92` |
| Baca body JSON | `app/api/gps-beacon/route.ts:96-105` |
| Validasi lat/lng | `app/api/gps-beacon/route.ts:108-116` |
| Ambil field payload | `app/api/gps-beacon/route.ts:118-140` |
| Normalisasi devicesId/deviceId | `app/api/gps-beacon/route.ts:142-147` |
| Bootstrap data Supabase | `app/api/gps-beacon/route.ts:150-151` |
| Catat device terlihat | `app/api/gps-beacon/route.ts:157-167` |
| Lookup assignment device | `app/api/gps-beacon/route.ts:169-196` |
| Legacy buggyId fallback | `app/api/gps-beacon/route.ts:197-207` |
| Reject tanpa identity | `app/api/gps-beacon/route.ts:209-217` |
| Session end | `app/api/gps-beacon/route.ts:221-234` |
| Hide fleet check | `app/api/gps-beacon/route.ts:236-263` |
| Bentuk telemetry payload | `app/api/gps-beacon/route.ts:265-293` |
| Masuk live store | `app/api/gps-beacon/route.ts:295` |
| Upsert latest telemetry | `app/api/gps-beacon/route.ts:304-364` |
| Insert raw history | `app/api/gps-beacon/route.ts:366-413` |
| Tambah point ke session | `app/api/gps-beacon/route.ts:415-438` |
| Response sukses | `app/api/gps-beacon/route.ts:440-458` |

Hal yang perlu dipahami:

1. `devicesId` adalah identitas alat fisik, bukan identitas buggy.
2. API mencari assignment aktif `devicesId -> buggy_id`.
3. Jika device belum diassign, API return 409 agar data tidak masuk ke buggy salah.
4. Payload lama dengan `buggyId` masih didukung untuk kompatibilitas.
5. Data masuk ke tiga tempat:
   - live memory store untuk tampilan realtime,
   - `latest_buggy_telemetry` untuk snapshot terakhir,
   - `buggy_history` untuk raw history.

---

## 10. Live Store dan Status Koneksi

Live store adalah penyimpanan sementara di memory server untuk data buggy realtime.

Referensi kode:

| Fungsi | Lokasi |
| --- | --- |
| Tipe telemetry input | `lib/realtime/buggy-live-store.ts:13-26` |
| State global live store | `lib/realtime/buggy-live-store.ts:28-33` |
| Ambil mutable state | `lib/realtime/buggy-live-store.ts:311-322` |
| Ambil snapshot live buggy | `lib/realtime/buggy-live-store.ts:329-355` |
| Hitung last seen dan connection status | `lib/realtime/buggy-live-store.ts:335-352` |
| Parse telemetry payload | `lib/realtime/buggy-live-store.ts:274-309` |
| Auto-register buggy fallback | `lib/realtime/buggy-live-store.ts:385-412` |
| Update telemetry ke store | `lib/realtime/buggy-live-store.ts:414-512` |
| Entry point ingest payload | `lib/realtime/buggy-live-store.ts:514-522` |

Alur update:

1. API `gps-beacon` memanggil `ingestBuggyPayload`.
2. Store mencari buggy berdasarkan ID.
3. Jika ada, update posisi, speed, passenger, GSM, ETA, current stop, path cursor.
4. Jika tidak ada, sistem bisa membuat buggy sementara dengan fallback, tetapi alur production tetap mengandalkan master data Supabase.
5. Snapshot dipakai oleh `/api/buggy`.

---

## 11. API Live Buggy

Frontend tidak membaca live store langsung. Frontend memanggil API:

```text
GET /api/buggy
```

Referensi kode:

| Fungsi | Lokasi |
| --- | --- |
| Handler GET `/api/buggy` | `app/api/buggy/route.ts:80-95` |
| Bootstrap dari database | `app/api/buggy/route.ts:81-82` |
| Ambil snapshot live store | `app/api/buggy/route.ts:84` |
| Overlay master data buggy | `app/api/buggy/route.ts:27-78` |
| Filter hidden fleet | `app/api/buggy/route.ts:42-60` |
| Merge latest telemetry | `app/api/buggy/route.ts:86` |
| Header sumber data | `app/api/buggy/route.ts:89-94` |

Frontend mengambil data dengan hook:

| Fungsi | Lokasi |
| --- | --- |
| Hook live feed | `hooks/useBuggyLiveFeed.ts:54-144` |
| Polling `/api/buggy` tiap 1 detik | `hooks/useBuggyLiveFeed.ts:85-104` |
| Mode SSE `/api/buggy/stream` | `hooks/useBuggyLiveFeed.ts:107-134` |
| Endpoint SSE | `app/api/buggy/stream/route.ts:16-71` |

---

## 12. Device Assignment

Device assignment memungkinkan ESP dipindah dari satu buggy ke buggy lain tanpa flash ulang firmware.

Alur:

```text
ESP deviceId
  -> MQTT bridge devicesId
  -> /api/gps-beacon
  -> lookup device_assignments
  -> resolved buggy_id
  -> update buggy
```

Schema database:

| Tabel | Fungsi | Lokasi |
| --- | --- | --- |
| `device_assignments` | Mapping `devices_id` ke `buggy_id` | `supabase/migrations/20260603093000_create_device_assignments.sql:1-9` |
| Unique active device | Satu device hanya boleh punya satu assignment aktif | `supabase/migrations/20260603093000_create_device_assignments.sql:11-13` |
| `device_registry` | Menyimpan device yang pernah terlihat | `supabase/migrations/20260603093000_create_device_assignments.sql:37-44` |
| `devices_id` pada telemetry | Menyimpan device di latest telemetry dan history | `supabase/migrations/20260603093000_create_device_assignments.sql:65-75` |

API:

| Fungsi | Lokasi |
| --- | --- |
| GET assignments dan registry options | `app/api/admin/device-assignments/route.ts:75-160` |
| Ambil latest telemetry per device | `app/api/admin/device-assignments/route.ts:49-73` |
| POST assignment baru | `app/api/admin/device-assignments/route.ts:162-225` |
| Nonaktifkan assignment lama device yang sama | `app/api/admin/device-assignments/route.ts:191-204` |
| PUT assignment | `app/api/admin/device-assignments/[id]/route.ts:10-80` |
| DELETE/deactivate assignment | `app/api/admin/device-assignments/[id]/route.ts:82-118` |

Frontend:

| Fungsi | Lokasi |
| --- | --- |
| DeviceAssignmentPanel | `components/data/DeviceAssignmentPanel.tsx:54` |
| Load assignment dari API | `components/data/DeviceAssignmentPanel.tsx:102-135` |
| Submit assignment | `components/data/DeviceAssignmentPanel.tsx:168-229` |
| Deactivate assignment | `components/data/DeviceAssignmentPanel.tsx:231-253` |
| Panel ditempatkan di Edit Fleet | `components/data/AdminBuggyFormPanel.tsx:276-282` |
| Operational detail menampilkan device ID | `components/data/BuggyOperationalDetail.tsx:84-118` dan `components/data/BuggyOperationalDetail.tsx:184-185` |

---

## 13. Fleet Management

Admin dapat menambah, mengubah, menghapus, dan menyembunyikan fleet.

Fitur `Hide Fleet` memakai field `is_active` pada tabel `buggies`. Jika `is_active=false`, armada tidak muncul di list/map operasional, bahkan untuk admin.

Frontend:

| Fungsi | Lokasi |
| --- | --- |
| Form tambah/edit buggy | `components/data/AdminBuggyFormPanel.tsx:18-55` |
| Validasi code/name/capacity | `components/data/AdminBuggyFormPanel.tsx:55-74` |
| Submit create/update | `components/data/AdminBuggyFormPanel.tsx:75-115` |
| Delete fleet | `components/data/AdminBuggyFormPanel.tsx:117-134` |
| Toggle Hide Fleet | `components/data/AdminBuggyFormPanel.tsx:198-220` |
| Render device assignment saat edit | `components/data/AdminBuggyFormPanel.tsx:276-282` |

Backend:

| Fungsi | Lokasi |
| --- | --- |
| GET semua buggy master | `app/api/admin/buggies/route.ts:47-74` |
| POST tambah buggy | `app/api/admin/buggies/route.ts:76-146` |
| PUT update buggy | `app/api/admin/buggies/[id]/route.ts:13-91` |
| Jika hide, remove dari live store | `app/api/admin/buggies/[id]/route.ts:52-54` |
| Jika visible, add/update live store | `app/api/admin/buggies/[id]/route.ts:55-84` |
| DELETE buggy | `app/api/admin/buggies/[id]/route.ts:93-126` |

---

## 14. Operational Detail

Operational Detail adalah halaman detail admin untuk satu buggy.

Data yang ditampilkan:

- Kode dan nama fleet.
- Driver assignment.
- Koordinat.
- Speed.
- ETA.
- Current stop dan next stop.
- Status koneksi.
- Occupancy/passenger load.
- Geofence status.
- GSM status.
- MQTT status.
- Device ID yang terhubung.

Referensi kode:

| Fungsi | Lokasi |
| --- | --- |
| Komponen detail | `components/data/BuggyOperationalDetail.tsx:70` |
| Load assigned device ID | `components/data/BuggyOperationalDetail.tsx:86-118` |
| Hitung current/next stop | `components/data/BuggyOperationalDetail.tsx:136-137` |
| Hitung APN/GSM/MQTT label | `components/data/BuggyOperationalDetail.tsx:138-178` |
| Hitung occupancy | `components/data/BuggyOperationalDetail.tsx:179-183` |
| Device ID display value | `components/data/BuggyOperationalDetail.tsx:184-185` |
| Last seen dan connection status | `components/data/BuggyOperationalDetail.tsx:186-193` |
| Tombol edit fleet | `components/data/BuggyOperationalDetail.tsx:264-276` |
| Passenger load visual | `components/data/BuggyOperationalDetail.tsx:333-360` |

---

## 15. History dan Session

History terdiri dari dua sumber:

1. `buggy_history`: raw GPS point.
2. `buggy_session_history`: ringkasan session perjalanan.

### 15.1 Session Store

Session store mengakumulasi point GPS menjadi sesi perjalanan.

Referensi kode:

| Fungsi | Lokasi |
| --- | --- |
| Penjelasan lifecycle session | `lib/realtime/session-store.ts:1-11` |
| Config timeout dan minimum point | `lib/realtime/session-store.ts:19-22` |
| Tipe point session | `lib/realtime/session-store.ts:26-36` |
| Bucket sesi pagi/siang/outside | `lib/realtime/session-store.ts:128-160` |
| Auto finalize jika idle | `lib/realtime/session-store.ts:162-186` |
| Start session | `lib/realtime/session-store.ts:194-220` |
| Build session summary | `lib/realtime/session-store.ts:330-398` |
| Finalize session | `lib/realtime/session-store.ts:400-441` |
| Save session ke DB | `lib/realtime/session-store.ts:446-620` |
| Path menyimpan passenger per point | `lib/realtime/session-store.ts:520-533` |
| Row session DB | `lib/realtime/session-store.ts:578-598` |

### 15.2 API History Session

Endpoint:

```text
GET /api/buggy-sessions
POST /api/buggy-sessions/delete
```

Referensi kode:

| Fungsi | Lokasi |
| --- | --- |
| Akses Admin/Driver history | `app/api/buggy-sessions/route.ts:68-153` |
| Map row DB ke BuggySession | `app/api/buggy-sessions/route.ts:168-208` |
| Group raw point jadi session | `app/api/buggy-sessions/route.ts:212-243` |
| Merge session berdasarkan bucket | `app/api/buggy-sessions/route.ts:245-355` |
| GET session API | `app/api/buggy-sessions/route.ts:399-594` |
| Cleanup raw history lebih dari 7 hari | `app/api/buggy-sessions/route.ts:426-429` |
| Ambil raw history H-1 untuk synthetic ongoing | `app/api/buggy-sessions/route.ts:464-480` |
| Build synthetic session dari raw point | `app/api/buggy-sessions/route.ts:515-579` |
| Delete session admin | `app/api/buggy-sessions/delete/route.ts:63-195` |

### 15.3 UI History

UI history memakai kalender tanggal. Tanggal yang memiliki session diberi titik biru. User memilih tanggal, lalu melihat buggy aktif pada tanggal itu.

Referensi kode:

| Fungsi | Lokasi |
| --- | --- |
| HistoryPanel utama | `components/history/HistoryPanel.tsx:142-417` |
| Fetch session API | `components/history/HistoryPanel.tsx:174-204` |
| Auto refresh 10 detik | `components/history/HistoryPanel.tsx:206-212` |
| Group sessions by buggy/date | `components/history/HistoryPanel.tsx:230-245` |
| Available dates | `components/history/HistoryPanel.tsx:247-257` |
| Summary harian | `components/history/HistoryPanel.tsx:280-297` |
| Tampilkan path history di map | `components/history/HistoryPanel.tsx:338-346` |
| Calendar history | `components/history/HistoryDateBuggyList.tsx:60-124` |
| Dot biru tanggal ada session | `components/history/HistoryDateBuggyList.tsx:192-226` |
| List buggy aktif pada tanggal | `components/history/HistoryDateBuggyList.tsx:234-300` |
| Detail session | `components/history/HistorySessionDetail.tsx:49-60` |
| Delete session dari UI | `components/history/HistorySessionDetail.tsx:62-99` |
| Export CSV detail session | `components/history/HistorySessionDetail.tsx:101-235` |

### 15.4 Stop Halte pada History

Stop halte dideteksi dari path GPS yang berada dekat titik halte.

Referensi kode:

| Fungsi | Lokasi |
| --- | --- |
| Deteksi stop point | `lib/history/stop-points.ts:1-83` |
| Dipanggil di detail session | `components/history/HistorySessionDetail.tsx:60` |
| Dipanggil saat tampilkan path map | `components/history/HistoryPanel.tsx:341-345` |
| Export stop halte sebagai row CSV | `components/history/HistorySessionDetail.tsx:189-208` |

---

## 16. Statistik Operasional

Statistik operasional menggunakan data session dan live buggy.

Fitur:

- Active/idle/stopped.
- Total passenger.
- Daily average.
- Peak time.
- Total trips.
- Total distance.
- Average speed.
- Total time.
- Ranking buggy.
- Grafik series.

Referensi kode:

| Fungsi | Lokasi |
| --- | --- |
| Komponen statistik | `components/data/AdminStatisticsPanel.tsx:47-54` |
| Chart dan stat helpers | `components/data/AdminStatisticsPanel.tsx:62-172` |
| Passenger load dari session | `components/data/AdminStatisticsPanel.tsx:200-212` |
| API statistik admin | `app/api/admin/statistics/route.ts:32-208` |
| Ambil data bulan berjalan | `app/api/admin/statistics/route.ts:47-58` |
| Ambil data bulan sebelumnya | `app/api/admin/statistics/route.ts:60-70` |
| Kalkulasi total/trend | `app/api/admin/statistics/route.ts:72-116` |
| Daily series dan top buggies | `app/api/admin/statistics/route.ts:117-171` |
| Response statistik | `app/api/admin/statistics/route.ts:173-202` |

---

## 17. Geofence

Geofence adalah area operasional berbentuk lingkaran dengan center dan radius.

Fitur:

- Admin membuat geofence.
- Admin edit radius/nama/center.
- Admin enable/disable geofence.
- Admin hapus geofence.
- Map menampilkan lingkaran geofence.
- Event geofence menyimpan/memperlihatkan buggy masuk/keluar area.

API:

| Fungsi | Lokasi |
| --- | --- |
| GET semua geofence | `app/api/geofences/route.ts:8-13` |
| POST geofence baru | `app/api/geofences/route.ts:15-65` |
| PATCH geofence | `app/api/geofences/[id]/route.ts:13-104` |
| DELETE geofence | `app/api/geofences/[id]/route.ts:106-120` |

UI:

| Fungsi | Lokasi |
| --- | --- |
| Tab Geofence admin | `components/data/AdminDataSection.tsx:182-207` |
| GeofenceManager | `components/data/GeofenceManager.tsx` |
| GeofenceEventLog | `components/data/GeofenceEventLog.tsx` |
| State geofence di admin page | `app/[locale]/admin/page.tsx:195-208` |
| Draft geofence di map | `components/map/MapCanvas.tsx:158-164` |

---

## 18. Settings dan Account Management

Settings menyimpan preferensi di localStorage.

Fitur:

- Bahasa.
- Style peta.
- Browser notification.
- Nearby alert radius.
- Geofence event alert.
- Offline buggy alert.
- Compact admin panel.
- Open panel on dashboard.
- Edit account.
- Account management untuk admin.
- Logout.

Referensi kode:

| Fungsi | Lokasi |
| --- | --- |
| Tipe settings | `hooks/useAdminSettings.ts:7-16` |
| Default settings | `hooks/useAdminSettings.ts:18-26` |
| LocalStorage key | `hooks/useAdminSettings.ts:48-57` |
| Parse/write settings | `hooks/useAdminSettings.ts:60-79` |
| Hook settings | `hooks/useAdminSettings.ts:99-127` |
| Settings panel | `components/settings/AppSettingsPanel.tsx:88-213` |
| Account/profile area | `components/settings/AppSettingsPanel.tsx:227-310` |
| Account management admin | `components/settings/AppSettingsPanel.tsx:207-210` |
| Logout settings | `components/settings/AppSettingsPanel.tsx:175-187` |

---

## 19. Authentication

Auth memakai Supabase Auth. Callback OAuth/password reset diproses di API route.

Referensi kode:

| Fungsi | Lokasi |
| --- | --- |
| Callback auth route | `app/api/auth/callback/route.ts:6-65` |
| Ambil `code` dan `next` | `app/api/auth/callback/route.ts:7-14` |
| Exchange code for session | `app/api/auth/callback/route.ts:16-19` |
| Redirect berdasarkan role Admin | `app/api/auth/callback/route.ts:35-37` |
| Redirect berdasarkan role Driver | `app/api/auth/callback/route.ts:39-41` |
| Redirect user umum | `app/api/auth/callback/route.ts:43` |
| Password reset handling | `app/api/auth/callback/route.ts:20-22` dan `app/api/auth/callback/route.ts:56-59` |
| Server Supabase client | `lib/supabase/server.ts:9-38` |
| Admin Supabase client service role | `lib/supabase/server.ts:55-69` |

Hal yang perlu dijelaskan:

1. Session user disimpan dan dibaca via cookie Supabase.
2. Server route memakai `createClient()` untuk membaca user saat ini.
3. API admin memakai `requireAdmin()` agar tidak cukup hanya menyembunyikan tombol di frontend.
4. Admin client memakai service role untuk operasi backend yang perlu bypass RLS secara terkontrol.

---

## 20. Push Notification

Push notification digunakan untuk memberi alert ketika buggy mendekati halte dekat pengguna.

Alur:

```text
Browser request permission
  -> Service Worker membuat PushSubscription
  -> POST /api/push/subscribe
  -> notification_subscriptions
  -> Scheduler/cron panggil /api/push/check-nearby
  -> processNearbyPushAlerts
  -> Web Push terkirim
```

Referensi kode:

| Fungsi | Lokasi |
| --- | --- |
| Subscribe push | `app/api/push/subscribe/route.ts:58-113` |
| Validasi subscription | `app/api/push/subscribe/route.ts:77-90` |
| Simpan subscription | `app/api/push/subscribe/route.ts:92-106` |
| Check nearby endpoint | `app/api/push/check-nearby/route.ts:16-28` |
| Proteksi token worker | `app/api/push/check-nearby/route.ts:7-14` |
| Toggle browser notification | `components/settings/AppSettingsPanel.tsx:164-173` |

---

## 21. Database dan Supabase

Tabel penting:

| Tabel | Fungsi |
| --- | --- |
| `accounts` | Menyimpan role user dan assignment driver. |
| `buggies` | Master armada buggy. |
| `haltes` | Master halte. |
| `geofences` | Area operasional. |
| `device_assignments` | Mapping device fisik ke buggy. |
| `device_registry` | Device yang pernah mengirim payload. |
| `latest_buggy_telemetry` | Posisi/status terakhir per buggy. |
| `buggy_history` | Raw GPS point. |
| `buggy_session_history` | Ringkasan session perjalanan. |
| `notification_subscriptions` | Data Web Push subscription. |

Referensi kode Supabase:

| Fungsi | Lokasi |
| --- | --- |
| Server client user session | `lib/supabase/server.ts:9-38` |
| Admin client service role | `lib/supabase/server.ts:55-69` |
| Nama tabel history | `lib/supabase/server.ts:71-77` |
| Nama tabel latest telemetry | `lib/supabase/server.ts:79-84` |
| Nama tabel session | `lib/supabase/server.ts:86-88` |
| Nama tabel device assignment | `lib/supabase/server.ts:90-96` |
| Migration device assignment | `supabase/migrations/20260603093000_create_device_assignments.sql:1-75` |

---

## 22. Alur End-to-End yang Perlu Dihafal

### 22.1 Saat buggy mengirim GPS

1. ESP mengirim `deviceId`, lat, lng, speed, passengers, gsm ke MQTT.
2. MQTT bridge mengirim HTTP POST ke `/api/gps-beacon`.
3. API validasi `BUGGY_INGEST_TOKEN`.
4. API normalisasi `deviceId` menjadi `devicesId`.
5. API mencatat device ke `device_registry`.
6. API mencari assignment aktif di `device_assignments`.
7. Jika assignment ada, API mendapatkan `buggy_id`.
8. API mengecek apakah fleet di-hide.
9. API update live store.
10. API upsert `latest_buggy_telemetry`.
11. API insert raw point ke `buggy_history`.
12. API menambah point ke session store.
13. Frontend polling `/api/buggy` setiap detik.
14. Map dan panel berubah sesuai posisi terbaru.

### 22.2 Saat admin melihat history

1. UI `HistoryPanel` fetch `/api/buggy-sessions`.
2. API memastikan user admin/driver.
3. Jika driver, data difilter sesuai buggy assignment.
4. API membaca `buggy_session_history`.
5. API juga membaca raw history 24 jam terakhir untuk session yang belum final.
6. API membentuk synthetic ongoing session.
7. UI menampilkan kalender tanggal.
8. User pilih tanggal, lalu pilih buggy.
9. User pilih session.
10. UI menampilkan path di map dan detail session.
11. Export CSV dibuat di browser dari data session.

### 22.3 Saat admin memindahkan device

1. Admin masuk Edit Fleet.
2. Panel device assignment menampilkan device dari `device_registry` dan assignment lama.
3. Admin memilih device untuk buggy tersebut.
4. API membuat assignment aktif baru.
5. Assignment aktif lama untuk device yang sama dinonaktifkan.
6. GPS berikutnya dari device tersebut otomatis masuk ke buggy baru.

### 22.4 Saat fleet di-hide

1. Admin edit fleet.
2. Toggle `Hide Fleet`.
3. API update `buggies.is_active=false`.
4. Live store menghapus buggy dari tampilan.
5. `/api/buggy` juga filter hidden fleet.
6. Jika GPS masuk untuk fleet hidden, `/api/gps-beacon` return 409 dan tidak menerapkan ke live map.

### 22.5 Peta Alur Data per Fitur

Gunakan tabel ini saat ingin menjawab pertanyaan “data ini asalnya dari mana?”.

| Fitur | Sumber data | API / hook | Parent pengambil data | Child penerima data | Bentuk data penting |
| --- | --- | --- | --- | --- | --- |
| Live buggy list | `buggies` + `latest_buggy_telemetry` + live store | `/api/buggy`, `useBuggyLiveFeed` | `app/[locale]/page.tsx`, `app/[locale]/admin/page.tsx` | `PanelActive`, `BuggyCard`, `MapCanvas`, `MapMarker` | `Buggy[]` |
| Detail buggy realtime | Live buggy dari `/api/buggy` | `useBuggyLiveFeed` | Admin page memilih `selectedBuggy` | `BuggyOperationalDetail` | `Buggy` |
| Device ID di operational detail | `device_assignments`, `device_registry`, `latest_buggy_telemetry.devices_id` | `/api/admin/device-assignments` | `BuggyOperationalDetail` load assigned devices | Card detail device | `devicesId`, `lastSeenAt`, `speedKmh` |
| Edit fleet | `buggies` | `/api/admin/buggies`, `/api/admin/buggies/[id]` | `AdminDataSection` | `AdminBuggyFormPanel` | `Buggy` form values |
| Device assignment | `device_registry`, `device_assignments` | `/api/admin/device-assignments` | `AdminBuggyFormPanel` | `DeviceAssignmentPanel` | `DeviceAssignment[]` |
| History calendar | `buggy_session_history` + raw `buggy_history` H-1 | `/api/buggy-sessions` | `HistoryPanel` | `HistoryDateBuggyList` | `sessions`, `availableDates`, `activeBuggySummaries` |
| History session list | `sessions` state dari `HistoryPanel` | Tidak fetch ulang | `HistoryPanel` mencari session by buggy/date | `HistorySessionList` | `selectedBuggySessions` |
| History session detail | `sessions` state dari `HistoryPanel` | Tidak fetch ulang | `HistoryPanel` mencari `selectedSession` | `HistorySessionDetail` | `selectedSession: BuggySession` |
| History path map | `selectedSession.path` | Tidak fetch ulang | `HistoryPanel` | `MapCanvas` melalui `onShowPath` | `[lat,lng][]`, stop points |
| Export CSV history | `selectedSession.path` + stop points | Browser-only | `HistorySessionDetail` | Download CSV | summary row, GPS point rows, stop halte rows |
| Statistik operasional | `buggy_session_history` | `/api/admin/statistics` | `AdminDataSection` | `AdminStatisticsPanel` | monthly totals, passenger series |
| Geofence map | `geofences` | `/api/geofences` | Admin page | `MapCanvas`, geofence panel | `Geofence[]` |
| Search route | `haltes`, `liveBuggies`, Google Maps API | `useDirectionSearch` | Public/admin page | `LiveSearchBar`, `DirectionPanel`, `MapCanvas` | `DirectionResult` |
| Halte list | `haltes` DB atau static fallback | `/api/haltes`, runtime cache | Page/admin data panel | Halte panel, map marker | `HaltePoint[]` |
| User role | `accounts` + Supabase Auth | `useUserRole`, proxy | Page/components | Conditional UI | `role`, `buggy_id` |
| Push notification | `notification_subscriptions`, live buggy snapshot | `/api/push/subscribe`, `/api/push/check-nearby` | Settings / background worker | Browser notification | push endpoint, radius, user position |

Cara membaca satu baris tabel:

```text
Fitur History Detail
  -> data awal dari buggy_session_history
  -> API /api/buggy-sessions mengubah row DB menjadi BuggySession
  -> HistoryPanel fetch dan menyimpan ke state sessions
  -> HistoryPanel mencari selectedSession
  -> HistorySessionDetail menerima selectedSession sebagai props
  -> UI membaca s.durationMinutes, s.path, s.passengerAvg, dan field lain
```

---

## 23. Pertanyaan Dosen yang Mungkin Muncul

### Apa perbedaan `deviceId`, `devicesId`, dan `buggyId`?

`deviceId` adalah field dari ESP. Backend menormalisasi menjadi `devicesId`. `buggyId` adalah ID armada di database. Sistem tidak mengunci ESP ke buggy secara hardcode; mapping dilakukan melalui tabel `device_assignments`.

### Kenapa frontend tidak langsung subscribe MQTT?

Karena data harus divalidasi, diamankan dengan token, disimpan ke database, dan dinormalisasi dulu. Jika browser langsung subscribe MQTT, keamanan dan konsistensi data lebih sulit dijaga.

### Bagaimana sistem tahu buggy online atau offline?

Live store menyimpan waktu terakhir telemetry diterima. Saat snapshot dibaca, sistem menghitung `lastSeenSecondsAgo` dan status koneksi.

Kode: `lib/realtime/buggy-live-store.ts:329-355`.

### Apa fungsi `latest_buggy_telemetry` dan `buggy_history`?

`latest_buggy_telemetry` untuk snapshot terakhir yang cepat dibaca. `buggy_history` untuk raw GPS point historis yang dapat diolah menjadi session.

### Mengapa ada in-memory live store kalau sudah ada Supabase?

Live store membuat tampilan realtime lebih cepat dan sederhana. Supabase tetap dipakai untuk persistence agar data tidak hilang untuk history/statistik.

### Bagaimana driver dibatasi hanya melihat buggy tertentu?

Role dan `buggy_id` driver dibaca dari tabel `accounts`. API history membuat alias filter berdasarkan assigned buggy, lalu query hanya data buggy tersebut.

Kode: `app/api/buggy-sessions/route.ts:68-153`.

### Bagaimana session perjalanan dibuat?

Setiap GPS point masuk ke session store. Session difinalisasi saat `sessionEnd`, idle terlalu lama, atau bucket operasional berubah. Ringkasan seperti durasi, jarak, average speed, passenger, dan path dihitung sebelum disimpan.

Kode: `lib/realtime/session-store.ts:400-620`.

### Bagaimana stop halte pada history didapat?

Sistem mengecek titik GPS yang berada dekat koordinat halte. Jika beberapa titik dekat halte, dibuat stop point dengan durasi dan jumlah point.

Kode: `lib/history/stop-points.ts`.

### Apa pengamanan untuk API ingest GPS?

Endpoint `/api/gps-beacon` wajib memakai header `Authorization: Bearer <BUGGY_INGEST_TOKEN>`.

Kode: `lib/auth/ingest-token.ts:3-25`.

### Apa pengamanan untuk API admin?

API admin memakai `requireAdmin()`, yang membaca user dari Supabase Auth lalu memastikan role di tabel `accounts` adalah `Admin`.

Kode: `lib/auth/admin-guard.ts:15-49`.

---

## 24. Ringkasan Jawaban Cepat

Jika harus menjelaskan dalam 1 menit:

> SIMOBI adalah sistem monitoring buggy listrik berbasis Next.js dan Supabase. Data GPS dari ESP dikirim lewat MQTT, diteruskan MQTT bridge ke API `/api/gps-beacon`, lalu backend memvalidasi token, mencari assignment `devicesId -> buggy_id`, memperbarui live store, menyimpan snapshot terakhir ke `latest_buggy_telemetry`, dan menyimpan raw point ke `buggy_history`. Frontend mengambil data lewat `/api/buggy` dan menampilkannya di Google Maps. Admin dapat mengelola buggy, halte, geofence, device assignment, akun, statistik, dan history. Driver hanya melihat data buggy yang ditugaskan. History perjalanan dihitung dari raw GPS point menjadi session, lalu dapat ditampilkan di kalender, path map, detail sesi, dan export CSV.

Jika harus menjelaskan arsitektur:

```text
Hardware/Simulator -> MQTT -> Bridge -> API Ingest -> Live Store + Supabase -> API Snapshot/History -> React UI + Google Maps
```

Jika harus menjelaskan keamanan:

```text
User dashboard: Supabase Auth + role accounts
Admin API: requireAdmin()
GPS ingest: BUGGY_INGEST_TOKEN
Push worker: PUSH_WORKER_TOKEN atau CRON_SECRET
```

---

## 25. Checklist Belajar

Pelajari urutan ini:

1. Baca gambaran umum arsitektur pada dokumen ini.
2. Pahami `proxy.ts` untuk auth dan role.
3. Pahami `/api/gps-beacon` sebagai pintu masuk telemetry.
4. Pahami `buggy-live-store.ts` sebagai live state.
5. Pahami `/api/buggy` dan `useBuggyLiveFeed` sebagai jalur data ke frontend.
6. Pahami `MapCanvas` sebagai visualisasi peta.
7. Pahami `useDirectionSearch` sebagai rute pengguna.
8. Pahami `session-store.ts` dan `/api/buggy-sessions` untuk history.
9. Pahami `device_assignments` untuk fleksibilitas ESP ke buggy.
10. Pahami admin CRUD: buggy, geofence, account, settings, statistic.
