import React, { useState, useMemo } from "react";
import { formatTimestamp } from "../utils/helpers";

/**
 * Build alert items from backend data.
 * Each alert has: { id, severity, sensor, title, description, suggestion, timestamp }
 *
 * We derive alerts ONLY from actual backend data — never from fabricated values.
 * Threshold violations are labeled as threshold-based, NOT ML anomalies.
 */
function buildAlerts(latest, thresholds, connection, error) {
  const alerts = [];

  // Connection / data freshness alerts
  if (connection === "ERROR" || error) {
    alerts.push({
      id: "conn-error",
      severity: "critical",
      sensor: "System",
      title: "ThingSpeak connection error",
      description: error || "Cannot reach ThingSpeak. Check your network and channel settings.",
      suggestion: "Verify CHANNEL_ID, READ_API_KEY, and internet connectivity.",
      timestamp: null,
    });
  } else if (connection === "Connecting") {
    alerts.push({
      id: "conn-waiting",
      severity: "info",
      sensor: "System",
      title: "Connecting to ThingSpeak",
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
        title: "pH below lower limit",
        description: `pH ${latest.ph.toFixed(2)} is below the configured low limit of ${thresholds.ph_low}.`,
        suggestion: "Check the pH sensor calibration and water source. Add alkaline treatment if appropriate.",
        timestamp: ts,
      });
    } else if (latest.ph > thresholds.ph_high) {
      alerts.push({
        id: "ph-high",
        severity: "critical",
        sensor: "pH",
        title: "pH above upper limit",
        description: `pH ${latest.ph.toFixed(2)} exceeds the configured high limit of ${thresholds.ph_high}.`,
        suggestion: "Check the pH sensor and consider acidification treatment.",
        timestamp: ts,
      });
    } else if (latest.ph < thresholds.ph_low + 0.5 || latest.ph > thresholds.ph_high - 0.5) {
      alerts.push({
        id: "ph-warn",
        severity: "warning",
        sensor: "pH",
        title: "pH approaching limit",
        description: `pH ${latest.ph.toFixed(2)} is close to a configured boundary (${thresholds.ph_low}–${thresholds.ph_high}).`,
        suggestion: "Monitor pH closely. No immediate action required.",
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
        title: "High turbidity",
        description: `Turbidity ${latest.turbidity.toFixed(1)} NTU exceeds the configured limit of ${thresholds.turbidity} NTU.`,
        suggestion: "Inspect the water source for contamination or stir-up. Check the turbidity sensor.",
        timestamp: ts,
      });
    } else if (latest.turbidity > thresholds.turbidity * 0.8) {
      alerts.push({
        id: "turb-warn",
        severity: "warning",
        sensor: "Turbidity",
        title: "Turbidity approaching limit",
        description: `Turbidity ${latest.turbidity.toFixed(1)} NTU is approaching the ${thresholds.turbidity} NTU limit.`,
        suggestion: "Monitor turbidity. No immediate action required.",
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
        title: "High electrical conductivity",
        description: `EC ${latest.ec.toFixed(1)} µS/cm exceeds the configured limit of ${thresholds.ec} µS/cm.`,
        suggestion: "Check for dissolved salts or contaminants. Verify EC sensor calibration.",
        timestamp: ts,
      });
    } else if (latest.ec > thresholds.ec * 0.8) {
      alerts.push({
        id: "ec-warn",
        severity: "warning",
        sensor: "EC",
        title: "EC approaching limit",
        description: `EC ${latest.ec.toFixed(1)} µS/cm is approaching the ${thresholds.ec} µS/cm limit.`,
        suggestion: "Monitor conductivity. No immediate action required.",
        timestamp: ts,
      });
    }
  }

  // If everything is OK, show one info-level item
  if (latest && alerts.filter(a => a.severity === "critical" || a.severity === "warning").length === 0) {
    alerts.push({
      id: "all-ok",
      severity: "ok",
      sensor: "All",
      title: "All configured thresholds satisfied",
      description: "pH, turbidity, and EC readings are within the configured project limits.",
      suggestion: "Continue monitoring.",
      timestamp: ts,
    });
  }

  return alerts;
}

const SEVERITY_ICONS = {
  critical: "🔴",
  warning:  "🟡",
  info:     "🔵",
  ok:       "🟢",
};

const SEVERITY_LABELS = {
  critical: "Critical",
  warning:  "Warning",
  info:     "Info",
  ok:       "OK",
};

export default function AlertsPanel({ latest, thresholds, connection, error, loading }) {
  const [dismissed, setDismissed]         = useState(new Set());
  const [severityFilter, setSeverityFilter] = useState("all");
  const [sensorFilter, setSensorFilter]   = useState("all");

  const allAlerts = useMemo(() =>
    buildAlerts(latest, thresholds, connection, error),
    // Only rebuild when the latest entry_id changes (deduplication)
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [latest?.entry_id, thresholds, connection, error]
  );

  const sensors = useMemo(() => {
    const s = new Set(allAlerts.map(a => a.sensor));
    return ["all", ...Array.from(s)];
  }, [allAlerts]);

  const visible = allAlerts.filter(a =>
    !dismissed.has(a.id) &&
    (severityFilter === "all" || a.severity === severityFilter) &&
    (sensorFilter === "all" || a.sensor === sensorFilter)
  );

  if (loading) {
    return (
      <div className="card">
        <div className="skeleton skeleton-h" style={{ width: "40%", marginBottom: 16 }} />
        {[1, 2, 3].map(i => (
          <div key={i} className="skeleton" style={{ height: 60, borderRadius: 10, marginBottom: 8 }} />
        ))}
      </div>
    );
  }

  return (
    <div className="card">
      <div className="card-header">
        <div>
          <div className="card-title">Alerts & Status</div>
          <div className="card-subtitle">
            Threshold-based checks · {allAlerts.filter(a => a.severity === "critical").length} critical
          </div>
        </div>
        <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
          Dismissed items are not persistently stored.
        </div>
      </div>

      {/* Filters */}
      <div className="alert-filters">
        {["all", "critical", "warning", "info", "ok"].map(s => (
          <button
            key={s}
            className={`filter-btn${severityFilter === s ? " active" : ""}`}
            onClick={() => setSeverityFilter(s)}
          >
            {s === "all" ? "All" : SEVERITY_LABELS[s]}
          </button>
        ))}
        <span style={{ width: 1, height: 16, background: "var(--border)", alignSelf: "center" }} />
        {sensors.map(s => (
          <button
            key={s}
            className={`filter-btn${sensorFilter === s ? " active" : ""}`}
            onClick={() => setSensorFilter(s)}
          >
            {s === "all" ? "All Sensors" : s}
          </button>
        ))}
      </div>

      {dismissed.size > 0 && (
        <button
          className="btn btn-xs btn-secondary"
          style={{ marginBottom: 10, alignSelf: "flex-start" }}
          onClick={() => setDismissed(new Set())}
        >
          Restore {dismissed.size} dismissed
        </button>
      )}

      <div className="alert-list">
        {visible.length === 0 && (
          <div style={{ fontSize: 13, color: "var(--text-muted)", padding: "20px 0", textAlign: "center" }}>
            No alerts match the current filters.
          </div>
        )}

        {visible.map(alert => (
          <div
            key={alert.id}
            className={`alert-item severity-${alert.severity}`}
            role="alert"
          >
            <span className="alert-icon" aria-hidden="true">{SEVERITY_ICONS[alert.severity]}</span>
            <div className="alert-content">
              <div className="alert-title">{alert.title}</div>
              <div className="alert-description">{alert.description}</div>
              {alert.suggestion && (
                <div className="alert-meta">💡 {alert.suggestion}</div>
              )}
              {alert.timestamp && (
                <div className="alert-meta">🕐 {formatTimestamp(alert.timestamp)}</div>
              )}
            </div>
            <button
              className="alert-dismiss"
              onClick={() => setDismissed(prev => new Set([...prev, alert.id]))}
              aria-label={`Dismiss alert: ${alert.title}`}
              title="Dismiss (this session only — not permanently saved)"
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
