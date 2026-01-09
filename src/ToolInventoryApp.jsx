// src/ToolInventoryApp.jsx - WITH DATE/TIME TRACKING
import React, { useEffect, useMemo, useRef, useState } from "react";
import "./modern-light.css";
import LocationSection from "./LocationSection";
import { LS, load, save } from "./storage";

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


/* ──────── GEOMETRY (ADVANCED) ──────── */
const GeometrySection = ({ toolType, geometry, setGeometry }) => {
  const tt = String(toolType || "").toLowerCase();
  const isMillLike = ["endmill","drill","tap","reamer"].some(k => tt.includes(k));
  const isTurningInsert = tt.includes("turning insert") || tt.includes("grooving insert");
  const isFaceMillInsert = tt.includes("face mill insert");

  const g = geometry || {};
  const set = (k, v) => setGeometry(p => ({ ...(p || {}), [k]: v }));

  if (isMillLike) {
    return (
      <div className="form-grid" style={{ gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
        <Input label="Diameter (in/mm)" value={g.diameter || ""} onChange={v => set("diameter", v)} />
        <Input label="Flutes" type="number" value={g.flutes || ""} onChange={v => set("flutes", v)} />
        <Input label="Tool Material" value={g.toolMaterial || ""} onChange={v => set("toolMaterial", v)} placeholder="Carbide, HSS…" />

        <Input label="LOC" value={g.loc || ""} onChange={v => set("loc", v)} />
        <Input label="OAL" value={g.oal || ""} onChange={v => set("oal", v)} />
        <Input label="Shank Ø" value={g.shankDiameter || ""} onChange={v => set("shankDiameter", v)} />

        <Input label="Corner Radius / Chamfer" value={g.cornerRadius || ""} onChange={v => set("cornerRadius", v)} />
        <Input label="Helix Angle" value={g.helixAngle || ""} onChange={v => set("helixAngle", v)} placeholder="e.g., 35°" />
        <Input label="Coating" value={g.coating || ""} onChange={v => set("coating", v)} placeholder="TiAlN, AlCrN…" />
      </div>
    );
  }

  if (isTurningInsert) {
    return (
      <div className="form-grid" style={{ gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
        <Input label="ISO Shape / Code" value={g.isoShape || ""} onChange={v => set("isoShape", v)} placeholder="CNMG, DNMG…" />
        <Input label="ISO Size" value={g.isoSize || ""} onChange={v => set("isoSize", v)} placeholder="432, 160408…" />
        <Input label="Nose Radius" value={g.noseRadius || ""} onChange={v => set("noseRadius", v)} />

        <Input label="Thickness" value={g.thickness || ""} onChange={v => set("thickness", v)} />
        <Input label="Hand" value={g.hand || ""} onChange={v => set("hand", v)} placeholder="L / R / N" />
        <Input label="Material Group" value={g.materialGroup || ""} onChange={v => set("materialGroup", v)} placeholder="P/M/K/N/S/H" />

        <Input label="Grade" value={g.grade || ""} onChange={v => set("grade", v)} />
        <Input label="Chipbreaker" value={g.chipbreaker || ""} onChange={v => set("chipbreaker", v)} />
        <Input label="Coating" value={g.coating || ""} onChange={v => set("coating", v)} />
      </div>
    );
  }

  if (isFaceMillInsert) {
    return (
      <div className="form-grid" style={{ gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
        <Input label="Insert Style" value={g.insertStyle || ""} onChange={v => set("insertStyle", v)} placeholder="APKT, SEKT…" />
        <Input label="ISO Size" value={g.isoSize || ""} onChange={v => set("isoSize", v)} />
        <Input label="Thickness" value={g.thickness || ""} onChange={v => set("thickness", v)} />

        <Input label="Corner Radius" value={g.cornerRadius || ""} onChange={v => set("cornerRadius", v)} />
        <Input label="Grade" value={g.grade || ""} onChange={v => set("grade", v)} />
        <Input label="Coating" value={g.coating || ""} onChange={v => set("coating", v)} />
      </div>
    );
  }

  return (
    <div className="subtle" style={{ fontSize: 13 }}>
      Pick a <b>Tool Type</b> to see geometry fields.
    </div>
  );
};

/* ──────── HELPERS ──────── */
const money = v => Number(v || 0).toLocaleString("en-US", { style: "currency", currency: "USD" });

const packDisplay = (qtyEach, packSize) => {
  const ps = Number(packSize);
  const q = Number(qtyEach) || 0;
  if (!ps || ps <= 1) return null;
  const packs = Math.floor(q / ps);
  const each = q % ps;
  return `${packs} pk + ${each} ea`;
};


const isInsertType = (toolType) => String(toolType || "").toLowerCase().includes("insert");

// ✨ NEW: Format date/time for display
const formatDateTime = (isoString) => {
  if (!isoString) return "—";
  const date = new Date(isoString);
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true
  });
};

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
            CNC Tooling Management
          </p>
        </div>
      </div>

      <div className="toolbar" style={{ gap: 10 }}>
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

/* ──────── PO MODAL WITH PROJECT FIELD ──────── */
const SHIPPING_TYPES = ["Standard", "Expedited", "Rush", "Next Day"];

function POModal({ onClose, onSubmit }) {
  const [showAllTools, setShowAllTools] = useState(false);
  const [poTools, setPOTools] = useState([]);
  const [dragOverIndex, setDragOverIndex] = useState(null);
  
  const [po, setPO] = useState({
    poNumber: "",
    vendor: "",
    project: "",
    projectType: "new",
    shippingType: "Standard",
    shippingCost: 0,
    notes: "",
    dateOrdered: new Date().toISOString().split("T")[0]
  });

  const [errors, setErrors] = useState({});

  const allTools = load(LS.tools, []);
  const queueTools = load(LS.queue, []);
  const jobKits = load("toolly_kits", []);
  
  const availableTools = showAllTools ? allTools : queueTools;

  const handleDragStart = (e, tool) => {
    e.dataTransfer.setData("tool", JSON.stringify(tool));
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOverIndex(null);
    
    const toolData = e.dataTransfer.getData("tool");
    if (toolData) {
      const tool = JSON.parse(toolData);
      if (!poTools.some(t => t.id === tool.id)) {
        setPOTools(prev => [...prev, { 
          ...tool, 
          orderQty: tool.threshold || 1,
          orderPrice: tool.price || 0
        }]);
      }
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setDragOverIndex(0);
  };

  const updateToolQty = (toolId, qty) => {
    setPOTools(prev => prev.map(t => 
      t.id === toolId ? { ...t, orderQty: Math.max(1, parseInt(qty) || 1) } : t
    ));
  };

  const updateToolPrice = (toolId, price) => {
    setPOTools(prev => prev.map(t => 
      t.id === toolId ? { ...t, orderPrice: parseFloat(price) || 0 } : t
    ));
  };

  const removeTool = (toolId) => {
    setPOTools(prev => prev.filter(t => t.id !== toolId));
  };

  const subtotal = poTools.reduce((sum, t) => sum + (t.orderQty * t.orderPrice), 0);
  const shipping = parseFloat(po.shippingCost || 0);
  const total = subtotal + shipping;

  const validate = () => {
    const e = {};
    if (!po.poNumber.trim()) e.poNumber = "PO Number required";
    if (poTools.length === 0) e.tools = "Add at least one tool";
    if (!po.project.trim()) e.project = "Project required";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = () => {
    if (!validate()) return;
    
    const poData = {
      ...po,
      tools: poTools.map(t => ({
        id: t.id,
        toolId: t.id,
        name: t.name,
        quantity: t.orderQty,
        unitPrice: t.orderPrice,
        machineGroup: t.machineGroup || ""
      }))
    };
    
    onSubmit(poData);
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="card"
        style={{
          width: "min(1400px, 95vw)",
          height: "90vh",
          padding: 0,
          display: "flex",
          flexDirection: "column"
        }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ 
          padding: 20, 
          borderBottom: "1px solid var(--border)",
          background: "var(--card)"
        }}>
          <h3 style={{ margin: "0 0 8px", color: "var(--text)" }}>
            Create Purchase Order
          </h3>
          <div style={{ fontSize: 13, color: "var(--muted)" }}>
            Drag tools from left to add them to this PO
          </div>
        </div>

        <div style={{ 
          flex: 1, 
          display: "grid", 
          gridTemplateColumns: "400px 1fr",
          overflow: "hidden"
        }}>
          
          <div style={{ 
            borderRight: "1px solid var(--border)",
            display: "flex",
            flexDirection: "column",
            background: "var(--bg)"
          }}>
            <div style={{ 
              padding: 16, 
              borderBottom: "1px solid var(--border)",
              background: "var(--card)"
            }}>
              <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
                <button 
                  className={`pill ${!showAllTools ? "active" : ""}`}
                  onClick={() => setShowAllTools(false)}
                  style={{ flex: 1 }}
                >
                  Reorder Queue ({queueTools.length})
                </button>
                <button 
                  className={`pill ${showAllTools ? "active" : ""}`}
                  onClick={() => setShowAllTools(true)}
                  style={{ flex: 1 }}
                >
                  All Tools ({allTools.length})
                </button>
              </div>
            </div>

            <div style={{ flex: 1, overflow: "auto", padding: 12 }}>
              {availableTools.length === 0 ? (
                <div style={{ padding: 40, textAlign: "center", color: "var(--muted)" }}>
                  No tools available
                </div>
              ) : (
                <div style={{ display: "grid", gap: 8 }}>
                  {availableTools.map(tool => (
                    <div
                      key={tool.id}
                      draggable
                      onDragStart={e => handleDragStart(e, tool)}
                      style={{
                        padding: 12,
                        background: "var(--card)",
                        border: "1px solid var(--border)",
                        borderRadius: 8,
                        cursor: "grab"
                      }}
                    >
                      <div style={{ fontWeight: 600, color: "var(--text)" }}>
                        {tool.name}
                      </div>
                      <div className="subtle" style={{ fontSize: 12, marginTop: 2 }}>
                        {tool.manufacturer} · {tool.partNumber}
                      </div>
                      <div style={{ 
                        display: "flex", 
                        justifyContent: "space-between",
                        marginTop: 6,
                        fontSize: 12
                      }}>
                        <span className="subtle">Stock: {tool.quantity}</span>
                        <span style={{ fontWeight: 600, color: "var(--accent)" }}>
                          {money(tool.price || 0)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div style={{ 
            display: "flex", 
            flexDirection: "column",
            overflow: "auto",
            background: "var(--card)"
          }}>
            <div style={{ padding: 20, borderBottom: "1px solid var(--border)" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
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
                    <div style={{ color: "#ef4444", fontSize: 12, marginTop: 4 }}>
                      {errors.poNumber}
                    </div>
                  )}
                </div>

                <div>
                  <label style={{ display: "block", fontSize: 12, color: "var(--muted)", marginBottom: 6 }}>
                    Vendor
                  </label>
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

                <div style={{ gridColumn: "1/-1" }}>
                  <label style={{ display: "block", fontSize: 12, color: "var(--muted)", marginBottom: 6 }}>
                    Project / Job *
                  </label>
                  <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                    <button 
                      className={`pill ${po.projectType === "existing" ? "active" : ""}`}
                      onClick={() => setPO(p => ({ ...p, projectType: "existing", project: "" }))}
                      type="button"
                      style={{ fontSize: 12 }}
                    >
                      📋 Existing Job Kit
                    </button>
                    <button 
                      className={`pill ${po.projectType === "new" ? "active" : ""}`}
                      onClick={() => setPO(p => ({ ...p, projectType: "new", project: "" }))}
                      type="button"
                      style={{ fontSize: 12 }}
                    >
                      ✨ New Project
                    </button>
                  </div>

                  {po.projectType === "existing" ? (
                    <select
                      value={po.project}
                      onChange={e => setPO(p => ({ ...p, project: e.target.value }))}
                      style={{
                        width: "100%",
                        padding: "10px 12px",
                        border: `1px solid ${errors.project ? "#ef4444" : "var(--border)"}`,
                        borderRadius: 10,
                        background: "var(--card)",
                        color: "var(--text)",
                        outline: "none"
                      }}
                    >
                      <option value="">Select a job kit...</option>
                      {jobKits.map(kit => (
                        <option key={kit.id} value={`Job-${kit.id}`}>
                          {kit.partName} ({kit.customer}) - {kit.partNumber}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="text"
                      value={po.project}
                      onChange={e => setPO(p => ({ ...p, project: e.target.value }))}
                      placeholder="Enter new project name..."
                      style={{
                        width: "100%",
                        padding: "10px 12px",
                        border: `1px solid ${errors.project ? "#ef4444" : "var(--border)"}`,
                        borderRadius: 10,
                        background: "var(--card)",
                        color: "var(--text)",
                        outline: "none"
                      }}
                    />
                  )}
                  {errors.project && (
                    <div style={{ color: "#ef4444", fontSize: 12, marginTop: 4 }}>
                      {errors.project}
                    </div>
                  )}
                </div>

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
                      <option key={type} value={type}>{type}</option>
                    ))}
                  </select>
                </div>

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

                <div style={{ gridColumn: "1/-1" }}>
                  <label style={{ display: "block", fontSize: 12, color: "var(--muted)", marginBottom: 6 }}>
                    Notes
                  </label>
                  <textarea
                    value={po.notes}
                    onChange={e => setPO(p => ({ ...p, notes: e.target.value }))}
                    placeholder="Special instructions, lead time, etc."
                    rows={2}
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
            </div>

            <div style={{ flex: 1, padding: 20 }}>
              <div style={{ marginBottom: 12, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <strong style={{ color: "var(--text)" }}>
                  Tools on this PO ({poTools.length})
                </strong>
                {errors.tools && (
                  <div style={{ color: "#ef4444", fontSize: 12 }}>
                    {errors.tools}
                  </div>
                )}
              </div>

              <div
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={() => setDragOverIndex(null)}
                style={{
                  minHeight: 200,
                  border: dragOverIndex !== null ? "2px dashed var(--accent)" : "2px dashed var(--border)",
                  borderRadius: 12,
                  padding: 16,
                  background: dragOverIndex !== null ? "var(--accent-50)" : "var(--bg)",
                  transition: "all 0.2s"
                }}
              >
                {poTools.length === 0 ? (
                  <div style={{ textAlign: "center", padding: 40, color: "var(--muted)" }}>
                    <div style={{ fontSize: 48, marginBottom: 8 }}>👈</div>
                    <p>Drag tools here to add them to this PO</p>
                  </div>
                ) : (
                  <div style={{ display: "grid", gap: 12 }}>
                    {poTools.map(tool => (
                      <div 
                        key={tool.id}
                        className="card"
                        style={{ padding: 16 }}
                      >
                        <div style={{ 
                          display: "grid", 
                          gridTemplateColumns: "2fr 1fr 1fr auto",
                          gap: 12,
                          alignItems: "center"
                        }}>
                          <div>
                            <div style={{ fontWeight: 600, color: "var(--text)" }}>
                              {tool.name}
                            </div>
                            <div className="subtle" style={{ fontSize: 12 }}>
                              {tool.manufacturer} · {tool.partNumber}
                            </div>
                          </div>

                          <div>
                            <label style={{ display: "block", fontSize: 11, color: "var(--muted)", marginBottom: 4 }}>
                              Quantity
                            </label>
                            <input
                              type="number"
                              min="1"
                              value={tool.orderQty}
                              onChange={e => updateToolQty(tool.id, e.target.value)}
                              style={{
                                width: "100%",
                                padding: "8px 10px",
                                border: "1px solid var(--border)",
                                borderRadius: 8,
                                background: "var(--card)",
                                color: "var(--text)",
                                textAlign: "center",
                                fontWeight: 600
                              }}
                            />
                          </div>

                          <div>
                            <label style={{ display: "block", fontSize: 11, color: "var(--muted)", marginBottom: 4 }}>
                              Unit Price
                            </label>
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              value={tool.orderPrice}
                              onChange={e => updateToolPrice(tool.id, e.target.value)}
                              style={{
                                width: "100%",
                                padding: "8px 10px",
                                border: "1px solid var(--border)",
                                borderRadius: 8,
                                background: "var(--card)",
                                color: "var(--text)",
                                textAlign: "right",
                                fontWeight: 600
                              }}
                            />
                          </div>

                          <button
                            className="btn btn-danger"
                            onClick={() => removeTool(tool.id)}
                            style={{ padding: "8px 12px" }}
                          >
                            ×
                          </button>
                        </div>

                        <div style={{ 
                          marginTop: 8, 
                          paddingTop: 8,
                          borderTop: "1px dashed var(--border)",
                          textAlign: "right",
                          fontSize: 14,
                          color: "var(--muted)"
                        }}>
                          Subtotal: <strong style={{ color: "var(--text)" }}>
                            {money(tool.orderQty * tool.orderPrice)}
                          </strong>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {poTools.length > 0 && (
                <div
                  style={{
                    marginTop: 20,
                    padding: 16,
                    background: "var(--bg)",
                    borderRadius: 8,
                    border: "1px solid var(--border)"
                  }}
                >
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
                    <div>
                      <div className="subtle" style={{ fontSize: 12 }}>Subtotal</div>
                      <div style={{ fontWeight: 700, fontSize: 18, color: "var(--text)" }}>
                        {money(subtotal)}
                      </div>
                    </div>
                    <div>
                      <div className="subtle" style={{ fontSize: 12 }}>Shipping</div>
                      <div style={{ fontWeight: 700, fontSize: 18, color: "var(--text)" }}>
                        {money(shipping)}
                      </div>
                      <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>
                        {po.shippingType}
                      </div>
                    </div>
                    <div>
                      <div className="subtle" style={{ fontSize: 12 }}>Total Cost</div>
                      <div style={{ fontWeight: 700, fontSize: 22, color: "var(--accent)" }}>
                        {money(total)}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <div style={{ 
          padding: 20, 
          borderTop: "1px solid var(--border)",
          background: "var(--card)",
          display: "flex",
          justifyContent: "space-between"
        }}>
          <button className="btn" onClick={onClose}>
            Cancel
          </button>
          <button
            className="btn btn-primary"
            onClick={handleSubmit}
            disabled={!po.poNumber || poTools.length === 0 || !po.project}
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
    pending: { text: "⏳ Pending Approval", color: "#9333ea", bg: "#faf5ff" },
    approved: { text: "✅ Approved", color: "#059669", bg: "#ecfdf5" },
    ordered: { text: "📦 Ordered", color: "#f59e0b", bg: "#fffbeb" },
    paid: { text: "💰 Paid", color: "#3b82f6", bg: "#eff6ff" },
    received: { text: "✅ Received", color: "#22c55e", bg: "#f0fdf4" }
  };
  
  const badge = badges[status] || badges.pending;
  
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
  const [expandedPOs, setExpandedPOs] = useState(new Set());
  const [showArchived, setShowArchived] = useState(false);
  const [form, setForm] = useState({
    name: "",
    manufacturer: "",
    partNumber: "",
    barcode: "",
    description: "",
    quantity: "",
    threshold: "",
    price: "",
    machineGroup: "",
    toolType: "",
    uom: "EA",
    packSize: "",
    geometry: {
      diameter: "",
      flutes: "",
      loc: "",
      oal: "",
      shankDiameter: "",
      cornerRadius: "",
      helixAngle: "",
      toolMaterial: "",
      coating: "",
      isoShape: "",
      isoSize: "",
      noseRadius: "",
      thickness: "",
      hand: "",
      grade: "",
      chipbreaker: "",
      materialGroup: "",
      insertStyle: ""
    }
  });

  // ── BARCODE SCAN (USB scanner / keyboard wedge) ──
  // Admin page (this file) only supports scanning into the Add Tool modal.
  const scanInputRef = useRef(null);
  const [scanMode, setScanMode] = useState(null); // "add" | null

  const beginScan = () => {
    setScanMode("add");
    // Focus the hidden input so the scanner "types" into it.
    setTimeout(() => scanInputRef.current?.focus(), 0);
  };

  const [addShowAdvanced, setAddShowAdvanced] = useState(false);
  const [editShowAdvanced, setEditShowAdvanced] = useState(false);


  const [errors, setErrors] = useState({});
  const [toast, setToast] = useState("");
  const [search, setSearch] = useState("");
  const [fMach, setFMach] = useState("");
  const [fType, setFType] = useState("");
  const [selId, setSelId] = useState(null);
  const [poProjectFilter, setPOProjectFilter] = useState("all");
  const [poShippingFilter, setPOShippingFilter] = useState("all");
  const [poProjectSearch, setPOProjectSearch] = useState("");
  const [poSortBy, setPOSortBy] = useState("pending-first");
  const [poModalOpen, setPOModalOpen] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [modal, setModal] = useState({
    id: null,
    name: "",
    manufacturer: "",
    partNumber: "",
    barcode: "",
    description: "",
    quantity: 0,
    threshold: 0,
    price: 0,
    vendor: "",
    projects: "",
    location: {},
    machineGroup: "",
    toolType: "",
    uom: "EA",
    packSize: "",
    geometry: {
      diameter: "",
      flutes: "",
      loc: "",
      oal: "",
      shankDiameter: "",
      cornerRadius: "",
      helixAngle: "",
      toolMaterial: "",
      coating: "",
      isoShape: "",
      isoSize: "",
      noseRadius: "",
      thickness: "",
      hand: "",
      grade: "",
      chipbreaker: "",
      materialGroup: "",
      insertStyle: ""
    }
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
        barcode: x.barcode ?? "",
        uom: x.uom ?? "EA",
        packSize: x.packSize === 0 || x.packSize ? Number(x.packSize) : "",
        geometry: (x.geometry && typeof x.geometry === "object") ? x.geometry : {},
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

    const loadedOrders = (load(LS.orders, []) || []).map(o => {
      if (o.tools && Array.isArray(o.tools)) {
        return {
          orderId: o.orderId ?? `PO-${Date.now()}`,
          poNumber: o.poNumber || "",
          vendor: o.vendor || "",
          project: o.project || "",
          projectType: o.projectType || "new",
          shippingType: o.shippingType || "Standard",
          shippingCost: o.shippingCost || 0,
          notes: o.notes || "",
          status: o.status || "pending",
          dateCreated: o.dateCreated || o.orderedAt || new Date().toISOString(),
          dateApproved: o.dateApproved || null,
          dateOrdered: o.dateOrdered || (o.status === "ordered" || o.status === "paid" || o.status === "received" ? o.orderedAt : null),
          datePaid: o.datePaid || null,
          dateReceived: o.dateReceived || null,
          tools: o.tools
        };
      } else {
        return {
          orderId: o.orderId ?? `${o.id}-${Date.now()}`,
          poNumber: o.poNumber || `PO-${o.id}`,
          vendor: o.vendor || "",
          project: "",
          projectType: "new",
          shippingType: o.shippingType || "Standard",
          shippingCost: o.shippingCost || 0,
          notes: o.notes || "",
          status: o.status || "pending",
          dateCreated: o.dateCreated || o.orderedAt || new Date().toISOString(),
          dateApproved: o.dateApproved || null,
          dateOrdered: o.dateOrdered || (o.status === "ordered" || o.status === "paid" || o.status === "received" ? o.orderedAt : null),
          datePaid: o.datePaid || null,
          dateReceived: o.dateReceived || null,
          tools: [{
            id: o.id,
            toolId: o.toolId || o.id,
            name: o.name,
            quantity: o.quantity || 0,
            unitPrice: o.unitPrice || o.price || 0,
            machineGroup: o.machineGroup || ""
          }]
        };
      }
    });
    
    setTools(norm(load(LS.tools, [])));
    setQueue(norm(load(LS.queue, [])));
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
  const getProjectDisplay = (po) => {
    if (po.projectType === "existing") {
      const kitId = po.project.replace("Job-", "");
      const jobKits = load("toolly_kits", []);
      const kit = jobKits.find(k => k.id === parseInt(kitId));
      return kit ? `${kit.partName} (${kit.customer})` : po.project;
    }
    return po.project;
  };

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
        t.barcode,
        t.description,
        t.vendor,
        t.machineGroup,
        t.toolType,
        t.uom,
        t.packSize,
        JSON.stringify(t.geometry || {})
      ]
        .join(" ")
        .toLowerCase();
      return (!q || hay.includes(q)) && (!fMach || t.machineGroup === fMach) && (!fType || t.toolType === fType);
    });
  }, [tools, search, fMach, fType]);

  const sel = tools.find(t => t.id === selId);
  const activePOs = orders.filter(o => o.status !== "received");
  const archivedPOs = orders.filter(o => o.status === "received");
  let displayPOs = showArchived ? archivedPOs : activePOs;

  displayPOs = displayPOs.filter(po => {
    if (poProjectFilter === "new" && po.projectType !== "new") return false;
    if (poProjectFilter === "existing" && po.projectType !== "existing") return false;

    if (poShippingFilter !== "all" && po.shippingType !== poShippingFilter) return false;

    if (poProjectSearch) {
      const projectName = getProjectDisplay(po).toLowerCase();
      if (!projectName.includes(poProjectSearch.toLowerCase())) return false;
    }

    return true;
  });

  displayPOs = [...displayPOs].sort((a, b) => {
    const aTotalCost = a.tools.reduce((sum, t) => sum + (t.quantity * t.unitPrice), 0) + (a.shippingCost || 0);
    const bTotalCost = b.tools.reduce((sum, t) => sum + (t.quantity * t.unitPrice), 0) + (b.shippingCost || 0);

    switch (poSortBy) {
      case "pending-first":
        // Status priority: pending > approved > ordered > paid > received
        const statusOrder = { pending: 0, approved: 1, ordered: 2, paid: 3, received: 4 };
        const aStatus = statusOrder[a.status] ?? 99;
        const bStatus = statusOrder[b.status] ?? 99;
        if (aStatus !== bStatus) return aStatus - bStatus;
        // If same status, sort by date (newest first)
        return new Date(b.dateCreated).getTime() - new Date(a.dateCreated).getTime();
      case "date-desc":
        return new Date(b.dateCreated).getTime() - new Date(a.dateCreated).getTime();
      case "date-asc":
        return new Date(a.dateCreated).getTime() - new Date(b.dateCreated).getTime();
      case "total-desc":
        return bTotalCost - aTotalCost;
      case "total-asc":
        return aTotalCost - bTotalCost;
      default:
        return 0;
    }
  });

  /* ── ACTIONS ── */
  const validate = () => {
    const e = {};
    if (!form.name.trim()) e.name = "Name required";
    if (form.quantity !== "" && +form.quantity < 0) e.quantity = "≥ 0";
    if (form.threshold !== "" && +form.threshold < 0) e.threshold = "≥ 0";
    if (form.price !== "" && +form.price < 0) e.price = "≥ 0.00";
    if (form.packSize !== "" && (+form.packSize <= 0 || !Number.isFinite(+form.packSize))) e.packSize = "Pack size must be > 0";
    // Prevent duplicate barcodes (if provided)
    const bc = String(form.barcode || "").trim();
    if (bc) {
      const exists = tools.some(t => String(t.barcode || "").trim() === bc);
      if (exists) e.barcode = "Barcode already exists";
    }

    setErrors(e);
    return !Object.keys(e).length;
  };

  const createPO = poData => {
    if (!poData.tools || poData.tools.length === 0) return;

    const newPO = {
      orderId: `PO-${Date.now()}`,
      poNumber: poData.poNumber,
      vendor: poData.vendor,
      project: poData.project || "",
      projectType: poData.projectType || "new",
      shippingType: poData.shippingType,
      shippingCost: parseFloat(poData.shippingCost) || 0,
      notes: poData.notes,
      status: "pending",
      dateCreated: new Date().toISOString(),
      dateApproved: null,
      dateOrdered: null,
      datePaid: null,
      dateReceived: null,
      tools: poData.tools.map(tool => ({
        id: tool.id,
        toolId: tool.toolId,
        name: tool.name,
        quantity: tool.quantity,
        unitPrice: tool.unitPrice,
        machineGroup: tool.machineGroup || ""
      }))
    };

    setOrders(p => [...p, newPO]);
    
    poData.tools.forEach(tool => {
      rmQueue(tool.id);
    });
    
    setPOModalOpen(false);
    note(`PO ${poData.poNumber} created! Pending CFO approval ⏳`);
  };

  const addTool = () => {
    if (!validate()) return;
    const t = {
      id: Date.now(),
      name: form.name.trim(),
      manufacturer: form.manufacturer.trim(),
      partNumber: form.partNumber.trim(),
      barcode: (form.barcode || "").trim(),
      description: form.description.trim(),
      quantity: Math.max(0, parseInt(form.quantity || 0)),
      threshold: Math.max(0, parseInt(form.threshold || 0)),
      price: Number(parseFloat(form.price || 0).toFixed(2)),
      vendor: "",
      projects: [],
      location: {},
      machineGroup: form.machineGroup || "",
      toolType: form.toolType || "",
      uom: form.uom || "EA",
      packSize: form.packSize === "" ? "" : Math.max(1, parseInt(form.packSize) || 0),
      geometry: { ...(form.geometry || {}) }
    };
    setTools(p => [...p, t]);
    setForm({
      name: "",
      manufacturer: "",
      partNumber: "",
      barcode: "",
      description: "",
      quantity: "",
      threshold: "",
      price: "",
      machineGroup: "",
      toolType: "",
      uom: "EA",
      packSize: "",
      geometry: {
        diameter: "",
        flutes: "",
        loc: "",
        oal: "",
        shankDiameter: "",
        cornerRadius: "",
        helixAngle: "",
        toolMaterial: "",
        coating: "",
        isoShape: "",
        isoSize: "",
        noseRadius: "",
        thickness: "",
        hand: "",
        grade: "",
        chipbreaker: "",
        materialGroup: "",
        insertStyle: ""
      }
    });
    setAddShowAdvanced(false);
    setErrors({});
    setSelId(t.id);
    note("Tool added ✅");
    setAddOpen(false);
    setScanMode(null);
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

  const markApproved = (orderId) => {
    setOrders(p => p.map(o => 
      o.orderId === orderId 
        ? { ...o, status: "approved", dateApproved: new Date().toISOString() }
        : o
    ));
    note("CFO Approved ✅");
  };

  const markOrdered = (orderId) => {
    setOrders(p => p.map(o => 
      o.orderId === orderId 
        ? { ...o, status: "ordered", dateOrdered: new Date().toISOString() }
        : o
    ));
    note("Marked as ordered 📦");
  };

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
    
    o.tools.forEach(tool => {
      setTools(p => p.map(t => 
        t.id === tool.toolId 
          ? { ...t, quantity: t.quantity + tool.quantity } 
          : t
      ));
    });
    
    setOrders(p => p.map(order => 
      order.orderId === orderId
        ? { ...order, status: "received", dateReceived: new Date().toISOString() }
        : order
    ));
    
    note(`PO ${o.poNumber} received! Tools added to inventory ✅`);
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

  const togglePO = (poId) => {
    setExpandedPOs(prev => {
      const next = new Set(prev);
      if (next.has(poId)) {
        next.delete(poId);
      } else {
        next.add(poId);
      }
      return next;
    });
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
      <Header />

      {/* Hidden input to capture USB barcode scans (scanner types + Enter) */}
      <input
        ref={scanInputRef}
        value={form.barcode}
        onChange={e => {
          if (scanMode !== "add") return;
          setForm(p => ({ ...p, barcode: e.target.value }));
        }}
        onKeyDown={e => {
          if (e.key !== "Enter") return;

          if (scanMode !== "add") return;

          const raw = String(form.barcode || "").trim();
          if (!raw) return;

          note("Barcode captured ✅");
          setScanMode(null);
        }}
        onBlur={() => setScanMode(null)}
        style={{
          position: "absolute",
          left: -9999,
          top: -9999,
          width: 1,
          height: 1,
          opacity: 0
        }}
        aria-hidden="true"
      />

      {/* STATS */}
      <div className="metrics" style={{
        margin: "16px 24px 0",
        gap: 16,
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))"
      }}>
        <div className="metric card stat-accent">
          <div className="label">Needs Attention</div>
          <div className="value">{tools.filter(t => t.quantity <= t.threshold).length}</div>
        </div>
        <div className="metric card">
          <div className="label">Active Tools</div>
          <div className="value">{tools.length}</div>
        </div>
        <div className="metric card">
          <div className="label">Purchase Orders</div>
          <div className="value">{activePOs.length}</div>
        </div>
        <div className="metric card">
          <div className="label">Total Value</div>
          <div className="value">{money(totalVal)}</div>
        </div>
      </div>

      {/* ACTION BAR */}
      <div className="controls" style={{
        margin: "16px 24px 0",
        display: "flex",
        gap: 12,
        flexWrap: "wrap",
        alignItems: "end"
      }}>
        <div className="search" style={{ flex: 1, minWidth: 280 }}>
          <input placeholder="Search anything…" onChange={e => setSearch(e.target.value)} />
        </div>
<Select label="Machine" value={fMach} onChange={setFMach} options={machOpts} />
        <Select label="Type" value={fType} onChange={setFType} options={typeOpts} />
        <button 
          className="btn btn-primary" 
          onClick={() => {
            setErrors({});
            setForm({
              name: "",
              manufacturer: "",
              partNumber: "",
              barcode: "",
              description: "",
              quantity: "",
              threshold: "",
              price: "",
              machineGroup: "",
              toolType: "",
              uom: "EA",
              packSize: "",
              geometry: {
                diameter: "",
                flutes: "",
                loc: "",
                oal: "",
                shankDiameter: "",
                cornerRadius: "",
                helixAngle: "",
                toolMaterial: "",
                coating: "",
                isoShape: "",
                isoSize: "",
                noseRadius: "",
                thickness: "",
                hand: "",
                grade: "",
                chipbreaker: "",
                materialGroup: "",
                insertStyle: ""
              }
            });
            setAddShowAdvanced(false);
            setScanMode(null);
            setAddOpen(true);
          }}
          style={{ alignSelf: "flex-end" }}
        >
          + Add Tool
        </button>
      </div>

      {/* MAIN LAYOUT */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "1fr 340px",
        gap: 24,
        margin: "16px 24px 0"
      }}>
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
                              setEditShowAdvanced(false);
                              setModalOpen(true);
                            }}
                          >
                            Edit
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
                  {sel.barcode && (
                    <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 4 }}>
                      Barcode:{" "}
                      <span style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}>
                        {sel.barcode}
                      </span>
                    </div>
                  )}
                  {packDisplay(sel.quantity, sel.packSize) && (
                    <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 4 }}>
                      Packaging: {packDisplay(sel.quantity, sel.packSize)}
                    </div>
                  )}

                  {sel.barcode && (
                    <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 4 }}>
                      Barcode: <span style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}>{sel.barcode}</span>
                    </div>
                  )}
                  {packDisplay(sel.quantity, sel.packSize) && (
                    <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 4 }}>
                      On hand: {packDisplay(sel.quantity, sel.packSize)}
                    </div>
                  )}
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

              <div style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 12,
                fontSize: 14
              }}>
                <div>
                  <div style={{ color: "var(--muted)" }}>On Hand</div>
                  <div style={{ fontWeight: 700, fontSize: 20 }}>{sel.quantity}</div>
                </div>
                <div>
                  <div style={{ color: "var(--muted)" }}>Incoming</div>
                  <div style={{ fontWeight: 700, fontSize: 20 }}>
                    {orders
                      .filter(o => o.status !== "received")
                      .reduce((count, po) => {
                        const toolInPO = po.tools.find(t => t.toolId === sel.id);
                        return count + (toolInPO ? toolInPO.quantity : 0);
                      }, 0)
                    }
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
                  onClick={() => setPOModalOpen(true)}
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

          <div style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 12,
            fontSize: 13
          }}>
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

      {/* REORDER QUEUE + PURCHASE ORDERS - SIDE BY SIDE */}
      <div style={{
        margin: "24px 24px 0",
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit,minmax(340px,1fr))",
        gap: 16
      }}>
        {/* REORDER QUEUE */}
        <div className="card" style={{ padding: 0, boxShadow: "var(--shadow)" }}>
          <div style={{
            padding: "16px 20px",
            background: "#fef3c7",
            borderBottom: "1px solid #fde68a",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center"
          }}>
            <strong style={{ fontSize: 16, color: "#78350f" }}>📦 Reorder Queue ({queue.length})</strong>
            {queue.length > 0 && (
              <button 
                className="btn btn-success btn-sm" 
                onClick={() => setPOModalOpen(true)}
              >
                Create PO
              </button>
            )}
          </div>
          <div style={{ maxHeight: 500, overflow: "auto" }}>
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
                      <div style={{ fontWeight: 600, color: "var(--text)" }}>{t.name}</div>
                      <div style={{ fontSize: 12, color: "var(--muted)" }}>
                        need {t.threshold} • {t.quantity} on hand
                      </div>
                    </div>
                    <button className="btn btn-danger btn-sm" onClick={() => rmQueue(t.id)}>
                      ×
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* PURCHASE ORDERS WITH FILTERS */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* TABS */}
          <div style={{ display: "flex", gap: 8 }}>
            <button 
              className={`pill ${!showArchived ? "active" : ""}`}
              onClick={() => setShowArchived(false)}
              style={{ padding: "10px 20px", flex: 1 }}
            >
              🧾 Active ({activePOs.length})
            </button>
            <button 
              className={`pill ${showArchived ? "active" : ""}`}
              onClick={() => setShowArchived(true)}
              style={{ padding: "10px 20px", flex: 1 }}
            >
              📦 Archived ({archivedPOs.length})
            </button>
          </div>

          {/* FILTER CONTROLS */}
          <div className="card" style={{ padding: 16 }}>
            <div style={{ 
              display: "grid", 
              gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
              gap: 12,
              marginBottom: 12
            }}>
              {/* Project Type Filter */}
              <div>
                <label style={{ display: "block", fontSize: 11, color: "var(--muted)", marginBottom: 4 }}>
                  Project Type
                </label>
                <select
                  value={poProjectFilter}
                  onChange={e => setPOProjectFilter(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "8px 10px",
                    border: "1px solid var(--border)",
                    borderRadius: 8,
                    background: "var(--card)",
                    color: "var(--text)",
                    fontSize: 13
                  }}
                >
                  <option value="all">All Projects</option>
                  <option value="new">✨ New Projects</option>
                  <option value="existing">📋 Job Kits</option>
                </select>
              </div>

              {/* Shipping Type Filter */}
              <div>
                <label style={{ display: "block", fontSize: 11, color: "var(--muted)", marginBottom: 4 }}>
                  Shipping
                </label>
                <select
                  value={poShippingFilter}
                  onChange={e => setPOShippingFilter(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "8px 10px",
                    border: "1px solid var(--border)",
                    borderRadius: 8,
                    background: "var(--card)",
                    color: "var(--text)",
                    fontSize: 13
                  }}
                >
                  <option value="all">All Shipping</option>
                  <option value="Standard">Standard</option>
                  <option value="Expedited">Expedited</option>
                  <option value="Rush">Rush</option>
                  <option value="Next Day">Next Day</option>
                </select>
              </div>

              {/* Sort By */}
              <div>
                <label style={{ display: "block", fontSize: 11, color: "var(--muted)", marginBottom: 4 }}>
                  Sort By
                </label>
                <select
                  value={poSortBy}
                  onChange={e => setPOSortBy(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "8px 10px",
                    border: "1px solid var(--border)",
                    borderRadius: 8,
                    background: "var(--card)",
                    color: "var(--text)",
                    fontSize: 13
                  }}
                >
                  <option value="pending-first">⏳ Pending First</option>
                  <option value="date-desc">Date (Newest)</option>
                  <option value="date-asc">Date (Oldest)</option>
                  <option value="total-desc">Total (High to Low)</option>
                  <option value="total-asc">Total (Low to High)</option>
                </select>
              </div>
            </div>

            {/* Project Search */}
            <input
              type="text"
              placeholder="Search by project name..."
              value={poProjectSearch}
              onChange={e => setPOProjectSearch(e.target.value)}
              style={{
                width: "100%",
                padding: "8px 12px",
                border: "1px solid var(--border)",
                borderRadius: 8,
                background: "var(--card)",
                color: "var(--text)",
                fontSize: 13,
                outline: "none"
              }}
            />

            {/* Clear Filters Button */}
            {(poProjectFilter !== "all" || poShippingFilter !== "all" || poProjectSearch) && (
              <button
                className="btn btn-sm"
                onClick={() => {
                  setPOProjectFilter("all");
                  setPOShippingFilter("all");
                  setPOProjectSearch("");
                }}
                style={{ marginTop: 8, width: "100%", fontSize: 12 }}
              >
                Clear Filters
              </button>
            )}
          </div>

          {/* PO CARDS */}
          <div className="card" style={{ padding: 0, boxShadow: "var(--shadow)" }}>
            <div style={{ maxHeight: 500, overflow: "auto" }}>
              {displayPOs.length === 0 ? (
                <div style={{ padding: 40, textAlign: "center", color: "var(--muted)" }}>
                  <div style={{ fontSize: 48, marginBottom: 8 }}>
                    {poProjectFilter !== "all" || poShippingFilter !== "all" || poProjectSearch ? "🔍" : showArchived ? "📦" : "📋"}
                  </div>
                  <p style={{ margin: 0 }}>
                    {poProjectFilter !== "all" || poShippingFilter !== "all" || poProjectSearch 
                      ? "No POs match your filters" 
                      : showArchived ? "No archived purchase orders" : "No active purchase orders"}
                  </p>
                </div>
              ) : (
                <div>
                  {displayPOs.map(po => {
                    const isExpanded = expandedPOs.has(po.orderId);
                    const totalCost = po.tools.reduce((sum, t) => sum + (t.quantity * t.unitPrice), 0) + (po.shippingCost || 0);
                    const isRush = po.shippingType && po.shippingType !== "Standard";
                    const isNewProject = po.projectType === "new";
                    
                    return (
                      <div 
                        key={po.orderId}
                        style={{ borderBottom: "1px solid var(--border)" }}
                      >
                        {/* PO Header */}
                        <div 
                          style={{ 
                            padding: 16,
                            cursor: "pointer",
                            background: isExpanded ? "var(--accent-50)" : "transparent",
                            transition: "background 0.2s"
                          }}
                          onClick={() => togglePO(po.orderId)}
                        >
                          <div style={{ 
                            display: "flex", 
                            justifyContent: "space-between", 
                            alignItems: "start",
                            marginBottom: 8
                          }}>
                            <div style={{ flex: 1 }}>
                              <div style={{ 
                                display: "flex", 
                                alignItems: "center",
                                gap: 8,
                                marginBottom: 6,
                                flexWrap: "wrap"
                              }}>
                                <h4 style={{ 
                                  margin: 0, 
                                  fontSize: 16, 
                                  fontWeight: 700,
                                  color: "var(--text)" 
                                }}>
                                  {po.poNumber}
                                </h4>
                                <StatusBadge status={po.status} />
                                {isNewProject && (
                                  <span 
                                    className="badge"
                                    style={{
                                      background: "#f0fdf4",
                                      borderColor: "#86efac",
                                      color: "#166534",
                                      fontSize: 10
                                    }}
                                  >
                                    ✨ New
                                  </span>
                                )}
                              </div>
                              
                              <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 4 }}>
                                <strong style={{ color: "var(--text)" }}>{getProjectDisplay(po)}</strong>
                                {po.vendor && <span> • {po.vendor}</span>}
                              </div>

                              <div style={{ 
                                display: "flex",
                                gap: 12,
                                fontSize: 11,
                                color: "var(--muted)"
                              }}>
                                <span>{po.tools.length} tool{po.tools.length !== 1 ? "s" : ""}</span>
                                <span>•</span>
                                <span style={{ color: "var(--accent)", fontWeight: 600 }}>
                                  {money(totalCost)}
                                </span>
                                <span>•</span>
                                <span>{formatDateTime(po.dateCreated)}</span>
                              </div>
                            </div>

                            {/* Expand Icon */}
                            <div style={{ 
                              fontSize: 20,
                              color: "var(--muted)",
                              marginLeft: 12,
                              transition: "transform 0.2s",
                              transform: isExpanded ? "rotate(180deg)" : "rotate(0deg)"
                            }}>
                              ▼
                            </div>
                          </div>

                          {/* Action Buttons */}
                          {!showArchived && (
                            <div 
                              style={{ display: "flex", gap: 6, marginTop: 8 }}
                              onClick={e => e.stopPropagation()}
                            >
                              {po.status === "pending" && (
                                <>
                                  <button 
                                    className="btn btn-success btn-sm" 
                                    onClick={() => markApproved(po.orderId)}
                                  >
                                    ✅ CFO Approve
                                  </button>
                                  <button 
                                    className="btn btn-danger btn-sm" 
                                    onClick={() => deletePO(po.orderId)}
                                  >
                                    Delete
                                  </button>
                                </>
                              )}
                              {po.status === "approved" && (
                                <>
                                  <button 
                                    className="btn btn-primary btn-sm" 
                                    onClick={() => markOrdered(po.orderId)}
                                  >
                                    📦 Mark Ordered
                                  </button>
                                  <button 
                                    className="btn btn-danger btn-sm" 
                                    onClick={() => deletePO(po.orderId)}
                                  >
                                    Delete
                                  </button>
                                </>
                              )}
                              {po.status === "ordered" && (
                                <>
                                  <button 
                                    className="btn btn-primary btn-sm" 
                                    onClick={() => markPaid(po.orderId)}
                                  >
                                    💰 Mark Paid
                                  </button>
                                  <button 
                                    className="btn btn-danger btn-sm" 
                                    onClick={() => deletePO(po.orderId)}
                                  >
                                    Delete
                                  </button>
                                </>
                              )}
                              {po.status === "paid" && (
                                <button 
                                  className="btn btn-success btn-sm" 
                                  onClick={() => receiveOrder(po.orderId)}
                                >
                                  ✅ Receive Order
                                </button>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Expanded Content */}
                        {isExpanded && (
                          <div 
                            style={{ 
                              padding: "0 16px 16px 16px",
                              background: "var(--bg)",
                              borderTop: "1px solid var(--border)"
                            }}
                          >
                            {/* ✨ DATE/TIME TIMELINE */}
                            <div style={{
                              margin: "12px 0",
                              padding: 12,
                              background: "var(--card)",
                              borderRadius: 8,
                              border: "1px solid var(--border)"
                            }}>
                              <h5 style={{ 
                                margin: "0 0 10px",
                                fontSize: 12,
                                fontWeight: 600,
                                color: "var(--muted)",
                                textTransform: "uppercase"
                              }}>
                                📅 Order Timeline
                              </h5>
                              <div style={{ display: "grid", gap: 8 }}>
                                {/* Created */}
                                <div style={{ 
                                  display: "flex", 
                                  alignItems: "center",
                                  gap: 10,
                                  padding: 8,
                                  background: "var(--bg)",
                                  borderRadius: 6
                                }}>
                                  <div style={{
                                    width: 8,
                                    height: 8,
                                    borderRadius: "50%",
                                    background: "#9333ea",
                                    flexShrink: 0
                                  }} />
                                  <div style={{ flex: 1 }}>
                                    <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text)" }}>
                                      Created
                                    </div>
                                    <div style={{ fontSize: 11, color: "var(--muted)" }}>
                                      {formatDateTime(po.dateCreated)}
                                    </div>
                                  </div>
                                </div>

                                {/* Approved */}
                                {po.dateApproved && (
                                  <div style={{ 
                                    display: "flex", 
                                    alignItems: "center",
                                    gap: 10,
                                    padding: 8,
                                    background: "var(--bg)",
                                    borderRadius: 6
                                  }}>
                                    <div style={{
                                      width: 8,
                                      height: 8,
                                      borderRadius: "50%",
                                      background: "#059669",
                                      flexShrink: 0
                                    }} />
                                    <div style={{ flex: 1 }}>
                                      <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text)" }}>
                                        CFO Approved
                                      </div>
                                      <div style={{ fontSize: 11, color: "var(--muted)" }}>
                                        {formatDateTime(po.dateApproved)}
                                      </div>
                                    </div>
                                  </div>
                                )}

                                {/* Ordered */}
                                {po.dateOrdered && (
                                  <div style={{ 
                                    display: "flex", 
                                    alignItems: "center",
                                    gap: 10,
                                    padding: 8,
                                    background: "var(--bg)",
                                    borderRadius: 6
                                  }}>
                                    <div style={{
                                      width: 8,
                                      height: 8,
                                      borderRadius: "50%",
                                      background: "#f59e0b",
                                      flexShrink: 0
                                    }} />
                                    <div style={{ flex: 1 }}>
                                      <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text)" }}>
                                        Ordered from Vendor
                                      </div>
                                      <div style={{ fontSize: 11, color: "var(--muted)" }}>
                                        {formatDateTime(po.dateOrdered)}
                                      </div>
                                    </div>
                                  </div>
                                )}

                                {/* Paid */}
                                {po.datePaid && (
                                  <div style={{ 
                                    display: "flex", 
                                    alignItems: "center",
                                    gap: 10,
                                    padding: 8,
                                    background: "var(--bg)",
                                    borderRadius: 6
                                  }}>
                                    <div style={{
                                      width: 8,
                                      height: 8,
                                      borderRadius: "50%",
                                      background: "#3b82f6",
                                      flexShrink: 0
                                    }} />
                                    <div style={{ flex: 1 }}>
                                      <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text)" }}>
                                        Paid
                                      </div>
                                      <div style={{ fontSize: 11, color: "var(--muted)" }}>
                                        {formatDateTime(po.datePaid)}
                                      </div>
                                    </div>
                                  </div>
                                )}

                                {/* Received */}
                                {po.dateReceived && (
                                  <div style={{ 
                                    display: "flex", 
                                    alignItems: "center",
                                    gap: 10,
                                    padding: 8,
                                    background: "var(--bg)",
                                    borderRadius: 6
                                  }}>
                                    <div style={{
                                      width: 8,
                                      height: 8,
                                      borderRadius: "50%",
                                      background: "#22c55e",
                                      flexShrink: 0
                                    }} />
                                    <div style={{ flex: 1 }}>
                                      <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text)" }}>
                                        Received
                                      </div>
                                      <div style={{ fontSize: 11, color: "var(--muted)" }}>
                                        {formatDateTime(po.dateReceived)}
                                      </div>
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* Tools List */}
                            <h5 style={{ 
                              margin: "12px 0 8px",
                              fontSize: 12,
                              fontWeight: 600,
                              color: "var(--muted)",
                              textTransform: "uppercase"
                            }}>
                              Tools on this order
                            </h5>
                            
                            <div style={{ display: "grid", gap: 6 }}>
                              {po.tools.map((tool, idx) => (
                                <div 
                                  key={idx}
                                  style={{
                                    padding: 10,
                                    background: "var(--card)",
                                    border: "1px solid var(--border)",
                                    borderRadius: 8,
                                    display: "grid",
                                    gridTemplateColumns: "2fr 1fr 1fr",
                                    gap: 8,
                                    alignItems: "center",
                                    fontSize: 12
                                  }}
                                >
                                  <div>
                                    <div style={{ fontWeight: 600, color: "var(--text)" }}>
                                      {tool.name}
                                    </div>
                                    {tool.machineGroup && (
                                      <span className="badge pill" style={{ fontSize: 9, marginTop: 2 }}>
                                        {tool.machineGroup}
                                      </span>
                                    )}
                                  </div>
                                  <div className="subtle">
                                    Qty: <strong style={{ color: "var(--text)" }}>{tool.quantity}</strong> × {money(tool.unitPrice)}
                                  </div>
                                  <div style={{ textAlign: "right", fontWeight: 600, color: "var(--accent)" }}>
                                    {money(tool.quantity * tool.unitPrice)}
                                  </div>
                                </div>
                              ))}
                            </div>

                            {/* Totals */}
                            <div 
                              style={{
                                marginTop: 12,
                                padding: 10,
                                background: "var(--card)",
                                borderRadius: 8,
                                border: "1px solid var(--border)",
                                display: "grid",
                                gridTemplateColumns: "1fr 1fr 1fr",
                                gap: 8,
                                fontSize: 11
                              }}
                            >
                              <div>
                                <div className="subtle">Subtotal</div>
                                <div style={{ fontWeight: 600, color: "var(--text)" }}>
                                  {money(po.tools.reduce((sum, t) => sum + (t.quantity * t.unitPrice), 0))}
                                </div>
                              </div>
                              <div>
                                <div className="subtle">Shipping</div>
                                <div style={{ fontWeight: 600, color: "var(--text)" }}>
                                  {money(po.shippingCost || 0)}
                                  {isRush && <span style={{ color: "#f59e0b", marginLeft: 4 }}>⚡</span>}
                                </div>
                              </div>
                              <div>
                                <div className="subtle">Total</div>
                                <div style={{ fontWeight: 700, fontSize: 14, color: "var(--accent)" }}>
                                  {money(totalCost)}
                                </div>
                              </div>
                            </div>

                            {/* Notes */}
                            {po.notes && (
                              <div style={{ 
                                marginTop: 8, 
                                padding: 8, 
                                background: "var(--card)", 
                                borderRadius: 6,
                                fontSize: 11,
                                color: "var(--muted)",
                                fontStyle: "italic"
                              }}>
                                📝 {po.notes}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* TOAST */}
      {toast && (
        <div className="toast">
          <span>✅</span>
          <span>{toast}</span>
        </div>
      )}

      {/* ADD TOOL MODAL */}
      {addOpen && (
        <div className="modal-backdrop" onClick={() => setAddOpen(false)}>
          <div
            className="card"
            style={{ width: "min(920px,94vw)", padding: 20 }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
              <div>
                <h3 style={{ marginBottom: 4 }}>Add Tool</h3>
                <div className="subtle" style={{ marginTop: 0 }}>
                  Tip: click <b>Scan Barcode</b> and scan with a USB scanner (it types + hits Enter).
                </div>
              </div>
              <button className="btn" onClick={() => setAddOpen(false)} title="Close">
                ✕
              </button>
            </div>

            <div className="form-grid" style={{ gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginTop: 14 }}>
              <Input
                label="Name"
                value={form.name}
                onChange={v => setForm(p => ({ ...p, name: v }))}
                error={errors.name}
              />
              <Input
                label="Manufacturer"
                value={form.manufacturer}
                onChange={v => setForm(p => ({ ...p, manufacturer: v }))}
              />
              <Input
                label="Part #"
                value={form.partNumber}
                onChange={v => setForm(p => ({ ...p, partNumber: v }))}
              />

              <div style={{ gridColumn: "1/3" }}>
                <Input
                  label="Barcode"
                  value={form.barcode}
                  onChange={v => setForm(p => ({ ...p, barcode: v }))}
                  error={errors.barcode}
                  placeholder="Scan or type…"
                />
              </div>
              <div style={{ display: "flex", alignItems: "end" }}>
                <button className="btn" style={{ width: "100%" }} onClick={beginScan}>
                  📟 Scan Barcode
                </button>
              </div>

              <div style={{ gridColumn: "1/-1" }}>
                <Input
                  label="Description"
                  value={form.description}
                  onChange={v => setForm(p => ({ ...p, description: v }))}
                />
              </div>

              <Input
                label="Quantity"
                type="number"
                value={form.quantity}
                onChange={v => setForm(p => ({ ...p, quantity: v }))}
                error={errors.quantity}
              />
              <Input
                label="Low Threshold"
                type="number"
                value={form.threshold}
                onChange={v => setForm(p => ({ ...p, threshold: v }))}
                error={errors.threshold}
              />
              <Input
                label="Unit Price"
                type="number"
                step="0.01"
                value={form.price}
                onChange={v => setForm(p => ({ ...p, price: v }))}
                error={errors.price}
              />

              <SelectWithOther
                label="Machine Group"
                value={form.machineGroup}
                setValue={v => setForm(p => ({ ...p, machineGroup: v }))}
                baseOptions={MACHINE_GROUPS_BASE}
              />
              <SelectWithOther
                label="Tool Type"
                value={form.toolType}
                setValue={v => setForm(p => ({ ...p, toolType: v }))}
                baseOptions={TOOL_TYPES_BASE}
              />
              {isInsertType(form.toolType) ? (
                <Input
                  label="Pack Size (optional)"
                  type="number"
                  value={form.packSize}
                  onChange={v => setForm(p => ({ ...p, packSize: v }))}
                  error={errors.packSize}
                  placeholder="e.g., 10"
                />
              ) : (
                <div />
              )}

{/* ADVANCED */}
<div style={{ marginTop: 14 }}>
  <button
    className="btn"
    onClick={() => setAddShowAdvanced(s => !s)}
    style={{ width: "100%", justifyContent: "space-between", display: "flex", alignItems: "center" }}
  >
    <span>⚙️ Advanced geometry</span>
    <span style={{ fontSize: 12, opacity: 0.7 }}>{addShowAdvanced ? "Hide" : "Show"}</span>
  </button>

  {addShowAdvanced && (
    <div className="card" style={{ marginTop: 10, padding: 14, background: "var(--card)", border: "1px solid var(--border)" }}>
      <div className="subtle" style={{ fontSize: 12, marginBottom: 10 }}>
        Optional: capture detailed geometry so operators can scan and instantly see specs.
      </div>
      <GeometrySection
        toolType={form.toolType}
        geometry={form.geometry}
        setGeometry={fn => setForm(p => ({ ...p, geometry: typeof fn === "function" ? fn(p.geometry) : fn }))}
      />
    </div>
  )}
</div>

            </div>

            <div className="toolbar" style={{ marginTop: 16 }}>
              <button className="btn" onClick={() => setAddOpen(false)}>
                Cancel
              </button>
              <button className="btn btn-primary" onClick={addTool}>
                Add Tool
              </button>
            </div>
          </div>
        </div>
      )}

      {/* EDIT MODAL */}
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
              
              <Input
                label="Barcode"
                value={modal.barcode}
                onChange={v => setModal(p => ({ ...p, barcode: v }))}
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
              {isInsertType(modal.toolType) && (
                <Input
                  label="Pack Size (optional)"
                  type="number"
                  value={modal.packSize}
                  onChange={v => setModal(p => ({ ...p, packSize: v }))}
                />
              )}

{/* ADVANCED */}
<div style={{ marginTop: 14 }}>
  <button
    className="btn"
    onClick={() => setEditShowAdvanced(s => !s)}
    style={{ width: "100%", justifyContent: "space-between", display: "flex", alignItems: "center" }}
  >
    <span>⚙️ Advanced geometry</span>
    <span style={{ fontSize: 12, opacity: 0.7 }}>{editShowAdvanced ? "Hide" : "Show"}</span>
  </button>

  {editShowAdvanced && (
    <div className="card" style={{ marginTop: 10, padding: 14, background: "var(--card)", border: "1px solid var(--border)" }}>
      <GeometrySection
        toolType={modal.toolType}
        geometry={modal.geometry}
        setGeometry={fn => setModal(p => ({ ...p, geometry: typeof fn === "function" ? fn(p.geometry) : fn }))}
      />
    </div>
  )}
</div>

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
                  // Prevent duplicate barcodes when editing (if provided)
                  const bc = String(modal.barcode || "").trim();
                  if (bc) {
                    const dup = tools.some(t => t.id !== modal.id && String(t.barcode || "").trim() === bc);
                    if (dup) {
                      note("Barcode already exists on another tool ❗");
                      return;
                    }
                  }

                  setTools(p =>
                    p.map(t =>
                      t.id === modal.id
                        ? {
                            ...t,
                            name: modal.name.trim(),
                            manufacturer: modal.manufacturer.trim(),
                            partNumber: modal.partNumber.trim(),
                            barcode: (modal.barcode || "").trim(),
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
                            toolType: modal.toolType,
                            uom: modal.uom || "EA",
                            packSize: modal.packSize === "" ? "" : Math.max(1, parseInt(modal.packSize) || 0),
                            geometry: { ...(modal.geometry || {}) }
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

      {/* PO MODAL */}
      {poModalOpen && (
        <POModal
          onClose={() => setPOModalOpen(false)}
          onSubmit={createPO}
        />
      )}
    </div>
  );
}