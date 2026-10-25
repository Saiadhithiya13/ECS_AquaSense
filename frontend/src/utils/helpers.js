/**
 * AquaSense — Shared utility helpers
 */

/**
 * Format a numeric sensor value, returning "--" when the value is
 * missing, null, or non-finite.
 *
 * @param {any} value
 * @param {number} digits  decimal places
 * @returns {string}
 */
export function fmt(value, digits = 2) {
  if (value === null || value === undefined) return "--";
  const n = Number(value);
  if (!Number.isFinite(n)) return "--";
  return n.toFixed(digits);
}

/**
 * Parse an ISO timestamp string safely.
 * Returns a Date or null.
 */
export function parseTimestamp(ts) {
  if (!ts) return null;
  const d = new Date(ts);
  return isNaN(d.getTime()) ? null : d;
}

/**
 * Format a timestamp for display.
 */
export function formatTimestamp(ts, options = {}) {
  const d = parseTimestamp(ts);
  if (!d) return "--";
  return d.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    ...options
  });
}

/**
 * Format a timestamp as HH:MM for chart axis labels.
 */
export function formatChartTime(ts) {
  const d = parseTimestamp(ts);
  if (!d) return "--";
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

/**
 * Return the colour class for a sensor status.
 *
 * @param {"normal"|"warning"|"critical"|"unknown"} status
 * @returns {string}  CSS class prefix
 */
export function statusColor(status) {
  switch (status) {
    case "normal":   return "green";
    case "warning":  return "amber";
    case "critical": return "red";
    default:         return "muted";
  }
}

/**
 * Determine pH sensor status.
 */
export function phStatus(value, thresholds) {
  if (value === null || value === undefined) return "unknown";
  const { ph_low, ph_high } = thresholds;
  if (value < ph_low || value > ph_high) return "critical";
  // Warn if close to the boundary (within 0.5 pH)
  if (value < ph_low + 0.5 || value > ph_high - 0.5) return "warning";
  return "normal";
}

/**
 * Determine turbidity sensor status.
 */
export function turbidityStatus(value, thresholds) {
  if (value === null || value === undefined) return "unknown";
  const limit = thresholds.turbidity;
  if (value > limit) return "critical";
  if (value > limit * 0.8) return "warning";
  return "normal";
}

/**
 * Determine EC sensor status.
 */
export function ecStatus(value, thresholds) {
  if (value === null || value === undefined) return "unknown";
  const limit = thresholds.ec;
  if (value > limit) return "critical";
  if (value > limit * 0.8) return "warning";
  return "normal";
}

/**
 * Temperature has no configured alarm limit — always "normal" display.
 */
export function temperatureStatus() {
  return "normal";
}

/**
 * Export an array of objects to a CSV file and trigger browser download.
 * Only includes columns specified in `columns`.
 *
 * @param {object[]} rows
 * @param {string[]} columns
 * @param {string}   filename
 */
export function exportCSV(rows, columns, filename = "aquasense_export.csv") {
  const header = columns.join(",");
  const body = rows.map(row =>
    columns.map(col => {
      const v = row[col];
      if (v === null || v === undefined) return "";
      const s = String(v);
      // Quote fields containing commas or quotes
      return s.includes(",") || s.includes('"')
        ? `"${s.replace(/"/g, '""')}"`
        : s;
    }).join(",")
  );
  const csv = [header, ...body].join("\r\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href     = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Generate demo readings for use when the backend/ESP32 is offline.
 * Returns an object shaped identically to a real /api/data response.
 *
 * IMPORTANT: These values are clearly labeled as simulated; they must
 * never be silently mixed with real ThingSpeak readings.
 */
export function generateDemoData() {
  const now = Date.now();
  const history = Array.from({ length: 40 }, (_, i) => {
    const ts = new Date(now - (40 - i) * 20_000).toISOString();
    const ph = +(6.5 + Math.sin(i * 0.3) * 1.2 + (Math.random() - 0.5) * 0.3).toFixed(2);
    const turbidity = +(4 + Math.sin(i * 0.2) * 3 + Math.random() * 1).toFixed(2);
    const ec = +(350 + Math.sin(i * 0.15) * 150 + Math.random() * 30).toFixed(2);
    const temperature = +(28 + Math.sin(i * 0.1) * 3 + (Math.random() - 0.5)).toFixed(2);
    const quality = (ph >= 5.5 && ph <= 8.5 && turbidity <= 12 && ec <= 800) ? "GOOD" : "BAD";
    return {
      created_at: ts, entry_id: i + 1,
      ph, turbidity, ec, temperature,
      quality, ml_prediction: quality,
      probability: quality === "GOOD" ? 92.4 : 21.3,
      reasons: quality === "GOOD"
        ? ["All configured thresholds satisfied"]
        : ["Simulated threshold violation"]
    };
  });
  const latest = history[history.length - 1];
  return {
    latest, history,
    connection: "DEMO",
    last_update: new Date().toLocaleString(),
    thingspeak_last_success: null,
    error: "",
    model_accuracy: 97.83,
    training_samples: 6000,
    model_name: "Random Forest Classifier",
    model_note: "DEMO MODE — data is entirely simulated and does not reflect real sensor readings.",
    thresholds: { ph_low: 5.5, ph_high: 8.5, turbidity: 12, ec: 800 },
    isDemo: true
  };
}

/**
 * Clamp a value between min and max.
 */
export function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

/**
 * Filter history records by a time-range label.
 *
 * @param {object[]} history
 * @param {"1h"|"6h"|"24h"|"all"} range
 */
export function filterByRange(history, range) {
  if (range === "all" || !history.length) return history;
  const now   = Date.now();
  const hours = range === "1h" ? 1 : range === "6h" ? 6 : 24;
  const cutoff = now - hours * 60 * 60 * 1000;
  return history.filter(r => {
    const d = parseTimestamp(r.created_at);
    return d && d.getTime() >= cutoff;
  });
}

/**
 * Compute a simple summary from the history array.
 */
export function computeSummary(history) {
  if (!history.length) return null;
  const total      = history.length;
  const good       = history.filter(r => r.quality === "GOOD").length;
  const violations = total - good;
  const pct        = total > 0 ? Math.round((good / total) * 100) : 0;
  const lastViol   = [...history].reverse().find(r => r.quality !== "GOOD");
  return { total, good, violations, pct, lastViolation: lastViol || null };
}
