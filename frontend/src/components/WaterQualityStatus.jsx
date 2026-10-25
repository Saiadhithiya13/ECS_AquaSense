import React from "react";
import { fmt, formatTimestamp } from "../utils/helpers";

export default function WaterQualityStatus({ latest, loading }) {
  if (loading) {
    return (
      <div className="card" style={{ display: "flex", flexDirection: "column", gap: 12, minHeight: 300 }}>
        <div className="skeleton skeleton-h" style={{ width: "50%" }} />
        <div style={{ flex: 1, display: "grid", placeItems: "center" }}>
          <div className="skeleton" style={{ width: 110, height: 110, borderRadius: "50%" }} />
        </div>
        <div className="skeleton skeleton-h" style={{ width: "70%" }} />
        <div className="skeleton skeleton-h sm" style={{ width: "40%" }} />
      </div>
    );
  }

  if (!latest) {
    return (
      <div className="card quality-panel">
        <div className="quality-circle waiting" aria-label="No data">❓</div>
        <div className="quality-name waiting">NO DATA</div>
        <div className="quality-caption">
          Waiting for sensor data from ThingSpeak.
          Check that the ESP32 is powered and connected to Wi-Fi.
        </div>
        <div className="disclaimer">
          This panel shows project threshold status, not certified water safety.
        </div>
      </div>
    );
  }

  const isGood = latest.quality === "GOOD";
  const qualityClass = isGood ? "good" : "bad";
  const qualityColor = isGood ? "var(--green)" : "var(--red)";

  const probability = latest.probability;
  const reasons = latest.reasons || [];
  const mlDiffers = (latest.ml_prediction !== latest.quality) && latest.ml_prediction;

  return (
    <div className="card quality-panel">
      <div className="text-xs text-muted font-semibold" style={{ textTransform: "uppercase", letterSpacing: "0.8px" }}>
        Water Quality Status
      </div>

      <div
        className={`quality-circle ${qualityClass}`}
        role="img"
        aria-label={`Water quality is ${latest.quality}`}
      >
        {isGood ? "✓" : "⚠"}
      </div>

      <div className={`quality-name ${qualityClass}`}>{latest.quality}</div>

      <div className="quality-caption">
        {isGood
          ? "All configured project thresholds are satisfied."
          : "One or more configured thresholds are exceeded."}
      </div>

      {reasons.length > 0 && (
        <ul style={{ fontSize: 11.5, color: "var(--text-secondary)", textAlign: "left", width: "100%", maxWidth: 280, paddingLeft: 16, lineHeight: 1.7 }}>
          {reasons.filter(r => !r.startsWith("All")).map((r, i) => (
            <li key={i}>{r}</li>
          ))}
        </ul>
      )}

      {/* ML confidence bar */}
      {probability !== null && probability !== undefined && (
        <div className="confidence-bar-wrap">
          <div className="confidence-label">
            <span>ML estimated "GOOD" probability</span>
            <b style={{ color: qualityColor }}>{fmt(probability, 1)}%</b>
          </div>
          <div className="confidence-track" role="progressbar" aria-valuenow={probability} aria-valuemin={0} aria-valuemax={100}>
            <div className="confidence-fill" style={{ width: `${Math.max(0, Math.min(100, probability))}%` }} />
          </div>
        </div>
      )}

      {mlDiffers && (
        <div style={{ fontSize: 11, color: "var(--amber)", background: "rgba(245,158,11,.08)", border: "1px solid rgba(245,158,11,.20)", borderRadius: 6, padding: "6px 10px", maxWidth: 280 }}>
          ℹ ML model predicted {latest.ml_prediction}. Threshold rule result ({latest.quality}) is used as the final classification.
        </div>
      )}

      {latest.created_at && (
        <div className="text-xs text-muted">
          Classified at: {formatTimestamp(latest.created_at)}
        </div>
      )}

      <div className="disclaimer">
        ⚠ This is a monitoring and screening system, not a certified determination of drinking-water safety.
      </div>
    </div>
  );
}
