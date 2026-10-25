import React, { useMemo } from "react";
import {
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  Wrench,
  Droplets,
  Zap,
  Thermometer,
  Filter,
  Info,
} from "lucide-react";
import { fmt } from "../utils/helpers";

/* ──────────────────────────────────────────────────────────────
   Recommendation generator
   All logic is derived from actual sensor values and configured
   thresholds — no fabricated causes or chemical dosing quantities.
   ────────────────────────────────────────────────────────────── */

function buildRecommendations(latest, thresholds) {
  if (!latest) return [];

  const t = thresholds || {};
  const phLow    = t.ph_low    ?? 5.5;
  const phHigh   = t.ph_high   ?? 8.5;
  const turbLimit = t.turbidity ?? 12.0;
  const ecLimit  = t.ec        ?? 800.0;

  const ph   = typeof latest.ph          === "number" ? latest.ph          : null;
  const turb = typeof latest.turbidity   === "number" ? latest.turbidity   : null;
  const ec   = typeof latest.ec          === "number" ? latest.ec          : null;
  const temp = typeof latest.temperature === "number" ? latest.temperature : null;

  const recs = [];

  // pH violations
  if (ph !== null && ph < phLow) {
    recs.push({
      id: "ph-low",
      priority: "critical",
      icon: Droplets,
      title: "pH Below Configured Minimum",
      subtitle: `Measured: ${fmt(ph, 2)} pH — Limit: ≥ ${phLow} pH`,
      body: `The current pH reading (${fmt(ph, 2)}) is below the configured lower limit of ${phLow}. This indicates acidic conditions that exceed the project alarm threshold.`,
      steps: [
        "Verify the pH sensor is properly calibrated using a standard buffer solution.",
        "Confirm the reading is stable and not a transient spike.",
        "Re-test the water sample after confirming sensor calibration.",
        "If the reading persists, investigate the water source for potential acid contamination.",
      ],
      rationale: `pH ${fmt(ph, 2)} is below the configured lower limit of ${phLow}.`,
    });
  } else if (ph !== null && ph > phHigh) {
    recs.push({
      id: "ph-high",
      priority: "critical",
      icon: Droplets,
      title: "pH Above Configured Maximum",
      subtitle: `Measured: ${fmt(ph, 2)} pH — Limit: ≤ ${phHigh} pH`,
      body: `The current pH reading (${fmt(ph, 2)}) exceeds the configured upper limit of ${phHigh}. This indicates alkaline conditions that exceed the project alarm threshold.`,
      steps: [
        "Verify the pH sensor calibration using a standard buffer solution.",
        "Confirm the reading is stable before taking further action.",
        "Re-test after confirming sensor calibration.",
        "If the reading persists, investigate the water source for possible alkaline contamination.",
      ],
      rationale: `pH ${fmt(ph, 2)} exceeds the configured upper limit of ${phHigh}.`,
    });
  }

  // Turbidity
  if (turb !== null && turb > turbLimit) {
    recs.push({
      id: "turbidity-high",
      priority: "attention",
      icon: Filter,
      title: "Turbidity Exceeds Configured Limit",
      subtitle: `Measured: ${fmt(turb, 1)} NTU — Limit: ≤ ${turbLimit} NTU`,
      body: `Turbidity (${fmt(turb, 1)} NTU) is above the configured threshold of ${turbLimit} NTU. High turbidity may indicate suspended particles in the water. Elevated turbidity can interfere with disinfection processes.`,
      steps: [
        "Inspect the turbidity sensor for fouling or incorrect positioning.",
        "Check the water source for visible cloudiness or disturbance.",
        "Re-take the measurement after allowing the sensor to stabilize.",
        "Investigate possible causes such as sediment stir-up or a change in the source water.",
      ],
      rationale: `Turbidity ${fmt(turb, 1)} NTU exceeds the configured limit of ${turbLimit} NTU.`,
    });
  }

  // EC
  if (ec !== null && ec > ecLimit) {
    recs.push({
      id: "ec-high",
      priority: "attention",
      icon: Zap,
      title: "Electrical Conductivity Exceeds Configured Limit",
      subtitle: `Measured: ${fmt(ec, 0)} µS/cm — Limit: ≤ ${ecLimit} µS/cm`,
      body: `EC (${fmt(ec, 0)} µS/cm) exceeds the configured threshold of ${ecLimit} µS/cm. This may indicate elevated dissolved solids in the water. Sensor calibration should be verified before drawing conclusions.`,
      steps: [
        "Verify the EC sensor calibration using a reference solution.",
        "Confirm the reading with a secondary measurement if available.",
        "Check for any recent changes in the water source that could affect ion concentration.",
        "If calibration is confirmed correct, investigate potential sources of dissolved ions in the water supply.",
      ],
      rationale: `EC ${fmt(ec, 0)} µS/cm exceeds the configured limit of ${ecLimit} µS/cm.`,
    });
  }

  // Temperature advisory (informational only — no alarm configured)
  if (temp !== null && temp > 30) {
    recs.push({
      id: "temp-elevated",
      priority: "informational",
      icon: Thermometer,
      title: "Elevated Temperature — Informational",
      subtitle: `Measured: ${fmt(temp, 1)} °C — No alarm threshold configured`,
      body: `The measured temperature (${fmt(temp, 1)} °C) is elevated. No alarm threshold is configured for temperature in this project. This advisory is provided for informational context only.`,
      steps: [
        "Monitor temperature trends over time.",
        "No immediate action is required as no threshold is configured.",
        "Consider whether elevated temperatures are relevant to the operational context being monitored.",
      ],
      rationale: `Temperature of ${fmt(temp, 1)} °C is above 30 °C. No project alarm threshold is active for temperature.`,
    });
  }

  return recs;
}

/* ──────────────────────────────────────────────────────────
   Priority display helpers
   ────────────────────────────────────────────────────────── */

const PRIORITY_CONFIG = {
  critical:      { label: "Critical",           badgeClass: "critical",     cardClass: "critical-card" },
  attention:     { label: "Attention Required",  badgeClass: "attention",    cardClass: "attention-card" },
  informational: { label: "Informational",       badgeClass: "informational", cardClass: "info-card" },
};

const PRIORITY_ORDER = { critical: 0, attention: 1, informational: 2 };

/* ──────────────────────────────────────────────────────────
   Component
   ────────────────────────────────────────────────────────── */

export default function WaterDiagnostics({ latest, thresholds }) {
  const recommendations = useMemo(
    () => buildRecommendations(latest, thresholds)
            .sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]),
    [latest, thresholds]
  );

  const hasIssues = recommendations.some(r => r.priority !== "informational");
  const criticalCount = recommendations.filter(r => r.priority === "critical").length;

  // Assessment summary metrics
  const t = thresholds || {};
  const summaryMetrics = latest ? [
    {
      label: "pH",
      value: latest.ph != null ? `${fmt(latest.ph, 2)} pH` : "--",
      limit: `${t.ph_low ?? "?"} – ${t.ph_high ?? "?"} pH`,
      failed: latest.ph != null && (latest.ph < (t.ph_low ?? 5.5) || latest.ph > (t.ph_high ?? 8.5)),
    },
    {
      label: "Turbidity",
      value: latest.turbidity != null ? `${fmt(latest.turbidity, 1)} NTU` : "--",
      limit: `≤ ${t.turbidity ?? "?"}  NTU`,
      failed: latest.turbidity != null && latest.turbidity > (t.turbidity ?? 12),
    },
    {
      label: "EC",
      value: latest.ec != null ? `${fmt(latest.ec, 0)} µS/cm` : "--",
      limit: `≤ ${t.ec ?? "?"} µS/cm`,
      failed: latest.ec != null && latest.ec > (t.ec ?? 800),
    },
    {
      label: "Temperature",
      value: latest.temperature != null ? `${fmt(latest.temperature, 1)} °C` : "--",
      limit: "No alarm",
      failed: false,
    },
  ] : [];

  return (
    <div className="card" style={{ marginBottom: 20 }}>
      {/* Card Header */}
      <div className="card-header" style={{ marginBottom: 14 }}>
        <div>
          <div className="card-title">
            <Wrench size={15} style={{ color: "var(--brand)" }} />
            Recommended Actions
          </div>
          <div className="card-subtitle">
            Derived from current sensor readings and configured thresholds
          </div>
        </div>

        {hasIssues ? (
          <span
            className={`priority-badge ${criticalCount > 0 ? "critical" : "attention"}`}
          >
            <AlertTriangle size={10} />
            {criticalCount > 0
              ? `${criticalCount} Critical`
              : `${recommendations.filter(r => r.priority === "attention").length} Attention`}
          </span>
        ) : (
          <span className="priority-badge informational">
            <CheckCircle2 size={10} />
            {latest ? "All Thresholds Met" : "No Data"}
          </span>
        )}
      </div>

      {/* Assessment Summary */}
      {latest && (
        <div className="assessment-summary-card">
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px", color: "var(--text-muted)", marginBottom: 8 }}>
            Assessment Summary
          </div>
          <div style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 8 }}>
            Classification: <strong style={{ color: latest.quality === "GOOD" ? "var(--green)" : "var(--red)" }}>
              {latest.quality}
            </strong>
            {" "}·{" "}
            {latest.quality === "GOOD"
              ? "No configured threshold violations detected in the available readings."
              : (latest.reasons || []).filter(r => !r.startsWith("Note:")).join(" ")}
          </div>
          <div className="assessment-metrics">
            {summaryMetrics.map(m => (
              <div key={m.label} className="assessment-metric">
                <div className="assessment-metric-label">{m.label}</div>
                <div className={`assessment-metric-value ${m.failed ? "fail" : m.value !== "--" ? "pass" : ""}`}>
                  {m.value}
                </div>
                <div style={{ fontSize: 9.5, color: "var(--text-muted)", marginTop: 2 }}>{m.limit}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* No data state */}
      {!latest && (
        <div style={{
          background: "var(--surface2)",
          border: "1px solid var(--border)",
          borderRadius: "var(--radius-md)",
          padding: "16px 18px",
          marginBottom: 14,
          display: "flex",
          alignItems: "center",
          gap: 12,
        }}>
          <Info size={22} color="var(--text-muted)" />
          <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>
            No sensor readings available yet. Recommendations will appear once the system receives data from the ESP32.
          </div>
        </div>
      )}

      {/* All clear */}
      {latest && !recommendations.length && (
        <div style={{
          background: "rgba(40,125,90,0.06)",
          border: "1px solid rgba(40,125,90,0.2)",
          borderRadius: "var(--radius-md)",
          padding: "14px 18px",
          marginBottom: 14,
          display: "flex",
          alignItems: "center",
          gap: 12,
        }}>
          <ShieldCheck size={24} color="var(--green)" style={{ flexShrink: 0 }} />
          <div>
            <div style={{ fontSize: 13.5, fontWeight: 700, color: "var(--green)", marginBottom: 2 }}>
              No Threshold Violations Detected
            </div>
            <div style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.6 }}>
              pH, turbidity, and EC are all within their configured project limits. Continue monitoring.
            </div>
          </div>
        </div>
      )}

      {/* Recommendation cards */}
      {recommendations.map(rec => {
        const Icon = rec.icon;
        const cfg = PRIORITY_CONFIG[rec.priority];
        const iconColors = {
          critical:      { bg: "rgba(185,56,56,0.1)",   color: "var(--red)" },
          attention:     { bg: "rgba(183,121,31,0.1)",  color: "var(--amber)" },
          informational: { bg: "rgba(23,107,104,0.1)",  color: "var(--brand)" },
        };
        const ic = iconColors[rec.priority];

        return (
          <div key={rec.id} className={`recommendation-card ${cfg.cardClass}`}>
            <div className="recommendation-header">
              <div
                className="recommendation-icon"
                style={{ background: ic.bg, color: ic.color }}
              >
                <Icon size={15} />
              </div>
              <div style={{ flex: 1 }}>
                <div className="recommendation-title">{rec.title}</div>
                <div className="recommendation-subtitle">{rec.subtitle}</div>
              </div>
              <span className={`priority-badge ${cfg.badgeClass}`}>
                {cfg.label}
              </span>
            </div>

            <p className="recommendation-body">{rec.body}</p>

            <ul className="recommendation-steps">
              {rec.steps.map((step, i) => (
                <li key={i} className="recommendation-step">
                  <span className="step-bullet">{i + 1}</span>
                  <span>{step}</span>
                </li>
              ))}
            </ul>

            <div className="recommendation-rationale">
              <div className="rationale-label">Assessment Rationale</div>
              {rec.rationale}
            </div>
          </div>
        );
      })}

      {/* Footer note */}
      <div style={{
        marginTop: 12,
        padding: "8px 12px",
        background: "var(--surface2)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-sm)",
        fontSize: 11,
        color: "var(--text-muted)",
        lineHeight: 1.6,
      }}>
        <strong>Note:</strong> Recommendations are based solely on readings from the connected sensor array and configured project thresholds.
        Verify sensor calibration before acting on this assessment. Do not use this system as the sole basis for drinking-water safety decisions.
      </div>
    </div>
  );
}
