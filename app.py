
# ================================================================
# SMART WATER QUALITY MONITORING + RANDOM FOREST AI
# ESP32 + THINGSPEAK + FLASK + CHART.JS
#
# ThingSpeak Field Mapping:
# Field 1 = pH
# Field 2 = Turbidity (NTU)
# Field 3 = EC (uS/cm)
# Field 4 = Temperature (C)
#
# Features:
# - Live ThingSpeak sensor data
# - Simulated dataset for Random Forest training
# - GOOD / BAD classification
# - Sensor threshold alerts
# - Live charts and history
# - Auto-refresh every 20 seconds
# - Manual model retraining
# - Single Python file
# ================================================================

import os
import random
import threading
from datetime import datetime

import requests
import numpy as np
import pandas as pd

from flask import Flask, jsonify, render_template_string
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score

# ================================================================
# CONFIGURATION
# ================================================================

app = Flask(__name__)

CHANNEL_ID = "178785"

# IMPORTANT:
# For a PRIVATE channel, enter its READ API KEY here.
# For a PUBLIC channel, leave this empty.
# Do not use the ESP32 WRITE API KEY as the read key.
READ_API_KEY = "IHR6TD7MP82Z3UZR"

THINGSPEAK_URL = (
    f"https://api.thingspeak.com/channels/{CHANNEL_ID}/feeds.json"
)

REFRESH_SECONDS = 20
HISTORY_COUNT = 100
TRAINING_SAMPLES = 6000

# Thresholds from the ESP32 sketch
PH_LOW = 5.5
PH_HIGH = 8.5
TURBIDITY_LIMIT = 12.0
EC_LIMIT = 800.0

# Model features
FEATURES = ["ph", "turbidity", "ec", "temperature"]

# ================================================================
# GLOBAL DATA
# ================================================================

model = None
model_accuracy = 0.0
training_samples = 0

latest_data = None
history_data = []
last_update = "Waiting for ThingSpeak data"
connection_status = "Connecting"
last_error = ""

data_lock = threading.Lock()

# ================================================================
# WATER QUALITY RULES
# ================================================================

def classify_by_threshold(ph, turbidity, ec):
    """
    Simulated training labels based on ESP32 alarm limits.
    GOOD means all three measured parameters are within
    the configured project thresholds.
    """

    bad_reasons = []

    if ph < PH_LOW:
        bad_reasons.append("pH too low")

    if ph > PH_HIGH:
        bad_reasons.append("pH too high")

    if turbidity > TURBIDITY_LIMIT:
        bad_reasons.append("High turbidity")

    if ec > EC_LIMIT:
        bad_reasons.append("High EC")

    if bad_reasons:
        return 0, bad_reasons

    return 1, ["All configured thresholds satisfied"]


# ================================================================
# SIMULATED DATASET
# ================================================================

def generate_dataset(samples=TRAINING_SAMPLES):
    """
    Generate synthetic readings and assign labels using
    the threshold-based rules.

    These are simulated training records, not real measurements.
    """

    rng = np.random.default_rng(42)

    ph = rng.uniform(3.0, 11.0, samples)
    turbidity = rng.uniform(0.0, 100.0, samples)
    ec = rng.uniform(0.0, 2500.0, samples)
    temperature = rng.uniform(10.0, 45.0, samples)

    df = pd.DataFrame({
        "ph": ph,
        "turbidity": turbidity,
        "ec": ec,
        "temperature": temperature
    })

    df["quality"] = (
        (df["ph"] >= PH_LOW) &
        (df["ph"] <= PH_HIGH) &
        (df["turbidity"] <= TURBIDITY_LIMIT) &
        (df["ec"] <= EC_LIMIT)
    ).astype(int)

    return df


# ================================================================
# TRAIN RANDOM FOREST
# ================================================================

def train_model():
    global model, model_accuracy, training_samples

    df = generate_dataset()

    X = df[FEATURES]
    y = df["quality"]

    X_train, X_test, y_train, y_test = train_test_split(
        X,
        y,
        test_size=0.20,
        random_state=42,
        stratify=y
    )

    rf = RandomForestClassifier(
        n_estimators=160,
        max_depth=12,
        min_samples_leaf=2,
        class_weight="balanced",
        random_state=42,
        n_jobs=-1
    )

    rf.fit(X_train, y_train)

    accuracy = accuracy_score(
        y_test,
        rf.predict(X_test)
    )

    with data_lock:
        model = rf
        model_accuracy = float(accuracy)
        training_samples = len(df)

    print("\n===================================")
    print("RANDOM FOREST TRAINED")
    print("Training samples:", len(df))
    print("Test accuracy:", round(accuracy * 100, 2), "%")
    print("===================================\n")


# ================================================================
# PREDICTION
# ================================================================

def predict_quality(ph, turbidity, ec, temperature):
    with data_lock:
        current_model = model

    if current_model is None:
        return {
            "quality": "MODEL NOT READY",
            "probability": 0.0,
            "reasons": ["Model has not been trained"]
        }

    values = [ph, turbidity, ec, temperature]

    if not all(np.isfinite(v) for v in values):
        return {
            "quality": "INVALID DATA",
            "probability": 0.0,
            "reasons": ["One or more sensor values are invalid"]
        }

    sample = pd.DataFrame(
        [[ph, turbidity, ec, temperature]],
        columns=FEATURES
    )

    prediction = int(current_model.predict(sample)[0])
    probabilities = current_model.predict_proba(sample)[0]

    classes = list(current_model.classes_)
    good_index = classes.index(1)

    good_probability = float(probabilities[good_index]) * 100

    # Keep the final displayed class consistent with the project's
    # actual alarm limits, even if the ML model makes an error.
    rule_label, reasons = classify_by_threshold(
        ph, turbidity, ec
    )

    quality = "GOOD" if rule_label == 1 else "BAD"

    if prediction != rule_label:
        reasons.append("ML prediction differs from threshold rules")

    return {
        "quality": quality,
        "ml_prediction": "GOOD" if prediction == 1 else "BAD",
        "probability": round(good_probability, 1),
        "reasons": reasons
    }


# ================================================================
# FETCH THINGSPEAK DATA
# ================================================================

def fetch_thingspeak():
    global latest_data, history_data
    global last_update, connection_status, last_error

    params = {"results": HISTORY_COUNT}

    if READ_API_KEY.strip():
        params["api_key"] = READ_API_KEY.strip()

    try:
        response = requests.get(
            THINGSPEAK_URL,
            params=params,
            timeout=12
        )

        response.raise_for_status()
        payload = response.json()

        feeds = payload.get("feeds", [])

        if not feeds:
            raise ValueError(
                "No readings found. Check channel ID and field mapping."
            )

        parsed_history = []

        for feed in feeds:
            try:
                ph = float(feed["field1"])
                turbidity = float(feed["field2"])
                ec = float(feed["field3"])
                temperature = float(feed["field4"])

                values = [ph, turbidity, ec, temperature]

                if not all(np.isfinite(v) for v in values):
                    continue

                result = predict_quality(
                    ph, turbidity, ec, temperature
                )

                parsed_history.append({
                    "created_at": feed.get("created_at", ""),
                    "entry_id": feed.get("entry_id"),
                    "ph": round(ph, 2),
                    "turbidity": round(turbidity, 2),
                    "ec": round(ec, 2),
                    "temperature": round(temperature, 2),
                    "quality": result["quality"],
                    "ml_prediction": result.get("ml_prediction", ""),
                    "probability": result["probability"],
                    "reasons": result["reasons"]
                })

            except (KeyError, TypeError, ValueError):
                continue

        if not parsed_history:
            raise ValueError(
                "No complete numeric records found in fields 1-4."
            )

        newest = parsed_history[-1]

        with data_lock:
            # Update history only after valid data was retrieved.
            history_data = parsed_history
            latest_data = newest
            connection_status = "CONNECTED"
            last_update = datetime.now().strftime("%d-%m-%Y %H:%M:%S")
            last_error = ""

        return True

    except Exception as exc:
        with data_lock:
            connection_status = "ERROR"
            last_error = str(exc)

        print("ThingSpeak error:", exc)
        return False


# ================================================================
# FLASK ROUTES
# ================================================================

@app.route("/")
def dashboard():
    return render_template_string(HTML_PAGE)


@app.route("/api/data")
def api_data():
    # Serve the last known data immediately. The background thread
    # refreshes ThingSpeak independently.
    with data_lock:
        latest = latest_data.copy() if latest_data else None
        history = [row.copy() for row in history_data]
        status = connection_status
        updated = last_update
        error = last_error
        accuracy = model_accuracy
        count = training_samples

    return jsonify({
        "latest": latest,
        "history": history,
        "connection": status,
        "last_update": updated,
        "error": error,
        "model_accuracy": round(accuracy * 100, 2),
        "training_samples": count,
        "thresholds": {
            "ph_low": PH_LOW,
            "ph_high": PH_HIGH,
            "turbidity": TURBIDITY_LIMIT,
            "ec": EC_LIMIT
        }
    })


@app.route("/api/retrain", methods=["POST"])
def api_retrain():
    try:
        train_model()

        with data_lock:
            has_data = latest_data is not None

        if has_data:
            fetch_thingspeak()

        return jsonify({
            "success": True,
            "message": "Random Forest model retrained successfully."
        })

    except Exception as exc:
        return jsonify({
            "success": False,
            "message": str(exc)
        }), 500


# ================================================================
# BACKGROUND SENSOR REFRESH
# ================================================================

def background_worker():
    while True:
        fetch_thingspeak()
        threading.Event().wait(REFRESH_SECONDS)


# ================================================================
# COMPLETE DASHBOARD HTML
# ================================================================

HTML_PAGE = r"""
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Smart Water Quality AI Dashboard</title>

<script src="https://cdn.jsdelivr.net/npm/chart.js"></script>

<style>
:root {
    --bg: #081120;
    --panel: #111d31;
    --panel2: #16263d;
    --text: #edf5ff;
    --muted: #9eb1ca;
    --cyan: #36d9f7;
    --green: #27e0a3;
    --red: #ff5577;
    --orange: #ffb454;
    --border: rgba(154,183,220,.14);
}

* { box-sizing: border-box; }

body {
    margin: 0;
    font-family: Inter, Segoe UI, Arial, sans-serif;
    background:
      radial-gradient(ellipse at 5% 0%, #183758 0%, transparent 38%),
      radial-gradient(ellipse at 100% 10%, #25234c 0%, transparent 30%),
      var(--bg);
    color: var(--text);
    min-height: 100vh;
}

header {
    padding: 25px 4%;
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-wrap: wrap;
    gap: 15px;
    border-bottom: 1px solid var(--border);
}

.brand {
    display: flex;
    align-items: center;
    gap: 14px;
}

.logo {
    width: 52px;
    height: 52px;
    display: grid;
    place-items: center;
    border-radius: 16px;
    font-size: 28px;
    background: linear-gradient(135deg,#14c8e9,#3a79ff);
    box-shadow: 0 8px 30px #16c8f544;
}

h1 { font-size: clamp(20px,3vw,29px); margin: 0; }
.subtitle { color: var(--muted); font-size: 13px; margin-top: 7px; }

.connection {
    display: flex;
    align-items: center;
    gap: 9px;
    background: #122b35;
    color: var(--green);
    padding: 10px 15px;
    border-radius: 30px;
    border: 1px solid #27e0a333;
    font-size: 12px;
    font-weight: 700;
}

.dot {
    width: 9px;
    height: 9px;
    border-radius: 50%;
    background: currentColor;
    box-shadow: 0 0 12px currentColor;
    animation: pulse 1.5s infinite;
}

@keyframes pulse {
    50% { opacity: .4; transform: scale(.8); }
}

main { max-width: 1500px; margin: auto; padding: 25px 4%; }

.section-head {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 12px;
    flex-wrap: wrap;
    margin-bottom: 17px;
}

.section-head h2 { font-size: 17px; margin: 0; }
.small { color: var(--muted); font-size: 12px; }

.grid {
    display: grid;
    grid-template-columns: repeat(4,minmax(0,1fr));
    gap: 16px;
    margin-bottom: 20px;
}

.card {
    background: linear-gradient(145deg, #14243a, #101a2c);
    border: 1px solid var(--border);
    border-radius: 18px;
    padding: 20px;
    min-width: 0;
    box-shadow: 0 12px 40px #00000015;
    transition: transform .2s, border-color .2s;
}

.card:hover {
    transform: translateY(-3px);
    border-color: #36d9f755;
}

.sensor-title {
    display: flex;
    justify-content: space-between;
    align-items: center;
    color: var(--muted);
    font-size: 13px;
}

.sensor-icon { font-size: 21px; }

.value {
    margin-top: 18px;
    font-size: clamp(26px,3vw,35px);
    font-weight: 750;
    letter-spacing: -1px;
    overflow-wrap: anywhere;
}

.unit { font-size: 12px; color: var(--muted); margin-left: 5px; }

.range {
    margin-top: 17px;
    height: 5px;
    background: #26344b;
    border-radius: 20px;
    overflow: hidden;
}

.range-fill {
    height: 100%;
    width: 0;
    border-radius: 20px;
    transition: width .5s;
}

.cyan { color: var(--cyan); }
.green { color: var(--green); }
.orange { color: var(--orange); }
.red { color: var(--red); }

.cyan-bg { background: linear-gradient(90deg,#2a9eff,#36d9f7); }
.green-bg { background: linear-gradient(90deg,#15bb82,#36f3b4); }
.orange-bg { background: linear-gradient(90deg,#ff913e,#ffd166); }
.red-bg { background: linear-gradient(90deg,#f43f5e,#ff8a7a); }

.main-grid {
    display: grid;
    grid-template-columns: minmax(0,1.6fr) minmax(290px,1fr);
    gap: 18px;
    margin-bottom: 20px;
}

.chart-card { min-height: 330px; }
.chart-wrap { position: relative; height: 260px; margin-top: 20px; }

.quality-box {
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    text-align: center;
    min-height: 290px;
}

.quality-circle {
    width: 130px;
    height: 130px;
    display: grid;
    place-items: center;
    border: 5px solid var(--green);
    border-radius: 50%;
    box-shadow: 0 0 35px #27e0a322;
    margin: 12px 0 18px;
    font-size: 40px;
    transition: all .4s;
}

.quality-name { font-size: 27px; font-weight: 800; letter-spacing: 1px; }
.quality-caption { color: var(--muted); font-size: 12px; margin-top: 9px; }

.confidence {
    width: 100%;
    max-width: 280px;
    text-align: left;
    margin-top: 25px;
}

.confidence-row {
    display: flex;
    justify-content: space-between;
    font-size: 12px;
    margin-bottom: 9px;
}

.confidence-bar {
    height: 8px;
    background: #26344b;
    border-radius: 10px;
    overflow: hidden;
}

.confidence-fill {
    height: 100%;
    width: 0;
    background: linear-gradient(90deg,#21c6d9,#27e0a3);
    transition: width .5s;
}

.alert-list { display: grid; gap: 10px; }

.alert-item {
    display: flex;
    align-items: flex-start;
    gap: 10px;
    padding: 12px;
    border: 1px solid var(--border);
    background: #0e1929;
    border-radius: 12px;
    font-size: 12px;
}

.alert-symbol { font-size: 16px; }
.alert-message { font-weight: 650; }
.alert-description { color: var(--muted); margin-top: 4px; line-height: 1.5; }

.toolbar {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-wrap: wrap;
}

button {
    border: 0;
    cursor: pointer;
    border-radius: 10px;
    padding: 11px 15px;
    font-weight: 700;
    color: white;
    background: linear-gradient(110deg,#1678f5,#635bfa);
    transition: opacity .2s, transform .2s;
}

button:hover { opacity: .85; transform: translateY(-1px); }
button:disabled { opacity: .5; cursor: wait; }

.table-wrap { overflow-x: auto; margin-top: 16px; }

table { width: 100%; border-collapse: collapse; font-size: 12px; white-space: nowrap; }

th {
    color: var(--muted);
    font-weight: 600;
    text-align: left;
    padding: 14px 12px;
    border-bottom: 1px solid var(--border);
}

td {
    padding: 14px 12px;
    border-bottom: 1px solid var(--border);
}

tbody tr:hover { background: #ffffff06; }

.pill {
    display: inline-block;
    padding: 5px 9px;
    border-radius: 20px;
    font-size: 10px;
    font-weight: 800;
}

.pill-good { background: #0b4437; color: #51efbc; }
.pill-bad { background: #4b1b2a; color: #ff8299; }

footer {
    padding: 24px 4%;
    text-align: center;
    color: var(--muted);
    font-size: 11px;
    border-top: 1px solid var(--border);
    line-height: 1.8;
}

#toast {
    position: fixed;
    bottom: 22px;
    right: 22px;
    max-width: calc(100% - 44px);
    background: #173e39;
    border: 1px solid #27e0a355;
    padding: 14px 18px;
    border-radius: 12px;
    display: none;
    z-index: 10;
    font-size: 13px;
}

@media(max-width:950px) {
    .grid { grid-template-columns: repeat(2,minmax(0,1fr)); }
    .main-grid { grid-template-columns: 1fr; }
}

@media(max-width:500px) {
    header { padding: 20px 5%; }
    main { padding: 20px 4%; }
    .grid { gap: 10px; }
    .card { padding: 14px; border-radius: 13px; }
    .value { font-size: 25px; }
    .quality-circle { width: 110px; height: 110px; }
}
</style>
</head>

<body>

<header>
    <div class="brand">
        <div class="logo">💧</div>
        <div>
            <h1>Smart Water Quality AI</h1>
            <div class="subtitle">
                ESP32 · ThingSpeak · Random Forest Intelligence
            </div>
        </div>
    </div>

    <div class="connection" id="connectionBadge">
        <span class="dot"></span>
        <span id="connectionText">CONNECTING</span>
    </div>
</header>

<main>

    <div class="section-head">
        <div>
            <h2>Live Sensor Overview</h2>
            <div class="small" style="margin-top:7px">
                Channel 178785 · Auto-refresh every 20 seconds
            </div>
        </div>
        <div class="small">
            Last updated: <span id="lastUpdate">Waiting...</span>
        </div>
    </div>

    <section class="grid">

        <div class="card">
            <div class="sensor-title">
                <span>pH Level</span><span class="sensor-icon">🧪</span>
            </div>
            <div class="value cyan" id="phValue">--</div>
            <div class="small" id="phState">Waiting for sensor</div>
            <div class="range"><div class="range-fill cyan-bg" id="phBar"></div></div>
            <div class="small" style="margin-top:10px">Target: 5.5 – 8.5</div>
        </div>

        <div class="card">
            <div class="sensor-title">
                <span>Turbidity</span><span class="sensor-icon">🌊</span>
            </div>
            <div class="value" id="turbValue">--</div>
            <div class="small" id="turbState">Waiting for sensor</div>
            <div class="range"><div class="range-fill cyan-bg" id="turbBar"></div></div>
            <div class="small" style="margin-top:10px">Project limit: 12 NTU</div>
        </div>

        <div class="card">
            <div class="sensor-title">
                <span>Electrical Conductivity</span><span class="sensor-icon">⚡</span>
            </div>
            <div class="value" id="ecValue">--</div>
            <div class="small" id="ecState">Waiting for sensor</div>
            <div class="range"><div class="range-fill orange-bg" id="ecBar"></div></div>
            <div class="small" style="margin-top:10px">Project limit: 800 µS/cm</div>
        </div>

        <div class="card">
            <div class="sensor-title">
                <span>Temperature</span><span class="sensor-icon">🌡️</span>
            </div>
            <div class="value orange" id="tempValue">--</div>
            <div class="small">DS18B20 sensor</div>
            <div class="range"><div class="range-fill orange-bg" id="tempBar"></div></div>
            <div class="small" style="margin-top:10px">No temperature alarm configured</div>
        </div>

    </section>

    <section class="main-grid">

        <div class="card chart-card">
            <div class="section-head">
                <div>
                    <h2>Sensor Trend Analysis</h2>
                    <div class="small" style="margin-top:6px">
                        Historical readings from ThingSpeak
                    </div>
                </div>
                <div class="small" id="historyCount">0 records</div>
            </div>
            <div class="chart-wrap">
                <canvas id="trendChart"></canvas>
            </div>
        </div>

        <div class="card quality-box">
            <div class="small">RANDOM FOREST WATER QUALITY RESULT</div>
            <div class="quality-circle" id="qualityCircle">💧</div>
            <div class="quality-name green" id="qualityName">WAITING</div>
            <div class="quality-caption" id="qualityCaption">
                Waiting for live sensor readings
            </div>

            <div class="confidence">
                <div class="confidence-row">
                    <span>ML estimated GOOD probability</span>
                    <b id="confidenceText">--%</b>
                </div>
                <div class="confidence-bar">
                    <div class="confidence-fill" id="confidenceBar"></div>
                </div>
            </div>

            <div class="small" style="margin-top:15px">
                Model test accuracy: <b id="modelAccuracy">--%</b>
            </div>
            <div class="small" style="margin-top:6px">
                Synthetic training samples: <b id="sampleCount">0</b>
            </div>
        </div>

    </section>

    <section class="main-grid">

        <div class="card">
            <div class="section-head">
                <div>
                    <h2>Quality Assessment</h2>
                    <div class="small" style="margin-top:6px">
                        Current project threshold checks
                    </div>
                </div>
            </div>
            <div class="alert-list" id="alertList">
                <div class="alert-item">Waiting for sensor data...</div>
            </div>
        </div>

        <div class="card">
            <div class="section-head">
                <div>
                    <h2>AI Model Control</h2>
                    <div class="small" style="margin-top:6px">
                        Random Forest classification model
                    </div>
                </div>
            </div>

            <div class="alert-item">
                <span class="alert-symbol">🤖</span>
                <div>
                    <div class="alert-message">Random Forest Classifier</div>
                    <div class="alert-description">
                        Uses pH, turbidity, EC and temperature as features.
                        Training labels are generated from the configured
                        project thresholds.
                    </div>
                </div>
            </div>

            <button id="retrainButton" onclick="retrainModel()"
                style="width:100%;margin-top:15px">
                ↻ Retrain AI Model
            </button>

            <div class="small" id="retrainMessage"
                style="margin-top:12px;line-height:1.6">
                Model is trained at startup.
            </div>
        </div>

    </section>

    <section class="card">
        <div class="section-head">
            <div>
                <h2>Recent Water Quality Records</h2>
                <div class="small" style="margin-top:6px">
                    Latest entries received from ThingSpeak
                </div>
            </div>
            <div class="toolbar">
                <button onclick="refreshData()">⟳ Refresh Now</button>
            </div>
        </div>

        <div class="table-wrap">
            <table>
                <thead>
                    <tr>
                        <th>Time</th>
                        <th>pH</th>
                        <th>Turbidity</th>
                        <th>EC</th>
                        <th>Temperature</th>
                        <th>Quality</th>
                    </tr>
                </thead>
                <tbody id="historyTable">
                    <tr><td colspan="6">Waiting for ThingSpeak...</td></tr>
                </tbody>
            </table>
        </div>
    </section>

    <div class="small" id="errorText" style="margin-top:15px"></div>

</main>

<footer>
    SMART WATER QUALITY MONITORING SYSTEM · ESP32 + RANDOM FOREST<br>
    GOOD/BAD represents configured project thresholds, not certified
    drinking-water safety. Synthetic labels are not laboratory measurements.
</footer>

<div id="toast"></div>

<script>
let trendChart = null;
let lastEntryId = null;
let requestInProgress = false;

function el(id) {
    return document.getElementById(id);
}

function number(value, digits=2) {
    if (value === null || value === undefined || !Number.isFinite(Number(value))) {
        return "--";
    }
    return Number(value).toFixed(digits);
}

function setBar(id, value, maximum, colorClass) {
    const bar = el(id);
    const pct = Math.max(0, Math.min(100, (Number(value) / maximum) * 100));
    bar.style.width = pct + "%";
    bar.className = "range-fill " + colorClass;
}

function makeChart(history) {
    const rows = history.slice(-40);

    const labels = rows.map((r, i) => {
        if (r.created_at) {
            const d = new Date(r.created_at);
            if (!isNaN(d.getTime())) {
                return d.toLocaleTimeString([], {
                    hour: "2-digit", minute: "2-digit"
                });
            }
        }
        return "Reading " + (i + 1);
    });

    const data = {
        labels: labels,
        datasets: [
            {
                label: "pH",
                data: rows.map(r => r.ph),
                borderColor: "#36d9f7",
                backgroundColor: "#36d9f71b",
                yAxisID: "y",
                tension: .35,
                borderWidth: 2,
                pointRadius: 2,
                fill: false
            },
            {
                label: "Turbidity (NTU)",
                data: rows.map(r => r.turbidity),
                borderColor: "#27e0a3",
                backgroundColor: "#27e0a31b",
                yAxisID: "y1",
                tension: .35,
                borderWidth: 2,
                pointRadius: 2,
                fill: false
            },
            {
                label: "EC (µS/cm)",
                data: rows.map(r => r.ec),
                borderColor: "#ffb454",
                yAxisID: "y2",
                tension: .35,
                borderWidth: 2,
                pointRadius: 0,
                fill: false
            }
        ]
    };

    if (trendChart) {
        trendChart.data = data;
        trendChart.update("none");
        return;
    }

    trendChart = new Chart(el("trendChart"), {
        type: "line",
        data: data,
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: "index", intersect: false },
            plugins: {
                legend: {
                    labels: { color: "#c5d5e9", usePointStyle: true }
                }
            },
            scales: {
                x: {
                    ticks: { color: "#91a5bf", maxTicksLimit: 8 },
                    grid: { color: "#ffffff0a" }
                },
                y: {
                    type: "linear",
                    position: "left",
                    min: 0,
                    max: 14,
                    ticks: { color: "#36d9f7" },
                    grid: { color: "#ffffff0b" }
                },
                y1: {
                    type: "linear",
                    position: "right",
                    min: 0,
                    max: 100,
                    ticks: { color: "#27e0a3" },
                    grid: { drawOnChartArea: false }
                },
                y2: {
                    type: "linear",
                    display: false,
                    min: 0,
                    max: 2500
                }
            }
        }
    });
}

function showAlerts(data) {
    const items = [];

    if (data.ph < 5.5) {
        items.push(["🔴", "Low pH", "pH is below 5.5"]);
    } else if (data.ph > 8.5) {
        items.push(["🔴", "High pH", "pH is above 8.5"]);
    } else {
        items.push(["🟢", "pH within project limits",
            "Current pH: " + number(data.ph)]);
    }

    if (data.turbidity > 12) {
        items.push(["🔴", "High turbidity",
            number(data.turbidity) + " NTU exceeds the 12 NTU limit"]);
    } else {
        items.push(["🟢", "Turbidity within project limits",
            number(data.turbidity) + " NTU"]);
    }

    if (data.ec > 800) {
        items.push(["🔴", "High EC",
            number(data.ec, 1) + " µS/cm exceeds the 800 limit"]);
    } else {
        items.push(["🟢", "EC within project limits",
            number(data.ec, 1) + " µS/cm"]);
    }

    if (data.quality === "BAD") {
        items.unshift([
            "⚠️",
            "Water quality flagged BAD",
            "One or more configured thresholds are exceeded."
        ]);
    } else {
        items.unshift([
            "✅",
            "All configured thresholds satisfied",
            "This is a project-rule result, not a safety certification."
        ]);
    }

    el("alertList").innerHTML = items.map(item => `
        <div class="alert-item">
            <span class="alert-symbol">${item[0]}</span>
            <div>
                <div class="alert-message">${item[1]}</div>
                <div class="alert-description">${item[2]}</div>
            </div>
        </div>
    `).join("");
}

function renderLatest(data) {
    el("phValue").innerHTML =
        number(data.ph, 2) + '<span class="unit">pH</span>';

    el("turbValue").innerHTML =
        number(data.turbidity, 1) + '<span class="unit">NTU</span>';

    el("ecValue").innerHTML =
        number(data.ec, 1) + '<span class="unit">µS/cm</span>';

    el("tempValue").innerHTML =
        number(data.temperature, 1) + '<span class="unit">°C</span>';

    el("phState").textContent =
        (data.ph < 5.5 || data.ph > 8.5)
        ? "Outside configured limits" : "Within configured limits";

    el("turbState").textContent =
        data.turbidity > 12 ? "High turbidity alert" : "Within project limit";

    el("ecState").textContent =
        data.ec > 800 ? "High conductivity alert" : "Within project limit";

    setBar("phBar", data.ph, 14,
        (data.ph < 5.5 || data.ph > 8.5) ? "red-bg" : "cyan-bg");

    setBar("turbBar", data.turbidity, 100,
        data.turbidity > 12 ? "red-bg" : "green-bg");

    setBar("ecBar", data.ec, 2500,
        data.ec > 800 ? "red-bg" : "orange-bg");

    setBar("tempBar", data.temperature, 50, "orange-bg");

    const good = data.quality === "GOOD";

    el("qualityName").textContent = data.quality;
    el("qualityName").className =
        "quality-name " + (good ? "green" : "red");

    el("qualityCircle").textContent = good ? "✓" : "⚠";
    el("qualityCircle").style.borderColor =
        good ? "var(--green)" : "var(--red)";

    el("qualityCircle").style.color =
        good ? "var(--green)" : "var(--red)";

    el("qualityCircle").style.boxShadow =
        good ? "0 0 35px #27e0a322" : "0 0 35px #ff557733";

    el("qualityCaption").textContent =
        good ? "All configured thresholds satisfied"
             : "One or more configured thresholds exceeded";

    el("confidenceText").textContent =
        number(data.probability, 1) + "%";

    el("confidenceBar").style.width =
        Math.max(0, Math.min(100, Number(data.probability))) + "%";

    showAlerts(data);
}

function renderHistory(history) {
    el("historyCount").textContent = history.length + " records";

    const recent = history.slice(-12).reverse();

    if (!recent.length) {
        el("historyTable").innerHTML =
            '<tr><td colspan="6">No records available</td></tr>';
        return;
    }

    el("historyTable").innerHTML = recent.map(r => {
        let time = r.created_at || "--";
        const date = new Date(time);

        if (!isNaN(date.getTime())) {
            time = date.toLocaleString();
        }

        const good = r.quality === "GOOD";

        return `
            <tr>
                <td>${time}</td>
                <td>${number(r.ph)}</td>
                <td>${number(r.turbidity, 1)}</td>
                <td>${number(r.ec, 1)}</td>
                <td>${number(r.temperature, 1)} °C</td>
                <td>
                    <span class="pill ${good ? "pill-good" : "pill-bad"}">
                        ${r.quality}
                    </span>
                </td>
            </tr>
        `;
    }).join("");
}

async function refreshData() {
    if (requestInProgress) return;

    requestInProgress = true;

    try {
        const response = await fetch("/api/data", { cache: "no-store" });
        const data = await response.json();

        const connected = data.connection === "CONNECTED";

        el("connectionText").textContent =
            connected ? "THINGSPEAK CONNECTED" : data.connection;

        el("connectionBadge").style.color =
            connected ? "var(--green)" : "var(--red)";

        el("lastUpdate").textContent = data.last_update;

        el("modelAccuracy").textContent =
            number(data.model_accuracy, 2) + "%";

        el("sampleCount").textContent =
            Number(data.training_samples).toLocaleString();

        el("errorText").textContent = data.error
            ? "Connection issue: " + data.error
            : "";

        if (data.latest) {
            renderLatest(data.latest);

            if (lastEntryId !== data.latest.entry_id) {
                lastEntryId = data.latest.entry_id;
            }

            renderHistory(data.history || []);
            makeChart(data.history || []);
        } else if (data.error) {
            el("qualityName").textContent = "NO DATA";
            el("qualityCaption").textContent =
                "Check ThingSpeak connection and channel field mapping.";
        }
    } catch (error) {
        el("connectionText").textContent = "DASHBOARD ERROR";
        el("connectionBadge").style.color = "var(--red)";
        el("errorText").textContent = error.message;
    } finally {
        requestInProgress = false;
    }
}

async function retrainModel() {
    const button = el("retrainButton");
    button.disabled = true;
    button.textContent = "Training Random Forest...";

    el("retrainMessage").textContent =
        "Generating simulated samples and training the classifier.";

    try {
        const response = await fetch("/api/retrain", {
            method: "POST"
        });

        const result = await response.json();

        el("retrainMessage").textContent = result.message;

        el("toast").textContent = result.message;
        el("toast").style.display = "block";

        setTimeout(() => {
            el("toast").style.display = "none";
        }, 3500);

        await refreshData();
    } catch (error) {
        el("retrainMessage").textContent =
            "Training request failed: " + error.message;
    } finally {
        button.disabled = false;
        button.textContent = "↻ Retrain AI Model";
    }
}

refreshData();
setInterval(refreshData, 20000);
</script>

</body>
</html>
"""


# ================================================================
# START APPLICATION
# ================================================================

if __name__ == "__main__":

    print("\n============================================")
    print("SMART WATER QUALITY AI DASHBOARD")
    print("ThingSpeak channel:", CHANNEL_ID)
    print("Training Random Forest...")
    print("============================================\n")

    train_model()

    # Start only one background worker, even when Flask's debug
    # reloader is enabled. Debug is disabled below for that reason.
    worker = threading.Thread(
        target=background_worker,
        daemon=True
    )
    worker.start()

    print("\nDashboard URL: http://127.0.0.1:5000")
    print("Press CTRL+C to stop.\n")

    app.run(
        host="0.0.0.0",
        port=5000,
        debug=False,
        threaded=True
    )
