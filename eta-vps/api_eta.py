"""
Script: REST API Prediksi ETA Buggy Undip - VPS Version
Fungsi: Menerima request dari Web/Frontend, melakukan feature engineering
        otomatis, dan mengembalikan prediksi Waktu Tempuh.
Author: Faizal Adi Purwoko
"""
from flask import Flask, request, jsonify
import xgboost as xgb
import pandas as pd
import numpy as np
from datetime import datetime, timedelta
import pytz
import os

app = Flask(__name__)

# 1. LOAD MODEL & DATA
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MODEL_PATH = os.path.join(BASE_DIR, "xgboost_eta_model.json")
ROUTE_PATH = os.path.join(BASE_DIR, "dataroute.txt")

# Load model
model = xgb.Booster()
model.load_model(MODEL_PATH)

HALTE_LOCATIONS = {
    'h01': {'lat': -7.054518537168431, 'lng': 110.44413919120406},
    'h03': {'lat': -7.0556100, 'lng': 110.4391},
    'h04': {'lat': -7.053615652182, 'lng': 110.43919618890992},
    'h05': {'lat': -7.052103865215362, 'lng': 110.43808378253539},
    'h06': {'lat': -7.050873236387066, 'lng': 110.43718416935035},
    'h07': {'lat': -7.050370746018777, 'lng': 110.43609972172088},
    'h08': {'lat': -7.049832325888632, 'lng': 110.43849680096805},
    'h10': {'lat': -7.048677336244937, 'lng': 110.44021522652281},
    'h11': {'lat': -7.04713778936035, 'lng': 110.43869200447789},
    'h13': {'lat': -7.047569654368096, 'lng': 110.44101030995277},
    'h14': {'lat': -7.048907407951046, 'lng': 110.44252222022146},
    'h15': {'lat': -7.050684864323637, 'lng': 110.4420491664416},
    'h16': {'lat': -7.053006517891536, 'lng': 110.44130798104808},
    'h17': {'lat': -7.0552369, 'lng': 110.4394576},
    'h18': {'lat': -7.055973568692425, 'lng': 110.43939589722012},
}

route_order = list(HALTE_LOCATIONS.keys())
halte_to_idx = {h: i for i, h in enumerate(route_order)}

def haversine_dist(lon1, lat1, lon2, lat2):
    """Hitung jarak haversine antara 2 titik koordinat"""
    lon1, lat1, lon2, lat2 = map(np.radians, [lon1, lat1, lon2, lat2])
    a = np.sin((lat2 - lat1)/2.0)**2 + np.cos(lat1) * np.cos(lat2) * np.sin((lon2 - lon1)/2.0)**2
    return 2 * np.arcsin(np.sqrt(a)) * 6_367_000.0

def load_route_distance():
    """Load rute dari dataroute.txt dan hitung jarak kumulatif"""
    route_points = []
    with open(ROUTE_PATH, 'r') as f:
        for line in f:
            # Skip comments dan empty lines
            line = line.split('#')[0].strip()
            if line:
                parts = line.split(',')
                if len(parts) >= 2:
                    try:
                        route_points.append((float(parts[0]), float(parts[1])))
                    except ValueError:
                        continue  # Skip lines yang tidak valid

    if not route_points:
        raise ValueError("dataroute.txt kosong atau tidak ada koordinat valid!")

    route_arr = np.array(route_points)
    cum_dist = [0.0]
    for i in range(1, len(route_arr)):
        d = haversine_dist(route_arr[i-1, 1], route_arr[i-1, 0],
                          route_arr[i, 1], route_arr[i, 0])
        cum_dist.append(cum_dist[-1] + d)

    # Mapping halte ke index di route
    halte_idx = {}
    for h_id, h_data in HALTE_LOCATIONS.items():
        dists = haversine_dist(route_arr[:, 1], route_arr[:, 0],
                              h_data['lng'], h_data['lat'])
        halte_idx[h_id] = np.argmin(dists)

    return route_arr, np.array(cum_dist), halte_idx

# Load data spasial saat startup
try:
    _, cum_dist, halte_map_idx = load_route_distance()
    print(f"✓ Route loaded: {len(cum_dist)} points, total distance: {cum_dist[-1]:.2f} meters")
except Exception as e:
    print(f"✗ Error loading route: {e}")
    raise

def calculate_route_distance(from_halte, to_halte):
    """Hitung jarak aspal antara 2 halte (otomatis, tidak perlu manual!)"""
    idx_a = halte_map_idx[from_halte]
    idx_b = halte_map_idx[to_halte]
    if idx_b >= idx_a:
        return cum_dist[idx_b] - cum_dist[idx_a]
    else:
        return (cum_dist[-1] - cum_dist[idx_a]) + cum_dist[idx_b]

# 2. LOGIKA PREDIKSI INTI
def get_prediction(from_halte, to_halte, pax, timestamp=None):
    """Fungsi inti prediksi ETA"""
    if timestamp is None:
        now = datetime.now(pytz.timezone('Asia/Jakarta'))
    else:
        now = timestamp

    hour = now.hour
    day = now.weekday()  # 0=Senin, 6=Minggu

    # Hitung jarak otomatis dari dataroute.txt
    route_dist = calculate_route_distance(from_halte, to_halte)

    # Feature engineering (SAMA PERSIS dengan training)
    is_weekend = 1 if day >= 5 else 0
    is_peak = 1 if hour in [7, 8, 9, 10, 12, 13, 14, 16, 17] else 0
    is_rusun = 1 if from_halte == 'h18' else 0  # h18 = Rusunawa

    # ORDER FITUR HARUS SAMA DENGAN SAAT TRAINING!
    features = np.array([[
        route_dist,      # route_distance_m
        pax,             # max_passengers
        hour,            # hour_of_day
        day,             # day_of_week
        is_weekend,      # is_weekend
        is_peak,         # is_peak_hour
        halte_to_idx[from_halte],  # from_halte_idx
        halte_to_idx[to_halte],    # to_halte_idx
        is_rusun         # is_rusun
    ]])

    dmatrix = xgb.DMatrix(features)
    pred_sec = float(model.predict(dmatrix)[0])
    return pred_sec

# 3. ENDPOINTS API UNTUK WEB

@app.route('/health', methods=['GET'])
def health():
    """Health check endpoint"""
    return jsonify({
        'status': 'healthy',
        'model_loaded': True,
        'routes_loaded': True,
        'timestamp': datetime.now(pytz.timezone('Asia/Jakarta')).isoformat()
    })

@app.route('/predict_segment', methods=['POST'])
def predict_segment():
    """Prediksi SATU SEGMEN (Contoh: h01 ke h03)"""
    data = request.json
    try:
        from_halte = data['from_halte']
        to_halte = data['to_halte']
        pax = data.get('passengers', 0)

        # Optional: custom timestamp
        timestamp = None
        if 'timestamp' in data:
            timestamp = datetime.fromisoformat(data['timestamp'].replace('Z', '+00:00'))
            timestamp = timestamp.astimezone(pytz.timezone('Asia/Jakarta'))

        if from_halte not in HALTE_LOCATIONS or to_halte not in HALTE_LOCATIONS:
            return jsonify({'success': False, 'error': 'ID Halte tidak valid'}), 400

        sec = get_prediction(from_halte, to_halte, pax, timestamp)
        mins = int(sec // 60)
        secs = int(sec % 60)

        return jsonify({
            'success': True,
            'from': from_halte,
            'to': to_halte,
            'eta_seconds': round(sec, 1),
            'eta_formatted': f"~{mins} menit {secs} detik",
            'eta_minutes': round(sec / 60, 1)
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/predict_route', methods=['POST'])
def predict_full_route():
    """Prediksi KUMULATIF dari halte saat ini ke semua halte depannya"""
    data = request.json
    try:
        start_halte = data['start_halte']
        pax = data.get('passengers', 0)

        # Optional: custom timestamp
        timestamp = None
        if 'timestamp' in data:
            timestamp = datetime.fromisoformat(data['timestamp'].replace('Z', '+00:00'))
            timestamp = timestamp.astimezone(pytz.timezone('Asia/Jakarta'))

        if start_halte not in HALTE_LOCATIONS:
            return jsonify({'success': False, 'error': 'ID Halte tidak valid'}), 400

        start_idx = route_order.index(start_halte)
        predictions = []
        total_seconds = 0
        current_time = timestamp if timestamp else datetime.now(pytz.timezone('Asia/Jakarta'))

        # Looping untuk memprediksi tiap halte secara berurutan
        for i in range(start_idx, len(route_order) - 1):
            from_h = route_order[i]
            to_h = route_order[i + 1]

            sec = get_prediction(from_h, to_h, pax, current_time)
            total_seconds += sec
            current_time = current_time + timedelta(seconds=sec)

            # Format rentang menit (untuk meng-cover error MAE ~40 detik)
            min_est = int(total_seconds // 60)
            max_est = min_est + 1

            predictions.append({
                'halte_tujuan': to_h,
                'halte_nama': f"Halte {to_h.upper()}",
                'arrival_time': current_time.strftime('%H:%M:%S'),
                'eta_cumulative_seconds': round(total_seconds, 1),
                'eta_display': f"{min_est} - {max_est} Menit",
                'eta_minutes_min': min_est,
                'eta_minutes_max': max_est
            })

        return jsonify({
            'success': True,
            'posisi_buggy': start_halte,
            'start_time': (timestamp if timestamp else datetime.now(pytz.timezone('Asia/Jakarta'))).strftime('%H:%M:%S'),
            'jumlah_penumpang': pax,
            'estimasi_rute': predictions
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/haltes', methods=['GET'])
def get_haltes():
    """Endpoint untuk mendapatkan daftar semua halte"""
    return jsonify({
        'success': True,
        'haltes': HALTE_LOCATIONS,
        'route_order': route_order
    })

if __name__ == '__main__':
    from datetime import timedelta
    print("="*75)
    print("API Server ETA Buggy Undip - VPS Version")
    print("Model loaded: xgboost_eta_model.json")
    print("Route loaded: dataroute.txt")
    print("Server running on: http://0.0.0.0:5000")
    print("Endpoints:")
    print("  - GET  /health")
    print("  - GET  /haltes")
    print("  - POST /predict_segment")
    print("  - POST /predict_route")
    print("="*75)
    app.run(host='0.0.0.0', port=5000, debug=False)
