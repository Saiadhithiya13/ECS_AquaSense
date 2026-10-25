import React, { useState, useMemo } from "react";
import { fmt, formatTimestamp, exportCSV } from "../utils/helpers";
import { Download, ArrowUpDown } from "lucide-react";

const PAGE_SIZE = 15;

const COLUMNS = [
  { key: "created_at",  label: "Timestamp",     render: (v) => formatTimestamp(v) },
  { key: "ph",          label: "pH",             render: (v) => fmt(v, 2) },
  { key: "turbidity",   label: "Turbidity (NTU)",render: (v) => fmt(v, 1) },
  { key: "ec",          label: "EC (µS/cm)",     render: (v) => fmt(v, 1) },
  { key: "temperature", label: "Temperature (°C)",render: (v) => fmt(v, 1) },
  { key: "quality",     label: "Status",         render: (v) => (
    <span className={`pill pill-${v === "GOOD" ? "good" : "bad"}`}>{v}</span>
  )},
];

const CSV_COLUMNS = ["created_at", "ph", "turbidity", "ec", "temperature", "quality", "ml_prediction", "probability"];

export default function ReadingsTable({ history, loading }) {
  const [search, setSearch]   = useState("");
  const [page, setPage]       = useState(1);
  const [sortKey, setSortKey] = useState("created_at");
  const [sortDir, setSortDir] = useState("desc");

  const filtered = useMemo(() => {
    if (!history) return [];
    const q = search.toLowerCase().trim();
    return history.filter(r => !q || Object.values(r).some(v => String(v).toLowerCase().includes(q)));
  }, [history, search]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      const va = a[sortKey] ?? "";
      const vb = b[sortKey] ?? "";
      const cmp = typeof va === "number"
        ? va - vb
        : String(va).localeCompare(String(vb));
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [filtered, sortKey, sortDir]);

  const totalPages = Math.ceil(sorted.length / PAGE_SIZE);
  const pageRows   = sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const handleSort = key => {
    if (sortKey === key) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("desc"); }
    setPage(1);
  };

  const handleSearch = e => { setSearch(e.target.value); setPage(1); };

  const handleExport = () => {
    if (!history || !history.length) return;
    exportCSV(
      history,                     // All available data (not just current page)
      CSV_COLUMNS,
      `aquasense_readings_${new Date().toISOString().split("T")[0]}.csv`
    );
  };

  if (loading) {
    return (
      <div className="card">
        <div className="skeleton skeleton-h" style={{ width: "40%", marginBottom: 16 }} />
        <div className="skeleton skeleton-block" style={{ height: 200 }} />
      </div>
    );
  }

  return (
    <div className="card">
      <div className="card-header">
        <div>
          <div className="card-title">Recent Readings</div>
          <div className="card-subtitle">
            {history ? history.length : 0} records from ThingSpeak
          </div>
        </div>
        <button
          id="export-csv-btn"
          className="btn btn-secondary btn-sm"
          onClick={handleExport}
          disabled={!history || !history.length}
          title="Export all available records as CSV"
        >
          <Download size={14} />
          Export CSV
        </button>
      </div>

      <div className="table-controls">
        <input
          id="readings-search"
          className="search-input"
          type="text"
          placeholder="Search readings…"
          value={search}
          onChange={handleSearch}
          aria-label="Search readings"
        />
        <span className="text-xs text-muted">
          {filtered.length} of {history ? history.length : 0} records
        </span>
      </div>

      {!pageRows.length ? (
        <div style={{ textAlign: "center", color: "var(--text-muted)", padding: "30px 0", fontSize: 13 }}>
          {search ? "No records match your search." : "No readings available yet."}
        </div>
      ) : (
        <>
          <div className="table-scroll">
            <table aria-label="Sensor readings table">
              <thead>
                <tr>
                  {COLUMNS.map(col => (
                    <th
                      key={col.key}
                      onClick={() => handleSort(col.key)}
                      title={`Sort by ${col.label}`}
                    >
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                        {col.label}
                        <ArrowUpDown size={11} opacity={sortKey === col.key ? 1 : 0.35} />
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pageRows.map((row, i) => (
                  <tr key={row.entry_id ?? i}>
                    {COLUMNS.map(col => (
                      <td key={col.key}>{col.render(row[col.key], row)}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="pagination">
            <span>
              Page {page} of {totalPages} · showing {pageRows.length} records
            </span>
            <div className="page-btns">
              <button
                className="page-btn"
                onClick={() => setPage(1)}
                disabled={page === 1}
                aria-label="First page"
              >«</button>
              <button
                className="page-btn"
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                aria-label="Previous page"
              >‹</button>

              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                const start = Math.max(1, Math.min(page - 2, totalPages - 4));
                const n = start + i;
                if (n > totalPages) return null;
                return (
                  <button
                    key={n}
                    className={`page-btn${page === n ? " active" : ""}`}
                    onClick={() => setPage(n)}
                    aria-current={page === n ? "page" : undefined}
                  >{n}</button>
                );
              })}

              <button
                className="page-btn"
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                aria-label="Next page"
              >›</button>
              <button
                className="page-btn"
                onClick={() => setPage(totalPages)}
                disabled={page === totalPages}
                aria-label="Last page"
              >»</button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
