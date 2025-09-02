import React, { useEffect, useMemo, useState } from "react";
import "./modern-light.css";
import LocationSection from "./LocationSection";

/* ---------------- Taxonomy ---------------- */
const MACHINE_GROUPS_BASE = ["", "Milling", "Swiss", "Lathe", "Wire EDM", "Inspection", "General", "Other…"];
const TOOL_TYPES_BASE = [
  "", "Endmill", "Drill", "Tap", "Reamer",
  "Turning Insert", "Grooving Insert", "Boring Bar", "Face Mill Insert",
  "Collet", "Tap Holder", "Tool Holder", "Fixture", "Gage", "Other…"
];

/* ---------------- Reusable inputs ---------------- */
function Input({ label, value, onChange, error, ...props }) {
  return (
    <div className="input">
      <label>{label}</label>
      <input
        {...props}
        value={String(value ?? "")}
        onChange={(e) => onChange?.(e.target.value)}
        style={error ? { borderColor: "#ef4444" } : undefined}
      />
      {error ? <div style={{ color: "#ef4444", fontSize: 12, marginTop: 4 }}>{error}</div> : null}
    </div>
  );
}
function Select({ label, value, onChange, options, ...props }) {
  return (
    <div className="input">
      <label>{label}</label>
      <select value={value ?? ""} onChange={(e) => onChange?.(e.target.value)} {...props}>
        {options.map((opt) => (
          <option key={opt} value={opt}>{opt || "—"}</option>
        ))}
      </select>
    </div>
  );
}
/** Dropdown that reveals a free-text box when “Other…” is chosen. */
function SelectWithOther({ label, value, setValue, baseOptions }) {
  const isOther = value && !baseOptions.includes(value);
  const selValue = isOther ? "Other…" : (value ?? "");
  return (
    <div style={{ display: "grid", gap: 6 }}>
      <Select
        label={label}
        value={selValue}
        onChange={(v) => {
          if (v === "Other…") {
            setValue(isOther ? value : ""); // switch to custom
          } else {
            setValue(v);
          }
        }}
        options={baseOptions}
      />
      {selValue === "Other…" && (
        <Input
          label={`${label} (custom)`}
          value={value && !baseOptions.includes(value) ? value : ""}
          onChange={(v) => setValue(v)}
          placeholder={`Enter custom ${label.toLowerCase()}`}
        />
      )}
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

function sparklinePath(points, w = 260, h = 80, pad = 6) {
  if (!points.length) return "";
  const ys = points;
  const min = Math.min(...ys);
  const max = Math.max(...ys);
  const range = max - min || 1;
  const x = (i, n) => pad + (i / (n - 1 || 1)) * (w - pad * 2);
  const y = (v) => h - pad - ((v - min) / range) * (h - pad * 2);
  return points.map((v, i, a) => `${i === 0 ? "M" : "L"} ${x(i, a.length).toFixed(1)} ${y(v).toFixed(1)}`).join(" ");
}
function makeHistory(qty = 0, threshold = 0) {
  const base = Math.max(threshold * 1.2, 10);
  const step = Math.max(1, Math.round((qty || 6) / 6));
  return Array.from({ length: 12 }, (_, i) => {
    const decay = Math.max(0, qty - i * step);
    return Math.round((decay + base) / 1.5);
  }).reverse();
}

/* ---------------- Persistence keys ---------------- */
const LS_KEYS = { tools: "ttl_tools", queue: "ttl_queue", orders: "ttl_orders" };

/* ---------------- Main ---------------- */
export default function ToolInventoryApp() {
  const [tools, setTools] = useState([]);
  const [queue, setQueue] = useState([]);
  const [orders, setOrders] = useState([]);

  const [form, setForm] = useState({
    name: "", manufacturer: "", partNumber: "", description: "",
    quantity: "", threshold: "", price: "",
    machineGroup: "", toolType: "",
  });
  const [formErrors, setFormErrors] = useState({});

  const [toast, setToast] = useState("");
  const [search, setSearch] = useState("");

  // filters
  const [filterMachine, setFilterMachine] = useState("");
  const [filterType, setFilterType] = useState("");

  const [selectedId, setSelectedId] = useState(null);

  // Details modal
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
    location: {},
    machineGroup: "",
    toolType: "",
  });

  // NEW: Inventory modal (same style as details)
  const [isInventoryOpen, setInventoryOpen] = useState(false);

  const note = (msg) => {
    setToast(msg);
    clearTimeout(note._t);
    note._t = setTimeout(() => setToast(""), 2400);
  };

  /* ---------------- Load from localStorage on mount ---------------- */
  useEffect(() => {
    try {
      const t = JSON.parse(localStorage.getItem(LS_KEYS.tools) || "[]");
      const q = JSON.parse(localStorage.getItem(LS_KEYS.queue) || "[]");
      const o = JSON.parse(localStorage.getItem(LS_KEYS.orders) || "[]");
      const norm = (arr) =>
        (arr || []).map((x) => ({
          id: x.id ?? Date.now() + Math.random(),
          name: x.name ?? "",
          manufacturer: x.manufacturer ?? "",
          partNumber: x.partNumber ?? "",
          description: x.description ?? "",
          quantity: Number.isFinite(x.quantity) ? x.quantity : 0,
          threshold: Number.isFinite(x.threshold) ? x.threshold : 0,
          price: Number.isFinite(x.price) ? Number(parseFloat(x.price || 0).toFixed(2)) : 0,
          vendor: x.vendor ?? "",
          projects: Array.isArray(x.projects) ? x.projects : [],
          location: typeof x.location === "object" && x.location !== null ? x.location : {},
          machineGroup: x.machineGroup ?? "",
          toolType: x.toolType ?? "",
        }));
      setTools(norm(t));
      setQueue(norm(q));
      setOrders(
        (o || []).map((ord) => ({
          orderId: ord.orderId ?? `${ord.id}-${Date.now() + Math.random()}`,
          id: ord.id,
          name: ord.name ?? "",
          quantity: Number.isFinite(ord.quantity) ? ord.quantity : 0,
          price: Number.isFinite(ord.price) ? Number(parseFloat(ord.price || 0).toFixed(2)) : 0,
          orderedAt: ord.orderedAt ?? new Date().toISOString(),
        }))
      );
    } catch { /* ignore */ }
  }, []);

  /* ---------------- Save to localStorage whenever data changes ---------------- */
  useEffect(() => { localStorage.setItem(LS_KEYS.tools, JSON.stringify(tools)); }, [tools]);
  useEffect(() => { localStorage.setItem(LS_KEYS.queue, JSON.stringify(queue)); }, [queue]);
  useEffect(() => { localStorage.setItem(LS_KEYS.orders, JSON.stringify(orders)); }, [orders]);

  /* ---------------- Derived ---------------- */
  const totalQty = tools.reduce((a, t) => a + (t.quantity || 0), 0);
  const totalValue = tools.reduce((a, t) => a + (t.quantity || 0) * (t.price || 0), 0);

  // dynamic filter options include custom values found in data
  const machineFilterOptions = useMemo(() => {
    const s = new Set(MACHINE_GROUPS_BASE);
    tools.forEach(t => t.machineGroup && s.add(t.machineGroup));
    return Array.from(s);
  }, [tools]);
  const toolTypeFilterOptions = useMemo(() => {
    const s = new Set(TOOL_TYPES_BASE);
    tools.forEach(t => t.toolType && s.add(t.toolType));
    return Array.from(s);
  }, [tools]);

  const filteredTools = useMemo(() => {
    const q = search.trim().toLowerCase();
    return tools.filter((t) => {
      const hay = [
        t.name, t.manufacturer, t.partNumber, t.description, t.vendor,
        t.machineGroup, t.toolType,
      ].filter(Boolean).join(" ").toLowerCase();
      const textOk = q ? hay.includes(q) : true;
      const machineOk = filterMachine ? t.machineGroup === filterMachine : true;
      const typeOk = filterType ? t.toolType === filterType : true;
      return textOk && machineOk && typeOk;
    });
  }, [tools, search, filterMachine, filterType]);

  const selected = useMemo(() => tools.find((t) => t.id === selectedId) || null, [tools, selectedId]);

  /* ---------------- Actions ---------------- */
  const validateForm = () => {
    const errors = {};
    if (!form.name?.trim()) errors.name = "Tool name is required";
    if (form.quantity !== "" && (isNaN(form.quantity) || Number(form.quantity) < 0)) errors.quantity = "Enter a number ≥ 0";
    if (form.threshold !== "" && (isNaN(form.threshold) || Number(form.threshold) < 0)) errors.threshold = "Enter a number ≥ 0";
    if (form.price !== "" && (isNaN(form.price) || Number(form.price) < 0)) errors.price = "Enter a price ≥ 0.00";
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const addTool = () => {
    if (!validateForm()) return;
    const t = {
      id: Date.now(),
      name: form.name.trim(),
      manufacturer: (form.manufacturer || "").trim(),
      partNumber: (form.partNumber || "").trim(),
      description: (form.description || "").trim(),
      quantity: Math.max(0, parseInt(form.quantity || 0, 10)),
      threshold: Math.max(0, parseInt(form.threshold || 0, 10)),
      price: Number(parseFloat(form.price || 0).toFixed(2)),
      vendor: "",
      projects: [],
      location: {},
      machineGroup: form.machineGroup || "",
      toolType: form.toolType || "",
    };
    setTools((prev) => [...prev, t]);
    setForm({
      name: "", manufacturer: "", partNumber: "", description: "",
      quantity: "", threshold: "", price: "",
      machineGroup: "", toolType: "",
    });
    setFormErrors({});
    setSelectedId(t.id);
    note("Tool added ✅");
  };

  const updateQty = (id, delta) => {
    setTools((prev) =>
      prev.map((t) => (t.id === id ? { ...t, quantity: Math.max(0, (t.quantity || 0) + delta) } : t))
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

  const addToQueue = (tool) => { setQueue((q) => (q.some((x) => x.id === tool.id) ? q : [...q, tool])); note("Added to reorder queue 📦"); };
  const removeFromQueue = (id) => setQueue((prev) => prev.filter((t) => t.id !== id));

  const markOrdered = (id) => {
    const t = tools.find((x) => x.id === id);
    if (!t) return;
    const order = { orderId: `${id}-${Date.now()}`, id, name: t.name, quantity: t.threshold || 1, price: t.price || 0, orderedAt: new Date().toISOString() };
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
    setTools((prev) => prev.map((t) => (t.id === o.id ? { ...t, quantity: (t.quantity || 0) + received } : t)));
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

  const removePending = (orderId) => { setOrders((prev) => prev.filter((x) => x.orderId !== orderId)); note("Pending order removed"); };

  const exportCSV = () => {
    const header = ["Employee", "Job", "Tool", "Qty", "Timestamp"];
    const rows = tools.map((t) => ["N/A", "N/A", t.name, t.quantity, new Date().toISOString()]);
    const csv = [header, ...rows].map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "tools.csv"; a.click(); URL.revokeObjectURL(url);
    note("Exported CSV 📤");
  };
  const exportJSON = () => {
    const payload = { tools, queue, orders, exportedAt: new Date().toISOString() };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "tool-track-lite-backup.json"; a.click(); URL.revokeObjectURL(url);
    note("Exported JSON 📦");
  };
  const importJSON = (file) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target.result || "{}");
        if (!data || typeof data !== "object") throw new Error();
        setTools(Array.isArray(data.tools) ? data.tools : []);
        setQueue(Array.isArray(data.queue) ? data.queue : []);
        setOrders(Array.isArray(data.orders) ? data.orders : []);
        note("Import successful ✅");
      } catch { note("Import failed ❌ Invalid file"); }
    };
    reader.readAsText(file);
  };

  // Details modal helpers
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
      location: (tool.location && typeof tool.location === "object") ? tool.location : {},
      machineGroup: tool.machineGroup || "",
      toolType: tool.toolType || "",
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
              projects: modal.projects.split(",").map((p) => p.trim()).filter(Boolean),
              location: (modal.location && typeof modal.location === "object") ? modal.location : {},
              machineGroup: modal.machineGroup || "",
              toolType: modal.toolType || "",
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
        <div className="toolbar" style={{ gap: 8, flexWrap: "wrap" }}>
          <label className="btn" style={{ cursor: "pointer" }}>
            Import JSON
            <input type="file" accept="application/json" onChange={(e) => e.target.files?.[0] && importJSON(e.target.files[0])} style={{ display: "none" }} />
          </label>
          <button className="btn" onClick={exportJSON}>Export JSON</button>
          <button className="btn" onClick={exportCSV}>Export CSV</button>
        </div>
      </div>

      {/* Stat Tiles */}
      <div className="metrics">
        <div className="metric card stat-accent">
          <div className="label">Purchase Recommended</div>
          <div className="value">{tools.filter((t) => (t.quantity || 0) <= (t.threshold || 0)).length}</div>
          <div className="note">Low or zero stock</div>
        </div>
        <div className="metric card">
          <div className="label">Reorder Queue</div>
          <div className="value">{queue.length}</div>
          <div className="note">Awaiting PO</div>
        </div>
        <div className="metric card">
          <div className="label">Out of Stock</div>
          <div className="value">{tools.filter((t) => (t.quantity || 0) === 0).length}</div>
          <div className="note">Immediate action</div>
        </div>
        <div className="metric card">
          <div className="label">Inventory Value</div>
          <div className="value">{money(totalValue)}</div>
          <div className="note">{totalQty} items</div>
        </div>
      </div>

      {/* Search + filters */}
      <div className="controls" style={{ gap: 8, flexWrap: "wrap" }}>
        <div className="search" style={{ minWidth: 280, flex: 1 }}>
          <input placeholder="Search name, manufacturer, part #, description, vendor, type…" onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Select label="Machine Group" value={filterMachine} onChange={setFilterMachine} options={machineFilterOptions} />
        <Select label="Tool Type" value={filterType} onChange={setFilterType} options={toolTypeFilterOptions} />
      </div>

      {/* Add Tool */}
      <div className="card form">
        <div className="form-grid" style={{ gridTemplateColumns: "2fr 1.4fr 1.4fr 2fr 1fr 1fr 1fr 1.2fr 1.4fr auto" }}>
          <Input label="Tool Name" value={form.name} onChange={(v) => setForm({ ...form, name: v })} placeholder='e.g., 1/4" Carbide Endmill' error={formErrors.name} />
          <Input label="Manufacturer" value={form.manufacturer} onChange={(v) => setForm({ ...form, manufacturer: v })} placeholder="YG-1" />
          <Input label="Part Number" value={form.partNumber} onChange={(v) => setForm({ ...form, partNumber: v })} placeholder="EM1234-0250" />
          <Input label="Description" value={form.description} onChange={(v) => setForm({ ...form, description: v })} placeholder="2-flute, TiAlN" />
          <Input label="Qty" type="number" value={form.quantity} onChange={(v) => setForm({ ...form, quantity: v })} placeholder="12" error={formErrors.quantity} />
          <Input label="Low Threshold" type="number" value={form.threshold} onChange={(v) => setForm({ ...form, threshold: v })} placeholder="10" error={formErrors.threshold} />
          <Input label="Price (USD)" type="number" step="0.01" value={form.price} onChange={(v) => setForm({ ...form, price: v })} placeholder="15.50" error={formErrors.price} />
          <SelectWithOther label="Machine Group" value={form.machineGroup} setValue={(v) => setForm({ ...form, machineGroup: v })} baseOptions={MACHINE_GROUPS_BASE} />
          <SelectWithOther label="Tool Type" value={form.toolType} setValue={(v) => setForm({ ...form, toolType: v })} baseOptions={TOOL_TYPES_BASE} />
          <button className="btn btn-primary" onClick={addTool}>Add Tool</button>
        </div>
      </div>

      {/* Main layout: table (scrolls) + details */}
      <div className="layout">
        {/* LEFT: Inventory table */}
        <div className="card table-wrap">
          <div className="table-scroll">
            <table className="table">
              <thead>
                <tr>
                  <th style={{ width: "36%" }}>Item</th>
                  <th>On Hand</th>
                  <th>Vendor</th>
                  <th style={{ textAlign: "right" }}>Total Cost</th>
                  <th>Actions</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredTools.length === 0 && (
                  <tr><td colSpan={6} style={{ color: "var(--muted)" }}>No items found.</td></tr>
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
                        <div className="subtle">{t.manufacturer || "—"} · {t.partNumber || "—"}</div>
                        {(t.machineGroup || t.toolType) && (
                          <div className="subtle" style={{ marginTop: 4, display: "flex", gap: 6, flexWrap: "wrap" }}>
                            {t.machineGroup && <span className="badge pill">{t.machineGroup}</span>}
                            {t.toolType && <span className="badge pill">{t.toolType}</span>}
                          </div>
                        )}
                        {t.description && <div className="subtle" style={{ marginTop: 2 }}>{t.description}</div>}
                      </td>
                      <td style={{ minWidth: 220 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <input
                            style={{ width: 90, padding: 8, border: "1px solid var(--border)", borderRadius: 10 }}
                            type="number"
                            value={t.quantity || 0}
                            onChange={(e) =>
                              setTools((prev) =>
                                prev.map((x) => x.id === t.id ? { ...x, quantity: parseInt(e.target.value || 0, 10) } : x)
                              )
                            }
                            onClick={(e) => e.stopPropagation()}
                          />
                          <div style={{ flex: 1 }}>
                            <div className="progress"><span style={{ width: `${pct}%` }} /></div>
                            <div className="subtle">{t.quantity || 0} on hand · min {t.threshold || 0}</div>
                          </div>
                        </div>
                      </td>
                      <td>{t.vendor || <span className="subtle">—</span>}</td>
                      <td style={{ textAlign: "right" }}>{money((t.quantity || 0) * (t.price || 0))}</td>
                      <td style={{ whiteSpace: "nowrap" }}>
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                          <button className="btn" onClick={(e) => { e.stopPropagation(); updateQty(t.id, -1); }}>-1</button>
                          <button className="btn" onClick={(e) => { e.stopPropagation(); updateQty(t.id, 1); }}>+1</button>
                          <button className="btn" onClick={(e) => { e.stopPropagation(); addToQueue(t); }}>Reorder</button>
                          <button className="btn" onClick={(e) => { e.stopPropagation(); openDetails(t); }}>Details</button>
                          <button className="btn btn-danger" onClick={(e) => { e.stopPropagation(); removeTool(t.id); }}>Delete</button>
                        </div>
                      </td>
                      <td>
                        {isZero ? <span className="badge zero">❌ Out of Stock</span>
                          : isLow ? <span className="badge low">⚠️ Low Stock</span>
                          : <span className="badge ok">✅ In Stock</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* RIGHT: Details / analytics card */}
        <aside className="card side">
          {!selected ? (
            <>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div>
                  <h3 style={{ margin: 0 }}>Expected On-Hand Supply</h3>
                  <div className="subtle">Pick an item to see details (vendors, incoming, demand)</div>
                </div>
                {/* Open Inventory button at top-right of chart */}
                <button className="btn" onClick={() => setInventoryOpen(true)} title="Open Inventory">Open Inventory</button>
              </div>
              <svg
                width="100%"
                height="86"
                viewBox="0 0 260 86"
                preserveAspectRatio="none"
                style={{ background: "#fafafa", border: "1px solid var(--border),", borderRadius: 10, marginTop: 10 }}
              >
                <path d={sparklinePath(makeHistory(12, 6))} fill="none" stroke="#60a5fa" strokeWidth="2" />
                <line x1="0" x2="260" y1="70" y2="70" stroke="#f59e0b" strokeDasharray="4 4" strokeWidth="1" />
              </svg>
              <div className="subtle" style={{ marginTop: 8 }}>(Select an item on the left)</div>
            </>
          ) : (
            <>
              {/* Header with button */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                <div>
                  <h3 style={{ margin: 0 }}>{selected.name}</h3>
                  <div className="subtle" style={{ marginTop: 4 }}>{selected.manufacturer || "—"} · {selected.partNumber || "—"}</div>
                </div>
                <button className="btn" onClick={() => setInventoryOpen(true)} title="Open Inventory">Open Inventory</button>
              </div>

              <svg width="100%" height="86" viewBox="0 0 260 86" preserveAspectRatio="none" style={{ background: "#fafafa", border: "1px solid var(--border)", borderRadius: 10 }}>
                <path d={sparklinePath(makeHistory(selected.quantity, selected.threshold))} fill="none" stroke="#60a5fa" strokeWidth="2" />
                <line x1="0" x2="260" y1="70" y2="70" stroke="#f59e0b" strokeDasharray="4 4" strokeWidth="1" />
              </svg>

              <div className="kpi">
                <div><div className="subtle">On Hand</div><div style={{ fontWeight: 700, fontSize: 18 }}>{selected.quantity || 0}</div></div>
                <div><div className="subtle">Incoming</div><div style={{ fontWeight: 700, fontSize: 18 }}>{orders.filter((o) => o.id === selected.id).length}</div></div>
                <div><div className="subtle">Demand</div><div style={{ fontWeight: 700, fontSize: 18 }}>{Math.max(0, (selected.threshold || 0) - (selected.quantity || 0))}</div></div>
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
        <div style={{ padding: 16, borderBottom: "1px solid var(--border)" }}><strong>📦 Reorder Queue</strong></div>
        <ul style={{ listStyle: "none", margin: 0, padding: 16 }}>
          {queue.length === 0 && <li className="subtle">No tools in reorder queue.</li>}
          {queue.map((t) => (
            <li key={t.id} style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", borderBottom: "1px dashed var(--border)" }}>
              <span><strong>{t.name}</strong> · Qty {t.quantity} · Threshold {t.threshold}</span>
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
        <div style={{ padding: 16, borderBottom: "1px solid var(--border)" }}><strong>🧾 Pending Orders</strong></div>
        <ul style={{ listStyle: "none", margin: 0, padding: 16 }}>
          {orders.length === 0 && <li className="subtle">No pending orders.</li>}
          {orders.map((o) => (
            <li key={o.orderId} style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", borderBottom: "1px dashed var(--border)" }}>
              <span><strong>{o.name}</strong> — Ordered <em className="subtle">{new Date(o.orderedAt).toLocaleString()}</em></span>
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
      {toast && <div className="toast"><span>✅</span><span>{toast}</span></div>}

      {/* DETAILS MODAL */}
      {isModalOpen && (
        <div
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.35)", display: "grid", placeItems: "center", zIndex: 50 }}
          onClick={() => setModalOpen(false)}
        >
          <div className="card" style={{ width: "min(820px, 92vw)", padding: 16 }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h3 style={{ margin: 0 }}>Tool Details</h3>
              <button className="btn" onClick={() => setModalOpen(false)}>Close</button>
            </div>

            {/* Primary fields */}
            <div className="form-grid" style={{ marginTop: 12, gridTemplateColumns: "1.2fr 1fr 1fr" }}>
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
                <Input label="Projects Used On (comma separated)" value={modal.projects} onChange={(v) => setModal({ ...modal, projects: v })} />
              </div>

              <SelectWithOther label="Machine Group" value={modal.machineGroup} setValue={(v) => setModal({ ...modal, machineGroup: v })} baseOptions={MACHINE_GROUPS_BASE} />
              <SelectWithOther label="Tool Type" value={modal.toolType} setValue={(v) => setModal({ ...modal, toolType: v })} baseOptions={TOOL_TYPES_BASE} />
            </div>

            {/* Location Section */}
            <div style={{ marginTop: 12 }}>
              <LocationSection value={modal.location} onChange={(loc) => setModal((m) => ({ ...m, location: loc }))} />
            </div>

            <div className="toolbar" style={{ marginTop: 12 }}>
              <button className="btn" onClick={() => setModalOpen(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={saveDetails}>Save Details</button>
            </div>
          </div>
        </div>
      )}

      {/* NEW: INVENTORY MODAL */}
      {isInventoryOpen && (
        <div
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.35)", display: "grid", placeItems: "center", zIndex: 60 }}
          onClick={() => setInventoryOpen(false)}
        >
          <div
            className="card"
            style={{ width: "min(1100px, 94vw)", maxHeight: "86vh", padding: 16, display: "flex", flexDirection: "column" }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal header */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
              <h3 style={{ margin: 0 }}>Inventory</h3>
              <div className="toolbar" style={{ gap: 8, flexWrap: "wrap" }}>
                <div className="input" style={{ minWidth: 220 }}>
                  <label>Search</label>
                  <input placeholder="Search inventory…" onChange={(e) => setSearch(e.target.value)} />
                </div>
                <button className="btn" onClick={() => setInventoryOpen(false)}>Close</button>
              </div>
            </div>

            {/* Table body */}
            <div style={{ marginTop: 12, display: "flex", flexDirection: "column", minHeight: 0 }}>
              <div className="table-wrap" style={{ display: "flex", flexDirection: "column", minHeight: 0 }}>
                <div className="table-scroll" style={{ flex: 1, overflow: "auto" }}>
                  <table className="table">
                    <thead>
                      <tr>
                        <th style={{ width: "36%" }}>Item</th>
                        <th>On Hand</th>
                        <th>Vendor</th>
                        <th style={{ textAlign: "right" }}>Total Cost</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredTools.length === 0 && (
                        <tr><td colSpan={5} style={{ color: "var(--muted)" }}>No items found.</td></tr>
                      )}
                      {filteredTools.map((t) => {
                        const isLow = (t.quantity || 0) <= (t.threshold || 0);
                        const isZero = (t.quantity || 0) === 0;
                        return (
                          <tr
                            key={t.id}
                            onClick={() => { setSelectedId(t.id); setInventoryOpen(false); }}
                            style={{ cursor: "pointer" }}
                            title="Click to focus this item"
                          >
                            <td>
                              <div style={{ fontWeight: 600 }}>{t.name}</div>
                              <div className="subtle">{t.manufacturer || "—"} · {t.partNumber || "—"}</div>
                              {(t.machineGroup || t.toolType) && (
                                <div className="subtle" style={{ marginTop: 4, display: "flex", gap: 6, flexWrap: "wrap" }}>
                                  {t.machineGroup && <span className="badge pill">{t.machineGroup}</span>}
                                  {t.toolType && <span className="badge pill">{t.toolType}</span>}
                                </div>
                              )}
                              {t.description && <div className="subtle" style={{ marginTop: 2 }}>{t.description}</div>}
                            </td>
                            <td>{t.quantity || 0} (min {t.threshold || 0})</td>
                            <td>{t.vendor || <span className="subtle">—</span>}</td>
                            <td style={{ textAlign: "right" }}>{money((t.quantity || 0) * (t.price || 0))}</td>
                            <td>
                              {isZero ? <span className="badge zero">❌ Out of Stock</span>
                                : isLow ? <span className="badge low">⚠️ Low Stock</span>
                                : <span className="badge ok">✅ In Stock</span>}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            <div className="toolbar" style={{ marginTop: 12, justifyContent: "flex-end" }}>
              <button className="btn" onClick={() => setInventoryOpen(false)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------------- Small utilities ---------------- */
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
