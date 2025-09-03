// src/OperatorPull.jsx
import React, { useMemo, useState } from "react";
import { LS, load, save, nowIso } from "./storage.old";
import "./modern-light.css";

export default function OperatorPull() {
  const session = load(LS.session, null);
  const [search, setSearch] = useState("");

  // local state mirrors localStorage, so the UI updates instantly
  const [tools, setTools] = useState(load(LS.tools, []));
  const [tx, setTx] = useState(load(LS.tx, [])); // pull history (transactions)

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
  }, [search, tools]);

  const writeTools = (next) => { setTools(next); save(LS.tools, next); };
  const writeTx = (next) => { setTx(next); save(LS.tx, next); };

  const pullQty = (tool, qty) => {
    const n = Math.max(0, parseInt(qty, 10) || 0);
    if (n <= 0) return;

    // Ask for Job #
    const job = window.prompt(`Job number for "${tool.name}" (required)`, "");
    if (job === null) return; // cancelled
    const jobTrim = String(job).trim();
    if (!jobTrim) {
      alert("Please enter a job number.");
      return;
    }

    // Update inventory (never below 0)
    const updated = tools.map((t) =>
      t.id === tool.id ? { ...t, quantity: Math.max(0, (t.quantity || 0) - n) } : t
    );
    writeTools(updated);

    // Log transaction (at the TOP)
    const entry = {
      id: `${tool.id}-${Date.now()}`,
      toolId: tool.id,
      name: tool.name,
      qty: n,
      by: session?.username || "operator",
      at: nowIso(),
      before: tool.quantity || 0,
      after: Math.max(0, (tool.quantity || 0) - n),
      job: jobTrim, // <-- record job number
    };
    writeTx([entry, ...tx].slice(0, 2000));
  };

  const undoLast = () => {
    const last = tx[0];
    if (!last) return;
    // Restore quantity
    const nextTools = tools.map((t) =>
      t.id === last.toolId ? { ...t, quantity: (t.quantity || 0) + last.qty } : t
    );
    writeTools(nextTools);
    // Remove the last record
    writeTx(tx.slice(1));
  };

  return (
    <div className="app">
      {/* Header */}
      <div className="header">
        <div className="brand">
          <div className="logo">🏭</div>
          <h1>Operator Pull</h1>
        </div>
        <div className="toolbar">
          <a className="btn" href="#/admin">Admin</a>
          <button
            className="btn"
            onClick={() => {
              localStorage.removeItem(LS.session);
              window.location.hash = "#/operator";
              window.location.reload(); // land immediately on login
            }}
          >
            Sign out
          </button>
        </div>
      </div>

      {/* Top tiles (no dollar totals shown) */}
      <div className="metrics">
        <div className="metric card stat-accent">
          <div className="label">Signed in</div>
          <div className="value">{session?.username || "operator"}</div>
          <div className="note">Role: operator</div>
        </div>
        <div className="metric card">
          <div className="label">Items in Inventory</div>
          <div className="value">{tools.length}</div>
          <div className="note">tracked locally</div>
        </div>
        <div className="metric card">
          <div className="label">Recent Pulls</div>
          <div className="value">{tx.length}</div>
          <div className="note">history on device</div>
        </div>
      </div>

      {/* Search + Undo */}
      <div className="controls">
        <div className="search" style={{ flex: 1 }}>
          <input
            placeholder="Search tools to pull…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <button className="btn" onClick={undoLast} disabled={!tx.length}>
          Undo Last Pull
        </button>
      </div>

      {/* Layout: table + history side panel */}
      <div className="layout">
        {/* LEFT: Tools table */}
        <div className="card table-wrap">
          <div className="table-scroll">
            <table className="table">
              <thead>
                <tr>
                  <th style={{ width: "40%" }}>Item</th>
                  <th>On Hand</th>
                  <th>Pull</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr><td colSpan={4} className="subtle">No matching tools.</td></tr>
                )}
                {filtered.map((t) => {
                  const isLow = (t.quantity || 0) <= (t.threshold || 0);
                  const isZero = (t.quantity || 0) === 0;
                  return (
                    <tr key={t.id}>
                      <td>
                        <div style={{ fontWeight: 700 }}>{t.name}</div>
                        <div className="subtle">{t.manufacturer || "—"} · {t.partNumber || "—"}</div>
                        {(t.machineGroup || t.toolType) && (
                          <div className="subtle" style={{ marginTop: 4, display: "flex", gap: 6, flexWrap: "wrap" }}>
                            {t.machineGroup && <span className="badge pill">{t.machineGroup}</span>}
                            {t.toolType && <span className="badge pill">{t.toolType}</span>}
                          </div>
                        )}
                      </td>
                      <td>{t.quantity || 0} (min {t.threshold || 0})</td>
                      <td style={{ minWidth: 220 }}>
                        <PullControl disabled={isZero} onPull={(n) => pullQty(t, n)} />
                      </td>
                      <td>
                        {isZero ? (
                          <span className="badge zero">❌ Out of Stock</span>
                        ) : isLow ? (
                          <span className="badge low">⚠️ Low Stock</span>
                        ) : (
                          <span className="badge ok">✅ In Stock</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* RIGHT: Pull History */}
        <aside className="card side">
          <h3 style={{ margin: 0 }}>Pull History</h3>
          <ul style={{ listStyle: "none", padding: 0, marginTop: 10, maxHeight: "60vh", overflow: "auto" }}>
            {!tx.length && <li className="subtle">No pulls yet.</li>}
            {tx.map((r) => (
              <li key={r.id} style={{ padding: "8px 0", borderBottom: "1px dashed var(--border)" }}>
                <strong>{r.name}</strong> — pulled {r.qty} by <em>{r.by}</em>
                <div className="subtle">
                  {new Date(r.at).toLocaleString()}
                  {r.job ? ` · Job #${r.job}` : ""}
                  {typeof r.before === "number" && typeof r.after === "number"
                    ? ` · qty ${r.before} → ${r.after}`
                    : ""}
                </div>
              </li>
            ))}
          </ul>
        </aside>
      </div>
    </div>
  );
}

function PullControl({ disabled, onPull }) {
  const [n, setN] = useState("");

  return (
    <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
      <input
        className="input"
        style={{ width: 90, padding: 8, border: "1px solid var(--border)", borderRadius: 10 }}
        placeholder="Qty"
        value={n}
        onChange={(e) => setN(e.target.value)}
        inputMode="numeric"
        disabled={disabled}
      />
      <button
        className="btn btn-success"
        disabled={disabled}
        onClick={() => {
          onPull?.(n);
          setN("");
        }}
      >
        Pull
      </button>
    </div>
  );
}
