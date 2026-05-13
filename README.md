This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Repository Boundaries

- Runtime aplikasi Next.js berada di `app`, `components`, `hooks`, `lib`, dan `types`.
- Folder `comfyui-mcp-server` adalah tool/proyek terpisah dan bukan bagian runtime aplikasi Next.js ini.

## Realtime Buggy Scaffold

Scaffold realtime sudah tersedia agar data GPS dari Raspy (via MQTT) bisa langsung masuk website.

### 1) Mode feed frontend

Gunakan environment variable:

```bash
NEXT_PUBLIC_BUGGY_FEED_MODE=sse # poll | sse
```

- `poll`: polling `/api/buggy`.
- `sse`: subscribe `/api/buggy/stream`.

Frontend selalu membaca data dari backend realtime (`/api/buggy` atau `/api/buggy/stream`).
Jika source backend masih `seed`, data default server tetap ditampilkan sampai ada ingest MQTT.

### 2) Endpoint backend

- `GET /api/buggy`: daftar buggy (shape sama dengan `Buggy[]`).
- `GET /api/buggy/stream`: SSE stream snapshot buggy realtime.
- `POST /api/buggy/ingest`: endpoint ingest dari MQTT bridge.
- `POST /api/gps-beacon`: endpoint ingest GPS + telemetry operasional untuk bridge MQTT.

Pengamanan ingest wajib untuk `/api/buggy/ingest` dan `/api/gps-beacon`:

```bash
BUGGY_INGEST_TOKEN=your-secret-token
```

Setiap request ingest harus mengirim header:

```http
Authorization: Bearer your-secret-token
```

Jika `BUGGY_INGEST_TOKEN` belum diset, endpoint ingest akan menolak request
dengan status `500` agar service tidak berjalan terbuka tanpa sengaja.

### 3) Format payload ingest

Mode A - full snapshot:

```json
{
  "buggies": [
    /* Buggy[] full object */
  ]
}
```

Mode B - telemetry increment:

```json
{
  "telemetry": [
    {
      "id": "buggy-1",
      "lat": -7.05,
      "lng": 110.44,
      "speedKmh": 18.2,
      "passengers": 4,
      "capacity": 8,
      "etaMinutes": 3,
      "currentStopIndex": 2,
      "timestamp": "2026-04-21T04:00:00.000Z"
    }
  ]
}
```

### 4) GPS tracker MQTT

Halaman `/gps-tracker` dapat mensimulasikan satu device atau beberapa buggy sekaligus.
Browser publish ke broker MQTT via WebSocket, sehingga broker harus menyediakan listener
`ws://` atau `wss://`.

Environment browser:

```bash
NEXT_PUBLIC_MQTT_BROKER_WS_URL=ws://localhost:9001
NEXT_PUBLIC_MQTT_TOPIC_PREFIX=buggy
```

Jika browser menampilkan `connack timeout`, coba ganti host menjadi IPv4 eksplisit
dan restart Next.js:

```bash
NEXT_PUBLIC_MQTT_BROKER_WS_URL=ws://127.0.0.1:9001
```

Topic publish:

```text
buggy/{numericId}/data
```

Payload:

```json
{
  "buggyId": 2,
  "lat": -7.054518,
  "lng": 110.44413,
  "speedKmh": 12.5,
  "heading": 270,
  "altitude": 200,
  "accuracy": 5,
  "etaMinutes": 3,
  "batteryLevel": 85,
  "passengers": 4,
  "capacity": 8,
  "sessionStart": true,
  "timestamp": "2026-05-08T00:00:00.000Z",
  "source": "gps-tracker"
}
```

### 5) MQTT bridge

Bridge Node subscribe MQTT lalu forward ke `/api/gps-beacon`, sehingga dashboard tetap
membaca data dari backend `/api/buggy` dan history/session tetap tersimpan.

Untuk development cepat dari repo utama:

```bash
MQTT_BROKER_URL=mqtt://localhost:1883 \
MQTT_TOPIC=buggy/+/data \
NEXT_GPS_BEACON_URL=http://localhost:3000/api/gps-beacon \
BUGGY_INGEST_TOKEN=your-secret-token \
npm run bridge:mqtt
```

Opsional:

```bash
MQTT_USERNAME=...
MQTT_PASSWORD=...
```

Untuk deploy simulator sebagai worker terpisah, gunakan folder:

```text
mqtt-simulator-bridge-service
```

Service ini khusus payload `/gps-tracker` dengan topic default `buggy/+/data`,
dan sengaja dipisah dari `mqtt-bridge-service` produksi agar data simulator
tidak mengubah pipeline data asli.

### 6) Quick local pipeline test (GPS Tracker -> MQTT -> Next.js)

Install dependency:

```bash
npm install
```

Start broker MQTT dengan TCP dan WebSocket listener. File konfigurasi contoh
sudah tersedia di repo sebagai `mosquitto-websocket.conf`:

```conf
listener 1883
allow_anonymous true

listener 9001
protocol websockets
allow_anonymous true
```

Jalankan Mosquitto dari root repo:

```bash
mosquitto -c mosquitto-websocket.conf -v
```

Catatan: baris `listener` dan `allow_anonymous` adalah isi file konfigurasi,
bukan command terminal.

Pastikan port TCP dan WebSocket benar-benar didengar Mosquitto:

```bash
lsof -nP -iTCP:1883 -sTCP:LISTEN
lsof -nP -iTCP:9001 -sTCP:LISTEN
```

Output keduanya harus menunjukkan proses `mosquitto`. Jika port 9001 dipakai
proses lain, browser bisa tersambung ke WebSocket yang salah lalu berakhir
`connack timeout`.

Start Next.js:

```bash
npm run dev
```

Start bridge:

```bash
MQTT_BROKER_URL=mqtt://localhost:1883 \
MQTT_TOPIC=buggy/+/data \
NEXT_GPS_BEACON_URL=http://localhost:3000/api/gps-beacon \
BUGGY_INGEST_TOKEN=your-secret-token \
npm run bridge:mqtt
```

Buka `/gps-tracker`, pilih mode device atau armada, lalu klik `Mulai Simulator`.
Verifikasi data berubah:

```bash
curl -s http://localhost:3000/api/buggy | jq '.[0] | {id, name, passengers, capacity, updatedAt}'
```

Untuk production, jalankan bridge sebagai service long-running terpisah (Fly.io,
VM, atau worker server), bukan di Vercel serverless. Broker public harus memakai
`wss://` agar browser bisa publish dari HTTPS.

### 7) Setup Tabel Buggy History di Supabase

Jika Anda mendapatkan error "Could not find the table 'public.buggy_history' in the schema cache", ikuti langkah-langkah berikut:

1. Login ke Supabase Dashboard Anda
2. Buka SQL Editor
3. Jalankan SQL berikut untuk membuat tabel:

```sql
-- Create the buggy_history table
create table if not exists public.buggy_history (
  id uuid default gen_random_uuid() primary key,
  buggy_id text not null,
  lat double precision not null,
  lng double precision not null,
  speed_kmh double precision,
  accuracy double precision,
  heading double precision,
  altitude double precision,
  battery_level integer,
  passengers integer,
  capacity integer,
  source text,
  recorded_at timestamp with time zone default now() not null
);

-- Create indexes for better query performance
create index if not exists idx_buggy_history_buggy_id on public.buggy_history(buggy_id);
create index if not exists idx_buggy_history_recorded_at on public.buggy_history(recorded_at);
create index if not exists idx_buggy_history_location on public.buggy_history(lat, lng);

-- Enable RLS (Row Level Security)
alter table public.buggy_history enable row level security;

-- Grant permissions
grant usage on schema public to anon, authenticated;
grant all on table public.buggy_history to anon, authenticated;
```

4. Pastikan environment variables berikut sudah diatur dengan nilai yang benar dari Supabase Dashboard:
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`

5. Restart server Next.js Anda
