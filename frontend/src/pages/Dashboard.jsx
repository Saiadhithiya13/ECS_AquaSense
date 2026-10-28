import React, { useMemo } from "react";
import SensorCards from "../components/SensorCard";
import WaterQualityStatus from "../components/WaterQualityStatus";
import SensorCharts from "../components/SensorCharts";
import WaterDiagnostics from "../components/WaterDiagnostics";
import AlertsPanel from "../components/AlertsPanel";
import { computeSummary, formatTimestamp } from "../utils/helpers";
import { BarChart2, CheckCircle2, AlertTriangle, Clock, WifiOff } from "lucide-react";

function SummaryStrip({ history, loading }) {
  const summary = useMemo(() => computeSummary(history || []), [history]);

  if (loading || !summary) {
    return (
      <div className="summary-strip">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="summary-item">
            <div className="skeleton" style={{ width: 36, height: 36, borderRadius: 6, flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <div className="skeleton skeleton-h sm" style={{ width: "50%", marginBottom: 6 }} />
              <div className="skeleton skeleton-h lg" style={{ width: "55%" }} />
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="summary-strip">
      <div className="summary-item">
        <div className="summary-icon" aria-hidden="true">
          <BarChart2 size={15} />
        </div>
        <div>
          <div className="summary-label">Total Readings</div>
          <div className="summary-value">{summary.total}</div>
        </div>
      </div>
      <div className="summary-item">
        <div className="summary-icon pass" aria-hidden="true">
          <CheckCircle2 size={15} />
        </div>
        <div>
          <div className="summary-label">Within Thresholds</div>
          <div className="summary-value text-green">{summary.pct}%</div>
        </div>
      </div>
      <div className="summary-item">
        <div className={`summary-icon ${summary.violations > 0 ? "fail" : "pass"}`} aria-hidden="true">
          {summary.violations > 0 ? <AlertTriangle size={15} /> : <CheckCircle2 size={15} />}
        </div>
        <div>
          <div className="summary-label">Violations</div>
          <div className="summary-value" style={{ color: summary.violations > 0 ? "var(--red)" : "var(--green)" }}>
            {summary.violations}
          </div>
        </div>
      </div>
      <div className="summary-item">
        <div className="summary-icon" aria-hidden="true">
          <Clock size={15} />
        </div>
        <div>
          <div className="summary-label">Last Violation</div>
          <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text)", letterSpacing: -0.2 }}>
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
      <div style={{ padding: "80px 0", textAlign: "center" }}>
        <div style={{ display: "inline-flex", padding: 16, borderRadius: 12, background: "var(--surface2)", border: "1px solid var(--border)", marginBottom: 16, color: "var(--text3)" }}>
          <WifiOff size={28} />
        </div>
        <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 8, color: "var(--text)" }}>
          Cannot reach the backend
        </div>
        <div style={{ fontSize: 13, color: "var(--text-secondary)", maxWidth: 460, margin: "0 auto 20px", lineHeight: 1.7 }}>
          {error}<br /><br />
          Make sure the Flask backend is running on{" "}
          <code style={{ background: "var(--surface2)", padding: "2px 6px", borderRadius: 4, fontFamily: "JetBrains Mono, monospace", fontSize: 12 }}>
            http://localhost:5000
          </code>.
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
      <div className="page-heading">
        <div className="page-title">Live Dashboard</div>
        <div className="page-subtitle">
          Real-time sensor readings from ESP32 via ThingSpeak
          {data?.thresholds ? " · Channel 178785" : ""}
          {lastRefresh && ` · Updated ${lastRefresh.toLocaleTimeString()}`}
        </div>
      </div>

      {/* Summary strip */}
      <SummaryStrip history={history} loading={loading} />

      {/* Sensor cards */}
      <SensorCards latest={latest} history={history} thresholds={thresholds} loading={loading} />

      {/* Charts + Quality side-by-side */}
      <div className="dashboard-grid-2" style={{ marginBottom: 20 }}>
        <SensorCharts history={history} thresholds={thresholds} loading={loading} />
        <WaterQualityStatus latest={latest} thresholds={thresholds} loading={loading} />
      </div>

      {/* Remediation Actions */}
      <WaterDiagnostics latest={latest} thresholds={thresholds} />

      {/* Alerts log */}
      <AlertsPanel
        latest={latest}
        thresholds={thresholds}
        connection={data?.connection}
        error={error}
        loading={loading}
      />
    </div>
  );
}
