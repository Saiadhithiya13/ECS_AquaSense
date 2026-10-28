import React, { useState, useMemo } from "react";
import { fmt, formatTimestamp } from "../utils/helpers";
import { ChevronDown, ChevronRight, AlertTriangle, CheckCircle2, Info, Beaker, HelpCircle } from "lucide-react";

const PARAMS = [
  { key: "ph",          label: "pH",           unit: "pH",    digits: 2 },
  { key: "turbidity",   label: "Turbidity",    unit: "NTU",   digits: 1 },
  { key: "ec",          label: "Conductivity", unit: "µS/cm", digits: 0 },
  { key: "temperature", label: "Temperature",  unit: "°C",    digits: 1 },
];

/** Detailed scientific reasoning per parameter */
function buildDetailedReasons(latest, thresholds) {
  if (!latest) return [];
  const t = thresholds || {};
  const phLow     = t.ph_low    ?? 5.5;
  const phHigh    = t.ph_high   ?? 8.5;
  const turbLimit = t.turbidity ?? 12.0;
  const ecLimit   = t.ec        ?? 800.0;
  const reasons   = [];

  const ph = latest.ph;
  if (ph != null) {
    if (ph < phLow) {
      reasons.push({
        key: "ph", type: "fail", sensor: "pH",
        value: `${fmt(ph, 2)} pH`, limit: `>= ${phLow} pH`,
        headline: "Acidic conditions detected",
        detail: `A pH of ${fmt(ph, 2)} is below the acceptable lower limit of ${phLow}. Acidic water (pH < 6.5) can cause corrosion of metal distribution pipes, leach heavy metals (lead, copper) into the supply, and may indicate acid contamination from industrial or agricultural runoff. It also reduces the effectiveness of chlorine-based disinfection.`,
        action: "Verify sensor calibration using a standard pH buffer solution before drawing conclusions.",
      });
    } else if (ph > phHigh) {
      reasons.push({
        key: "ph", type: "fail", sensor: "pH",
        value: `${fmt(ph, 2)} pH`, limit: `<= ${phHigh} pH`,
        headline: "Alkaline conditions detected",
        detail: `A pH of ${fmt(ph, 2)} exceeds the upper threshold of ${phHigh}. Alkaline water can cause calcium carbonate scale in pipes, reduce chlorine residual efficacy, and at pH > 9 may irritate skin and mucous membranes. Possible causes include industrial waste, concrete leaching, or algal blooms.`,
        action: "Confirm the reading is stable. Re-test with a high-range buffer calibration.",
      });
    } else {
      reasons.push({
        key: "ph", type: "pass", sensor: "pH",
        value: `${fmt(ph, 2)} pH`, limit: `${phLow} to ${phHigh} pH`,
        headline: "pH is within the safe operating range",
        detail: `The pH reading of ${fmt(ph, 2)} falls within the configured range of ${phLow} to ${phHigh}. At this level, disinfection agents retain effective activity, risk of corrosion or scale formation is low, and no harmful acid or alkali contamination is indicated by this parameter.`,
        action: null,
      });
    }
  }

  const turb = latest.turbidity;
  if (turb != null) {
    if (turb > turbLimit) {
      reasons.push({
        key: "turbidity", type: "fail", sensor: "Turbidity",
        value: `${fmt(turb, 1)} NTU`, limit: `<= ${turbLimit} NTU`,
        headline: "Elevated particle suspension detected",
        detail: `Turbidity of ${fmt(turb, 1)} NTU exceeds the threshold of ${turbLimit} NTU. High turbidity means suspended particles (sediment, algae, organic matter) are present in the water. These particles can shield pathogens from UV or chemical disinfection, increasing the risk of microbial contamination. The WHO guideline for drinking water is < 1 NTU; values above 4 NTU are considered a risk for health.`,
        action: "Inspect sensor for fouling. Check the water source for visible disturbance, sediment, or upstream event.",
      });
    } else if (turb > turbLimit * 0.75) {
      reasons.push({
        key: "turbidity", type: "warn", sensor: "Turbidity",
        value: `${fmt(turb, 1)} NTU`, limit: `<= ${turbLimit} NTU`,
        headline: "Turbidity is elevated: approaching limit",
        detail: `Turbidity of ${fmt(turb, 1)} NTU is within the limit but trending high. A sudden rise in turbidity often signals early contamination, disturbed sediment, or a change in upstream water source. Monitor closely.`,
        action: "Continue monitoring. No immediate action required, but watch for upward trend.",
      });
    } else {
      reasons.push({
        key: "turbidity", type: "pass", sensor: "Turbidity",
        value: `${fmt(turb, 1)} NTU`, limit: `<= ${turbLimit} NTU`,
        headline: "Water clarity is acceptable",
        detail: `Turbidity of ${fmt(turb, 1)} NTU is well within the limit of ${turbLimit} NTU. Clear water allows disinfectants to work effectively and indicates low suspended particle content, consistent with good water clarity for the monitored context.`,
        action: null,
      });
    }
  }

  const ec = latest.ec;
  if (ec != null) {
    if (ec > ecLimit) {
      reasons.push({
        key: "ec", type: "fail", sensor: "Electrical Conductivity",
        value: `${fmt(ec, 0)} µS/cm`, limit: `<= ${ecLimit} µS/cm`,
        headline: "Elevated dissolved ionic concentration",
        detail: `EC of ${fmt(ec, 0)} µS/cm exceeds the limit of ${ecLimit} µS/cm. High conductivity indicates elevated dissolved ions (chlorides, sulphates, nitrates, or heavy metals). This may reflect contamination from agricultural fertilisers, industrial effluent, or seawater intrusion. Elevated TDS can affect taste, corrode infrastructure, and depending on the ion composition, may carry health implications. Always verify sensor calibration before acting.`,
        action: "Calibrate the EC sensor with a reference solution. Confirm with a secondary measurement if available.",
      });
    } else if (ec > ecLimit * 0.8) {
      reasons.push({
        key: "ec", type: "warn", sensor: "Electrical Conductivity",
        value: `${fmt(ec, 0)} µS/cm`, limit: `<= ${ecLimit} µS/cm`,
        headline: "Conductivity approaching threshold",
        detail: `EC of ${fmt(ec, 0)} µS/cm is within the limit but rising. A rising EC may indicate a developing source of dissolved solids in the upstream supply. Monitor trend direction.`,
        action: "Monitor for upward trends. Investigate if the value continues to increase.",
      });
    } else {
      reasons.push({
        key: "ec", type: "pass", sensor: "Electrical Conductivity",
        value: `${fmt(ec, 0)} µS/cm`, limit: `<= ${ecLimit} µS/cm`,
        headline: "Dissolved solids within acceptable range",
        detail: `EC of ${fmt(ec, 0)} µS/cm is within the configured limit of ${ecLimit} µS/cm. Total dissolved solid concentration is at a manageable level. No anomalous ion intrusion is indicated by this parameter.`,
        action: null,
      });
    }
  }

  const temp = latest.temperature;
  if (temp != null) {
    const elevated = temp > 30;
    reasons.push({
      key: "temperature", type: "info", sensor: "Temperature",
      value: `${fmt(temp, 1)} °C`, limit: "No alarm configured",
      headline: elevated ? "Elevated temperature: advisory" : "Temperature in normal range",
      detail: elevated
        ? `Temperature of ${fmt(temp, 1)} °C is elevated. No alarm threshold is configured for temperature. Warm water reduces dissolved oxygen, accelerates microbial growth (including Legionella above 25 °C), and degrades chlorine residual faster. This is an informational advisory only.`
        : `Temperature of ${fmt(temp, 1)} °C is within a typical range. No alarm threshold is configured. Temperature is provided for contextual awareness: it influences the interpretation of other parameters such as dissolved oxygen and disinfection efficiency.`,
      action: elevated ? "Context-dependent. No configured alarm; monitor if sustained high temperatures are expected." : null,
    });
  }

  return reasons;
}

/** Evaluate pass/fail for the metrics table */
function evaluateParams(latest, thresholds) {
  if (!latest) return [];
  const t = thresholds || {};
  return PARAMS.map(p => {
    const value = latest[p.key];
    const hasValue = value !== null && value !== undefined && Number.isFinite(Number(value));
    if (!hasValue) return { ...p, value: null, limit: null, status: "no-data" };
    const v = Number(value);
    if (p.key === "ph") {
      const low = t.ph_low, high = t.ph_high;
      if (low == null && high == null) return { ...p, value: v, limit: null, status: "no-limit" };
      const failed = (low != null && v < low) || (high != null && v > high);
      return { ...p, value: v, limit: `${low ?? "?"} to ${high ?? "?"} pH`, status: failed ? "fail" : "pass" };
    }
    if (p.key === "turbidity") {
      if (t.turbidity == null) return { ...p, value: v, limit: null, status: "no-limit" };
      return { ...p, value: v, limit: `<= ${t.turbidity} NTU`, status: v > t.turbidity ? "fail" : "pass" };
    }
    if (p.key === "ec") {
      if (t.ec == null) return { ...p, value: v, limit: null, status: "no-limit" };
      return { ...p, value: v, limit: `<= ${t.ec} µS/cm`, status: v > t.ec ? "fail" : "pass" };
    }
    return { ...p, value: v, limit: "No alarm", status: "no-limit" };
  });
}

function StatusIcon({ type }) {
  if (type === "fail") return <AlertTriangle size={12} />;
  if (type === "pass") return <CheckCircle2 size={12} />;
  if (type === "warn") return <AlertTriangle size={12} />;
  return <Info size={12} />;
}

export default function WaterQualityStatus({ latest, thresholds, loading }) {
  const [reasonsOpen, setReasonsOpen] = useState(false);
  const [expandedParam, setExpandedParam] = useState(null);

  const params         = useMemo(() => evaluateParams(latest, thresholds), [latest, thresholds]);
  const detailedReasons = useMemo(() => buildDetailedReasons(latest, thresholds), [latest, thresholds]);

  const failCount    = detailedReasons.filter(r => r.type === "fail").length;
  const warnCount    = detailedReasons.filter(r => r.type === "warn").length;
  const passCount    = detailedReasons.filter(r => r.type === "pass").length;

  if (loading) {
    return (
      <div className="card quality-panel">
        <div className="skeleton skeleton-h" style={{ width: "55%", marginBottom: 14 }} />
        <div className="skeleton" style={{ height: 84, borderRadius: 12, marginBottom: 14 }} />
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="skeleton" style={{ height: 36, borderRadius: 9, marginBottom: 8 }} />
        ))}
      </div>
    );
  }

  if (!latest) {
    return (
      <div className="card quality-panel">
        <div className="card-title" style={{ marginBottom: 16 }}>Water Quality Assessment</div>
        <div className="quality-verdict">
          <div className="quality-verdict-icon waiting">
            <HelpCircle size={15} />
          </div>
          <div>
            <div className="quality-verdict-title waiting">No Data</div>
            <div className="quality-verdict-sub">Waiting for first sensor reading from ESP32</div>
          </div>
        </div>
        <div className="disclaimer">
          Ensure the ESP32 is powered, connected to Wi-Fi, and posting to the Flask server.
        </div>
      </div>
    );
  }

  const isGood       = latest.quality === "GOOD";
  const qualityClass = isGood ? "good" : "bad";
  const failedParams = params.filter(p => p.status === "fail");

  return (
    <div className="card quality-panel">
      <div className="card-title" style={{ marginBottom: 16 }}>
        Water Quality Assessment
      </div>

      {/* Verdict block */}
      <div className={`quality-verdict ${qualityClass}`}>
        <div className={`quality-verdict-icon ${qualityClass}`}>
          {isGood ? <CheckCircle2 size={18} /> : <AlertTriangle size={18} />}
        </div>
        <div>
          <div className={`quality-verdict-title ${qualityClass}`}>
            {isGood ? "All Thresholds Met" : "Needs Attention"}
          </div>
          <div className="quality-verdict-sub">
            {isGood
              ? "All configured parameters are within safe operating limits."
              : `${failedParams.length} parameter${failedParams.length !== 1 ? "s" : ""} exceed configured threshold${failedParams.length !== 1 ? "s" : ""}.`}
          </div>
        </div>
      </div>

      {/* Metrics table */}
      <div className="quality-params">
        {params.map(p => (
          <div
            key={p.key}
            className={`quality-param-row ${p.status === "fail" ? "fail" : p.status === "pass" ? "pass" : "info"}`}
          >
            <span className="quality-param-name">{p.label}</span>
            <span className={`quality-param-val ${p.status === "fail" ? "fail" : p.status === "pass" ? "pass" : ""}`}>
              {p.value !== null ? `${fmt(p.value, p.digits)} ${p.unit}` : "--"}
            </span>
            <span className="quality-param-limit">{p.limit || "-"}</span>
            <span
              className="quality-param-status"
              style={{ color: p.status === "fail" ? "var(--red)" : p.status === "pass" ? "var(--green)" : "var(--text3)" }}
            >
              {p.status === "fail" ? "FAIL" : p.status === "pass" ? "OK" : p.status === "no-data" ? "N/A" : "-"}
            </span>
          </div>
        ))}
      </div>

      {/* Expandable Assessment Reasoning (Dropdown Form) */}
      <div className="reasoning-dropdown">
        <button
          className={`reasoning-dropdown-toggle${reasonsOpen ? " open" : ""}`}
          onClick={() => setReasonsOpen(o => !o)}
          aria-expanded={reasonsOpen}
          aria-controls="reasoning-dropdown-panel"
        >
          <span className="reasoning-dropdown-left">
            <Beaker size={14} className="reasoning-dropdown-icon-svg" />
            <span className="reasoning-dropdown-label">Detailed Assessment Reasoning</span>
            <span className="reasoning-summary-badges">
              {failCount > 0 && (
                <span className="reasoning-badge fail">
                  <AlertTriangle size={9} />
                  {failCount} Issue{failCount !== 1 ? "s" : ""}
                </span>
              )}
              {warnCount > 0 && (
                <span className="reasoning-badge warn">
                  <AlertTriangle size={9} />
                  {warnCount} Warning{warnCount !== 1 ? "s" : ""}
                </span>
              )}
              {passCount > 0 && (
                <span className="reasoning-badge pass">
                  <CheckCircle2 size={9} />
                  {passCount} OK
                </span>
              )}
            </span>
          </span>
          <ChevronDown
            size={16}
            className="reasoning-dropdown-chevron"
            style={{
              transform: reasonsOpen ? "rotate(180deg)" : "rotate(0deg)",
            }}
          />
        </button>

        <div
          id="reasoning-dropdown-panel"
          className={`reasoning-dropdown-panel${reasonsOpen ? " open" : ""}`}
        >
          <div className="reasoning-dropdown-content">
            {detailedReasons.map(r => {
              const isExpanded = expandedParam === r.key;
              return (
                <div key={r.key} className={`reasoning-param-card ${r.type}`}>
                  <button
                    className="reasoning-param-header"
                    onClick={() => setExpandedParam(isExpanded ? null : r.key)}
                    aria-expanded={isExpanded}
                  >
                    <div className={`reasoning-param-dot ${r.type}`}>
                      <StatusIcon type={r.type} />
                    </div>
                    <div className="reasoning-param-info">
                      <span className="reasoning-param-sensor">{r.sensor}</span>
                      <span className={`reasoning-param-val ${r.type}`}>{r.value}</span>
                      {r.limit && (
                        <span className="reasoning-param-limit">limit: {r.limit}</span>
                      )}
                    </div>
                    <ChevronRight
                      size={14}
                      className="reasoning-param-chevron"
                      style={{
                        transform: isExpanded ? "rotate(90deg)" : "rotate(0deg)",
                      }}
                    />
                  </button>

                  <div className={`reasoning-param-body${isExpanded ? " open" : ""}`}>
                    <div className="reasoning-param-body-inner">
                      <div className={`reasoning-param-headline ${r.type}`}>{r.headline}</div>
                      <div className="reasoning-param-detail">{r.detail}</div>
                      {r.action && (
                        <div className="reasoning-param-action">
                          <span className="reasoning-param-action-arrow">→</span>
                          <span>{r.action}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {latest.created_at && (
        <div className="text-xs text-muted" style={{ textAlign: "center", marginTop: 14, fontFamily: "JetBrains Mono,monospace" }}>
          Reading at {formatTimestamp(latest.created_at)}
        </div>
      )}

      <div className="disclaimer" style={{ display: "flex", alignItems: "center", gap: 6, justifyContent: "center" }}>
        <Info size={11} />
        <span>Monitoring system only - not a certified determination of drinking-water safety.</span>
      </div>
    </div>
  );
}
