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
  Legend,
} from "recharts";
import { filterByRange, formatChartTime } from "../utils/helpers";

const RANGES = [
  { id: "1h",  label: "1 Hour" },
  { id: "6h",  label: "6 Hours" },
  { id: "24h", label: "24 Hours" },
  { id: "all", label: "All Data" },
];

const SENSORS = [
  {
    id: "combined",
    label: "Combined",
    keys: ["ph", "turbidity", "ec", "temperature"],
  },
  { id: "ph",          label: "pH" },
  { id: "turbidity",   label: "Turbidity" },
  { id: "ec",          label: "EC" },
  { id: "temperature", label: "Temperature" },
];

const COLORS = {
  ph:          "#22d3ee",
  turbidity:   "#10b981",
  ec:          "#f59e0b",
  temperature: "#ef4444",
};

const UNITS = {
  ph:          "pH",
  turbidity:   "NTU",
  ec:          "µS/cm",
  temperature: "°C",
};

const Y_DOMAINS = {
  ph:          [0, 14],
  turbidity:   [0, 100],
  ec:          [0, 2500],
  temperature: [0, 55],
};

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload || !payload.length) return null;
  return (
    <div style={{
      background: "var(--surface2)", border: "1px solid var(--border)",
      borderRadius: 10, padding: "10px 14px", fontSize: 12,
    }}>
      <div style={{ color: "var(--text-muted)", marginBottom: 6 }}>{label}</div>
      {payload.map(p => (
        <div key={p.dataKey} style={{ color: p.color, display: "flex", justifyContent: "space-between", gap: 16 }}>
          <span>{p.name}</span>
          <b>{p.value !== null && p.value !== undefined ? `${Number(p.value).toFixed(2)} ${UNITS[p.dataKey] || ""}` : "--"}</b>
        </div>
      ))}
    </div>
  );
}

export default function SensorCharts({ history, thresholds, loading }) {
  const [range, setRange]   = useState("all");
  const [active, setActive] = useState("combined");

  const filtered = useMemo(() => filterByRange(history || [], range), [history, range]);

  const chartData = useMemo(() =>
    filtered.map(r => ({
      time:        formatChartTime(r.created_at),
      ph:          r.ph,
      turbidity:   r.turbidity,
      ec:          r.ec,
      temperature: r.temperature,
    })),
    [filtered]
  );

  const activeSensor = SENSORS.find(s => s.id === active);
  const keysToShow = activeSensor.keys || [active];

  if (loading) {
    return (
      <div className="card">
        <div className="skeleton skeleton-h" style={{ width: "40%", marginBottom: 12 }} />
        <div className="skeleton skeleton-block" style={{ height: 240 }} />
      </div>
    );
  }

  return (
    <div className="card">
      <div className="card-header">
        <div>
          <div className="card-title">Sensor Trends</div>
          <div className="card-subtitle">
            {chartData.length} readings · {range === "all" ? "all available" : range}
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
          <span style={{ fontSize: 32 }}>📉</span>
          <span>No data in this time range</span>
        </div>
      ) : active === "combined" ? (
        <CombinedChart data={chartData} thresholds={thresholds} />
      ) : (
        <SingleChart
          data={chartData}
          sensorKey={active}
          thresholds={thresholds}
        />
      )}
    </div>
  );
}

function CombinedChart({ data, thresholds }) {
  return (
    <div className="chart-wrap">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 10, bottom: 0, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
          <XAxis dataKey="time" tick={{ fill: "var(--text-muted)", fontSize: 10 }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
          <YAxis yAxisId="ph" domain={[0, 14]} tick={{ fill: COLORS.ph, fontSize: 10 }} tickLine={false} axisLine={false} width={28} />
          <YAxis yAxisId="right" orientation="right" domain={[0, 100]} tick={{ fill: COLORS.turbidity, fontSize: 10 }} tickLine={false} axisLine={false} width={28} />
          <Tooltip content={<CustomTooltip />} />
          <Legend wrapperStyle={{ fontSize: 11, color: "var(--text-secondary)" }} />

          {thresholds && (
            <>
              <ReferenceLine yAxisId="ph" y={thresholds.ph_low} stroke={COLORS.ph} strokeDasharray="4 4" strokeOpacity={0.5} label={{ value: `pH ${thresholds.ph_low}`, fill: COLORS.ph, fontSize: 9 }} />
              <ReferenceLine yAxisId="ph" y={thresholds.ph_high} stroke={COLORS.ph} strokeDasharray="4 4" strokeOpacity={0.5} label={{ value: `pH ${thresholds.ph_high}`, fill: COLORS.ph, fontSize: 9 }} />
              <ReferenceLine yAxisId="right" y={thresholds.turbidity} stroke={COLORS.turbidity} strokeDasharray="4 4" strokeOpacity={0.5} label={{ value: `NTU ${thresholds.turbidity}`, fill: COLORS.turbidity, fontSize: 9 }} />
            </>
          )}

          <Line yAxisId="ph"    type="monotone" dataKey="ph"        stroke={COLORS.ph}          strokeWidth={2} dot={false} name="pH" connectNulls={false} />
          <Line yAxisId="right" type="monotone" dataKey="turbidity" stroke={COLORS.turbidity}   strokeWidth={2} dot={false} name="Turbidity (NTU)" connectNulls={false} />
          <Line yAxisId="right" type="monotone" dataKey="temperature" stroke={COLORS.temperature} strokeWidth={1.5} dot={false} name="Temp (°C)" connectNulls={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function SingleChart({ data, sensorKey, thresholds }) {
  const domain  = Y_DOMAINS[sensorKey] || ["auto", "auto"];
  const color   = COLORS[sensorKey];
  const unit    = UNITS[sensorKey];

  // Reference lines for threshold sensors
  const refs = [];
  if (thresholds) {
    if (sensorKey === "ph") {
      refs.push({ y: thresholds.ph_low,  label: `Low (${thresholds.ph_low})` });
      refs.push({ y: thresholds.ph_high, label: `High (${thresholds.ph_high})` });
    } else if (sensorKey === "turbidity") {
      refs.push({ y: thresholds.turbidity, label: `Limit (${thresholds.turbidity} NTU)` });
    } else if (sensorKey === "ec") {
      refs.push({ y: thresholds.ec, label: `Limit (${thresholds.ec} µS/cm)` });
    }
  }

  return (
    <div className="chart-wrap">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 10, bottom: 0, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
          <XAxis dataKey="time" tick={{ fill: "var(--text-muted)", fontSize: 10 }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
          <YAxis domain={domain} tick={{ fill: color, fontSize: 10 }} tickLine={false} axisLine={false} width={36}
            tickFormatter={v => `${v}${sensorKey === "ph" ? "" : ""}`}
          />
          <Tooltip content={<CustomTooltip />} />

          {refs.map(r => (
            <ReferenceLine
              key={r.y}
              y={r.y}
              stroke={color}
              strokeDasharray="5 3"
              strokeOpacity={0.6}
              label={{ value: r.label, fill: color, fontSize: 9, position: "insideTopRight" }}
            />
          ))}

          <Line
            type="monotone"
            dataKey={sensorKey}
            stroke={color}
            strokeWidth={2}
            dot={false}
            name={`${sensorKey.toUpperCase()} (${unit})`}
            connectNulls={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
