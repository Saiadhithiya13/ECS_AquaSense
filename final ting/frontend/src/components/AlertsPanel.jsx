import React, { useState, useMemo } from "react";
import { formatTimestamp } from "../utils/helpers";
import { Bell, AlertCircle, AlertTriangle, Info, CheckCircle2, Clock } from "lucide-react";

/**
 * Build alert items from backend data.
 * Alerts are derived ONLY from actual backend data.
 * Threshold violations are labeled as threshold-based.
 */
function buildAlerts(latest, thresholds, connection, error) {
  const alerts = [];

  // Connection / data freshness alerts
  if (connection === "ERROR" || error) {
    alerts.push({
      id: "conn-error",
      severity: "critical",
      sensor: "System",
      title: "Backend connection error",
      description: error || "Cannot reach the backend. Check your network and server configuration.",
      suggestion: "Verify the Flask server is running and CORS is configured correctly.",
      timestamp: null,
    });
  } else if (connection === "Connecting") {
    alerts.push({
      id: "conn-waiting",
      severity: "info",
      sensor: "System",
      title: "Connecting to data source",
      description: "Waiting for the first data fetch to complete.",
      suggestion: "This usually takes a few seconds after server startup.",
      timestamp: null,
    });
  }

  if (!latest) return alerts;

  const ts = latest.created_at;

  // pH
  if (latest.ph !== null && latest.ph !== undefined && thresholds) {
    if (latest.ph < thresholds.ph_low) {
      alerts.push({
        id: "ph-low",
        severity: "critical",
        sensor: "pH",
        title: "pH below lower threshold",
        description: `pH ${latest.ph.toFixed(2)} is below the configured lower limit of ${thresholds.ph_low}.`,
        suggestion: "Check sensor calibration. Re-test after calibration is confirmed.",
        timestamp: ts,
      });
    } else if (latest.ph > thresholds.ph_high) {
      alerts.push({
        id: "ph-high",
        severity: "critical",
        sensor: "pH",
        title: "pH above upper threshold",
        description: `pH ${latest.ph.toFixed(2)} exceeds the configured upper limit of ${thresholds.ph_high}.`,
        suggestion: "Check sensor calibration. Re-test after calibration is confirmed.",
        timestamp: ts,
      });
    } else if (latest.ph < thresholds.ph_low + 0.5 || latest.ph > thresholds.ph_high - 0.5) {
      alerts.push({
        id: "ph-warn",
        severity: "warning",
        sensor: "pH",
        title: "pH approaching threshold boundary",
        description: `pH ${latest.ph.toFixed(2)} is close to a configured boundary (${thresholds.ph_low} to ${thresholds.ph_high}).`,
        suggestion: "Monitor pH closely. No immediate action required.",
        timestamp: ts,
      });
    } else {
      alerts.push({
        id: "ph-ok",
        severity: "ok",
        sensor: "pH",
        title: "pH within configured range",
        description: `pH ${latest.ph.toFixed(2)} is within the configured range (${thresholds.ph_low} to ${thresholds.ph_high}).`,
        suggestion: null,
        timestamp: ts,
      });
    }
  }

  // Turbidity
  if (latest.turbidity !== null && latest.turbidity !== undefined && thresholds) {
    if (latest.turbidity > thresholds.turbidity) {
      alerts.push({
        id: "turb-high",
        severity: "critical",
        sensor: "Turbidity",
        title: "Turbidity exceeds threshold",
        description: `Turbidity ${latest.turbidity.toFixed(1)} NTU exceeds the configured limit of ${thresholds.turbidity} NTU.`,
        suggestion: "Inspect sensor and water source. Verify calibration before acting.",
        timestamp: ts,
      });
    } else if (latest.turbidity > thresholds.turbidity * 0.8) {
      alerts.push({
        id: "turb-warn",
        severity: "warning",
        sensor: "Turbidity",
        title: "Turbidity approaching threshold",
        description: `Turbidity ${latest.turbidity.toFixed(1)} NTU is approaching the ${thresholds.turbidity} NTU limit.`,
        suggestion: "Monitor turbidity. No immediate action required.",
        timestamp: ts,
      });
    } else {
      alerts.push({
        id: "turb-ok",
        severity: "ok",
        sensor: "Turbidity",
        title: "Turbidity within limit",
        description: `Turbidity ${latest.turbidity.toFixed(1)} NTU is within the configured limit of ${thresholds.turbidity} NTU.`,
        suggestion: null,
        timestamp: ts,
      });
    }
  }

  // EC
  if (latest.ec !== null && latest.ec !== undefined && thresholds) {
    if (latest.ec > thresholds.ec) {
      alerts.push({
        id: "ec-high",
        severity: "critical",
        sensor: "EC",
        title: "EC exceeds threshold",
        description: `EC ${latest.ec.toFixed(1)} µS/cm exceeds the configured limit of ${thresholds.ec} µS/cm.`,
        suggestion: "Verify EC sensor calibration. Re-test before investigating the water source.",
        timestamp: ts,
      });
    } else if (latest.ec > thresholds.ec * 0.8) {
      alerts.push({
        id: "ec-warn",
        severity: "warning",
        sensor: "EC",
        title: "EC approaching threshold",
        description: `EC ${latest.ec.toFixed(1)} µS/cm is approaching the ${thresholds.ec} µS/cm limit.`,
        suggestion: "Monitor conductivity. No immediate action required.",
        timestamp: ts,
      });
    } else {
      alerts.push({
        id: "ec-ok",
        severity: "ok",
        sensor: "EC",
        title: "EC within limit",
        description: `EC ${latest.ec.toFixed(1)} µS/cm is within the configured limit of ${thresholds.ec} µS/cm.`,
        suggestion: null,
        timestamp: ts,
      });
    }
  }

  // Temperature: informational (no alarm threshold defined)
  if (latest.temperature !== null && latest.temperature !== undefined) {
    alerts.push({
      id: "temp-info",
      severity: "info",
      sensor: "Temperature",
      title: "Temperature reading",
      description: `Temperature: ${latest.temperature.toFixed(1)} °C. No alarm threshold is configured for temperature.`,
      suggestion: null,
      timestamp: ts,
    });
  }

  return alerts;
}

function SeverityIcon({ severity }) {
  switch (severity) {
    case "critical": return <AlertCircle size={14} className="text-red" />;
    case "warning":  return <AlertTriangle size={14} className="text-amber" />;
    case "info":     return <Info size={14} className="text-brand" />;
    default:         return <CheckCircle2 size={14} className="text-green" />;
  }
}

// Sensor filter tabs
const SENSOR_FILTERS = ["All", "pH", "Turbidity", "EC", "Temperature"];

export default function AlertsPanel({ latest, thresholds, connection, error, loading }) {
  const [dismissed, setDismissed] = useState(new Set());
  const [sensorFilter, setSensorFilter] = useState("All");

  const allAlerts = useMemo(() =>
    buildAlerts(latest, thresholds, connection, error),
    [latest, thresholds, connection, error]
  );

  // Apply sensor filter
  const visible = allAlerts.filter(a => {
    if (dismissed.has(a.id)) return false;
    if (sensorFilter === "All") return true;
    return a.sensor === sensorFilter;
  });

  const criticalCount = allAlerts.filter(a => a.severity === "critical").length;

  if (loading) {
    return (
      <div className="card">
        <div className="skeleton skeleton-h" style={{ width: "40%", marginBottom: 14 }} />
        {[1, 2, 3].map(i => (
          <div key={i} className="skeleton" style={{ height: 52, borderRadius: 8, marginBottom: 7 }} />
        ))}
      </div>
    );
  }

  return (
    <div className="card">
      <div className="card-header">
        <div>
          <div className="card-title">
            <Bell size={15} style={{ color: "var(--brand)" }} /> Alerts & Status
          </div>
          <div className="card-subtitle">
            Threshold-based checks · {criticalCount} critical
          </div>
        </div>
        {dismissed.size > 0 && (
          <button
            className="btn btn-xs btn-secondary"
            onClick={() => setDismissed(new Set())}
          >
            Restore {dismissed.size} dismissed
          </button>
        )}
      </div>

      {/* Sensor filter buttons */}
      <div className="alert-filters">
        {SENSOR_FILTERS.map(s => (
          <button
            key={s}
            className={`filter-btn${sensorFilter === s ? " active" : ""}`}
            onClick={() => setSensorFilter(s)}
          >
            {s}
          </button>
        ))}
      </div>

      <div className="alert-list">
        {visible.length === 0 && (
          <div style={{ fontSize: 12.5, color: "var(--text-muted)", padding: "16px 0", textAlign: "center" }}>
            {sensorFilter === "All"
              ? "No alerts available."
              : `No alerts for ${sensorFilter}${dismissed.size > 0 ? " (some dismissed)" : ""}.`}
          </div>
        )}

        {visible.map(alert => (
          <div
            key={alert.id}
            className={`alert-item severity-${alert.severity}`}
            role="alert"
          >
            <span className="alert-icon" aria-hidden="true">
              <SeverityIcon severity={alert.severity} />
            </span>
            <div className="alert-content">
              <div className="alert-title">{alert.title}</div>
              <div className="alert-description">{alert.description}</div>
              {alert.suggestion && (
                <div className="alert-meta">
                  <span style={{ fontWeight: 600, color: "var(--text-secondary)" }}>Action:</span> {alert.suggestion}
                </div>
              )}
              {alert.timestamp && (
                <div className="alert-meta" style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <Clock size={11} /> {formatTimestamp(alert.timestamp)}
                </div>
              )}
            </div>
            <button
              className="alert-dismiss"
              onClick={() => setDismissed(prev => new Set([...prev, alert.id]))}
              aria-label={`Dismiss alert: ${alert.title}`}
              title="Dismiss (this session only)"
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
