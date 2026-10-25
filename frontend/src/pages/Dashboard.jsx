import React, { useMemo } from "react";
import SensorCards from "../components/SensorCard";
import WaterQualityStatus from "../components/WaterQualityStatus";
import SensorCharts from "../components/SensorCharts";
import WaterDiagnostics from "../components/WaterDiagnostics";
import AlertsPanel from "../components/AlertsPanel";
import ReadingsTable from "../components/ReadingsTable";
import MLInsights from "../components/MLInsights";
import SystemHealth from "../components/SystemHealth";
import { computeSummary, formatTimestamp } from "../utils/helpers";

function SummaryStrip({ history, loading }) {
  const summary = useMemo(() => computeSummary(history || []), [history]);

  if (loading || !summary) {
    return (
      <div className="summary-strip">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="summary-item">
            <div className="skeleton" style={{ width: 38, height: 38, borderRadius: 10, flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <div className="skeleton skeleton-h sm" style={{ width: "50%", marginBottom: 4 }} />
              <div className="skeleton skeleton-h lg" style={{ width: "40%" }} />
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="summary-strip">
      <div className="summary-item">
        <div className="summary-icon" style={{ background: "rgba(34,211,238,.12)" }} aria-hidden="true">📊</div>
        <div className="summary-info">
          <div className="summary-label">Total Readings</div>
          <div className="summary-value">{summary.total}</div>
        </div>
      </div>
      <div className="summary-item">
        <div className="summary-icon" style={{ background: "rgba(16,185,129,.12)" }} aria-hidden="true">✅</div>
        <div className="summary-info">
          <div className="summary-label">Within Thresholds</div>
          <div className="summary-value text-green">{summary.pct}%</div>
        </div>
      </div>
      <div className="summary-item">
        <div className="summary-icon" style={{ background: "rgba(239,68,68,.12)" }} aria-hidden="true">⚠️</div>
        <div className="summary-info">
          <div className="summary-label">Threshold Violations</div>
          <div className="summary-value" style={{ color: summary.violations > 0 ? "var(--red)" : "var(--green)" }}>
            {summary.violations}
          </div>
        </div>
      </div>
      <div className="summary-item">
        <div className="summary-icon" style={{ background: "rgba(245,158,11,.12)" }} aria-hidden="true">🕐</div>
        <div className="summary-info">
          <div className="summary-label">Last Violation</div>
          <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text)" }}>
            {summary.lastViolation
              ? formatTimestamp(summary.lastViolation.created_at, { month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit" })
              : "None"}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Dashboard({ data, health, loading, error, lastRefresh, onRefresh }) {
  const latest     = data?.latest;
  const history    = data?.history || [];
  const thresholds = data?.thresholds;

  if (error && !data) {
    return (
      <div style={{ padding: "60px 0", textAlign: "center" }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>🔌</div>
        <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 8, color: "var(--text)" }}>
          Cannot reach the backend
        </div>
        <div style={{ fontSize: 13.5, color: "var(--text-secondary)", maxWidth: 440, margin: "0 auto 24px", lineHeight: 1.7 }}>
          {error}<br /><br />
          Make sure the Flask backend is running on <code>http://localhost:5000</code>.
          See the README for setup instructions.
        </div>
        <button className="btn btn-primary" onClick={onRefresh}>
          Try Again
        </button>
      </div>
    );
  }

  return (
    <div>
      {/* Page heading */}
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 20, fontWeight: 800, letterSpacing: "-0.5px", marginBottom: 4 }}>
          Dashboard
        </h1>
        <div className="text-sm text-muted">
          Live sensor readings from ThingSpeak · Channel {data?.thresholds ? "178785" : "–"}
          {lastRefresh && ` · Last updated ${lastRefresh.toLocaleTimeString()}`}
        </div>
      </div>

      {/* Summary strip */}
      <SummaryStrip history={history} loading={loading} />

      {/* Sensor cards */}
      <SensorCards latest={latest} history={history} thresholds={thresholds} loading={loading} />

      {/* Quality + Charts */}
      <div className="dashboard-grid-2" style={{ marginBottom: 24 }}>
        <SensorCharts history={history} thresholds={thresholds} loading={loading} />
        <WaterQualityStatus latest={latest} loading={loading} />
      </div>

      {/* Water Quality Cause Analysis & Remediation */}
      <WaterDiagnostics latest={latest} thresholds={thresholds} />

      {/* Alerts + ML */}
      <div className="dashboard-grid-2" style={{ marginBottom: 24 }}>
        <AlertsPanel
          latest={latest}
          thresholds={thresholds}
          connection={data?.connection}
          error={data?.error}
          loading={loading}
        />
        <MLInsights
          data={data}
          onRetrainSuccess={onRefresh}
        />
      </div>

      {/* Readings table */}
      <ReadingsTable history={history} loading={loading} />

      {/* System health */}
      <div style={{ marginTop: 24 }}>
        <SystemHealth data={data} health={health} lastRefresh={lastRefresh} loading={loading} />
      </div>
    </div>
  );
}
