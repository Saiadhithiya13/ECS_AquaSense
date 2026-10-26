import React, { useState } from "react";
import { retrainModel } from "../services/api";
import { fmt } from "../utils/helpers";
import { Brain, RefreshCw } from "lucide-react";

function ConfirmModal({ onConfirm, onCancel }) {
  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="retrain-modal-title">
      <div className="modal">
        <div className="modal-title" id="retrain-modal-title">Retrain Random Forest Model?</div>
        <div className="modal-body">
          <p>This will generate a new synthetic dataset of 6,000 samples using the configured
          project thresholds and retrain the classifier.</p>
          <br />
          <p><strong>Important:</strong> Training uses <em>simulated</em> threshold-labelled data,
          not real sensor measurements. The resulting accuracy reflects synthetic performance only
          and does not indicate real-world water quality detection ability.</p>
          <br />
          <p>The operation may take a few seconds. Continue?</p>
        </div>
        <div className="modal-actions">
          <button id="retrain-cancel-btn" className="btn btn-secondary" onClick={onCancel}>Cancel</button>
          <button id="retrain-confirm-btn" className="btn btn-primary" onClick={onConfirm} autoFocus>
            Yes, Retrain
          </button>
        </div>
      </div>
    </div>
  );
}

export default function MLInsights({ data, onRetrainSuccess }) {
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading]     = useState(false);
  const [message, setMessage]     = useState(null); // { type, text }

  const { model_accuracy, training_samples, model_name, model_note, latest } = data || {};

  const handleRetrain = async () => {
    setShowModal(false);
    setLoading(true);
    setMessage(null);

    try {
      const result = await retrainModel();
      setMessage({ type: "success", text: result.message });
      if (onRetrainSuccess) onRetrainSuccess();
    } catch (err) {
      setMessage({ type: "error", text: err.message || "Retrain request failed." });
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {showModal && (
        <ConfirmModal
          onConfirm={handleRetrain}
          onCancel={() => setShowModal(false)}
        />
      )}

      <div className="card">
        <div className="card-header">
          <div>
            <div className="card-title">
              <Brain size={14} style={{ color: "var(--brand)" }} />
              Model Analysis
            </div>
            <div className="card-subtitle">Random Forest Classifier · Threshold-labeled synthetic data</div>
          </div>
        </div>

        {/* Synthetic data limitation note */}
        <div className="ml-note">
          <strong>⚠ Limitation:</strong> {model_note || (
            "The model is trained on synthetic data generated from configured thresholds, " +
            "not real sensor measurements. Reported accuracy reflects simulated performance only."
          )}
        </div>

        {/* Stats */}
        <div className="ml-stat-grid">
          <div className="ml-stat">
            <div className="ml-stat-label">Model</div>
            <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text)", marginTop: 2 }}>
              {model_name || "Random Forest"}
            </div>
          </div>
          <div className="ml-stat">
            <div className="ml-stat-label">Synthetic Test Accuracy</div>
            <div className="ml-stat-value">
              {model_accuracy !== null && model_accuracy !== undefined
                ? `${fmt(model_accuracy, 2)}%`
                : "--"}
            </div>
          </div>
          <div className="ml-stat">
            <div className="ml-stat-label">Training Samples</div>
            <div className="ml-stat-value">
              {training_samples ? Number(training_samples).toLocaleString() : "--"}
            </div>
          </div>
        </div>

        {/* Current classification */}
        {latest && (
          <div style={{ marginBottom: 14 }}>
            <div className="section-heading">Current Classification</div>
            <div style={{
              display: "flex", gap: 14, flexWrap: "wrap",
              padding: "11px 13px",
              background: "var(--surface2)",
              borderRadius: "var(--radius-md)",
              border: "1px solid var(--border)",
            }}>
              <div>
                <div className="text-xs text-muted" style={{ marginBottom: 3 }}>Threshold result (final)</div>
                <div style={{
                  fontSize: 15, fontWeight: 700,
                  color: latest.quality === "GOOD" ? "var(--green)" : "var(--red)"
                }}>
                  {latest.quality}
                </div>
              </div>
              <div>
                <div className="text-xs text-muted" style={{ marginBottom: 3 }}>ML model prediction</div>
                <div style={{
                  fontSize: 15, fontWeight: 700,
                  color: latest.ml_prediction === "GOOD" ? "var(--green)" : "var(--red)"
                }}>
                  {latest.ml_prediction || "--"}
                </div>
              </div>
              <div>
                <div className="text-xs text-muted" style={{ marginBottom: 3 }}>Estimated "GOOD" probability</div>
                <div style={{ fontSize: 15, fontWeight: 700, color: "var(--brand)" }}>
                  {latest.probability !== null && latest.probability !== undefined
                    ? `${fmt(latest.probability, 1)}%`
                    : "--"}
                </div>
              </div>
            </div>

            {latest.reasons && latest.reasons.length > 0 && (
              <div style={{ marginTop: 8 }}>
                <div className="text-xs text-muted font-semibold" style={{ marginBottom: 4 }}>Detected Threshold Violations</div>
                <ul style={{ fontSize: 12, color: "var(--text-secondary)", paddingLeft: 16, lineHeight: 1.7 }}>
                  {latest.reasons.map((r, i) => <li key={i}>{r}</li>)}
                </ul>
              </div>
            )}
          </div>
        )}

        <hr className="divider" />

        {/* Feature info */}
        <div style={{ marginBottom: 14 }}>
          <div className="section-heading">Input Features</div>
          <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
            {["pH", "Turbidity (NTU)", "EC (µS/cm)", "Temperature (°C)"].map(f => (
              <span key={f} style={{
                padding: "3px 9px",
                borderRadius: 20,
                background: "var(--info-bg)",
                color: "var(--brand)",
                fontSize: 11,
                fontWeight: 600,
                border: "1px solid rgba(23,107,104,0.2)",
              }}>
                {f}
              </span>
            ))}
          </div>
        </div>

        {/* Retrain button */}
        <button
          id="retrain-btn"
          className="btn btn-primary w-full"
          onClick={() => setShowModal(true)}
          disabled={loading}
          style={{ marginBottom: message ? 10 : 0 }}
        >
          {loading ? (
            <>
              <RefreshCw size={13} style={{ animation: "aq-ml-spin 1s linear infinite" }} />
              Training…
            </>
          ) : (
            <>
              <RefreshCw size={13} />
              Retrain Random Forest Model
            </>
          )}
        </button>

        {message && (
          <div className={`toast ${message.type}`} style={{ position: "static", boxShadow: "none", maxWidth: "100%" }}>
            {message.type === "success" ? "✓" : "✗"} {message.text}
          </div>
        )}

        <style>{`@keyframes aq-ml-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      </div>
    </>
  );
}
