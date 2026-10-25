
# ================================================================
# SMART WATER QUALITY MONITORING + RANDOM FOREST AI
# ESP32 + THINGSPEAK + FLASK + REACT FRONTEND
#
# ThingSpeak Field Mapping:
#   Field 1 = pH
#   Field 2 = Turbidity (NTU)
#   Field 3 = EC (uS/cm)
#   Field 4 = Temperature (C)
#
# Features:
#   - Live ThingSpeak sensor data
#   - Simulated dataset for Random Forest training
#   - GOOD / BAD classification
#   - Sensor threshold alerts
#   - Live data history
#   - Auto-refresh every 20 seconds
#   - Manual model retraining
#   - Flask-CORS for React frontend
#   - /api/health endpoint
# ================================================================

import os
import logging
import threading
from datetime import datetime, timezone

import sqlite3
import requests
import numpy as np
import pandas as pd

from flask import Flask, jsonify, request
from flask_cors import CORS
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score
from dotenv import load_dotenv

# ================================================================
# LOGGING
# ================================================================

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s"
)
logger = logging.getLogger(__name__)

# ================================================================
# LOAD ENVIRONMENT VARIABLES
# ================================================================

load_dotenv()

# ================================================================
# CONFIGURATION (env overrides, fallback to original values)
# ================================================================

app = Flask(__name__)

# Allow React dev server and any configured production origin.
# VITE_API_BASE_URL is intentionally NOT set here; origins are a
# backend concern and must not be placed in VITE_ variables.
ALLOWED_ORIGINS = os.getenv(
    "CORS_ORIGINS",
    "http://localhost:5173,http://127.0.0.1:5173,http://localhost:3000"
).split(",")

CORS(app, resources={r"/api/*": {"origins": ALLOWED_ORIGINS}})

CHANNEL_ID = os.getenv("THINGSPEAK_CHANNEL_ID", "178785")

# For a PRIVATE channel supply the read key via environment variable.
# For a PUBLIC channel leave this empty.
# NEVER use the ESP32 write key here.
READ_API_KEY = os.getenv("THINGSPEAK_READ_API_KEY", "IHR6TD7MP82Z3UZR")

THINGSPEAK_URL = (
    f"https://api.thingspeak.com/channels/{CHANNEL_ID}/feeds.json"
)

REFRESH_SECONDS = int(os.getenv("REFRESH_SECONDS", "20"))
HISTORY_COUNT = int(os.getenv("HISTORY_COUNT", "100"))
TRAINING_SAMPLES = int(os.getenv("TRAINING_SAMPLES", "6000"))

# Thresholds from the ESP32 sketch — kept as project defaults.
PH_LOW = float(os.getenv("PH_LOW", "5.5"))
PH_HIGH = float(os.getenv("PH_HIGH", "8.5"))
TURBIDITY_LIMIT = float(os.getenv("TURBIDITY_LIMIT", "12.0"))
EC_LIMIT = float(os.getenv("EC_LIMIT", "800.0"))

# Model features (must match ThingSpeak field order)
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
thingspeak_last_success = None   # datetime of last successful fetch

data_lock = threading.Lock()

# ================================================================
# SQLITE PERSISTENT STORAGE
# ================================================================

DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "water_quality.db")

def init_db():
    """Initialize local SQLite database table for persistent reading storage."""
    try:
        with sqlite3.connect(DB_PATH) as conn:
            cursor = conn.cursor()
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS readings (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    timestamp TEXT NOT NULL,
                    ph REAL NOT NULL,
                    turbidity REAL NOT NULL,
                    ec REAL NOT NULL,
                    temperature REAL NOT NULL,
                    quality TEXT NOT NULL,
                    ml_prediction TEXT NOT NULL,
                    probability REAL NOT NULL,
                    reasons TEXT NOT NULL,
                    source TEXT DEFAULT 'esp32'
                )
            """)
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_readings_timestamp ON readings(timestamp)")
            conn.commit()
        logger.info("SQLite database initialized at: %s", DB_PATH)
    except Exception as exc:
        logger.error("Failed to initialize SQLite database: %s", exc)


def save_reading_to_db(ph, turbidity, ec, temperature, quality, ml_prediction, probability, reasons, source="esp32", timestamp=None):
    """Insert a single sensor record into the SQLite database."""
    if timestamp is None:
        timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    reasons_str = "; ".join(reasons) if isinstance(reasons, list) else str(reasons)
    try:
        with sqlite3.connect(DB_PATH) as conn:
            cursor = conn.cursor()
            cursor.execute("""
                INSERT INTO readings (timestamp, ph, turbidity, ec, temperature, quality, ml_prediction, probability, reasons, source)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (timestamp, float(ph), float(turbidity), float(ec), float(temperature), quality, ml_prediction, float(probability), reasons_str, source))
            conn.commit()
            return cursor.lastrowid
    except Exception as exc:
        logger.error("Failed to save reading to SQLite: %s", exc)
        return None


def get_recent_readings(limit=100):
    """Retrieve recent readings from SQLite in chronological order."""
    try:
        with sqlite3.connect(DB_PATH) as conn:
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()
            cursor.execute("""
                SELECT id, timestamp, ph, turbidity, ec, temperature, quality, ml_prediction, probability, reasons, source
                FROM readings
                ORDER BY id DESC
                LIMIT ?
            """, (limit,))
            rows = cursor.fetchall()
            result = []
            for r in reversed(rows):
                result.append({
                    "entry_id": r["id"],
                    "created_at": r["timestamp"],
                    "ph": round(r["ph"], 2),
                    "turbidity": round(r["turbidity"], 2),
                    "ec": round(r["ec"], 2),
                    "temperature": round(r["temperature"], 2),
                    "quality": r["quality"],
                    "ml_prediction": r["ml_prediction"],
                    "probability": round(r["probability"], 1),
                    "reasons": r["reasons"].split("; ") if r["reasons"] else [],
                    "source": r["source"]
                })
            return result
    except Exception as exc:
        logger.error("Failed to read history from SQLite: %s", exc)
        return []


# ================================================================
# WATER QUALITY RULES
# ================================================================

def classify_by_threshold(ph, turbidity, ec):
    """
    Final classification based on the same alarm limits used by the
    ESP32 firmware.  GOOD means all three parameters are within the
    configured project thresholds.
    """

    bad_reasons = []

    if ph < PH_LOW:
        bad_reasons.append(f"pH {ph:.2f} is below the low limit ({PH_LOW})")

    if ph > PH_HIGH:
        bad_reasons.append(f"pH {ph:.2f} is above the high limit ({PH_HIGH})")

    if turbidity > TURBIDITY_LIMIT:
        bad_reasons.append(
            f"Turbidity {turbidity:.1f} NTU exceeds limit ({TURBIDITY_LIMIT} NTU)"
        )

    if ec > EC_LIMIT:
        bad_reasons.append(
            f"EC {ec:.1f} µS/cm exceeds limit ({EC_LIMIT} µS/cm)"
        )

    if bad_reasons:
        return 0, bad_reasons

    return 1, ["All configured thresholds satisfied"]


# ================================================================
# SIMULATED DATASET
# ================================================================

def generate_dataset(samples=TRAINING_SAMPLES):
    """
    Generate synthetic readings and assign labels using the
    threshold-based rules.  These are simulated training records,
    not real sensor measurements.
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

    logger.info("Generating synthetic dataset (%d samples)…", TRAINING_SAMPLES)

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

    accuracy = accuracy_score(y_test, rf.predict(X_test))

    with data_lock:
        model = rf
        model_accuracy = float(accuracy)
        training_samples = len(df)

    logger.info(
        "Random Forest trained — samples: %d  test-accuracy: %.2f%%",
        len(df),
        accuracy * 100,
    )


# ================================================================
# PREDICTION
# ================================================================

def predict_quality(ph, turbidity, ec, temperature):
    with data_lock:
        current_model = model

    if current_model is None:
        return {
            "quality": "MODEL NOT READY",
            "ml_prediction": "UNKNOWN",
            "probability": 0.0,
            "reasons": ["Model has not been trained yet"]
        }

    values = [ph, turbidity, ec, temperature]

    if not all(np.isfinite(v) for v in values):
        return {
            "quality": "INVALID DATA",
            "ml_prediction": "UNKNOWN",
            "probability": 0.0,
            "reasons": ["One or more sensor values are non-finite"]
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

    # Always keep the displayed result consistent with the project's
    # configured alarm limits (same logic the ESP32 uses).
    rule_label, reasons = classify_by_threshold(ph, turbidity, ec)

    quality = "GOOD" if rule_label == 1 else "BAD"

    if prediction != rule_label:
        reasons.append(
            "Note: ML model prediction differs from threshold rule result"
        )

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
    global last_update, connection_status, last_error, thingspeak_last_success

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
                raw_ph   = feed.get("field1")
                raw_turb = feed.get("field2")
                raw_ec   = feed.get("field3")
                raw_temp = feed.get("field4")

                # Skip incomplete entries
                if any(v is None for v in [raw_ph, raw_turb, raw_ec, raw_temp]):
                    continue

                ph          = float(raw_ph)
                turbidity   = float(raw_turb)
                ec          = float(raw_ec)
                temperature = float(raw_temp)

                values = [ph, turbidity, ec, temperature]

                if not all(np.isfinite(v) for v in values):
                    continue

                result = predict_quality(ph, turbidity, ec, temperature)

                parsed_history.append({
                    "created_at":   feed.get("created_at", ""),
                    "entry_id":     feed.get("entry_id"),
                    "ph":           round(ph, 2),
                    "turbidity":    round(turbidity, 2),
                    "ec":           round(ec, 2),
                    "temperature":  round(temperature, 2),
                    "quality":      result["quality"],
                    "ml_prediction": result.get("ml_prediction", ""),
                    "probability":  result["probability"],
                    "reasons":      result["reasons"]
                })

            except (KeyError, TypeError, ValueError) as exc:
                logger.debug("Skipping malformed feed entry: %s", exc)
                continue

        if not parsed_history:
            raise ValueError(
                "No complete numeric records found in fields 1-4."
            )

        newest = parsed_history[-1]

        with data_lock:
            history_data = parsed_history
            latest_data  = newest
            connection_status = "CONNECTED"
            last_update = datetime.now().strftime("%d-%m-%Y %H:%M:%S")
            thingspeak_last_success = datetime.now(timezone.utc).isoformat()
            last_error  = ""

        logger.info(
            "ThingSpeak OK — %d valid records, latest entry_id=%s",
            len(parsed_history),
            newest.get("entry_id"),
        )

        return True

    except Exception as exc:
        with data_lock:
            connection_status = "ERROR"
            last_error = str(exc)

        logger.error("ThingSpeak fetch failed: %s", exc)
        return False


# ================================================================
# FLASK ROUTES
# ================================================================

@app.route("/")
def index():
    return jsonify({
        "status": "AquaSense API is running",
        "endpoints": ["/api/data", "/api/reading", "/api/retrain", "/api/health"],
        "storage": "SQLite (water_quality.db)"
    })


@app.route("/api/reading", methods=["POST"])
def api_receive_reading():
    """
    Receive sensor telemetry directly from ESP32 every 30 seconds.
    Evaluates ML + threshold quality, stores in local SQLite, and updates live state.
    """
    global latest_data, history_data, connection_status, last_update, last_error
    payload = request.get_json(silent=True) or request.form.to_dict()
    if not payload:
        return jsonify({"success": False, "error": "Invalid JSON or form body"}), 400

    try:
        ph = float(payload.get("ph"))
        turbidity = float(payload.get("turbidity"))
        ec = float(payload.get("ec"))
        temperature = float(payload.get("temperature"))
    except (TypeError, ValueError) as err:
        return jsonify({"success": False, "error": f"Invalid sensor readings: {err}"}), 400

    result = predict_quality(ph, turbidity, ec, temperature)
    now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    db_id = save_reading_to_db(
        ph=round(ph, 2),
        turbidity=round(turbidity, 2),
        ec=round(ec, 2),
        temperature=round(temperature, 2),
        quality=result["quality"],
        ml_prediction=result.get("ml_prediction", ""),
        probability=result["probability"],
        reasons=result["reasons"],
        source="esp32_direct",
        timestamp=now_str
    )

    reading_obj = {
        "entry_id": db_id,
        "created_at": now_str,
        "ph": round(ph, 2),
        "turbidity": round(turbidity, 2),
        "ec": round(ec, 2),
        "temperature": round(temperature, 2),
        "quality": result["quality"],
        "ml_prediction": result.get("ml_prediction", ""),
        "probability": result["probability"],
        "reasons": result["reasons"],
        "source": "esp32_direct"
    }

    with data_lock:
        latest_data = reading_obj
        history_data = get_recent_readings(HISTORY_COUNT)
        connection_status = "CONNECTED"
        last_update = datetime.now().strftime("%d-%m-%Y %H:%M:%S")
        last_error = ""

    logger.info("Direct ESP32 reading stored in SQLite [ID: %s] — pH: %.2f, Tu: %.2f, EC: %.2f, Temp: %.2f -> %s",
                db_id, ph, turbidity, ec, temperature, result["quality"])

    return jsonify({
        "success": True,
        "id": db_id,
        "quality": result["quality"],
        "ml_prediction": result.get("ml_prediction", ""),
        "probability": result["probability"],
        "reasons": result["reasons"]
    }), 201


@app.route("/api/data")
def api_data():
    """
    Return the latest sensor reading, full history from SQLite, ML model info,
    and configured thresholds. Serves from SQLite persistent store immediately.
    """
    with data_lock:
        db_history = get_recent_readings(HISTORY_COUNT)
        history = db_history if db_history else [row.copy() for row in history_data]
        latest = latest_data.copy() if latest_data else (history[-1].copy() if history else None)
        status  = connection_status
        updated = last_update
        error   = last_error
        accuracy = model_accuracy
        count   = training_samples
        ts_last = thingspeak_last_success

    return jsonify({
        "latest":           latest,
        "history":          history,
        "connection":       status,
        "last_update":      updated,
        "thingspeak_last_success": ts_last,
        "error":            error,
        "model_accuracy":   round(accuracy * 100, 2),
        "training_samples": count,
        "model_name":       "Random Forest Classifier",
        "storage":          "SQLite (local file)",
        "model_note": (
            "Trained on synthetic data generated from configured thresholds. "
            "Reported accuracy reflects simulated — not real-world — performance."
        ),
        "thresholds": {
            "ph_low":    PH_LOW,
            "ph_high":   PH_HIGH,
            "turbidity": TURBIDITY_LIMIT,
            "ec":        EC_LIMIT
        }
    })


@app.route("/api/retrain", methods=["POST"])
def api_retrain():
    """Retrain the Random Forest on a freshly generated synthetic dataset."""
    try:
        train_model()

        with data_lock:
            has_data = latest_data is not None

        if has_data:
            fetch_thingspeak()

        with data_lock:
            accuracy = model_accuracy
            count    = training_samples

        return jsonify({
            "success":          True,
            "message":          "Random Forest model retrained successfully.",
            "model_accuracy":   round(accuracy * 100, 2),
            "training_samples": count
        })

    except Exception as exc:
        logger.exception("Retrain failed")
        return jsonify({
            "success": False,
            "message": str(exc)
        }), 500


@app.route("/api/health")
def api_health():
    """
    Lightweight health check.  Returns backend status, model readiness,
    and ThingSpeak data freshness without exposing credentials.
    """
    with data_lock:
        has_model   = model is not None
        has_data    = latest_data is not None
        conn_status = connection_status
        ts_last     = thingspeak_last_success
        last_entry  = latest_data.get("created_at") if latest_data else None

    # Data freshness: warn if the last successful fetch was > 5 minutes ago
    data_fresh = False
    if ts_last:
        try:
            last_dt = datetime.fromisoformat(ts_last)
            delta   = (datetime.now(timezone.utc) - last_dt).total_seconds()
            data_fresh = delta < 300   # 5-minute window
        except ValueError:
            pass

    return jsonify({
        "backend":          "ok",
        "model_ready":      has_model,
        "thingspeak_status": conn_status,
        "data_available":   has_data,
        "data_fresh":       data_fresh,
        "last_sensor_entry": last_entry,
        "thingspeak_last_success": ts_last,
        "channel_id":       CHANNEL_ID
    })


# ================================================================
# BACKGROUND SENSOR REFRESH
# ================================================================

def background_worker():
    while True:
        fetch_thingspeak()
        threading.Event().wait(REFRESH_SECONDS)


# ================================================================
# START APPLICATION
# ================================================================

if __name__ == "__main__":

    logger.info("=" * 48)
    logger.info("AQUASENSE — SMART WATER QUALITY AI DASHBOARD")
    logger.info("ThingSpeak channel : %s", CHANNEL_ID)
    logger.info("CORS origins       : %s", ALLOWED_ORIGINS)
    logger.info("Training Random Forest…")
    logger.info("=" * 48)

    train_model()
    init_db()

    # Pre-populate state from SQLite history if available
    db_records = get_recent_readings(HISTORY_COUNT)
    if db_records:
        with data_lock:
            history_data = db_records
            latest_data = db_records[-1]
            last_update = db_records[-1].get("created_at", last_update)
            connection_status = "CONNECTED"
        logger.info("Loaded %d historical readings from SQLite.", len(db_records))

    # Start background ThingSpeak worker (optional cloud backup)
    worker = threading.Thread(target=background_worker, daemon=True)
    worker.start()

    logger.info("API base URL: http://0.0.0.0:%s", os.getenv("PORT", "5000"))
    logger.info("ESP32 Direct Post URL: http://<your-pc-ip>:%s/api/reading", os.getenv("PORT", "5000"))
    logger.info("SQLite Database: %s", DB_PATH)
    logger.info("Press CTRL+C to stop.")

    app.run(
        host="0.0.0.0",
        port=int(os.getenv("PORT", "5000")),
        debug=False,
        threaded=True
    )
