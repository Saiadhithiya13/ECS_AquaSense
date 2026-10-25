import React from "react";
import { formatTimestamp } from "../utils/helpers";

function HealthRow({ label, value, status, detail }) {
  const dotClass = status === "ok" ? "ok" : status === "warning" ? "warning" : status === "error" ? "error" : "unknown";
  return (
    <div className="health-item">
      <div className={`health-dot ${dotClass}`} role="img" aria-label={`Status: ${status}`} />
      <div>
        <div className="health-label">{label}</div>
        <div className="health-value">{value}</div>
        {detail && <div className="text-xs text-muted" style={{ marginTop: 2 }}>{detail}</div>}
      </div>
    </div>
  );
}

export default function SystemHealth({ data, health, lastRefresh, loading }) {
  if (loading) {
    return (
      <div className="card">
        <div className="skeleton skeleton-h" style={{ width: "40%", marginBottom: 12 }} />
        <div className="health-grid">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <div key={i} className="skeleton" style={{ height: 64, borderRadius: 10 }} />
          ))}
        </div>
      </div>
    );
  }

  // Derive statuses from real backend data
  const connection    = data?.connection;
  const thingspeak_ts = data?.thingspeak_last_success || health?.thingspeak_last_success;
  const lastEntry     = data?.latest?.created_at || health?.last_sensor_entry;
  const hasModel      = data?.model_accuracy !== undefined && data?.model_accuracy !== null;

  // Backend connection
  const backendOk = !!data;

  // ThingSpeak status
  const tsConnected = connection === "CONNECTED";
  const tsError     = connection === "ERROR";

  // Data freshness
  let dataFreshStatus = "unknown";
  let dataFreshLabel  = "Unknown";
  if (health?.data_fresh !== undefined) {
    dataFreshStatus = health.data_fresh ? "ok" : "warning";
    dataFreshLabel  = health.data_fresh ? "Fresh (< 5 min)" : "Stale (> 5 min)";
  } else if (lastEntry) {
    const delta = (Date.now() - new Date(lastEntry).getTime()) / 1000;
    if (delta < 120) { dataFreshStatus = "ok"; dataFreshLabel = "Fresh"; }
    else if (delta < 600) { dataFreshStatus = "warning"; dataFreshLabel = "Possibly stale"; }
    else { dataFreshStatus = "error"; dataFreshLabel = "Stale"; }
  }

  return (
    <div className="card">
      <div className="card-header">
        <div>
          <div className="card-title">System Health</div>
          <div className="card-subtitle">
            Status derived from actual backend responses and timestamps
          </div>
        </div>
        {lastRefresh && (
          <div className="text-xs text-muted">
            Checked: {lastRefresh.toLocaleTimeString()}
          </div>
        )}
      </div>

      <div className="health-grid">
        <HealthRow
          label="Backend API"
          value={backendOk ? "Reachable" : "Unreachable"}
          status={backendOk ? "ok" : "error"}
          detail={backendOk ? "Flask server responding" : "Check that app.py is running"}
        />

        <HealthRow
          label="ThingSpeak"
          value={tsConnected ? "Connected" : tsError ? "Error" : (connection || "Unknown")}
          status={tsConnected ? "ok" : tsError ? "error" : "warning"}
          detail={
            tsConnected
              ? `Channel ${data?.thresholds ? "data received" : "ID configured"}`
              : data?.error || "No recent data received"
          }
        />

        <HealthRow
          label="Data Freshness"
          value={dataFreshLabel}
          status={dataFreshStatus}
          detail={lastEntry ? `Last reading: ${formatTimestamp(lastEntry)}` : "No readings yet"}
        />

        <HealthRow
          label="ML Model"
          value={hasModel ? "Ready" : "Not trained"}
          status={hasModel ? "ok" : "warning"}
          detail={hasModel ? `Test accuracy: ${data.model_accuracy.toFixed(2)}% (synthetic data)` : "Waiting for training"}
        />

        <HealthRow
          label="Sensor Storage"
          value={data?.storage || "SQLite (water_quality.db)"}
          status={data?.latest ? "ok" : "warning"}
          detail={data?.history ? `${data.history.length} records saved in local SQLite file` : "Ready to store telemetry"}
        />

        <HealthRow
          label="Telemetry Sync"
          value="Every 30 s"
          status="ok"
          detail={lastRefresh ? `Last refresh: ${lastRefresh.toLocaleTimeString()}` : "Active sync"}
        />
      </div>

      <div className="disclaimer mt-3">
        ℹ Sensor readings are persistently saved to your local SQLite database (<code>water_quality.db</code>) every 30 seconds directly from ESP32 telemetry.
      </div>
    </div>
  );
}
