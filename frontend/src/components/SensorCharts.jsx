import React, { useState, useMemo } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
} from "recharts";
import { filterByRange, formatChartTime, parseTimestamp } from "../utils/helpers";

const RANGES = [
  { id: "1h",  label: "1h" },
  { id: "6h",  label: "6h" },
  { id: "24h", label: "24h" },
  { id: "all", label: "All" },
];

const SENSORS = [
  { id: "ph",          label: "pH",          color: "#176B68", unit: "pH",    domain: [0, 14] },
  { id: "turbidity",   label: "Turbidity",   color: "#B7791F", unit: "NTU",   domain: [0, "auto"] },
  { id: "ec",          label: "EC",          color: "#3B8C87", unit: "µS/cm", domain: [0, "auto"] },
  { id: "temperature", label: "Temperature", color: "#C05621", unit: "°C",    domain: [0, "auto"] },
];

const SENSOR_MAP = Object.fromEntries(SENSORS.map(s => [s.id, s]));

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload || !payload.length) return null;
  return (
    <div style={{
      background: "var(--surface)",
      border: "1px solid var(--border)",
      borderRadius: 8,
      padding: "10px 14px",
      fontSize: 12,
      boxShadow: "var(--shadow-md)",
    }}>
      <div style={{ color: "var(--text-muted)", marginBottom: 6, fontSize: 11 }}>{label}</div>
      {payload.map(p => {
        const cfg = SENSOR_MAP[p.dataKey];
        const unit = cfg ? cfg.unit : "";
        return (
          <div key={p.dataKey} style={{ color: p.color, display: "flex", justifyContent: "space-between", gap: 20 }}>
            <span style={{ color: "var(--text-secondary)" }}>{cfg ? cfg.label : p.name}</span>
            <b>{p.value !== null && p.value !== undefined ? `${Number(p.value).toFixed(2)} ${unit}` : "--"}</b>
          </div>
        );
      })}
    </div>
  );
}

/**
 * Parse and clean history into chart-ready records.
 * Returns records sorted chronologically, with only finite numeric values.
 * Invalid individual readings are set to null so recharts gaps them correctly.
 * Never substitutes missing readings with zero.
 */
function buildChartData(history) {
  if (!history || !history.length) return [];
  return history
    .map(r => {
      const d = parseTimestamp(r.created_at);
      if (!d) return null;
      const toNum = v => {
        if (v === null || v === undefined) return null;
        const n = Number(v);
        return Number.isFinite(n) ? n : null;
      };
      return {
        _ts:         d.getTime(),
        time:        formatChartTime(r.created_at),
        ph:          toNum(r.ph),
        turbidity:   toNum(r.turbidity),
        ec:          toNum(r.ec),
        temperature: toNum(r.temperature),
      };
    })
    .filter(Boolean)
    .sort((a, b) => a._ts - b._ts);
}

const GRID_STROKE = "var(--border)";
const TICK_STYLE  = { fill: "var(--text-muted)", fontSize: 10 };

export default function SensorCharts({ history, thresholds, loading }) {
  const [range, setRange]   = useState("all");
  const [active, setActive] = useState("ph");

  const filtered = useMemo(() => filterByRange(history || [], range), [history, range]);
  const chartData = useMemo(() => buildChartData(filtered), [filtered]);

  const cfg = SENSOR_MAP[active];

  if (loading) {
    return (
      <div className="card">
        <div className="skeleton skeleton-h" style={{ width: "40%", marginBottom: 10 }} />
        <div className="skeleton skeleton-block" style={{ height: 220 }} />
      </div>
    );
  }

  return (
    <div className="card">
      <div className="card-header">
        <div>
          <div className="card-title">
            <span>📈</span> Sensor Trends
          </div>
          <div className="card-subtitle">
            {chartData.length > 0
              ? `${chartData.length} reading${chartData.length !== 1 ? "s" : ""} · ${range === "all" ? "all available data" : range}`
              : "No data in selected range"}
          </div>
        </div>
        <div className="chart-controls">
          {RANGES.map(r => (
            <button
              key={r.id}
              className={`range-btn${range === r.id ? " active" : ""}`}
              onClick={() => setRange(r.id)}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      <div className="chart-tabs">
        {SENSORS.map(s => (
          <button
            key={s.id}
            className={`chart-tab${active === s.id ? " active" : ""}`}
            onClick={() => setActive(s.id)}
          >
            {s.label}
          </button>
        ))}
      </div>

      {!chartData.length ? (
        <div className="chart-empty">
          <span style={{ fontSize: 28, opacity: 0.5 }}>📉</span>
          <span>No historical readings available for this period.</span>
          <span style={{ fontSize: 11 }}>Try selecting a wider time range, or check that the backend is receiving sensor data.</span>
        </div>
      ) : (
        <SingleChart
          data={chartData}
          cfg={cfg}
          thresholds={thresholds}
        />
      )}
    </div>
  );
}

function SingleChart({ data, cfg, thresholds }) {
  // Build reference lines only for sensors with configured thresholds
  const refs = [];
  if (thresholds && cfg) {
    if (cfg.id === "ph") {
      if (thresholds.ph_low != null)
        refs.push({ y: thresholds.ph_low, label: `Low (${thresholds.ph_low})` });
      if (thresholds.ph_high != null)
        refs.push({ y: thresholds.ph_high, label: `High (${thresholds.ph_high})` });
    } else if (cfg.id === "turbidity" && thresholds.turbidity != null) {
      refs.push({ y: thresholds.turbidity, label: `Limit (${thresholds.turbidity} NTU)` });
    } else if (cfg.id === "ec" && thresholds.ec != null) {
      refs.push({ y: thresholds.ec, label: `Limit (${thresholds.ec} µS/cm)` });
    }
  }

  // Determine domain: for non-ph sensors let recharts auto-size with a floor at 0
  const domain = cfg.id === "ph" ? [0, 14] : [
    dataMin => Math.max(0, Math.floor(dataMin * 0.9)),
    dataMax => Math.ceil(dataMax * 1.1),
  ];

  return (
    <div className="chart-wrap">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 14, bottom: 0, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} strokeOpacity={0.5} />
          <XAxis
            dataKey="time"
            tick={TICK_STYLE}
            tickLine={false}
            axisLine={false}
            interval="preserveStartEnd"
            minTickGap={40}
          />
          <YAxis
            domain={domain}
            tick={TICK_STYLE}
            tickLine={false}
            axisLine={false}
            width={42}
            tickFormatter={v => `${v}`}
            label={{
              value: cfg.unit,
              angle: -90,
              position: "insideLeft",
              offset: 8,
              style: { fill: "var(--text-muted)", fontSize: 10 },
            }}
          />
          <Tooltip content={<CustomTooltip />} />

          {refs.map(r => (
            <ReferenceLine
              key={r.y}
              y={r.y}
              stroke={cfg.color}
              strokeDasharray="5 3"
              strokeOpacity={0.65}
              label={{ value: r.label, fill: cfg.color, fontSize: 9, position: "insideTopRight" }}
            />
          ))}

          <Line
            type="monotone"
            dataKey={cfg.id}
            stroke={cfg.color}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, strokeWidth: 0 }}
            name={cfg.label}
            connectNulls={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
