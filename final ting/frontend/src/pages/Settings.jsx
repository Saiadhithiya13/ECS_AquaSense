import React from "react";

function ThresholdItem({ label, value, unit, description }) {
  return (
    <div className="threshold-item">
      <div className="threshold-label">{label}</div>
      <div>
        <span className="threshold-value">{value !== undefined && value !== null ? value : "--"}</span>
        <span className="threshold-unit">{unit}</span>
      </div>
      {description && <div className="text-xs text-muted" style={{ marginTop: 4, lineHeight: 1.5 }}>{description}</div>}
    </div>
  );
}

export default function Settings({ data }) {
  const thresholds = data?.thresholds;

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 20, fontWeight: 800, letterSpacing: "-0.5px", marginBottom: 4 }}>
          Settings
        </h1>
        <div className="text-sm text-muted">
          Read-only view of the current backend configuration.
        </div>
      </div>

      {/* Thresholds */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-header">
          <div>
            <div className="card-title">Configured Thresholds</div>
            <div className="card-subtitle">
              Source of truth: backend environment variables / ESP32 firmware constants
            </div>
          </div>
        </div>

        <div style={{
          fontSize: 12, color: "var(--amber)",
          background: "rgba(245,158,11,.08)", border: "1px solid rgba(245,158,11,.18)",
          borderRadius: 8, padding: "10px 14px", marginBottom: 16, lineHeight: 1.6
        }}>
          Notice: Thresholds are read-only in this interface. To change them, update the backend
          environment variables (see <code>.env.example</code>) and restart the Flask server.
          The ESP32 firmware uses the same values compiled at build time; update
          <code>water_quality.ino</code> if you need the hardware alarm to match.
        </div>

        <div className="threshold-grid">
          <ThresholdItem
            label="pH Minimum"
            value={thresholds?.ph_low}
            unit="pH"
            description="Readings below this value trigger a BAD classification and the ESP32 buzzer."
          />
          <ThresholdItem
            label="pH Maximum"
            value={thresholds?.ph_high}
            unit="pH"
            description="Readings above this value trigger a BAD classification and the ESP32 buzzer."
          />
          <ThresholdItem
            label="Turbidity Limit"
            value={thresholds?.turbidity}
            unit="NTU"
            description="Maximum turbidity. Values above this trigger a BAD classification."
          />
          <ThresholdItem
            label="EC Limit"
            value={thresholds?.ec}
            unit="µS/cm"
            description="Maximum electrical conductivity. Values above this trigger a BAD classification."
          />
        </div>
      </div>

      {/* ThingSpeak info */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-header">
          <div>
            <div className="card-title">ThingSpeak Channel</div>
            <div className="card-subtitle">Field mapping from the ESP32 firmware</div>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 12 }}>
          {[
            { field: "Field 1", sensor: "pH", unit: "pH", fw: "phValue" },
            { field: "Field 2", sensor: "Turbidity", unit: "NTU", fw: "turbidity" },
            { field: "Field 3", sensor: "Electrical Conductivity", unit: "µS/cm", fw: "ecValue" },
            { field: "Field 4", sensor: "Temperature", unit: "°C", fw: "temperature" },
          ].map(({ field, sensor, unit, fw }) => (
            <div key={field} style={{
              background: "var(--surface2)", border: "1px solid var(--border)",
              borderRadius: "var(--radius-md)", padding: "12px 14px"
            }}>
              <div style={{ fontSize: 10.5, color: "var(--text-muted)", fontWeight: 600, marginBottom: 4 }}>
                {field}
              </div>
              <div style={{ fontWeight: 600, color: "var(--text)", fontSize: 13.5 }}>
                {sensor} ({unit})
              </div>
              <div className="text-xs text-muted" style={{ marginTop: 2 }}>
                Firmware variable: <code style={{ color: "var(--accent)" }}>{fw}</code>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ML info */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-header">
          <div>
            <div className="card-title">Machine Learning Configuration</div>
            <div className="card-subtitle">Random Forest Classifier settings</div>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12 }}>
          {[
            { label: "Algorithm", value: "Random Forest" },
            { label: "Estimators", value: "160 trees" },
            { label: "Max Depth", value: "12" },
            { label: "Min Samples Leaf", value: "2" },
            { label: "Class Weight", value: "balanced" },
            { label: "Training Samples", value: data?.training_samples ? Number(data.training_samples).toLocaleString() : "--" },
          ].map(({ label, value }) => (
            <div key={label} style={{
              background: "var(--surface2)", border: "1px solid var(--border)",
              borderRadius: "var(--radius-md)", padding: "10px 12px"
            }}>
              <div className="threshold-label">{label}</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: "var(--accent)" }}>{value}</div>
            </div>
          ))}
        </div>

        <div className="disclaimer mt-3">
          The Random Forest is trained on synthetic data generated using the project thresholds.
          Labels are assigned by the same rule-based classifier used for real-time decisions.
          The reported accuracy measures performance on held-out synthetic samples only and does
          not represent real-world water quality detection capability.
        </div>
      </div>

      {/* Storage note */}
      <div className="card">
        <div className="card-title" style={{ marginBottom: 8 }}>Data Storage</div>
        <div className="text-sm text-secondary" style={{ lineHeight: 1.7 }}>
          Sensor readings are stored <strong>in memory only</strong> within the Flask process.
          All readings are lost when the server is restarted. The backend fetches up to 100
          recent records from ThingSpeak on each polling cycle.<br /><br />
          To add persistent storage, consider writing readings to a SQLite database or
          exporting them periodically via the CSV export feature.
        </div>
      </div>
    </div>
  );
}
