/**
 * AquaSense — Centralized API service
 *
 * All backend requests go through this module.
 * The base URL is read from the VITE_API_BASE_URL env variable so
 * individual components never need to know the server address.
 *
 * IMPORTANT: VITE_ variables are exposed to the browser. Never store
 * ThingSpeak write keys, Wi-Fi passwords, or other secrets here.
 */

const BASE = import.meta.env.VITE_API_BASE_URL !== undefined 
  ? import.meta.env.VITE_API_BASE_URL 
  : "";

/**
 * Fetch the latest sensor data, history, model info, and thresholds.
 * @returns {Promise<object>}
 */
export async function fetchData() {
  const res = await fetch(`${BASE}/api/data`, { cache: "no-store" });
  if (!res.ok) throw new Error(`API /data returned HTTP ${res.status}`);
  return res.json();
}

/**
 * POST to /api/retrain — regenerates synthetic dataset and retrains model.
 * @returns {Promise<object>}
 */
export async function retrainModel() {
  const res = await fetch(`${BASE}/api/retrain`, { method: "POST" });
  const json = await res.json();
  if (!res.ok) throw new Error(json.message || `HTTP ${res.status}`);
  return json;
}

/**
 * Lightweight health check.
 * @returns {Promise<object>}
 */
export async function fetchHealth() {
  const res = await fetch(`${BASE}/api/health`, { cache: "no-store" });
  if (!res.ok) throw new Error(`API /health returned HTTP ${res.status}`);
  return res.json();
}
