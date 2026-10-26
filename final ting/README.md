# AquaTrace - Smart Water Quality Monitoring System

A full-stack, IoT-enabled water quality monitoring platform with real-time sensor analytics, Random Forest machine learning classification, and responsive web dashboard.

---

## 🌊 Architecture Overview

```
                          ┌────────────────────────┐
                          │   ESP32 Microcontroller │
                          │  (pH, Turbidity, EC,   │
                          │   DS18B20 Temp Sensors) │
                          └───────────┬────────────┘
                                      │  HTTP POST (every 30s)
                                      ▼
                          ┌────────────────────────┐
                          │   Flask Python API     │
                          │  (ML Classifier, Rules)│
                          └─────┬────────────┬─────┘
                                │            │
                 Saves to Disk  ▼            ▼  REST API / CORS
        ┌────────────────────────┐   ┌────────────────────────┐
        │   SQLite Local File    │   │  React + Vite Frontend │
        │  (water_quality.db)    │   │  (Charts, Gauges, Real-│
        │  Persistent History    │   │   time Diagnostics)    │
        └────────────────────────┘   └────────────────────────┘
```

---

## 📁 Repository Structure

```
ECS_Website/
├── backend/                  # Flask REST API & Machine Learning engine
│   ├── app.py                # Core Flask app, ML classifier, and background worker
│   ├── requirements.txt      # Python dependencies
│   └── .env.example          # Environment variable template
├── frontend/                 # Modern React 19 + Vite dashboard
│   ├── src/
│   │   ├── components/       # UI Components (SensorCard, Charts, WaterDiagnostics, Alerts, MLInsights)
│   │   ├── pages/            # Dashboard & Settings views
│   │   ├── services/         # Centralized API service
│   │   ├── hooks/            # Custom hooks (useAquaData)
│   │   ├── utils/            # Helper formatting, status checks & demo data
│   │   └── styles/           # Design system tokens and styling
│   ├── package.json          # Frontend dependencies (Lucide icons, Recharts)
│   └── vite.config.js        # Vite build configuration with proxy
├── firmware/                 # Microcontroller code
│   └── water_quality.ino     # ESP32 Arduino sketch with LCD & sensor drivers
├── app.py                    # Standalone legacy single-file dashboard (reference)
└── water_quality.ino         # Root firmware copy
```

---

## 🚀 Quick Start Guide

### 1. Start the Flask Backend

```bash
cd backend

# Create a virtual environment (recommended)
python -m venv venv
venv\Scripts\activate      # Windows
# source venv/bin/activate  # macOS/Linux

# Install requirements
pip install -r requirements.txt

# Run the backend
python app.py
```
*The backend starts at `http://127.0.0.1:5000` and automatically trains the Random Forest model upon startup.*

### 2. Start the Frontend Dashboard

```bash
cd frontend

# Install Node modules (if not already installed)
npm install

# Start Vite development server
npm run dev
```
*Open `http://localhost:5173` in your browser. The dashboard connects to the backend automatically.*

---

## 🧪 Demo Mode

If you don't have hardware sensors or active ThingSpeak data connected yet:
- Click the **"Demo Mode"** toggle in the top-right header of the dashboard.
- The interface immediately switches to realistic simulated data streams with sparklines, interactive historical charts, threshold evaluations, and alerts.

---

## ⚙️ Sensor & Threshold Configuration

| Sensor | ThingSpeak Field | Default Safe Range | Alarm Condition |
| :--- | :--- | :--- | :--- |
| **pH** | Field 1 | 5.5 – 8.5 | < 5.5 (Acidic) or > 8.5 (Alkaline) |
| **Turbidity** | Field 2 | 0 – 12 NTU | > 12 NTU (High suspended solids) |
| **EC (Conductivity)** | Field 3 | 0 – 800 µS/cm | > 800 µS/cm (High salinity / ions) |
| **Temperature** | Field 4 | Ambient / 10 – 35 °C | Informational (affects EC compensation) |

---

## 🤖 Machine Learning Integration

- **Classifier:** Scikit-Learn `RandomForestClassifier` (160 estimators, balanced class weights).
- **Dual Verification:** The dashboard explicitly separates **Threshold Alarm Rules** (strict safety boundaries) from **ML Predictions** (predictive classification).
- **On-Demand Retraining:** Trigger the `/api/retrain` endpoint directly from the ML Insights card in the UI.

---

## 📡 Hardware & Firmware Setup (ESP32)

1. Open `firmware/water_quality.ino` in the Arduino IDE.
2. Install required libraries via Library Manager:
   - `ThingSpeak` by MathWorks
   - `LiquidCrystal_I2C` by Frank de Brabander
   - `OneWire` by Paul Stoffregen
   - `DallasTemperature` by Miles Burton
3. Configure your Wi-Fi credentials (`ssid` and `password`) and ThingSpeak Channel/API Keys.
4. Select `ESP32 Dev Module` and flash to your device.
