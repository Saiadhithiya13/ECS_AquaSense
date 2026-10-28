import React, { useState, useRef, useEffect, useCallback } from "react";
import { fmt, formatTimestamp } from "../utils/helpers";
import { deleteReading } from "../services/api";
import { Trash2, Activity, AlertTriangle } from "lucide-react";

/**
 * ReadingsLog: shows every incoming sensor record with a delete button.
 *
 * Placed below the charts in the Sensor Trends page. Each row displays
 * the four sensor values (pH, turbidity, EC, temperature), the quality
 * status, and an action column containing a delete button.
 *
 * Deletion triggers a confirmation popup, sends a DELETE request to the
 * backend, then forces a data refresh.
 */
export default function ReadingsLog({ history, loading, onRefresh }) {
  const [deleting, setDeleting]   = useState(null);  // entry_id being deleted
  const [confirm, setConfirm]     = useState(null);  // entry_id awaiting confirmation
  const [error, setError]         = useState(null);
  const scrollRef = useRef(null);

  // Reverse-chronological: newest first
  const rows = history ? [...history].reverse() : [];

  // Auto-scroll to the top whenever new data arrives
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = 0;
    }
  }, [history?.length]);

  const handleDelete = useCallback(async (entryId) => {
    setConfirm(null);
    setDeleting(entryId);
    setError(null);
    try {
      await deleteReading(entryId);
      // Trigger a full data refresh so charts + everything else update
      if (onRefresh) await onRefresh();
    } catch (err) {
      setError(`Failed to delete #${entryId}: ${err.message}`);
    } finally {
      setDeleting(null);
    }
  }, [onRefresh]);

  if (loading) {
    return (
      <div className="card readings-log">
        <div className="skeleton skeleton-h" style={{ width: "40%", marginBottom: 14 }} />
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="skeleton" style={{ height: 48, borderRadius: 8, marginBottom: 8 }} />
        ))}
      </div>
    );
  }

  return (
    <div className="card readings-log">
      <div className="card-header">
        <div>
          <div className="card-title">
            <Activity size={15} style={{ color: "var(--brand)" }} /> Live Readings Log
          </div>
          <div className="card-subtitle">
            {rows.length > 0
              ? `${rows.length} record${rows.length !== 1 ? "s" : ""} · newest first`
              : "No readings recorded yet"}
          </div>
        </div>
      </div>

      {error && (
        <div className="readings-log-error">
          <AlertTriangle size={13} />
          <span>{error}</span>
          <button onClick={() => setError(null)} className="readings-log-error-close">×</button>
        </div>
      )}

      {!rows.length ? (
        <div className="readings-log-empty">
          <Activity size={24} style={{ opacity: 0.4, color: "var(--text3)", margin: "0 auto 8px" }} />
          <span>Waiting for sensor data from ESP32…</span>
        </div>
      ) : (
        <div className="readings-log-scroll" ref={scrollRef}>
          <table className="readings-log-table" aria-label="Live sensor readings log">
            <thead>
              <tr>
                <th>#</th>
                <th>Timestamp</th>
                <th>pH</th>
                <th>Turbidity</th>
                <th>EC</th>
                <th>Temp</th>
                <th>Status</th>
                <th className="readings-log-action-th">Action</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(row => {
                const id = row.entry_id;
                const isDeleting = deleting === id;
                const isConfirming = confirm === id;

                return (
                  <tr
                    key={id ?? row.created_at}
                    className={`readings-log-row${isDeleting ? " deleting" : ""}${isConfirming ? " confirming" : ""}`}
                  >
                    <td className="readings-log-id">{id ?? "–"}</td>
                    <td className="readings-log-ts">{formatTimestamp(row.created_at)}</td>
                    <td>{fmt(row.ph, 2)}</td>
                    <td>{fmt(row.turbidity, 1)} <span className="readings-log-unit">NTU</span></td>
                    <td>{fmt(row.ec, 0)} <span className="readings-log-unit">µS/cm</span></td>
                    <td>{fmt(row.temperature, 1)} <span className="readings-log-unit">°C</span></td>
                    <td>
                      <span className={`readings-log-pill ${row.quality === "GOOD" ? "good" : "bad"}`}>
                        {row.quality || "–"}
                      </span>
                    </td>
                    <td className="readings-log-action-cell">
                      {isConfirming ? (
                        <span className="readings-log-confirm">
                          <button
                            className="readings-log-confirm-yes"
                            onClick={() => handleDelete(id)}
                            title="Confirm delete"
                          >
                            Yes
                          </button>
                          <button
                            className="readings-log-confirm-no"
                            onClick={() => setConfirm(null)}
                            title="Cancel"
                          >
                            No
                          </button>
                        </span>
                      ) : (
                        <button
                          className="readings-log-delete-btn"
                          onClick={() => setConfirm(id)}
                          disabled={isDeleting || !id}
                          title={id ? `Delete reading #${id}` : "Cannot delete – no entry ID"}
                          aria-label={`Delete reading ${id}`}
                        >
                          {isDeleting ? (
                            <span className="readings-log-spinner" />
                          ) : (
                            <Trash2 size={13} />
                          )}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
