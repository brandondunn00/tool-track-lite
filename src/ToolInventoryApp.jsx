// src/ToolInventoryApp.jsx - WITH TABS
import React, { useEffect, useMemo, useRef, useState } from "react";
import "./modern-light.css";
import LocationSection from "./LocationSection";
import { LS, load, save } from "./storage";
import ApprovalQueue from './components/ApprovalQueue';
import NewProjectToolRequest from './components/NewProjectToolRequest';

/* ──────── SIMPLE TAB SYSTEM ──────── */
function Tabs({ children }) {
  const [activeTab, setActiveTab] = useState(0);
  const tabs = React.Children.toArray(children);
  
  return (
    <div>
      {/* Tab Headers */}
      <div style={{ 
        display: "flex", 
        gap: 8, 
        padding: "0 24px", 
        marginTop: "16px",
        borderBottom: "2px solid var(--border)",
        background: "var(--card)"
      }}>
        {tabs.map((tab, i) => (
          <button
            key={i}
            onClick={() => setActiveTab(i)}
            style={{
              padding: "12px 20px",
              border: "none",
              borderBottom: activeTab === i ? "3px solid var(--accent)" : "3px solid transparent",
              background: activeTab === i ? "var(--accent-50)" : "transparent",
              cursor: "pointer",
              fontWeight: activeTab === i ? 700 : 400,
              color: activeTab === i ? "var(--accent)" : "var(--text)",
              borderRadius: "8px 8px 0 0",
              transition: "all 0.2s ease"
            }}
          >
            {tab.props.label}
          </button>
        ))}
      </div>
      
      {/* Active Tab Content */}
      <div>
        {tabs[activeTab]}
      </div>
    </div>
  );
}

function Tab({ children }) {
  return <div>{children}</div>;
}

/* ──────── TAXONOMY ──────── */
const MACHINE_GROUPS_BASE = ["", "Milling", "Swiss", "Lathe", "Wire EDM", "Inspection", "General", "Other…"];
const TOOL_TYPES_BASE = [
  "", "Endmill", "Drill", "Tap", "Reamer",
  "Turning Insert", "Grooving Insert", "Boring Bar", "Face Mill Insert",
  "Collet", "Tap Holder", "Tool Holder", "Fixture", "Gage", "Other…"
];

/* ──────── INPUTS ──────── */
const Input = ({ label, value, onChange, error, ...p }) => (
  <div className="input">
    <label>{label}</label>
    <input
      {...p}
      value={String(value ?? "")}
      onChange={e => onChange?.(e.target.value)}
      style={error ? { borderColor: "#ef4444" } : {}}
    />
    {error && <div style={{ color: "#ef4444", fontSize: 12, marginTop: 4 }}>{error}</div>}
  </div>
);

const Select = ({ label, value, onChange, options, ...p }) => (
  <div className="input">
    <label>{label}</label>
    <select value={value ?? ""} onChange={e => onChange?.(e.target.value)} {...p}>
      {options.map(o => (
        <option key={o} value={o}>
          {o || "—"}
        </option>
      ))}
    </select>
  </div>
);

const SelectWithOther = ({ label, value, setValue, baseOptions }) => {
  const isOther = value && !baseOptions.includes(value);
  const sel = isOther ? "Other…" : (value ?? "");
  return (
    <div style={{ display: "grid", gap: 6 }}>
      <Select
        label={label}
        value={sel}
        onChange={v => (v === "Other…" ? setValue(isOther ? value : "") : setValue(v))}
        options={baseOptions}
      />
      {sel === "Other…" && (
        <Input
          label={`${label} (custom)`}
          value={value}
          onChange={setValue}
          placeholder={`Custom ${label.toLowerCase()}`}
        />
      )}
    </div>
  );
};

/* ──────── HELPERS ──────── */
const money = v => Number(v || 0).toLocaleString("en-US", { style: "currency", currency: "USD" });

const sparklinePath = (pts, w = 300, h = 100, pad = 10) => {
  if (!pts.length) return "";
  const min = Math.min(...pts),
    max = Math.max(...pts),
    r = max - min || 1;
  const x = (i, n) => pad + (i / (n - 1)) * (w - pad * 2);
  const y = v => h - pad - ((v - min) / r) * (h - pad * 2);
  return pts
    .map((v, i, a) => `${i === 0 ? "M" : "L"} ${x(i, a.length).toFixed(1)} ${y(v).toFixed(1)}`)
    .join(" ");
};

const fakeHistory = (qty = 0, thr = 0) => {
  const base = Math.max(thr * 1.2, 10);
  return Array.from({ length: 12 }, (_, i) => Math.round((qty + base - i * 2) / 1.5)).reverse();
};

/* ──────── SHARED HEADER ──────── */
function Header() {
  const pages = [
    { id: "admin", label: "Admin", hash: "#/" },
    { id: "operator", label: "Operator", hash: "#/operator" },
    { id: "kitting", label: "Job Kitting", hash: "#/kitting" },
    { id: "analytics", label: "Analytics", hash: "#/analytics" }
  ];

  return (
    <div
      className="header"
      style={{
        background: "var(--card)",
        borderBottom: "1px solid var(--border)",
        padding: "12px 24px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        boxShadow: "var(--shadow)"
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        <div style={{ fontSize: 32 }}>🛠️</div>
        <div>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: "var(--text)" }}>Toolly</h1>
          <p style={{ margin: "4px 0 0", fontSize: 13, color: "var(--muted)" }}>
            CNC Tooling Management • $10/mo • Unlimited users
          </p>
        </div>
      </div>

      <div className="toolbar" style={{ gap: 10 }}>
        {/* Navigation Pills */}
        {pages.map(page => (
          <a
            key={page.id}
            className={`pill ${page.id === "admin" ? "active" : ""}`}
            href={page.hash}
            style={{ textDecoration: "none" }}
          >
            {page.label}
          </a>
        ))}

        {/* Dark Mode Toggle */}
        <button
          className="btn"
          onClick={() => {
            document.body.classList.toggle("dark");
            const isDark = document.body.classList.contains("dark");
            localStorage.setItem("toolly_dark", isDark);
          }}
          style={{
            fontSize: 20,
            padding: "6px 12px",
            minWidth: 44,
            display: "flex",
            alignItems: "center",
            justifyContent: "center"
          }}
          title="Toggle dark mode"
        >
          {document.body.classList.contains("dark") ? "🌙" : "☀️"}
        </button>
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────
   PO MODAL COMPONENT
   ────────────────────────────────────────────────────────────── */

// Shipping type options
const SHIPPING_TYPES = ["Standard", "Expedited", "Rush", "Next Day"];

/* ──────── PO MODAL ──────── */
function POModal({ tool, onClose, onSubmit }) {
  const [po, setPO] = useState({
    poNumber: "",
    vendor: tool?.vendor || "",
    quantity: tool?.threshold || 1,
    unitPrice: tool?.price || 0,
    shippingType: "Standard",
    shippingCost: 0,
    notes: "",
    dateOrdered: new Date().toISOString().split("T")[0]
  });

  const [errors, setErrors] = useState({});

  // Validate form
  const validate = () => {
    const e = {};
    if (!po.poNumber.trim()) e.poNumber = "PO Number required";
    if (!po.quantity || po.quantity <= 0) e.quantity = "Quantity must be > 0";
    if (!po.unitPrice || po.unitPrice <= 0) e.unitPrice = "Unit price must be > 0";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = () => {
    if (!validate()) return;
    onSubmit(po);
  };

  // Calculate totals
  const subtotal = (po.quantity || 0) * (po.unitPrice || 0);
  const shipping = parseFloat(po.shippingCost || 0);
  const total = subtotal + shipping;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="card"
        style={{
          width: "min(600px,90vw)",
          padding: 24,
          maxHeight: "90vh",
          overflow: "auto"
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ marginBottom: 16 }}>
          <h3 style={{ margin: "0 0 8px", color: "var(--text)" }}>Create Purchase Order</h3>
          <div style={{ fontSize: 13, color: "var(--muted)" }}>Complete all fields to track spend and shipping</div>
        </div>

        {/* Tool Info Banner */}
        <div
          style={{
            padding: 12,
            background: "var(--accent-50)",
            borderRadius: 8,
            marginBottom: 16,
            border: "1px solid var(--border)"
          }}
        >
          <div style={{ fontWeight: 600, color: "var(--text)" }}>{tool?.name}</div>
          <div className="subtle">{tool?.manufacturer} · {tool?.partNumber}</div>
          {tool?.machineGroup && (
            <div style={{ marginTop: 4 }}>
              <span className="badge pill" style={{ fontSize: 11 }}>
                {tool.machineGroup}
              </span>
            </div>
          )}
        </div>

        {/* Form Fields */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          {/* PO Number */}
          <div style={{ gridColumn: "1/-1" }}>
            <label style={{ display: "block", fontSize: 12, color: "var(--muted)", marginBottom: 6 }}>
              PO Number *
            </label>
            <input
              type="text"
              value={po.poNumber}
              onChange={e => setPO(p => ({ ...p, poNumber: e.target.value }))}
              placeholder="PO-2024-001"
              style={{
                width: "100%",
                padding: "10px 12px",
                border: `1px solid ${errors.poNumber ? "#ef4444" : "var(--border)"}`,
                borderRadius: 10,
                background: "var(--card)",
                color: "var(--text)",
                outline: "none"
              }}
            />
            {errors.poNumber && (
              <div style={{ color: "#ef4444", fontSize: 12, marginTop: 4 }}>{errors.poNumber}</div>
            )}
          </div>

          {/* Vendor */}
          <div style={{ gridColumn: "1/-1" }}>
            <label style={{ display: "block", fontSize: 12, color: "var(--muted)", marginBottom: 6 }}>Vendor</label>
            <input
              type="text"
              value={po.vendor}
              onChange={e => setPO(p => ({ ...p, vendor: e.target.value }))}
              placeholder="McMaster, Grainger, MSC, etc."
              style={{
                width: "100%",
                padding: "10px 12px",
                border: "1px solid var(--border)",
                borderRadius: 10,
                background: "var(--card)",
                color: "var(--text)",
                outline: "none"
              }}
            />
          </div>

          {/* Quantity */}
          <div>
            <label style={{ display: "block", fontSize: 12, color: "var(--muted)", marginBottom: 6 }}>
              Quantity *
            </label>
            <input
              type="number"
              min="1"
              value={po.quantity}
              onChange={e => setPO(p => ({ ...p, quantity: e.target.value }))}
              style={{
                width: "100%",
                padding: "10px 12px",
                border: `1px solid ${errors.quantity ? "#ef4444" : "var(--border)"}`,
                borderRadius: 10,
                background: "var(--card)",
                color: "var(--text)",
                outline: "none"
              }}
            />
            {errors.quantity && (
              <div style={{ color: "#ef4444", fontSize: 12, marginTop: 4 }}>{errors.quantity}</div>
            )}
          </div>

          {/* Unit Price */}
          <div>
            <label style={{ display: "block", fontSize: 12, color: "var(--muted)", marginBottom: 6 }}>
              Unit Price *
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={po.unitPrice}
              onChange={e => setPO(p => ({ ...p, unitPrice: e.target.value }))}
              placeholder="0.00"
              style={{
                width: "100%",
                padding: "10px 12px",
                border: `1px solid ${errors.unitPrice ? "#ef4444" : "var(--border)"}`,
                borderRadius: 10,
                background: "var(--card)",
                color: "var(--text)",
                outline: "none"
              }}
            />
            {errors.unitPrice && (
              <div style={{ color: "#ef4444", fontSize: 12, marginTop: 4 }}>{errors.unitPrice}</div>
            )}
          </div>

          {/* Shipping Type */}
          <div>
            <label style={{ display: "block", fontSize: 12, color: "var(--muted)", marginBottom: 6 }}>
              Shipping Type
            </label>
            <select
              value={po.shippingType}
              onChange={e => setPO(p => ({ ...p, shippingType: e.target.value }))}
              style={{
                width: "100%",
                padding: "10px 12px",
                border: "1px solid var(--border)",
                borderRadius: 10,
                background: "var(--card)",
                color: "var(--text)",
                outline: "none"
              }}
            >
              {SHIPPING_TYPES.map(type => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </div>

          {/* Shipping Cost */}
          <div>
            <label style={{ display: "block", fontSize: 12, color: "var(--muted)", marginBottom: 6 }}>
              Shipping Cost
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={po.shippingCost}
              onChange={e => setPO(p => ({ ...p, shippingCost: e.target.value }))}
              placeholder="0.00"
              style={{
                width: "100%",
                padding: "10px 12px",
                border: "1px solid var(--border)",
                borderRadius: 10,
                background: "var(--card)",
                color: "var(--text)",
                outline: "none"
              }}
            />
          </div>

          {/* Date Ordered */}
          <div style={{ gridColumn: "1/-1" }}>
            <label style={{ display: "block", fontSize: 12, color: "var(--muted)", marginBottom: 6 }}>
              Date Ordered
            </label>
            <input
              type="date"
              value={po.dateOrdered}
              onChange={e => setPO(p => ({ ...p, dateOrdered: e.target.value }))}
              style={{
                width: "100%",
                padding: "10px 12px",
                border: "1px solid var(--border)",
                borderRadius: 10,
                background: "var(--card)",
                color: "var(--text)",
                outline: "none"
              }}
            />
          </div>

          {/* Notes */}
          <div style={{ gridColumn: "1/-1" }}>
            <label style={{ display: "block", fontSize: 12, color: "var(--muted)", marginBottom: 6 }}>Notes</label>
            <textarea
              value={po.notes}
              onChange={e => setPO(p => ({ ...p, notes: e.target.value }))}
              placeholder="Special instructions, lead time, project number, etc."
              rows={3}
              style={{
                width: "100%",
                padding: "10px 12px",
                border: "1px solid var(--border)",
                borderRadius: 10,
                background: "var(--card)",
                color: "var(--text)",
                outline: "none",
                resize: "vertical",
                fontFamily: "inherit"
              }}
            />
          </div>
        </div>

        {/* Cost Summary */}
        <div
          style={{
            marginTop: 20,
            padding: 16,
            background: "var(--bg)",
            borderRadius: 8,
            border: "1px solid var(--border)"
          }}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr 1fr",
              gap: 12,
              fontSize: 14
            }}
          >
            <div>
              <div className="subtle" style={{ fontSize: 12 }}>
                Subtotal
              </div>
              <div style={{ fontWeight: 700, fontSize: 16, color: "var(--text)" }}>
                {subtotal.toLocaleString("en-US", { style: "currency", currency: "USD" })}
              </div>
              <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>
                {po.quantity} ×{" "}
                {parseFloat(po.unitPrice || 0).toLocaleString("en-US", {
                  style: "currency",
                  currency: "USD"
                })}
              </div>
            </div>
            <div>
              <div className="subtle" style={{ fontSize: 12 }}>
                Shipping
              </div>
              <div style={{ fontWeight: 700, fontSize: 16, color: "var(--text)" }}>
                {shipping.toLocaleString("en-US", { style: "currency", currency: "USD" })}
              </div>
              <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>{po.shippingType}</div>
            </div>
            <div>
              <div className="subtle" style={{ fontSize: 12 }}>
                Total Cost
              </div>
              <div style={{ fontWeight: 700, fontSize: 20, color: "var(--accent)" }}>
                {total.toLocaleString("en-US", { style: "currency", currency: "USD" })}
              </div>
              {po.shippingType !== "Standard" && shipping > 0 && (
                <div style={{ fontSize: 11, color: "#f59e0b", marginTop: 2 }}>⚠️ Rush shipping</div>
              )}
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="toolbar" style={{ marginTop: 20, justifyContent: "flex-end", gap: 12 }}>
          <button className="btn" onClick={onClose}>
            Cancel
          </button>
          <button
            className="btn btn-primary"
            onClick={handleSubmit}
            disabled={!po.poNumber || !po.quantity || po.unitPrice <= 0}
          >
            Create Purchase Order
          </button>
        </div>
      </div>
    </div>
  );
}

/* ──────── STATUS BADGE ──────── */
const StatusBadge = ({ status }) => {
  const badges = {
    ordered: { text: "📦 Ordered", color: "#f59e0b", bg: "#fffbeb" },
    paid: { text: "💰 Paid", color: "#3b82f6", bg: "#eff6ff" },
    received: { text: "✅ Received", color: "#22c55e", bg: "#f0fdf4" }
  };
  
  const badge = badges[status] || badges.ordered;
  
  return (
    <span 
      className="badge" 
      style={{ 
        borderColor: badge.color, 
        background: badge.bg,
        color: badge.color,
        fontWeight: 600
      }}
    >
      {badge.text}
    </span>
  );
};

/* ──────── MAIN APP ──────── */
export default function ToolInventoryApp() {
  const [tools, setTools] = useState([]);
  const [queue, setQueue] = useState([]);
  const [orders, setOrders] = useState([]);
  const [form, setForm] = useState({
    name: "",
    manufacturer: "",
    partNumber: "",
    description: "",
    quantity: "",
    threshold: "",
    price: "",
    machineGroup: "",
    toolType: ""
  });
  const [errors, setErrors] = useState({});
  const [toast, setToast] = useState("");
  const [search, setSearch] = useState("");
  const [fMach, setFMach] = useState("");
  const [fType, setFType] = useState("");
  const [selId, setSelId] = useState(null);
  const [poModalOpen, setPOModalOpen] = useState(false);
  const [poTool, setPOTool] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
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
    toolType: ""
  });
  const loaded = useRef(false);

  const note = msg => {
    setToast(msg);
    clearTimeout(note.t);
    note.t = setTimeout(() => setToast(""), 2400);
  };

  /* ── LOAD ── */
  useEffect(() => {
    const norm = a =>
      (a || []).map(x => ({
        id: x.id ?? Date.now() + Math.random(),
        name: x.name ?? "",
        manufacturer: x.manufacturer ?? "",
        partNumber: x.partNumber ?? "",
        description: x.description ?? "",
        quantity: Number(x.quantity) || 0,
        threshold: Number(x.threshold) || 0,
        price: Number(parseFloat(x.price || 0).toFixed(2)) || 0,
        vendor: x.vendor ?? "",
        projects: Array.isArray(x.projects) ? x.projects : [],
        location: typeof x.location === "object" ? x.location : {},
        machineGroup: x.machineGroup ?? "",
        toolType: x.toolType ?? ""
      }));

    setTools(norm(load(LS.tools, [])));
    setQueue(norm(load(LS.queue, [])));

    const loadedOrders = (load(LS.orders, []) || []).map(o => ({
      orderId: o.orderId ?? `${o.id}-${Date.now()}`,
      id: o.id,
      toolId: o.toolId || o.id,
      name: o.name,
      poNumber: o.poNumber || "",
      vendor: o.vendor || "",
      quantity: o.quantity || 0,
      unitPrice: o.unitPrice || o.price || 0,
      shippingType: o.shippingType || "Standard",
      shippingCost: o.shippingCost || 0,
      notes: o.notes || "",
      status: o.status || "ordered",
      dateOrdered: o.dateOrdered || o.orderedAt || new Date().toISOString(),
      datePaid: o.datePaid || null,
      dateReceived: o.dateReceived || null,
      machineGroup: o.machineGroup || ""
    }));
    setOrders(loadedOrders);

    setTimeout(() => (loaded.current = true), 0);
  }, []);

  /* ── SAVE ── */
  useEffect(() => {
    if (loaded.current) save(LS.tools, tools);
  }, [tools]);
  useEffect(() => {
    if (loaded.current) save(LS.queue, queue);
  }, [queue]);
  useEffect(() => {
    if (loaded.current) save(LS.orders, orders);
  }, [orders]);

  /* ── DERIVED ── */
  const totalVal = tools.reduce((a, t) => a + t.quantity * t.price, 0);
  const machOpts = useMemo(
    () => [...new Set([...MACHINE_GROUPS_BASE, ...tools.map(t => t.machineGroup)])],
    [tools]
  );
  const typeOpts = useMemo(
    () => [...new Set([...TOOL_TYPES_BASE, ...tools.map(t => t.toolType)])],
    [tools]
  );
  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return tools.filter(t => {
      const hay = [
        t.name,
        t.manufacturer,
        t.partNumber,
        t.description,
        t.vendor,
        t.machineGroup,
        t.toolType
      ]
        .join(" ")
        .toLowerCase();
      return (!q || hay.includes(q)) && (!fMach || t.machineGroup === fMach) && (!fType || t.toolType === fType);
    });
  }, [tools, search, fMach, fType]);

  const sel = tools.find(t => t.id === selId);

  /* ── ACTIONS ── */
  const validate = () => {
    const e = {};
    if (!form.name.trim()) e.name = "Name required";
    if (form.quantity !== "" && +form.quantity < 0) e.quantity = "≥ 0";
    if (form.threshold !== "" && +form.threshold < 0) e.threshold = "≥ 0";
    if (form.price !== "" && +form.price < 0) e.price = "≥ 0.00";
    setErrors(e);
    return !Object.keys(e).length;
  };

  const openPOModal = tool => {
    setPOTool(tool);
    setPOModalOpen(true);
  };

  const createPO = poData => {
    if (!poTool) return;

    const order = {
      orderId: `PO-${Date.now()}`,
      id: poTool.id,
      toolId: poTool.id,
      name: poTool.name,
      poNumber: poData.poNumber,
      vendor: poData.vendor,
      quantity: parseInt(poData.quantity) || 0,
      unitPrice: parseFloat(poData.unitPrice) || 0,
      shippingType: poData.shippingType,
      shippingCost: parseFloat(poData.shippingCost) || 0,
      notes: poData.notes,
      status: "ordered",
      dateOrdered: poData.dateOrdered,
      datePaid: null,
      dateReceived: null,
      machineGroup: poTool.machineGroup || ""
    };

    setOrders(p => [...p, order]);
    rmQueue(poTool.id);
    setPOModalOpen(false);
    setPOTool(null);
    note(`PO ${poData.poNumber} created! 🧾`);
  };

  const addTool = () => {
    if (!validate()) return;
    const t = {
      id: Date.now(),
      name: form.name.trim(),
      manufacturer: form.manufacturer.trim(),
      partNumber: form.partNumber.trim(),
      description: form.description.trim(),
      quantity: Math.max(0, parseInt(form.quantity || 0)),
      threshold: Math.max(0, parseInt(form.threshold || 0)),
      price: Number(parseFloat(form.price || 0).toFixed(2)),
      vendor: "",
      projects: [],
      location: {},
      machineGroup: form.machineGroup || "",
      toolType: form.toolType || ""
    };
    setTools(p => [...p, t]);
    setForm({
      name: "",
      manufacturer: "",
      partNumber: "",
      description: "",
      quantity: "",
      threshold: "",
      price: "",
      machineGroup: "",
      toolType: ""
    });
    setErrors({});
    setSelId(t.id);
    note("Tool added ✅");
  };

  const updQty = (id, delta) =>
    setTools(p =>
      p.map(t => {
        if (t.id !== id) return t;
        const newQty = Math.max(0, t.quantity + delta);
        if (newQty <= t.threshold && !queue.some(q => q.id === id)) {
          setQueue(q => [...q, { ...t, quantity: newQty }]);
          note(`${t.name} → queue`);
        }
        return { ...t, quantity: newQty };
      })
    );

  const markPaid = (orderId) => {
    setOrders(p => p.map(o => 
      o.orderId === orderId 
        ? { ...o, status: "paid", datePaid: new Date().toISOString() }
        : o
    ));
    note("Marked as paid 💰");
  };

  const receiveOrder = (orderId) => {
    const o = orders.find(x => x.orderId === orderId);
    if (!o) return;
    
    const qty = prompt(`Qty received for "${o.name}" (ordered ${o.quantity}):`, o.quantity);
    if (!qty) return;
    
    const n = Math.max(0, parseInt(qty) || 0);
    setTools(p => p.map(t => 
      t.id === o.toolId 
        ? { ...t, quantity: t.quantity + n } 
        : t
    ));
    setOrders(p => p.map(order => 
      order.orderId === orderId
        ? { ...order, status: "received", dateReceived: new Date().toISOString() }
        : order
    ));
    note(`+${n} received ✅`);
  };

  const deletePO = (orderId) => {
    if (!window.confirm("Delete this PO?")) return;
    setOrders(p => p.filter(o => o.orderId !== orderId));
    note("PO deleted 🗑️");
  };

  const delTool = id => {
    if (window.confirm("Delete this tool?")) {
      setTools(p => p.filter(t => t.id !== id));
      setQueue(p => p.filter(t => t.id !== id));
      setOrders(p => p.filter(o => o.id !== id));
      if (selId === id) setSelId(null);
      note("Deleted 🗑️");
    }
  };

  const toQueue = t => {
    setQueue(q => (q.some(x => x.id === t.id) ? q : [...q, t]));
    note("Queued 📦");
  };

  const rmQueue = id => setQueue(p => p.filter(t => t.id !== id));

  const receiveAll = () => {
    if (!queue.length) return;
    const qty = prompt(`Receive ALL ${queue.length} items — qty each:`, "10");
    if (!qty) return;
    const n = parseInt(qty) || 0;
    queue.forEach(t => updQty(t.id, n));
    setQueue([]);
    note(`Received ${queue.length} POs!`);
  };

  const exportCSV = () => {
    const rows = [
      ["Name", "Mfr", "Part#", "Qty", "Thr", "Price", "Value", "Machine", "Type", "Vendor"],
      ...tools.map(t => [
        t.name,
        t.manufacturer,
        t.partNumber,
        t.quantity,
        t.threshold,
        t.price,
        (t.quantity * t.price).toFixed(2),
        t.machineGroup,
        t.toolType,
        t.vendor
      ])
    ];
    const blob = new Blob([rows.map(r => r.join(",")).join("\n")], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `toolly-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    note("CSV ready 📊");
  };

  return (
    <div className="app">
      {/* HEADER */}
      <Header />

      {/* TONY CARD */}
      <div
        style={{
          margin: "16px 24px 0",
          borderRadius: 12,
          overflow: "hidden",
          boxShadow: "var(--shadow)"
        }}
      >
        <div style={{ padding: 20, background: "linear-gradient(135deg,#6366f1,#8b5cf6)", color: "white" }}>
          <strong style={{ fontSize: 18 }}>🤖 Toolly Tony</strong>
          <p style={{ fontSize: 13, margin: "8px 0 0", opacity: 0.9 }}>
            Ask me speeds/feeds, tool life, or "best insert for 316 stainless"
          </p>
        </div>
        <div style={{ padding: 16, background: "var(--card)" }}>
          <button
            className="btn btn-primary"
            style={{ width: "100%" }}
            onClick={() => note("Live Tony drops tomorrow — SuperGrok API")}
          >
            Unlock Tony (1 click)
          </button>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════
          TABS START HERE
          ═══════════════════════════════════════════════════════ */}
      <Tabs>
        {/* ═══════════════ TAB 1: INVENTORY ═══════════════ */}
        <Tab label="📦 Inventory">
          {/* STATS */}
          <div
            className="metrics"
            style={{
              margin: "16px 24px 0",
              gap: 16,
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))"
            }}
          >
            <div className="metric card stat-accent">
              <div className="label">Low/Zero</div>
              <div className="value">{tools.filter(t => t.quantity <= t.threshold).length}</div>
            </div>
            <div className="metric card">
              <div className="label">Queue</div>
              <div className="value">{queue.length}</div>
            </div>
            <div className="metric card">
              <div className="label">POs</div>
              <div className="value">{orders.length}</div>
            </div>
            <div className="metric card">
              <div className="label">Value</div>
              <div className="value">{money(totalVal)}</div>
            </div>
          </div>

          {/* FILTERS */}
          <div
            className="controls"
            style={{
              margin: "16px 24px 0",
              display: "flex",
              gap: 12,
              flexWrap: "wrap",
              alignItems: "end"
            }}
          >
            <div className="search" style={{ flex: 1, minWidth: 280 }}>
              <input placeholder="Search anything…" onChange={e => setSearch(e.target.value)} />
            </div>
            <Select label="Machine" value={fMach} onChange={setFMach} options={machOpts} />
            <Select label="Type" value={fType} onChange={setFType} options={typeOpts} />
          </div>

          {/* ADD FORM */}
          <div className="card form" style={{ margin: "16px 24px 0" }}>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))",
                gap: 12,
                padding: 16
              }}
            >
              <Input
                label="Name"
                value={form.name}
                onChange={v => setForm(p => ({ ...p, name: v }))}
                error={errors.name}
              />
              <Input
                label="Mfr"
                value={form.manufacturer}
                onChange={v => setForm(p => ({ ...p, manufacturer: v }))}
              />
              <Input
                label="Part#"
                value={form.partNumber}
                onChange={v => setForm(p => ({ ...p, partNumber: v }))}
              />
              <Input
                label="Desc"
                value={form.description}
                onChange={v => setForm(p => ({ ...p, description: v }))}
              />
              <Input
                label="Qty"
                type="number"
                value={form.quantity}
                onChange={v => setForm(p => ({ ...p, quantity: v }))}
                error={errors.quantity}
              />
              <Input
                label="Low"
                type="number"
                value={form.threshold}
                onChange={v => setForm(p => ({ ...p, threshold: v }))}
                error={errors.threshold}
              />
              <Input
                label="Price"
                type="number"
                step="0.01"
                value={form.price}
                onChange={v => setForm(p => ({ ...p, price: v }))}
                error={errors.price}
              />
              <SelectWithOther
                label="Machine"
                value={form.machineGroup}
                setValue={v => setForm(p => ({ ...p, machineGroup: v }))}
                baseOptions={MACHINE_GROUPS_BASE}
              />
              <SelectWithOther
                label="Type"
                value={form.toolType}
                setValue={v => setForm(p => ({ ...p, toolType: v }))}
                baseOptions={TOOL_TYPES_BASE}
              />
              <div style={{ display: "flex", alignItems: "end" }}>
                <button className="btn btn-primary" style={{ width: "100%" }} onClick={addTool}>
                  Add Tool
                </button>
              </div>
            </div>
          </div>

          {/* MAIN LAYOUT */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 340px",
              gap: 24,
              margin: "16px 24px 0"
            }}
          >
            {/* TABLE */}
            <div className="card table-wrap">
              <div className="table-scroll">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Item</th>
                      <th>On Hand</th>
                      <th>Vendor</th>
                      <th>Value</th>
                      <th>Actions</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.length === 0 && (
                      <tr>
                        <td colSpan={6} className="subtle">
                          Nothing matches
                        </td>
                      </tr>
                    )}
                    {filtered.map(t => {
                      const low = t.quantity <= t.threshold;
                      const zero = t.quantity === 0;
                      const pct = Math.min(100, Math.round((t.quantity / (t.threshold * 2 || 10)) * 100));

                      return (
                        <tr
                          key={t.id}
                          onClick={() => setSelId(t.id)}
                          style={{
                            cursor: "pointer",
                            background: selId === t.id ? "var(--accent-50)" : ""
                          }}
                        >
                          <td>
                            <div style={{ fontWeight: 600 }}>{t.name}</div>
                            <div className="subtle">
                              {t.manufacturer} · {t.partNumber}
                            </div>
                            {(t.machineGroup || t.toolType) && (
                              <div
                                className="subtle"
                                style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 4 }}
                              >
                                {t.machineGroup && <span className="badge pill">{t.machineGroup}</span>}
                                {t.toolType && <span className="badge pill">{t.toolType}</span>}
                              </div>
                            )}
                          </td>
                          <td>
                            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                              <input
                                type="number"
                                min="0"
                                value={t.quantity}
                                onChange={e =>
                                  setTools(p =>
                                    p.map(x =>
                                      x.id === t.id
                                        ? { ...x, quantity: Math.max(0, parseInt(e.target.value) || 0) }
                                        : x
                                    )
                                  )
                                }
                                onClick={e => e.stopPropagation()}
                                style={{
                                  width: 80,
                                  padding: "8px 10px",
                                  border: "1px solid var(--border)",
                                  borderRadius: 8,
                                  background: "var(--card)",
                                  fontWeight: 600,
                                  textAlign: "center",
                                  color: "var(--text)"
                                }}
                              />
                              <div style={{ flex: 1 }}>
                                <div className="progress">
                                  <span
                                    style={{
                                      width: `${pct}%`,
                                      background: zero ? "#ef4444" : low ? "#f59e0b" : "#10b981"
                                    }}
                                  />
                                </div>
                                <div className="subtle" style={{ fontSize: 11 }}>
                                  min {t.threshold}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td>{t.vendor || "—"}</td>
                          <td style={{ textAlign: "right" }}>{money(t.quantity * t.price)}</td>
                          <td style={{ whiteSpace: "nowrap" }}>
                            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                              <button
                                className="btn"
                                onClick={e => {
                                  e.stopPropagation();
                                  updQty(t.id, -1);
                                }}
                              >
                                −1
                              </button>
                              <button
                                className="btn btn-primary"
                                onClick={e => {
                                  e.stopPropagation();
                                  navigator.clipboard.writeText(JSON.stringify({ toolId: t.id, qty: 1 }));
                                  note("QR copied — scan!");
                                }}
                              >
                                📱 Pull
                              </button>
                              <button
                                className="btn"
                                onClick={e => {
                                  e.stopPropagation();
                                  toQueue(t);
                                }}
                              >
                                Reorder
                              </button>
                              <button
                                className="btn"
                                onClick={e => {
                                  e.stopPropagation();
                                  setModal({ ...t, projects: t.projects.join(", ") });
                                  setModalOpen(true);
                                }}
                              >
                                Edit
                              </button>
                              <button
                                className="btn btn-danger"
                                onClick={e => {
                                  e.stopPropagation();
                                  delTool(t.id);
                                }}
                              >
                                Del
                              </button>
                            </div>
                          </td>
                          <td>
                            {zero ? (
                              <span className="badge zero">❌ Out</span>
                            ) : low ? (
                              <span className="badge low">⚠️ Low</span>
                            ) : (
                              <span className="badge ok">✅ OK</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* SIDEBAR */}
            <aside style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {sel ? (
                <div className="card" style={{ padding: 16, boxShadow: "var(--shadow)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start" }}>
                    <div>
                      <h2 style={{ margin: 0, fontSize: 20 }}>{sel.name}</h2>
                      <div style={{ fontSize: 13, color: "var(--muted)", marginTop: 4 }}>
                        {sel.manufacturer} · {sel.partNumber}
                      </div>
                    </div>
                    <span
                      className={`badge ${
                        sel.quantity === 0 ? "zero" : sel.quantity <= sel.threshold ? "low" : "ok"
                      }`}
                      style={{ fontSize: 11 }}
                    >
                      {sel.quantity === 0 ? "OUT" : sel.quantity <= sel.threshold ? "LOW" : "OK"}
                    </span>
                  </div>

                  <svg
                    width="100%"
                    height="100"
                    viewBox="0 0 300 100"
                    style={{
                      margin: "16px 0",
                      background: "var(--card)",
                      borderRadius: 8,
                      border: "1px solid var(--border)"
                    }}
                  >
                    <path
                      d={sparklinePath(fakeHistory(sel.quantity, sel.threshold), 300, 100)}
                      fill="none"
                      stroke="#3b82f6"
                      strokeWidth="3"
                    />
                    <line x1="0" x2="300" y1="80" y2="80" stroke="#f97316" strokeDasharray="6 6" />
                  </svg>

                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr",
                      gap: 12,
                      fontSize: 14
                    }}
                  >
                    <div>
                      <div style={{ color: "var(--muted)" }}>On Hand</div>
                      <div style={{ fontWeight: 700, fontSize: 20 }}>{sel.quantity}</div>
                    </div>
                    <div>
                      <div style={{ color: "var(--muted)" }}>Incoming</div>
                      <div style={{ fontWeight: 700, fontSize: 20 }}>
                        {orders.filter(o => o.toolId === sel.id && o.status !== "received").length}
                      </div>
                    </div>
                    <div>
                      <div style={{ color: "var(--muted)" }}>Need</div>
                      <div style={{ fontWeight: 700, fontSize: 20 }}>
                        {Math.max(0, sel.threshold - sel.quantity)}
                      </div>
                    </div>
                    <div>
                      <div style={{ color: "var(--muted)" }}>Value</div>
                      <div style={{ fontWeight: 700, fontSize: 20 }}>{money(sel.quantity * sel.price)}</div>
                    </div>
                  </div>

                  <div style={{ marginTop: 16, display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <button
                      className="btn"
                      style={{ flex: 1 }}
                      onClick={() => updQty(sel.id, -1)}
                    >
                      -1
                    </button>
                    <button
                      className="btn btn-primary"
                      style={{ flex: 2 }}
                      onClick={() => {
                        navigator.clipboard.writeText(JSON.stringify({ toolId: sel.id, qty: 1 }));
                        note("QR copied!");
                      }}
                    >
                      📱 Pull
                    </button>
                    <button
                      className="btn btn-success"
                      style={{ flex: 2 }}
                      onClick={() => openPOModal(sel)}
                    >
                      Create PO
                    </button>
                  </div>
                </div>
              ) : (
                <div className="card" style={{ padding: 32, textAlign: "center", color: "var(--muted)" }}>
                  <div style={{ fontSize: 48 }}>🛠️</div>
                  <p style={{ margin: "12px 0 0", fontSize: 14 }}>
                    Select a tool to see
                    <br />
                    details and history
                  </p>
                </div>
              )}

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 12,
                  fontSize: 13
                }}
              >
                <div className="card" style={{ padding: 12, textAlign: "center" }}>
                  <div style={{ color: "var(--muted)" }}>Total Tools</div>
                  <div style={{ fontWeight: 700, fontSize: 18 }}>{tools.length}</div>
                </div>
                <div className="card" style={{ padding: 12, textAlign: "center" }}>
                  <div style={{ color: "var(--muted)" }}>Queue</div>
                  <div style={{ fontWeight: 700, fontSize: 18 }}>{queue.length}</div>
                </div>
              </div>
            </aside>
          </div>

          {/* QUEUE + POs */}
          <div
            style={{
              margin: "24px 24px 0",
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit,minmax(340px,1fr))",
              gap: 16
            }}
          >
            {/* REORDER QUEUE */}
            <div className="card" style={{ padding: 0, boxShadow: "var(--shadow)" }}>
              <div
                style={{
                  padding: "16px 20px",
                  background: "#fef3c7",
                  borderBottom: "1px solid #fde68a",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center"
                }}
              >
                <strong style={{ fontSize: 16, color: "#78350f" }}>📦 Reorder Queue ({queue.length})</strong>
                <button className="btn btn-success btn-sm" onClick={receiveAll}>
                  Receive All
                </button>
              </div>
              <div style={{ maxHeight: 340, overflow: "auto" }}>
                {queue.length === 0 ? (
                  <div style={{ padding: 40, textAlign: "center", color: "var(--muted)" }}>
                    <div style={{ fontSize: 48 }}>✨</div>
                    <p>No items — you're golden!</p>
                  </div>
                ) : (
                  <ul style={{ margin: 0, padding: 0, listStyle: "none" }}>
                    {[...new Map(queue.map(t => [t.id, t])).values()].map(t => (
                      <li
                        key={t.id}
                        style={{
                          padding: "12px 20px",
                          borderBottom: "1px dashed var(--border)",
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center"
                        }}
                      >
                        <div>
                          <div style={{ fontWeight: 600 }}>{t.name}</div>
                          <div style={{ fontSize: 12, color: "var(--muted)" }}>
                            need {t.threshold} • {t.quantity} on hand
                          </div>
                        </div>
                        <div style={{ display: "flex", gap: 8 }}>
                          <button className="btn btn-success btn-sm" onClick={() => openPOModal(t)}>
                            Create PO
                          </button>
                          <button className="btn btn-danger btn-sm" onClick={() => rmQueue(t.id)}>
                            ×
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            {/* PENDING POs */}
            <div className="card" style={{ padding: 0, boxShadow: "var(--shadow)" }}>
              <div style={{ 
                padding: "16px 20px", 
                background: "#dbeafe", 
                borderBottom: "1px solid #93c5fd",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center"
              }}>
                <strong style={{ fontSize: 16, color: "#1e3a8a" }}>
                  🧾 Purchase Orders ({orders.length})
                </strong>
                <div style={{ fontSize: 11, color: "#1e40af" }}>
                  {orders.filter(o => o.status === "paid").length} paid
                </div>
              </div>
              <div style={{ maxHeight: 400, overflow: "auto" }}>
                {orders.length === 0 ? (
                  <div style={{ padding: 40, textAlign: "center", color: "var(--muted)" }}>
                    <div style={{ fontSize: 48 }}>📋</div>
                    <p style={{ margin: "8px 0 0" }}>No purchase orders yet</p>
                  </div>
                ) : (
                  <ul style={{ margin: 0, padding: 0, listStyle: "none" }}>
                    {orders.map(o => {
                      const totalCost = (o.quantity * o.unitPrice) + (o.shippingCost || 0);
                      const isRush = o.shippingType && o.shippingType !== "Standard";
                      
                      return (
                        <li 
                          key={o.orderId} 
                          style={{ 
                            padding: "14px 20px", 
                            borderBottom: "1px dashed var(--border)",
                            background: o.status === "received" ? "var(--bg)" : "transparent"
                          }}
                        >
                          <div style={{ 
                            display: "flex", 
                            justifyContent: "space-between", 
                            alignItems: "center",
                            marginBottom: 8
                          }}>
                            <div>
                              <div style={{ fontWeight: 600, color: "var(--text)" }}>
                                {o.name}
                              </div>
                              <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>
                                PO: {o.poNumber} • {o.vendor || "—"}
                              </div>
                            </div>
                            <StatusBadge status={o.status} />
                          </div>

                          <div style={{ 
                            fontSize: 12, 
                            color: "var(--muted)", 
                            marginBottom: 8,
                            display: "grid",
                            gridTemplateColumns: "1fr 1fr",
                            gap: 8
                          }}>
                            <div>
                              Qty: <strong style={{ color: "var(--text)" }}>{o.quantity}</strong> × {money(o.unitPrice)}
                            </div>
                            <div>
                              Ship: {money(o.shippingCost || 0)}
                              {isRush && <span style={{ color: "#f59e0b", marginLeft: 4 }}>⚡ {o.shippingType}</span>}
                            </div>
                          </div>

                          <div style={{ 
                            display: "flex", 
                            justifyContent: "space-between",
                            alignItems: "center",
                            marginBottom: 10
                          }}>
                            <div style={{ fontSize: 14, fontWeight: 700, color: "var(--accent)" }}>
                              Total: {money(totalCost)}
                            </div>
                            <div style={{ fontSize: 11, color: "var(--muted)" }}>
                              {o.status === "ordered" && `Ordered ${new Date(o.dateOrdered).toLocaleDateString()}`}
                              {o.status === "paid" && `Paid ${new Date(o.datePaid).toLocaleDateString()}`}
                              {o.status === "received" && `Received ${new Date(o.dateReceived).toLocaleDateString()}`}
                            </div>
                          </div>

                          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                            {o.status === "ordered" && (
                              <>
                                <button 
                                  className="btn btn-primary btn-sm" 
                                  onClick={() => markPaid(o.orderId)}
                                >
                                  Mark Paid
                                </button>
                                <button 
                                  className="btn btn-danger btn-sm" 
                                  onClick={() => deletePO(o.orderId)}
                                >
                                  Delete
                                </button>
                              </>
                            )}
                            {o.status === "paid" && (
                              <button 
                                className="btn btn-success btn-sm" 
                                onClick={() => receiveOrder(o.orderId)}
                              >
                                Receive Order
                              </button>
                            )}
                            {o.status === "received" && (
                              <div style={{ 
                                fontSize: 11, 
                                color: "var(--muted)",
                                fontStyle: "italic"
                              }}>
                                Order complete
                              </div>
                            )}
                          </div>

                          {o.notes && (
                            <div style={{ 
                              marginTop: 8, 
                              padding: 8, 
                              background: "var(--bg)", 
                              borderRadius: 6,
                              fontSize: 11,
                              color: "var(--muted)",
                              fontStyle: "italic"
                            }}>
                              📝 {o.notes}
                            </div>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </div>
          </div>
        </Tab>

        {/* ═══════════════ TAB 2: APPROVAL QUEUE ═══════════════ */}
        <Tab label="✅ Approvals">
          <div style={{ padding: "24px" }}>
            <ApprovalQueue userRole="manager" />
          </div>
        </Tab>

        {/* ═══════════════ TAB 3: NEW PROJECT TOOL ═══════════════ */}
        <Tab label="🆕 Project Tool">
          <div style={{ padding: "24px" }}>
            <NewProjectToolRequest />
          </div>
        </Tab>
      </Tabs>

      {/* TOAST (outside tabs) */}
      {toast && (
        <div className="toast">
          <span>✅</span>
          <span>{toast}</span>
        </div>
      )}

      {/* EDIT MODAL (outside tabs) */}
      {modalOpen && (
        <div className="modal-backdrop" onClick={() => setModalOpen(false)}>
          <div
            className="card"
            style={{ width: "min(820px,92vw)", padding: 20 }}
            onClick={e => e.stopPropagation()}
          >
            <h3>Edit Tool</h3>
            <div className="form-grid" style={{ gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
              <Input
                label="Name"
                value={modal.name}
                onChange={v => setModal(p => ({ ...p, name: v }))}
              />
              <Input
                label="Mfr"
                value={modal.manufacturer}
                onChange={v => setModal(p => ({ ...p, manufacturer: v }))}
              />
              <Input
                label="Part#"
                value={modal.partNumber}
                onChange={v => setModal(p => ({ ...p, partNumber: v }))}
              />
              <div style={{ gridColumn: "1/-1" }}>
                <Input
                  label="Desc"
                  value={modal.description}
                  onChange={v => setModal(p => ({ ...p, description: v }))}
                />
              </div>
              <Input
                label="Qty"
                type="number"
                value={modal.quantity}
                onChange={v => setModal(p => ({ ...p, quantity: v }))}
              />
              <Input
                label="Low"
                type="number"
                value={modal.threshold}
                onChange={v => setModal(p => ({ ...p, threshold: v }))}
              />
              <Input
                label="Price"
                type="number"
                step="0.01"
                value={modal.price}
                onChange={v => setModal(p => ({ ...p, price: v }))}
              />
              <Input
                label="Vendor"
                value={modal.vendor}
                onChange={v => setModal(p => ({ ...p, vendor: v }))}
              />
              <div style={{ gridColumn: "1/-1" }}>
                <Input
                  label="Projects"
                  value={modal.projects}
                  onChange={v => setModal(p => ({ ...p, projects: v }))}
                />
              </div>
              <SelectWithOther
                label="Machine"
                value={modal.machineGroup}
                setValue={v => setModal(p => ({ ...p, machineGroup: v }))}
                baseOptions={MACHINE_GROUPS_BASE}
              />
              <SelectWithOther
                label="Type"
                value={modal.toolType}
                setValue={v => setModal(p => ({ ...p, toolType: v }))}
                baseOptions={TOOL_TYPES_BASE}
              />
            </div>

            <LocationSection
              value={modal.location}
              onChange={loc => setModal(p => ({ ...p, location: loc }))}
            />

            <div className="toolbar" style={{ marginTop: 16 }}>
              <button className="btn" onClick={() => setModalOpen(false)}>
                Cancel
              </button>
              <button
                className="btn btn-primary"
                onClick={() => {
                  setTools(p =>
                    p.map(t =>
                      t.id === modal.id
                        ? {
                            ...t,
                            name: modal.name.trim(),
                            manufacturer: modal.manufacturer.trim(),
                            partNumber: modal.partNumber.trim(),
                            description: modal.description.trim(),
                            quantity: Math.max(0, parseInt(modal.quantity) || 0),
                            threshold: Math.max(0, parseInt(modal.threshold) || 0),
                            price: Number(parseFloat(modal.price || 0).toFixed(2)),
                            vendor: modal.vendor.trim(),
                            projects: modal.projects
                              .split(",")
                              .map(s => s.trim())
                              .filter(Boolean),
                            location: modal.location,
                            machineGroup: modal.machineGroup,
                            toolType: modal.toolType
                          }
                        : t
                    )
                  );
                  setModalOpen(false);
                  note("Saved 💾");
                }}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PO MODAL (outside tabs) */}
      {poModalOpen && (
        <POModal
          tool={poTool}
          onClose={() => {
            setPOModalOpen(false);
            setPOTool(null);
          }}
          onSubmit={createPO}
        />
      )}
    </div>
  );
}