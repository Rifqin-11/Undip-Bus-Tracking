# SIMOBI MQTT Simulator Bridge

Service terpisah untuk data simulator `/gps-tracker`.

```text
/gps-tracker browser -> MQTT broker -> mqtt-simulator-bridge-service -> /api/gps-beacon
```

Service ini sengaja dipisah dari `mqtt-bridge-service` produksi agar payload simulator
tidak mengganggu pipeline data asli dari device.

## Topic

Default subscribe:

```text
buggy/+/data
```

Contoh payload simulator:

```json
{
  "buggyId": 1,
  "lat": -7.05449,
  "lng": 110.4441325,
  "speedKmh": 12,
  "heading": 180,
  "accuracy": 8,
  "batteryLevel": 92,
  "passengers": 4,
  "capacity": 8,
  "etaMinutes": 3,
  "sessionStart": true,
  "timestamp": "2026-05-10T00:00:00.000Z",
  "source": "gps-tracker"
}
```

## Local

```bash
cp .env.example .env
npm install
npm start
```

Atau tanpa `.env`:

```bash
MQTT_BROKER_URL=mqtt://localhost:1883 \
MQTT_TOPIC=buggy/+/data \
NEXT_GPS_BEACON_URL=http://localhost:3000/api/gps-beacon \
BUGGY_INGEST_TOKEN=your-secret-token \
npm start
```

Health check:

```text
GET /health
```

## Deploy Fly.io

Set secrets:

```bash
fly secrets set MQTT_BROKER_URL="mqtts://your-broker:8883"
fly secrets set MQTT_USERNAME="your-user"
fly secrets set MQTT_PASSWORD="your-password"
fly secrets set NEXT_GPS_BEACON_URL="https://www.simobi.my.id/api/gps-beacon"
fly secrets set BUGGY_INGEST_TOKEN="your-secret-token"
```

Deploy:

```bash
fly deploy
```

Konfigurasi `fly.toml` memakai `auto_stop_machines = false` dan
`min_machines_running = 1` karena MQTT bridge harus long-running.

## Railway

Gunakan folder ini sebagai root service, lalu set variables:

```text
MQTT_BROKER_URL=mqtts://your-broker:8883
MQTT_TOPIC=buggy/+/data
MQTT_USERNAME=your-user
MQTT_PASSWORD=your-password
NEXT_GPS_BEACON_URL=https://www.simobi.my.id/api/gps-beacon
BUGGY_INGEST_TOKEN=your-secret-token
PORT=8080
```
