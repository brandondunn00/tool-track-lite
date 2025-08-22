import React, { useMemo, useState } from "react";
import "./modern-light.css";

/* ---------------- Reusable input ---------------- */
function Input({ label, value, onChange, ...props }) {
  return (
    <div className="input">
      <label>{label}</label>
      <input
        {...props}
        value={String(value ?? "")}
        onChange={(e) => onChange?.(e.target.value)}
      />
    </div>
  );
}

/* ---------------- Helpers ---------------- */
const money = (v) =>
  Number(v || 0).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

// tiny sparkline (no libs)
function sparklinePath(points, w = 260, h = 80, pad = 6) {
  if (!points.length) return "";
  const ys = points;
  const min = Math.min(...ys);
  const max = Math.max(...ys);
  const range = max - min || 1;
  const x = (i, n) => pad + (i / (n - 1 || 1)) * (w - pad * 2);
  const y = (v) => h - pad - ((v - min) / range) * (h - pad * 2);
  return points
    .map((v, i, a) => `${i === 0 ? "M" : "L"} ${x(i, a.length).toFixed(1)} ${y(v).toFixed(1)}`)
    .join(" ");
}

function makeHistory(qty = 0, threshold = 0) {
  const base = Math.max(threshold * 1.2, 10);
  const step = Math.max(1, Math.round((qty || 6) / 6));
  return Array.from({ length: 12 }, (_, i) => {
    const decay = Math.max(0, qty - i * step);
    return Math.round((decay + base) / 1.5);
  }).reverse();
}

/* ---------------- Main ---------------- */
export default function ToolInventoryApp() {
  const [tools, setTools] = useState([]);
  const [form, setForm] = useState({
    name: "",
    manufacturer: "",
    partNumber: "",
    description: "",
    quantity: "",
    threshold: "",
    price: "",
  });
  const [queue, setQueue] = useState([]);
  const [orders, setOrders] = useState([]);
  const [toast, setToast] = useState("");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState(null);

  // modal
  const [isModalOpen, setModalOpen] = useState(false);
  const [modal, setModal] = useState({
    id: null,
    name: "",
    manufacturer: "",
    partNumber: "",
    description: "",
    quantity: 0,
    threshold: 0,
    price: 0,
    vendor: "",
    projects: "",
  });

  const note = (msg) => {
    setToast(msg);
    clearTimeout(note._t);
    note._t = setTimeout(() => setToast(""), 2400);
  };

  const totalQty = tools.reduce((a, t) => a + (t.quantity || 0), 0);
  const totalValue = tools.reduce((a, t) => a + (t.quantity || 0) * (t.price || 0), 0);

  const filteredTools = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return tools;
    return tools.filter((t) => {
      const hay = [t.name, t.manufacturer, t.partNumber, t.description]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [tools, search]);

  const selected = useMemo(
    () => tools.find((t) => t.id === selectedId) || null,
    [tools, selectedId]
  );

  /* ---------------- Actions ---------------- */
  const addTool = () => {
    if (!form.name?.trim()) return;
    const t = {
      id: Date.now(),
      name: form.name.trim(),
      manufacturer: form.manufacturer.trim(),
      partNumber: form.partNumber.trim(),
      description: form.description.trim(),
      quantity: Math.max(0, parseInt(form.quantity || 0, 10)),
      threshold: Math.max(0, parseInt(form.threshold || 0, 10)), // low when qty <= threshold
      price: Number(parseFloat(form.price || 0).toFixed(2)),
      vendor: "",
      projects: [],
    };
    setTools((prev) => [...prev, t]);
    setForm({
      name: "",
      manufacturer: "",
      partNumber: "",
      description: "",
      quantity: "",
      threshold: "",
      price: "",
    });
    setSelectedId(t.id);
    note("Tool added ✅");
  };

  const updateQty = (id, delta) => {
    setTools((prev) =>
      prev.map((t) =>
        t.id === id ? { ...t, quantity: Math.max(0, (t.quantity || 0) + delta) } : t
      )
    );
    const tool = tools.find((t) => t.id === id);
    if (tool && Math.max(0, (tool.quantity || 0) + delta) === 0) {
      setQueue((q) => (q.some((x) => x.id === id) ? q : [...q, tool]));
      note(`${tool.name} hit 0 ⚠️`);
    }
  };

  const removeTool = (id) => {
    if (!window.confirm("Delete this tool?")) return;
    setTools((prev) => prev.filter((t) => t.id !== id));
    setQueue((prev) => prev.filter((t) => t.id !== id));
    setOrders((prev) => prev.filter((o) => o.id !== id));
    if (selectedId === id) setSelectedId(null);
    note("Tool deleted 🗑️");
  };

  const addToQueue = (tool) => {
    setQueue((q) => (q.some((x) => x.id === tool.id) ? q : [...q, tool]));
    note("Added to reorder queue 📦");
  };
  const removeFromQueue = (id) => setQueue((prev) => prev.filter((t) => t.id !== id));

  const markOrdered = (id) => {
    const t = tools.find((x) => x.id === id);
    if (!t) return;
    const order = {
      orderId: `${id}-${Date.now()}`,
      id,
      name: t.name,
      quantity: t.threshold || 1,
      price: t.price || 0,
      orderedAt: new Date().toISOString(),
    };
    setOrders((prev) => (prev.some((o) => o.id === id) ? prev : [...prev, order]));
    removeFromQueue(id);
    note("Marked as ordered 🧾");
  };

  const markReceived = (orderId) => {
    const o = orders.find((x) => x.orderId === orderId);
    if (!o) return;
    const input = window.prompt(`Qty received for "${o.name}"`, String(o.quantity || 1));
    if (input === null) return;
    const received = Math.max(0, parseInt(input, 10) || 0);
    if (received <= 0) return note("Enter a valid positive number.");
    setTools((prev) =>
      prev.map((t) => (t.id === o.id ? { ...t, quantity: (t.quantity || 0) + received } : t))
    );
    setOrders((prev) => prev.filter((x) => x.orderId !== orderId));
    note("Order received ✅");
  };

  const undoOrdered = (orderId) => {
    const o = orders.find((x) => x.orderId === orderId);
    if (!o) return;
    addToQueue({ id: o.id, name: o.name, quantity: o.quantity, threshold: 0, price: o.price });
    setOrders((prev) => prev.filter((x) => x.orderId !== orderId));
    note("Moved back to queue ↩️");
  };

  const removePending = (orderId) => {
    setOrders((prev) => prev.filter((x) => x.orderId !== orderId));
    note("Pending order removed");
  };

  const exportCSV = () => {
    const header = ["Employee", "Job", "Tool", "Qty", "Timestamp"];
    const rows = tools.map((t) => ["N/A", "N/A", t.name, t.quantity, new Date().toISOString()]);
    const csv = [header, ...rows].map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "tools.csv";
    a.click();
    URL.revokeObjectURL(url);
    note("Exported CSV 📤");
  };

  // modal helpers
  const openDetails = (tool) => {
    setModal({
      id: tool.id,
      name: tool.name,
      manufacturer: tool.manufacturer || "",
      partNumber: tool.partNumber || "",
      description: tool.description || "",
      quantity: tool.quantity || 0,
      threshold: tool.threshold || 0,
      price: tool.price || 0,
      vendor: tool.vendor || "",
      projects: (tool.projects || []).join(", "),
    });
    setModalOpen(true);
  };
  const saveDetails = () => {
    setTools((prev) =>
      prev.map((t) =>
        t.id === modal.id
          ? {
              ...t,
              name: modal.name.trim(),
              manufacturer: modal.manufacturer.trim(),
              partNumber: modal.partNumber.trim(),
              description: modal.description.trim(),
              quantity: Math.max(0, parseInt(modal.quantity, 10) || 0),
              threshold: Math.max(0, parseInt(modal.threshold, 10) || 0),
              price: Number(parseFloat(modal.price || 0).toFixed(2)),
              vendor: modal.vendor.trim(),
              projects: modal.projects
                .split(",")
                .map((p) => p.trim())
                .filter(Boolean),
            }
          : t
      )
    );
    setModalOpen(false);
    note("Details saved 💾");
  };

  /* ---------------- UI ---------------- */
  return (
    <div className="app">
      {/* Header */}
      <div className="header">
        <div className="brand">
          <div className="logo">🛠️</div>
          <h1>Purchasing Planning</h1>
        </div>
        <div className="toolbar">
          <button className="btn" onClick={exportCSV}>Export CSV</button>
        </div>
      </div>

      {/* Stat Tiles */}
      <div className="metrics">
        <div className="metric card stat-accent">
          <div className="label">Purchase Recommended</div>
          <div className="value">
            {tools.filter((t) => (t.quantity || 0) <= (t.threshold || 0)).length}
          </div>
          <div className="note">Low or zero stock</div>
        </div>
        <div className="metric card">
          <div className="label">Reorder Queue</div>
          <div className="value">{queue.length}</div>
          <div className="note">Awaiting PO</div>
        </div>
        <div className="metric card">
          <div className="label">Out of Stock</div>
          <div className="value">
            {tools.filter((t) => (t.quantity || 0) === 0).length}
          </div>
          <div className="note">Immediate action</div>
        </div>
        <div className="metric card">
          <div className="label">Inventory Value</div>
          <div className="value">{money(totalValue)}</div>
          <div className="note">{totalQty} items</div>
        </div>
      </div>

      {/* Search + toggles */}
      <div className="controls">
        <div className="search">
          <input
            placeholder="Search name, manufacturer, part #, description…"
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <button className="pill active">Item UoM</button>
        <button className="pill">Vendor UoM</button>
        <button className="pill">Filter</button>
      </div>

      {/* Add Tool (wider grid) */}
      <div className="card form">
        <div
          className="form-grid"
          style={{ gridTemplateColumns: "2fr 1.4fr 1.4fr 2fr 1fr 1fr 1fr auto" }}
        >
          <Input
            label="Tool Name"
            value={form.name}
            onChange={(v) => setForm({ ...form, name: v })}
            placeholder='e.g., 1/4" Carbide Endmill'
          />
          <Input
            label="Manufacturer"
            value={form.manufacturer}
            onChange={(v) => setForm({ ...form, manufacturer: v })}
            placeholder="YG-1"
          />
          <Input
            label="Part Number"
            value={form.partNumber}
            onChange={(v) => setForm({ ...form, partNumber: v })}
            placeholder="EM1234-0250"
          />
          <Input
            label="Description"
            value={form.description}
            onChange={(v) => setForm({ ...form, description: v })}
            placeholder="2-flute, TiAlN"
          />
          <Input
            label="Qty"
            type="number"
            value={form.quantity}
            onChange={(v) => setForm({ ...form, quantity: v })}
            placeholder="12"
          />
          <Input
            label="Low Threshold"
            type="number"
            value={form.threshold}
            onChange={(v) => setForm({ ...form, threshold: v })}
            placeholder="10"
          />
          <Input
            label="Price (USD)"
            type="number"
            step="0.01"
            value={form.price}
            onChange={(v) => setForm({ ...form, price: v })}
            placeholder="15.50"
          />
          <button className="btn btn-primary" onClick={addTool}>Add Tool</button>
        </div>
      </div>

      {/* Main layout: table (wide) + details (narrow) */}
      <div className="layout">
        {/* LEFT: Inventory table */}
        <div className="card table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th style={{ width: "42%" }}>Item</th>
                <th>On Hand</th>
                <th style={{ textAlign: "right" }}>Total Cost</th>
                <th>Actions</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {filteredTools.length === 0 && (
                <tr>
                  <td colSpan={5} style={{ color: "var(--muted)" }}>
                    No items found.
                  </td>
                </tr>
              )}
              {filteredTools.map((t) => {
                const isLow = (t.quantity || 0) <= (t.threshold || 0);
                const isZero = (t.quantity || 0) === 0;
                const cap = Math.max(t.threshold * 2 || 20, 10);
                const pct = Math.min(100, Math.round(((t.quantity || 0) / cap) * 100));
                const active = selectedId === t.id;

                return (
                  <tr
                    key={t.id}
                    onClick={() => setSelectedId(t.id)}
                    style={{ cursor: "pointer", background: active ? "#f5faff" : undefined }}
                    title="Click to view details"
                  >
                    <td>
                      <div style={{ fontWeight: 600 }}>{t.name}</div>
                      <div className="subtle">
                        {t.manufacturer || "—"} · {t.partNumber || "—"}
                      </div>
                      {t.description && (
                        <div className="subtle" style={{ marginTop: 2 }}>
                          {t.description}
                        </div>
                      )}
                    </td>
                    <td style={{ minWidth: 220 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <input
                          style={{
                            width: 90,
                            padding: 8,
                            border: "1px solid var(--border)",
                            borderRadius: 10,
                          }}
                          type="number"
                          value={t.quantity || 0}
                          onChange={(e) =>
                            setTools((prev) =>
                              prev.map((x) =>
                                x.id === t.id
                                  ? { ...x, quantity: parseInt(e.target.value || 0, 10) }
                                  : x
                              )
                            )
                          }
                          onClick={(e) => e.stopPropagation()}
                        />
                        <div style={{ flex: 1 }}>
                          <div className="progress">
                            <span style={{ width: `${pct}%` }} />
                          </div>
                          <div className="subtle">
                            {t.quantity || 0} on hand · min {t.threshold || 0}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td style={{ textAlign: "right" }}>
                      {money((t.quantity || 0) * (t.price || 0))}
                    </td>
                    <td style={{ whiteSpace: "nowrap" }}>
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        <button
                          className="btn"
                          onClick={(e) => {
                            e.stopPropagation();
                            updateQty(t.id, -1);
                          }}
                        >
                          -1
                        </button>
                        <button
                          className="btn"
                          onClick={(e) => {
                            e.stopPropagation();
                            updateQty(t.id, 1);
                          }}
                        >
                          +1
                        </button>
                        <button
                          className="btn"
                          onClick={(e) => {
                            e.stopPropagation();
                            addToQueue(t);
                          }}
                        >
                          Reorder
                        </button>
                        <button
                          className="btn"
                          onClick={(e) => {
                            e.stopPropagation();
                            openDetails(t);
                          }}
                        >
                          Details
                        </button>
                        <button
                          className="btn btn-danger"
                          onClick={(e) => {
                            e.stopPropagation();
                            removeTool(t.id);
                          }}
                        >
                          Delete
                        </button>
                      </div>
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

        {/* RIGHT: Details / analytics card */}
        <aside className="card side">
          {!selected ? (
            <>
              <h3>Expected On-Hand Supply</h3>
              <div className="subtle">Pick an item to see details (vendors, incoming, demand)</div>
              <svg
                width="100%"
                height="86"
                viewBox="0 0 260 86"
                preserveAspectRatio="none"
                style={{
                  background: "#fafafa",
                  border: "1px solid var(--border)",
                  borderRadius: 10,
                  marginTop: 10,
                }}
              >
                <path d={sparklinePath(makeHistory(12, 6))} fill="none" stroke="#60a5fa" strokeWidth="2" />
                <line x1="0" x2="260" y1="70" y2="70" stroke="#f59e0b" strokeDasharray="4 4" strokeWidth="1" />
              </svg>
              <div className="subtle" style={{ marginTop: 8 }}>(Select an item on the left)</div>
            </>
          ) : (
            <>
              <h3 style={{ marginBottom: 4 }}>{selected.name}</h3>
              <div className="subtle" style={{ marginBottom: 10 }}>
                {selected.manufacturer || "—"} · {selected.partNumber || "—"}
              </div>

              <svg
                width="100%"
                height="86"
                viewBox="0 0 260 86"
                preserveAspectRatio="none"
                style={{ background: "#fafafa", border: "1px solid var(--border)", borderRadius: 10 }}
              >
                <path
                  d={sparklinePath(makeHistory(selected.quantity, selected.threshold))}
                  fill="none"
                  stroke="#60a5fa"
                  strokeWidth="2"
                />
                <line x1="0" x2="260" y1="70" y2="70" stroke="#f59e0b" strokeDasharray="4 4" strokeWidth="1" />
              </svg>

              <div className="kpi">
                <div>
                  <div className="subtle">On Hand</div>
                  <div style={{ fontWeight: 700, fontSize: 18 }}>{selected.quantity || 0}</div>
                </div>
                <div>
                  <div className="subtle">Incoming</div>
                  <div style={{ fontWeight: 700, fontSize: 18 }}>
                    {orders.filter((o) => o.id === selected.id).length}
                  </div>
                </div>
                <div>
                  <div className="subtle">Demand</div>
                  <div style={{ fontWeight: 700, fontSize: 18 }}>
                    {Math.max(0, (selected.threshold || 0) - (selected.quantity || 0))}
                  </div>
                </div>
              </div>

              <div className="toolbar" style={{ marginTop: 8 }}>
                <button className="btn" onClick={() => updateQty(selected.id, -1)}>-1</button>
                <button className="btn" onClick={() => updateQty(selected.id, +1)}>+1</button>
                <button className="btn" onClick={() => addToQueue(selected)}>Reorder</button>
                <button className="btn btn-success" onClick={() => markOrdered(selected.id)}>Mark Ordered</button>
              </div>

              <div style={{ marginTop: 12 }}>
                <button className="btn" onClick={() => openDetails(selected)}>Edit Details</button>
              </div>
            </>
          )}
        </aside>
      </div>

      {/* Reorder Queue */}
      <div className="card" style={{ marginTop: 18 }}>
        <div style={{ padding: 16, borderBottom: "1px solid var(--border)" }}>
          <strong>📦 Reorder Queue</strong>
        </div>
        <ul style={{ listStyle: "none", margin: 0, padding: 16 }}>
          {queue.length === 0 && <li className="subtle">No tools in reorder queue.</li>}
          {queue.map((t) => (
            <li
              key={t.id}
              style={{
                display: "flex",
                justifyContent: "space-between",
                padding: "10px 0",
                borderBottom: "1px dashed var(--border)",
              }}
            >
              <span>
                <strong>{t.name}</strong> · Qty {t.quantity} · Threshold {t.threshold}
              </span>
              <span className="toolbar">
                <button className="btn btn-success" onClick={() => markOrdered(t.id)}>Mark Ordered</button>
                <button className="btn" onClick={() => removeFromQueue(t.id)}>Remove</button>
              </span>
            </li>
          ))}
        </ul>
      </div>

      {/* Pending Orders */}
      <div className="card" style={{ marginTop: 14 }}>
        <div style={{ padding: 16, borderBottom: "1px solid var(--border)" }}>
          <strong>🧾 Pending Orders</strong>
        </div>
        <ul style={{ listStyle: "none", margin: 0, padding: 16 }}>
          {orders.length === 0 && <li className="subtle">No pending orders.</li>}
          {orders.map((o) => (
            <li
              key={o.orderId}
              style={{
                display: "flex",
                justifyContent: "space-between",
                padding: "10px 0",
                borderBottom: "1px dashed var(--border)",
              }}
            >
              <span>
                <strong>{o.name}</strong> — Ordered{" "}
                <em className="subtle">{new Date(o.orderedAt).toLocaleString()}</em>
              </span>
              <span className="toolbar">
                <button className="btn btn-success" onClick={() => markReceived(o.orderId)}>Received</button>
                <button className="btn" onClick={() => undoOrdered(o.orderId)}>Undo</button>
                <button className="btn btn-danger" onClick={() => removePending(o.orderId)}>Remove</button>
              </span>
            </li>
          ))}
        </ul>
      </div>

      {/* Toast */}
      {toast && (
        <div className="toast">
          <span>✅</span>
          <span>{toast}</span>
        </div>
      )}

      {/* Footer mini metrics */}
      <div style={{ marginTop: 12, color: "var(--muted)", fontSize: 12 }}>
        Total Qty: <strong>{totalQty}</strong> • Inventory Value:{" "}
        <strong>{money(totalValue)}</strong>
      </div>

      {/* DETAILS MODAL */}
      {isModalOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,.35)",
            display: "grid",
            placeItems: "center",
            zIndex: 50,
          }}
          onClick={() => setModalOpen(false)}
        >
          <div
            className="card"
            style={{ width: "min(760px, 92vw)", padding: 16 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h3 style={{ margin: 0 }}>Tool Details</h3>
              <button className="btn" onClick={() => setModalOpen(false)}>Close</button>
            </div>

            <div
              className="form-grid"
              style={{ marginTop: 12, gridTemplateColumns: "1.2fr 1fr 1fr" }}
            >
              <Input label="Tool Name" value={modal.name} onChange={(v) => setModal({ ...modal, name: v })} />
              <Input label="Manufacturer" value={modal.manufacturer} onChange={(v) => setModal({ ...modal, manufacturer: v })} />
              <Input label="Part Number" value={modal.partNumber} onChange={(v) => setModal({ ...modal, partNumber: v })} />
              <div style={{ gridColumn: "1 / -1" }}>
                <Input label="Description" value={modal.description} onChange={(v) => setModal({ ...modal, description: v })} />
              </div>

              <Input label="Quantity" type="number" value={modal.quantity} onChange={(v) => setModal({ ...modal, quantity: v })} />
              <Input label="Low Threshold" type="number" value={modal.threshold} onChange={(v) => setModal({ ...modal, threshold: v })} />
              <Input label="Price (USD)" type="number" step="0.01" value={modal.price} onChange={(v) => setModal({ ...modal, price: v })} />

              <Input label="Vendor Purchased From" value={modal.vendor} onChange={(v) => setModal({ ...modal, vendor: v })} />
              <div style={{ gridColumn: "1 / -1" }}>
                <Input
                  label="Projects Used On (comma separated)"
                  value={modal.projects}
                  onChange={(v) => setModal({ ...modal, projects: v })}
                />
              </div>
            </div>

            <div className="toolbar" style={{ marginTop: 12 }}>
              <button className="btn" onClick={() => setModalOpen(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={saveDetails}>Save Details</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
