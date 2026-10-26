import { useState, useEffect, useCallback, useRef } from "react";
import { fetchData, fetchHealth } from "../services/api";
import { generateDemoData } from "../utils/helpers";

const POLL_MS = 20_000; // Match the backend's REFRESH_SECONDS default

/**
 * useAquaData: central data-fetching hook.
 *
 * Returns live sensor data, history, model info, thresholds, health
 * status, loading/error state, and a manual refresh trigger.
 *
 * @param {boolean} demoMode  When true, uses simulated data only.
 */
export function useAquaData(demoMode = false) {
  const [data, setData]           = useState(null);
  const [health, setHealth]       = useState(null);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState(null);
  const [lastRefresh, setLastRefresh] = useState(null);
  const inFlight = useRef(false);

  const loadData = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;

    if (demoMode) {
      // Use clearly labelled simulated data
      setData(generateDemoData());
      setError(null);
      setLoading(false);
      setLastRefresh(new Date());
      inFlight.current = false;
      return;
    }

    try {
      const [apiData, apiHealth] = await Promise.all([
        fetchData(),
        fetchHealth().catch(() => null)   // health is optional
      ]);
      setData(apiData);
      setHealth(apiHealth);
      setError(null);
    } catch (err) {
      setError(err.message || "Failed to reach the backend");
    } finally {
      setLoading(false);
      setLastRefresh(new Date());
      inFlight.current = false;
    }
  }, [demoMode]);

  // Initial load
  useEffect(() => {
    loadData();
  }, [loadData]);

  // Auto-poll
  useEffect(() => {
    const id = setInterval(loadData, POLL_MS);
    return () => clearInterval(id);
  }, [loadData]);

  return { data, health, loading, error, lastRefresh, refresh: loadData };
}
