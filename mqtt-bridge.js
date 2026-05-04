const mqtt = require('mqtt');

// Konfigurasi MQTT
const MQTT_SERVER = process.env.MQTT_SERVER || "mqtts://db7ded41366b4e9e863e255883a077fd.s1.eu.hivemq.cloud:8883";
const MQTT_USER = process.env.MQTT_USER || "ESP32GPSBV1";
const MQTT_PASS = process.env.MQTT_PASS || "BuggycarMon12#";
const TOPIC = process.env.MQTT_TOPIC || "bus/gps/data";

// URL API Next.js kita
const API_URL = process.env.API_URL || "http://localhost:3000/api/gps-beacon";

// Hubungkan ke MQTT Broker
const client = mqtt.connect(MQTT_SERVER, {
  username: MQTT_USER,
  password: MQTT_PASS,
  clientId: 'nextjs-server-bridge-' + Math.random().toString(16).substring(2, 8)
});

client.on('connect', () => {
  console.log('✅ Bridge terhubung ke HiveMQ Cloud');
  client.subscribe(TOPIC, (err) => {
    if (!err) {
      console.log(`✅ Subscribed ke topic: ${TOPIC}`);
      console.log(`📡 Menunggu data GPS...`);
    } else {
      console.error('❌ Gagal subscribe:', err);
    }
  });
});

client.on('message', async (topic, message) => {
  try {
    const data = JSON.parse(message.toString());
    console.log(`\n📥 Menerima data dari ESP32:`, data);
    
    // Menyiapkan payload untuk dikirim ke API /api/gps-beacon
    // Asumsi ID hardware = buggy 2
    const payload = {
      buggyId: 2,
      lat: data.lat,
      lng: data.lng,
      speedKmh: data.speed || 0,
      accuracy: 10,
      forceResync: true
    };

    // Teruskan data ke Next.js API
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    
    if (res.ok) {
      console.log('✅ Data berhasil dikirim ke database SIMOBI!');
    } else {
      console.error('❌ Gagal mengirim ke API SIMOBI:', await res.text());
    }
  } catch (e) {
    console.error('❌ Terjadi kesalahan saat memproses pesan:', e.message);
  }
});

client.on('error', (err) => {
  console.error('❌ MQTT Error:', err);
});
