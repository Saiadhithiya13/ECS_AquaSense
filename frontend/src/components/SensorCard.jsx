import React, { useMemo } from "react";
import {
  fmt,
  phStatus, turbidityStatus, ecStatus, temperatureStatus,
  clamp, formatTimestamp
} from "../utils/helpers";

/** Tiny sparkline using SVG */
function Sparkline({ data, color }) {
  if (!data || data.length < 2) return null;
  const w = 100, h = 36;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * w;
    const y = h - ((v - min) / range) * (h - 4) - 2;
    return `${x},${y}`;
  });
  return (
    <svg viewBox={`0 0 ${w} ${h}`} width="100%" height={h} preserveAspectRatio="none" aria-hidden="true">
      <polyline points={pts.join(" ")} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  );
}

const SENSOR_CONFIG = {
  ph: {
    label: "pH Level",
    icon: "🧪",
    iconBg: "rgba(34,211,238,0.12)",
    unit: "pH",
    sparkColor: "#22d3ee",
    getStatus: (v, t) => phStatus(v, t),
    getPercent: (v) => clamp((v / 14) * 100, 0, 100),
    rangeText: (t) => `${t.ph_low} – ${t.ph_high} pH`,
  },
  turbidity: {
    label: "Turbidity",
    icon: "🌊",
    iconBg: "rgba(16,185,129,0.12)",
    unit: "NTU",
    sparkColor: "#10b981",
    getStatus: (v, t) => turbidityStatus(v, t),
    getPercent: (v) => clamp((v / 100) * 100, 0, 100),
    rangeText: (t) => `Limit: ${t.turbidity} NTU`,
  },
  ec: {
    label: "Electrical Conductivity",
    icon: "⚡",
    iconBg: "rgba(245,158,11,0.12)",
    unit: "µS/cm",
    sparkColor: "#f59e0b",
    getStatus: (v, t) => ecStatus(v, t),
    getPercent: (v) => clamp((v / 2500) * 100, 0, 100),
    rangeText: (t) => `Limit: ${t.ec} µS/cm`,
  },
  temperature: {
    label: "Temperature",
    icon: "🌡️",
    iconBg: "rgba(239,68,68,0.12)",
    unit: "°C",
    sparkColor: "#ef4444",
    getStatus: () => temperatureStatus(),
    getPercent: (v) => clamp(((v - 0) / 55) * 100, 0, 100),
    rangeText: () => "No alarm configured",
  },
};

const STATUS_LABELS = {
  normal: "Normal",
  warning: "Warning",
  critical: "Critical",
  unknown: "No data",
};

function SensorCard({ sensorKey, latest, history, thresholds }) {
  const cfg = SENSOR_CONFIG[sensorKey];
  const value = latest ? latest[sensorKey] : null;
  const status = thresholds ? cfg.getStatus(value, thresholds) : "unknown";
  const pct = value !== null ? cfg.getPercent(value) : 0;

  // Previous reading for delta
  const prev = history && history.length >= 2
    ? history[history.length - 2][sensorKey]
    : null;
  const delta = value !== null && prev !== null ? value - prev : null;

  // Sparkline: last 15 values
  const sparkData = useMemo(() => {
    if (!history || !history.length) return [];
    return history.slice(-15).map(r => r[sensorKey]).filter(v => v !== null && isFinite(v));
  }, [history, sensorKey]);

  const timestamp = latest ? formatTimestamp(latest.created_at) : null;

  return (
    <div
      className={`sensor-card status-${status}`}
      role="region"
      aria-label={`${cfg.label} sensor card`}
    >
      <div className="sensor-card-top">
        <span className="sensor-label">{cfg.label}</span>
        <div className="sensor-icon-wrap" style={{ background: cfg.iconBg }} aria-hidden="true">
          {cfg.icon}
        </div>
      </div>

      <div>
        <div className="sensor-value-row">
          <span className={`sensor-value`} style={{ color: status === "critical" ? "var(--red)" : status === "warning" ? "var(--amber)" : "var(--text)" }}>
            {value !== null ? fmt(value, sensorKey === "ph" ? 2 : 1) : "--"}
          </span>
          <span className="sensor-unit">{cfg.unit}</span>
        </div>

        <div className="flex items-center gap-2 mt-1" style={{ flexWrap: "wrap" }}>
          <span className={`sensor-badge ${status}`}>{STATUS_LABELS[status]}</span>
          {delta !== null && (
            <span className={`sensor-change ${delta > 0.01 ? "up" : delta < -0.01 ? "down" : "flat"}`}>
              {delta > 0.01 ? "▲" : delta < -0.01 ? "▼" : "–"}
              {Math.abs(delta) < 0.01 ? " stable" : ` ${Math.abs(delta).toFixed(2)}`}
            </span>
          )}
        </div>
      </div>

      <div className="sensor-progress" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
        <div
          className={`sensor-progress-fill ${status === "unknown" ? "normal" : status}`}
          style={{ width: `${pct}%` }}
        />
      </div>

      <div className="sparkline-wrap">
        <Sparkline data={sparkData} color={cfg.sparkColor} />
      </div>

      <div className="sensor-meta">
        <div>{cfg.rangeText(thresholds || { ph_low: 5.5, ph_high: 8.5, turbidity: 12, ec: 800 })}</div>
        {timestamp && <div style={{ marginTop: 2 }}>Last: {timestamp}</div>}
      </div>
    </div>
  );
}

export default function SensorCards({ latest, history, thresholds, loading }) {
  const keys = ["ph", "turbidity", "ec", "temperature"];

  if (loading) {
    return (
      <div className="sensor-grid">
        {keys.map(k => (
          <div key={k} className="sensor-card">
            <div className="skeleton skeleton-h lg" style={{ width: "60%", marginBottom: 12 }} />
            <div className="skeleton skeleton-h" style={{ width: "80%" }} />
            <div className="skeleton skeleton-h sm" style={{ width: "50%" }} />
            <div className="skeleton" style={{ height: 4, borderRadius: 4 }} />
            <div className="skeleton skeleton-block" style={{ height: 36 }} />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="sensor-grid">
      {keys.map(k => (
        <SensorCard
          key={k}
          sensorKey={k}
          latest={latest}
          history={history}
          thresholds={thresholds}
        />
      ))}
    </div>
  );
}
