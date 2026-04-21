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

Opsional pengamanan ingest:

```bash
BUGGY_INGEST_TOKEN=your-secret-token
```

Jika token diisi, kirim header:

```http
Authorization: Bearer your-secret-token
```

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

### 4) Bridge contoh

Lihat file `scripts/mqtt-to-next-bridge.example.mjs` untuk template MQTT subscriber
yang mem-forward data ke `/api/buggy/ingest`.

### 5) Simulator publisher ke MQTT

Script simulator berbasis data buggy saat ini tersedia di:

- `scripts/buggy-mqtt-simulator.mjs`

Install dependency lalu jalankan:

```bash
npm install
MQTT_BROKER_URL=mqtt://localhost:1883 \
SIM_BUGGY_IDS=1 \
npm run sim:mqtt
```

Default publish tiap 3 detik ke topic:

- `buggy/1/data`

Untuk banyak buggy:

```bash
SIM_BUGGY_IDS=all npm run sim:mqtt
```

### 6) Quick local pipeline test (Simulator -> MQTT -> Next.js)

Pastikan feed mode frontend bukan simulation:

```bash
NEXT_PUBLIC_BUGGY_FEED_MODE=sse
```

Start broker MQTT (contoh Mosquitto):

```bash
/opt/homebrew/opt/mosquitto/sbin/mosquitto -v -p 1883
```

Start Next.js:

```bash
npm run dev
```

Jalankan bridge subscriber (MQTT -> ingest API):

```bash
MQTT_BROKER_URL=mqtt://localhost:1883 \
MQTT_TOPIC=buggy/+/data \
NEXT_INGEST_URL=http://localhost:3000/api/buggy/ingest \
npm run bridge:mqtt
```

Lalu jalankan simulator publisher:

```bash
MQTT_BROKER_URL=mqtt://localhost:1883 \
SIM_BUGGY_IDS=1 \
npm run sim:mqtt
```

Verifikasi ingest berhasil:

```bash
curl -s http://localhost:3000/api/buggy | jq '.[0] | {id, name, updatedAt}'
```
