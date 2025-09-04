import React, { useMemo, useState } from "react";
import { LS, load, save } from "./storage";
import "./modern-light.css";

export default function OperatorPull() {
  const [tools, setTools] = useState(load(LS.tools, []));
  const [pulls, setPulls] = useState(load(LS.pulls, []));
  const [queue, setQueue] = useState(load(LS.queue, []));
  const [search, setSearch] = useState("");

  // persist helpers
  const persistTools = (next) => { setTools(next); save(LS.tools, next); };
  const persistPulls = (next) => { setPulls(next); save(LS.pulls, next); };
  const persistQueue = (next) => { setQueue(next); save(LS.queue, next); };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return tools;
    return tools.filter((t) => {
      const hay = [
        t.name, t.manufacturer, t.partNumber, t.description, t.vendor,
        t.machineGroup, t.toolType,
      ].filter(Boolean).join(" ").toLowerCase();
      return hay.includes(q);
    });
  }, [tools, search]);

  const pullOne = (tool) => {
    if (!tool || (tool.quantity || 0) <= 0) return;
    const job = window.prompt(`Job number for pulling "${tool.name}"?`);
    if (!job) return;

    // decrement stock
    const updated = tools.map((t) =>
      t.id === tool.id ? { ...t, quantity: Math.max(0, (t.quantity || 0) - 1) } : t
    );
    persistTools(updated);

    // log pull
    const log = {
      id: Date.now(),
      toolId: tool.id,
      name: tool.name,
      job: job.trim(),
      qty: 1,
      ts: new Date().toISOString(),
    };
    persistPulls([...pulls, log]);
  };

  const requestReorder = (tool) => {
    if (!tool) return;
    const exists = queue.some((q) => q.id === tool.id);
    if (exists) return;
    const next = [...queue, tool];
    persistQueue(next);
    alert(`Requested reorder for "${tool.name}"`);
  };

  return (
    <div className="app">
      {/* Header */}
      <div className="header">
        <div className="brand">
          <div className="logo">👷</div>
          <h1>Operator</h1>
        </div>
        <div className="toolbar">
          <a className="btn" href="#/kitting">Job Kitting</a>
          <a className="btn" href="#/">⬅ Back to Admin</a>
        </div>
      </div>

      {/* Quick search */}
      <div className="controls">
        <div className="search">
          <input
            placeholder="Search tools (name, part #, type, machine group…) "
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Tool list (compact) */}
      <div className="card table-wrap">
        <div className="table-scroll">
          <table className="table">
            <thead>
              <tr>
                <th style={{ width: "46%" }}>Tool</th>
                <th>On Hand</th>
                <th>Type</th>
                <th>Machine</th>
                <th style={{ textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={5} className="subtle">No tools match your search.</td>
                </tr>
              )}
              {filtered.map((t) => {
                const isZero = (t.quantity || 0) === 0;
                const isLow = (t.quantity || 0) <= (t.threshold || 0);
                return (
                  <tr key={t.id}>
                    <td>
                      <div style={{ fontWeight: 600 }}>{t.name}</div>
                      <div className="subtle">
                        {t.manufacturer || "—"} · {t.partNumber || "—"}
                      </div>
                      {t.description && (
                        <div className="subtle" style={{ marginTop: 2 }}>{t.description}</div>
                      )}
                    </td>
                    <td>
                      {(t.quantity || 0)}{" "}
                      {isZero ? (
                        <span className="badge zero" style={{ marginLeft: 6 }}>Out</span>
                      ) : isLow ? (
                        <span className="badge low" style={{ marginLeft: 6 }}>Low</span>
                      ) : (
                        <span className="badge ok" style={{ marginLeft: 6 }}>OK</span>
                      )}
                    </td>
                    <td>{t.toolType || <span className="subtle">—</span>}</td>
                    <td>{t.machineGroup || <span className="subtle">—</span>}</td>
                    <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                      <div className="toolbar" style={{ justifyContent: "flex-end" }}>
                        <button
                          className="btn btn-primary"
                          disabled={(t.quantity || 0) <= 0}
                          onClick={() => pullOne(t)}
                          title="Pull 1 and log job #"
                        >
                          Pull
                        </button>
                        <button
                          className="btn"
                          onClick={() => requestReorder(t)}
                          title="Ask Admin to reorder"
                        >
                          Request Reorder
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pull history */}
      <div className="card" style={{ marginTop: 14 }}>
        <div style={{ padding: 12, borderBottom: "1px solid var(--border)" }}>
          <strong>🧾 Pull History</strong>
        </div>
        <ul style={{ listStyle: "none", margin: 0, padding: 12 }}>
          {pulls.length === 0 && <li className="subtle">No pulls logged yet.</li>}
          {pulls.slice().reverse().map((p) => (
            <li
              key={p.id}
              style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px dashed var(--border)" }}
            >
              <span>
                <strong>{p.name}</strong> — Job <strong>{p.job}</strong> — Qty {p.qty}
              </span>
              <span className="subtle">{new Date(p.ts).toLocaleString()}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
