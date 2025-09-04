import React, { useMemo, useState } from "react";
import { LS, load, save } from "./storage";
import "./modern-light.css";

const SETUP_SLOTS = 12; // Tool 1..12

export default function JobKitting() {
  const [kits, setKits] = useState(load(LS.kits, []));
  const [tools] = useState(load(LS.tools, [])); // read-only here
  const [selectedId, setSelectedId] = useState(kits[0]?.id ?? null);

  const [newKit, setNewKit] = useState({ customer: "", project: "" });
  const [reqSearch, setReqSearch] = useState("");

  const selectedKit = useMemo(
    () => kits.find((k) => k.id === selectedId) || null,
    [kits, selectedId]
  );

  const persistKits = (next) => { setKits(next); save(LS.kits, next); };

  const createKit = () => {
    if (!newKit.customer.trim() || !newKit.project.trim()) return;
    const fresh = {
      id: Date.now(),
      customer: newKit.customer.trim(),
      project: newKit.project.trim(),
      requirements: [],       // [{id, toolId?, name, qty}]
      setup: {},              // { "1": reqId, "2": reqId, ... }
    };
    const next = [...kits, fresh];
    persistKits(next);
    setSelectedId(fresh.id);
    setNewKit({ customer: "", project: "" });
  };

  const deleteKit = (id) => {
    const next = kits.filter((k) => k.id !== id);
    persistKits(next);
    if (selectedId === id) setSelectedId(next[0]?.id ?? null);
  };

  const addRequirement = (name, toolId = null, qty = 1) => {
    if (!selectedKit) return;
    const req = { id: Date.now(), name: name.trim(), toolId, qty: Math.max(1, qty|0) };
    const updated = { ...selectedKit, requirements: [...selectedKit.requirements, req] };
    const next = kits.map((k) => (k.id === updated.id ? updated : k));
    persistKits(next);
  };

  const removeRequirement = (reqId) => {
    if (!selectedKit) return;
    const updated = {
      ...selectedKit,
      requirements: selectedKit.requirements.filter((r) => r.id !== reqId),
      setup: Object.fromEntries(Object.entries(selectedKit.setup).filter(([, rid]) => rid !== reqId)),
    };
    const next = kits.map((k) => (k.id === updated.id ? updated : k));
    persistKits(next);
  };

  const assignSetup = (slot, reqId) => {
    if (!selectedKit) return;
    const updated = { ...selectedKit, setup: { ...selectedKit.setup, [slot]: reqId || undefined } };
    const next = kits.map((k) => (k.id === updated.id ? updated : k));
    persistKits(next);
  };

  const printableSetup = () => {
    if (!selectedKit) return;
    const w = window.open("", "_blank", "width=900,height=1000");
    if (!w) return;

    const rows = Array.from({ length: SETUP_SLOTS }, (_, i) => {
      const slot = String(i + 1);
      const reqId = selectedKit.setup?.[slot];
      const req = selectedKit.requirements.find((r) => r.id === reqId);
      return `<tr><td style="padding:6px;border:1px solid #ddd;">${slot}</td><td style="padding:6px;border:1px solid #ddd;">${req ? escapeHtml(req.name) : ""}</td><td style="padding:6px;border:1px solid #ddd;">${req ? req.qty : ""}</td></tr>`;
    }).join("");

    const html = `
      <html>
        <head>
          <title>Setup Sheet — ${escapeHtml(selectedKit.customer)} — ${escapeHtml(selectedKit.project)}</title>
          <meta charset="utf-8" />
          <style>
            body { font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica Neue, Arial; padding: 16px; }
            h2, h3 { margin: 0 0 10px; }
            .muted { color: #6b7280; }
            table { border-collapse: collapse; width: 100%; margin-top: 10px; }
            th, td { border: 1px solid #ddd; padding: 6px; text-align: left; }
            th { background: #f8fafc; }
            ul { margin: 6px 0 0 16px; }
          </style>
        </head>
        <body>
          <h2>Setup Sheet</h2>
          <div class="muted">${escapeHtml(selectedKit.customer)} — ${escapeHtml(selectedKit.project)}</div>

          <h3 style="margin-top:14px;">Requirements</h3>
          <ul>
            ${selectedKit.requirements.map(r => `<li>${escapeHtml(r.name)}  ${r.qty ? `(x${r.qty})` : ""}</li>`).join("") || "<li>—</li>"}
          </ul>

          <h3 style="margin-top:14px;">Tool Assignments</h3>
          <table>
            <thead><tr><th>Tool #</th><th>Tool</th><th>Qty</th></tr></thead>
            <tbody>${rows}</tbody>
          </table>
          <script>setTimeout(() => window.print(), 100);</script>
        </body>
      </html>
    `;
    w.document.open();
    w.document.write(html);
    w.document.close();
  };

  const invMatches = useMemo(() => {
    const q = reqSearch.trim().toLowerCase();
    if (!q) return tools.slice(0, 10);
    return tools.filter((t) => {
      const hay = [t.name, t.partNumber, t.manufacturer, t.toolType, t.machineGroup]
        .filter(Boolean).join(" ").toLowerCase();
      return hay.includes(q);
    }).slice(0, 20);
  }, [tools, reqSearch]);

  return (
    <div className="app">
      {/* Header */}
      <div className="header">
        <div className="brand">
          <div className="logo">📦</div>
          <h1>Job Kitting</h1>
        </div>
        <div className="toolbar">
          <a className="btn" href="#/operator">Operator</a>
          <a className="btn" href="#/">⬅ Back to Admin</a>
        </div>
      </div>

      {/* Create kit */}
      <div className="card form">
        <div className="form-grid" style={{ gridTemplateColumns: "1fr 1fr auto auto" }}>
          <div className="input">
            <label>Customer</label>
            <input value={newKit.customer} onChange={(e) => setNewKit({ ...newKit, customer: e.target.value })} placeholder="Omni" />
          </div>
          <div className="input">
            <label>Project</label>
            <input value={newKit.project} onChange={(e) => setNewKit({ ...newKit, project: e.target.value })} placeholder="PSR Tib Inserts" />
          </div>
          <button className="btn btn-primary" onClick={createKit}>Create</button>
          {selectedKit && (
            <button className="btn" onClick={() => printableSetup()}>Print Setup Sheet</button>
          )}
        </div>
      </div>

      {/* Kit selector */}
      <div className="card">
        <div className="toolbar" style={{ padding: 12, borderBottom: "1px solid var(--border)" }}>
          <strong style={{ marginRight: 8 }}>Kits:</strong>
          {kits.length === 0 && <span className="subtle">No kits yet.</span>}
          {kits.map((k) => (
            <button
              key={k.id}
              className="btn"
              style={{ background: selectedId === k.id ? "var(--accent-50)" : undefined }}
              onClick={() => setSelectedId(k.id)}
            >
              {k.customer} — {k.project}
            </button>
          ))}
          {selectedKit && (
            <button className="btn btn-danger" style={{ marginLeft: "auto" }} onClick={() => deleteKit(selectedKit.id)}>
              Delete Selected
            </button>
          )}
        </div>

        {/* Two columns: Requirements | Setup Sheet */}
        {selectedKit && (
          <div className="layout" style={{ gridTemplateColumns: "1.4fr 1fr", marginTop: 0 }}>
            {/* Requirements */}
            <div className="card" style={{ padding: 12 }}>
              <h3 style={{ marginTop: 0 }}>Job Requirements</h3>

              {/* Add by search from inventory */}
              <div className="controls" style={{ marginTop: 8 }}>
                <div className="search" style={{ flex: 1 }}>
                  <input
                    placeholder="Find tool from inventory to add requirement…"
                    value={reqSearch}
                    onChange={(e) => setReqSearch(e.target.value)}
                  />
                </div>
                <button
                  className="btn"
                  onClick={() => {
                    const name = window.prompt("Add custom requirement (free text)");
                    if (name && name.trim()) addRequirement(name.trim(), null, 1);
                  }}
                >
                  + Custom
                </button>
              </div>

              {/* Inventory quick-pick */}
              <ul style={{ listStyle: "none", padding: 0, marginTop: 10 }}>
                {invMatches.map((t) => (
                  <li key={t.id} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px dashed var(--border)" }}>
                    <span>
                      <strong>{t.name}</strong> <span className="subtle">· {t.partNumber || "—"} · on hand {t.quantity || 0}</span>
                    </span>
                    <button className="btn" onClick={() => addRequirement(t.name, t.id, 1)}>Add</button>
                  </li>
                ))}
                {invMatches.length === 0 && <li className="subtle">No matching inventory.</li>}
              </ul>

              {/* Current requirements */}
              <div style={{ marginTop: 10 }}>
                <strong>Requirements List</strong>
                <ul style={{ listStyle: "none", padding: 0, marginTop: 6 }}>
                  {selectedKit.requirements.length === 0 && <li className="subtle">None yet.</li>}
                  {selectedKit.requirements.map((r) => (
                    <li key={r.id} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px dashed var(--border)" }}>
                      <span>{r.name} {r.qty ? <span className="subtle">(x{r.qty})</span> : null}</span>
                      <span className="toolbar">
                        <button
                          className="btn"
                          onClick={() => {
                            const q = window.prompt(`Qty for "${r.name}"`, String(r.qty || 1));
                            if (!q) return;
                            const qty = Math.max(1, parseInt(q, 10) || 1);
                            const updated = {
                              ...selectedKit,
                              requirements: selectedKit.requirements.map(x => x.id === r.id ? { ...x, qty } : x)
                            };
                            const next = kits.map((k) => (k.id === updated.id ? updated : k));
                            persistKits(next);
                          }}
                        >
                          Qty
                        </button>
                        <button className="btn btn-danger" onClick={() => removeRequirement(r.id)}>Remove</button>
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Setup sheet */}
            <div className="card" style={{ padding: 12 }}>
              <h3 style={{ marginTop: 0 }}>Setup Sheet</h3>
              <div className="subtle" style={{ marginBottom: 8 }}>Assign requirements to tool numbers to match the machine turret/magazine.</div>

              <table className="table" style={{ width: "100%" }}>
                <thead>
                  <tr>
                    <th style={{ width: 80 }}>Tool #</th>
                    <th>Assigned Requirement</th>
                    <th style={{ width: 80 }}>Qty</th>
                  </tr>
                </thead>
                <tbody>
                  {Array.from({ length: SETUP_SLOTS }, (_, i) => {
                    const slot = String(i + 1);
                    const currentReqId = selectedKit.setup?.[slot];
                    const currentReq = selectedKit.requirements.find((r) => r.id === currentReqId) || null;
                    return (
                      <tr key={slot}>
                        <td>{slot}</td>
                        <td>
                          <select
                            value={currentReqId || ""}
                            onChange={(e) => assignSetup(slot, e.target.value ? Number(e.target.value) : null)}
                            style={{ width: "100%", padding: 8, borderRadius: 8, border: "1px solid var(--border)" }}
                          >
                            <option value="">— Unassigned —</option>
                            {selectedKit.requirements.map((r) => (
                              <option key={r.id} value={r.id}>{r.name}</option>
                            ))}
                          </select>
                        </td>
                        <td>
                          {currentReq ? (currentReq.qty || 1) : <span className="subtle">—</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              <div className="toolbar" style={{ marginTop: 10, justifyContent: "flex-end" }}>
                <button className="btn" onClick={printableSetup}>Print</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[c]));
}
