// src/ToolInventoryApp.jsx (Firestore-backed) — Admin w/ Reorder Queue + Purchase Orders
import React, { useEffect, useMemo, useRef, useState } from "react";
import "./modern-light.css";
import LocationSection from "./LocationSection";

import { db } from "./firebase";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  increment,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  writeBatch,
} from "firebase/firestore";

/* ──────── TAXONOMY ──────── */
const MACHINE_GROUPS_BASE = ["", "Milling", "Swiss", "Lathe", "Wire EDM", "Inspection", "General", "Other…"];
const TOOL_TYPES_BASE = [
  "", "Endmill", "Drill", "Tap", "Reamer",
  "Turning Insert", "Grooving Insert", "Boring Bar", "Face Mill Insert",
  "Collet", "Tap Holder", "Tool Holder", "Fixture", "Gage", "Other…"
];

const SHIPPING_TYPES = ["Standard", "Expedited", "Rush", "Next Day"];

/* ──────── INPUTS ──────── */
const Input = ({ label, value, onChange, error, ...p }) => (
  <div className="input">
    <label>{label}</label>
    <input
      {...p}
      value={String(value ?? "")}
      onChange={(e) => onChange?.(e.target.value)}
      style={error ? { borderColor: "#ef4444" } : {}}
    />
    {error && <div style={{ color: "#ef4444", fontSize: 12, marginTop: 4 }}>{error}</div>}
  </div>
);

const Select = ({ label, value, onChange, options, ...p }) => (
  <div className="input">
    <label>{label}</label>
    <select value={value ?? ""} onChange={(e) => onChange?.(e.target.value)} {...p}>
      {options.map((o) => (
        <option key={o} value={o}>
          {o || "—"}
        </option>
      ))}
    </select>
  </div>
);

const SelectWithOther = ({ label, value, setValue, baseOptions }) => {
  const isOther = value && !baseOptions.includes(value);
  const sel = isOther ? "Other…" : value ?? "";
  return (
    <div style={{ display: "grid", gap: 6 }}>
      <Select
        label={label}
        value={sel}
        onChange={(v) => (v === "Other…" ? setValue(isOther ? value : "") : setValue(v))}
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


/* ──────── ADVANCED GEOMETRY INPUTS ──────── */
const GeometrySection = ({ toolType, geometry, setGeometry }) => {
  const tt = String(toolType || "").toLowerCase();
  const isMillLike = ["endmill", "drill", "tap", "reamer"].some((k) => tt.includes(k));
  const isTurningInsert = tt.includes("turning insert") || tt.includes("grooving insert");
  const isFaceMillInsert = tt.includes("face mill insert");

  const g = geometry || {};
  const set = (k, v) => setGeometry((p) => ({ ...(p || {}), [k]: v }));

  const gridStyle = { gridTemplateColumns: "1fr 1fr 1fr", gap: 12 };

  if (isMillLike) {
    return (
      <div className="form-grid" style={gridStyle}>
        <Input label="Diameter (in/mm)" value={g.diameter || ""} onChange={(v) => set("diameter", v)} />
        <Input label="Flutes" type="number" value={g.flutes || ""} onChange={(v) => set("flutes", v)} />
        <Input label="Tool Material" value={g.toolMaterial || ""} onChange={(v) => set("toolMaterial", v)} placeholder="Carbide, HSS…" />

        <Input label="LOC" value={g.loc || ""} onChange={(v) => set("loc", v)} />
        <Input label="OAL" value={g.oal || ""} onChange={(v) => set("oal", v)} />
        <Input label="Shank Ø" value={g.shankDiameter || ""} onChange={(v) => set("shankDiameter", v)} />

        <Input label="Corner Radius / Chamfer" value={g.cornerRadius || ""} onChange={(v) => set("cornerRadius", v)} />
        <Input label="Helix Angle" value={g.helixAngle || ""} onChange={(v) => set("helixAngle", v)} placeholder="e.g., 35°" />
        <Input label="Coating" value={g.coating || ""} onChange={(v) => set("coating", v)} placeholder="TiAlN, AlCrN…" />
      </div>
    );
  }

  if (isTurningInsert) {
    return (
      <div className="form-grid" style={gridStyle}>
        <Input label="ISO Shape / Code" value={g.isoShape || ""} onChange={(v) => set("isoShape", v)} placeholder="CNMG, DNMG…" />
        <Input label="ISO Size" value={g.isoSize || ""} onChange={(v) => set("isoSize", v)} placeholder="432, 160408…" />
        <Input label="Nose Radius" value={g.noseRadius || ""} onChange={(v) => set("noseRadius", v)} />

        <Input label="Thickness" value={g.thickness || ""} onChange={(v) => set("thickness", v)} />
        <Input label="Hand" value={g.hand || ""} onChange={(v) => set("hand", v)} placeholder="L / R / N" />
        <Input label="Material Group" value={g.materialGroup || ""} onChange={(v) => set("materialGroup", v)} placeholder="P/M/K/N/S/H" />

        <Input label="Grade" value={g.grade || ""} onChange={(v) => set("grade", v)} />
        <Input label="Chipbreaker" value={g.chipbreaker || ""} onChange={(v) => set("chipbreaker", v)} />
        <Input label="Coating" value={g.coating || ""} onChange={(v) => set("coating", v)} />
      </div>
    );
  }

  if (isFaceMillInsert) {
    return (
      <div className="form-grid" style={gridStyle}>
        <Input label="Insert Style" value={g.insertStyle || ""} onChange={(v) => set("insertStyle", v)} placeholder="APKT, SEKT…" />
        <Input label="ISO Size" value={g.isoSize || ""} onChange={(v) => set("isoSize", v)} />
        <Input label="Thickness" value={g.thickness || ""} onChange={(v) => set("thickness", v)} />

        <Input label="Corner Radius" value={g.cornerRadius || ""} onChange={(v) => set("cornerRadius", v)} />
        <Input label="Grade" value={g.grade || ""} onChange={(v) => set("grade", v)} />
        <Input label="Coating" value={g.coating || ""} onChange={(v) => set("coating", v)} />
      </div>
    );
  }

  return (
    <div className="subtle" style={{ fontSize: 13 }}>
      Pick a <b>Tool Type</b> to show geometry fields.
    </div>
  );
};

/* ──────── HELPERS ──────── */
const money = (v) => Number(v || 0).toLocaleString("en-US", { style: "currency", currency: "USD" });

const isInsertType = (toolType) => String(toolType || "").toLowerCase().includes("insert");

const packDisplay = (qtyEach, packSize) => {
  const ps = Number(packSize);
  const q = Number(qtyEach) || 0;
  if (!ps || ps <= 1) return null;
  const packs = Math.floor(q / ps);
  const each = q % ps;
  return `${packs} pk + ${each} ea`;
};

const formatDateTime = (ts) => {
  if (!ts) return "—";
  const d = ts?.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
};

const StatusBadge = ({ status }) => {
  const badges = {
    pending: { text: "⏳ Pending Approval", color: "#9333ea", bg: "#faf5ff" },
    approved: { text: "✅ Approved", color: "#059669", bg: "#ecfdf5" },
    ordered: { text: "📦 Ordered", color: "#f59e0b", bg: "#fffbeb" },
    paid: { text: "💰 Paid", color: "#3b82f6", bg: "#eff6ff" },
    received: { text: "✅ Received", color: "#22c55e", bg: "#f0fdf4" },
  };
  const b = badges[status] || badges.pending;
  return (
    <span className="badge" style={{ borderColor: b.color, background: b.bg, color: b.color, fontWeight: 600 }}>
      {b.text}
    </span>
  );
};

/* ──────── PO MODAL ──────── */
function POModal({ tools, queueItems, onClose, onSubmit }) {
  const [showAllTools, setShowAllTools] = useState(false);
  const [poTools, setPOTools] = useState([]);
  const [dragOver, setDragOver] = useState(false);

  const [kits, setKits] = useState([]);
  useEffect(() => {
    const kq = query(collection(db, "kits"), orderBy("updatedAt", "desc"));
    return onSnapshot(kq, (snap) => setKits(snap.docs.map((d) => ({ id: d.id, ...(d.data() || {}) }))));
  }, []);

  const [po, setPO] = useState({
    poNumber: "",
    vendor: "",
    project: "",
    projectType: "new",
    shippingType: "Standard",
    shippingCost: 0,
    notes: "",
  });
  const [errors, setErrors] = useState({});

  const availableTools = showAllTools ? tools : queueItems.map((q) => q.tool);

  const handleDragStart = (e, tool) => e.dataTransfer.setData("tool", JSON.stringify(tool));

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const toolData = e.dataTransfer.getData("tool");
    if (!toolData) return;
    const tool = JSON.parse(toolData);
    setPOTools((prev) => {
      if (prev.some((t) => t.id === tool.id)) return prev;
      return [...prev, { ...tool, orderQty: Math.max(1, tool.thresholdEach || 1), orderPrice: tool.unitPrice || 0 }];
    });
  };

  const subtotal = poTools.reduce((sum, t) => sum + (Number(t.orderQty) || 0) * (Number(t.orderPrice) || 0), 0);
  const shipping = parseFloat(po.shippingCost || 0) || 0;
  const total = subtotal + shipping;

  const validate = () => {
    const e = {};
    if (!po.poNumber.trim()) e.poNumber = "PO Number required";
    if (!po.project.trim()) e.project = "Project required";
    if (poTools.length === 0) e.tools = "Add at least one tool";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const submit = () => {
    if (!validate()) return;
    onSubmit({
      ...po,
      shippingCost: shipping,
      tools: poTools.map((t) => ({
        toolId: t.id,
        name: t.name,
        quantity: Math.max(1, parseInt(t.orderQty) || 1),
        unitPrice: Number(parseFloat(t.orderPrice || 0).toFixed(2)),
        machineGroup: t.machineGroup || "",
      })),
    });
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="card"
        style={{ width: "min(1400px, 95vw)", height: "90vh", padding: 0, display: "flex", flexDirection: "column" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ padding: 20, borderBottom: "1px solid var(--border)", background: "var(--card)" }}>
          <h3 style={{ margin: "0 0 8px", color: "var(--text)" }}>Create Purchase Order</h3>
          <div style={{ fontSize: 13, color: "var(--muted)" }}>Drag tools from left to add them to this PO</div>
        </div>

        <div style={{ flex: 1, display: "grid", gridTemplateColumns: "400px 1fr", overflow: "hidden" }}>
          {/* LEFT: tool source */}
          <div style={{ borderRight: "1px solid var(--border)", display: "flex", flexDirection: "column", background: "var(--bg)" }}>
            <div style={{ padding: 16, borderBottom: "1px solid var(--border)", background: "var(--card)" }}>
              <div style={{ display: "flex", gap: 8 }}>
                <button className={`pill ${!showAllTools ? "active" : ""}`} onClick={() => setShowAllTools(false)} style={{ flex: 1 }}>
                  Reorder Queue ({queueItems.length})
                </button>
                <button className={`pill ${showAllTools ? "active" : ""}`} onClick={() => setShowAllTools(true)} style={{ flex: 1 }}>
                  All Tools ({tools.length})
                </button>
              </div>
            </div>

            <div style={{ flex: 1, overflow: "auto", padding: 12 }}>
              {availableTools.length === 0 ? (
                <div style={{ padding: 40, textAlign: "center", color: "var(--muted)" }}>No tools available</div>
              ) : (
                <div style={{ display: "grid", gap: 8 }}>
                  {availableTools.map((tool) => (
                    <div
                      key={tool.id}
                      draggable
                      onDragStart={(e) => handleDragStart(e, tool)}
                      style={{
                        padding: 12,
                        background: "var(--card)",
                        border: "1px solid var(--border)",
                        borderRadius: 8,
                        cursor: "grab",
                      }}
                    >
                      <div style={{ fontWeight: 600, color: "var(--text)" }}>{tool.name}</div>
                      <div className="subtle" style={{ fontSize: 12, marginTop: 2 }}>
                        {tool.manufacturer} · {tool.partNumber}
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6, fontSize: 12 }}>
                        <span className="subtle">Stock: {tool.qtyEach}</span>
                        <span style={{ fontWeight: 600, color: "var(--accent)" }}>{money(tool.unitPrice || 0)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* RIGHT: PO form */}
          <div style={{ display: "flex", flexDirection: "column", overflow: "auto", background: "var(--card)" }}>
            <div style={{ padding: 20, borderBottom: "1px solid var(--border)" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={{ display: "block", fontSize: 12, color: "var(--muted)", marginBottom: 6 }}>PO Number *</label>
                  <input
                    value={po.poNumber}
                    onChange={(e) => setPO((p) => ({ ...p, poNumber: e.target.value }))}
                    style={{
                      width: "100%",
                      padding: "10px 12px",
                      border: `1px solid ${errors.poNumber ? "#ef4444" : "var(--border)"}`,
                      borderRadius: 10,
                      background: "var(--card)",
                      color: "var(--text)",
                      outline: "none",
                    }}
                  />
                  {errors.poNumber && <div style={{ color: "#ef4444", fontSize: 12, marginTop: 4 }}>{errors.poNumber}</div>}
                </div>

                <div>
                  <label style={{ display: "block", fontSize: 12, color: "var(--muted)", marginBottom: 6 }}>Vendor</label>
                  <input
                    value={po.vendor}
                    onChange={(e) => setPO((p) => ({ ...p, vendor: e.target.value }))}
                    style={{
                      width: "100%",
                      padding: "10px 12px",
                      border: "1px solid var(--border)",
                      borderRadius: 10,
                      background: "var(--card)",
                      color: "var(--text)",
                      outline: "none",
                    }}
                  />
                </div>

                <div style={{ gridColumn: "1/-1" }}>
                  <label style={{ display: "block", fontSize: 12, color: "var(--muted)", marginBottom: 6 }}>Project / Job *</label>

                  <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                    <button className={`pill ${po.projectType === "existing" ? "active" : ""}`} type="button" onClick={() => setPO((p) => ({ ...p, projectType: "existing", project: "" }))} style={{ fontSize: 12 }}>
                      📋 Existing Job Kit
                    </button>
                    <button className={`pill ${po.projectType === "new" ? "active" : ""}`} type="button" onClick={() => setPO((p) => ({ ...p, projectType: "new", project: "" }))} style={{ fontSize: 12 }}>
                      ✨ New Project
                    </button>
                  </div>

                  {po.projectType === "existing" ? (
                    <select
                      value={po.project}
                      onChange={(e) => setPO((p) => ({ ...p, project: e.target.value }))}
                      style={{
                        width: "100%",
                        padding: "10px 12px",
                        border: `1px solid ${errors.project ? "#ef4444" : "var(--border)"}`,
                        borderRadius: 10,
                        background: "var(--card)",
                        color: "var(--text)",
                        outline: "none",
                      }}
                    >
                      <option value="">Select a job kit…</option>
                      {kits.map((k) => (
                        <option key={k.id} value={`Kit-${k.id}`}>
                          {k.partName || "—"} ({k.customer || "—"}) — {k.partNumber || "—"}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      value={po.project}
                      onChange={(e) => setPO((p) => ({ ...p, project: e.target.value }))}
                      placeholder="Enter new project name…"
                      style={{
                        width: "100%",
                        padding: "10px 12px",
                        border: `1px solid ${errors.project ? "#ef4444" : "var(--border)"}`,
                        borderRadius: 10,
                        background: "var(--card)",
                        color: "var(--text)",
                        outline: "none",
                      }}
                    />
                  )}
                  {errors.project && <div style={{ color: "#ef4444", fontSize: 12, marginTop: 4 }}>{errors.project}</div>}
                </div>

                <div>
                  <label style={{ display: "block", fontSize: 12, color: "var(--muted)", marginBottom: 6 }}>Shipping Type</label>
                  <select
                    value={po.shippingType}
                    onChange={(e) => setPO((p) => ({ ...p, shippingType: e.target.value }))}
                    style={{
                      width: "100%",
                      padding: "10px 12px",
                      border: "1px solid var(--border)",
                      borderRadius: 10,
                      background: "var(--card)",
                      color: "var(--text)",
                      outline: "none",
                    }}
                  >
                    {SHIPPING_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ display: "block", fontSize: 12, color: "var(--muted)", marginBottom: 6 }}>Shipping Cost</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={po.shippingCost}
                    onChange={(e) => setPO((p) => ({ ...p, shippingCost: e.target.value }))}
                    style={{
                      width: "100%",
                      padding: "10px 12px",
                      border: "1px solid var(--border)",
                      borderRadius: 10,
                      background: "var(--card)",
                      color: "var(--text)",
                      outline: "none",
                    }}
                  />
                </div>

                <div style={{ gridColumn: "1/-1" }}>
                  <label style={{ display: "block", fontSize: 12, color: "var(--muted)", marginBottom: 6 }}>Notes</label>
                  <textarea
                    rows={2}
                    value={po.notes}
                    onChange={(e) => setPO((p) => ({ ...p, notes: e.target.value }))}
                    style={{
                      width: "100%",
                      padding: "10px 12px",
                      border: "1px solid var(--border)",
                      borderRadius: 10,
                      background: "var(--card)",
                      color: "var(--text)",
                      outline: "none",
                      resize: "vertical",
                      fontFamily: "inherit",
                    }}
                  />
                </div>
              </div>
            </div>

            <div style={{ flex: 1, padding: 20 }}>
              <div style={{ marginBottom: 12, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <strong style={{ color: "var(--text)" }}>Tools on this PO ({poTools.length})</strong>
                {errors.tools && <div style={{ color: "#ef4444", fontSize: 12 }}>{errors.tools}</div>}
              </div>

              <div
                onDrop={handleDrop}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOver(true);
                }}
                onDragLeave={() => setDragOver(false)}
                style={{
                  minHeight: 200,
                  border: dragOver ? "2px dashed var(--accent)" : "2px dashed var(--border)",
                  borderRadius: 12,
                  padding: 16,
                  background: dragOver ? "var(--accent-50)" : "var(--bg)",
                  transition: "all 0.2s",
                }}
              >
                {poTools.length === 0 ? (
                  <div style={{ textAlign: "center", padding: 40, color: "var(--muted)" }}>
                    <div style={{ fontSize: 48, marginBottom: 8 }}>👈</div>
                    <p>Drag tools here to add them to this PO</p>
                  </div>
                ) : (
                  <div style={{ display: "grid", gap: 12 }}>
                    {poTools.map((tool) => (
                      <div key={tool.id} className="card" style={{ padding: 16 }}>
                        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr auto", gap: 12, alignItems: "center" }}>
                          <div>
                            <div style={{ fontWeight: 600, color: "var(--text)" }}>{tool.name}</div>
                            <div className="subtle" style={{ fontSize: 12 }}>
                              {tool.manufacturer} · {tool.partNumber}
                            </div>
                          </div>

                          <div>
                            <label style={{ display: "block", fontSize: 11, color: "var(--muted)", marginBottom: 4 }}>Quantity</label>
                            <input
                              type="number"
                              min="1"
                              value={tool.orderQty}
                              onChange={(e) =>
                                setPOTools((p) => p.map((x) => (x.id === tool.id ? { ...x, orderQty: Math.max(1, parseInt(e.target.value) || 1) } : x)))
                              }
                              style={{
                                width: "100%",
                                padding: "8px 10px",
                                border: "1px solid var(--border)",
                                borderRadius: 8,
                                background: "var(--card)",
                                color: "var(--text)",
                                textAlign: "center",
                                fontWeight: 600,
                              }}
                            />
                          </div>

                          <div>
                            <label style={{ display: "block", fontSize: 11, color: "var(--muted)", marginBottom: 4 }}>Unit Price</label>
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              value={tool.orderPrice}
                              onChange={(e) =>
                                setPOTools((p) => p.map((x) => (x.id === tool.id ? { ...x, orderPrice: parseFloat(e.target.value) || 0 } : x)))
                              }
                              style={{
                                width: "100%",
                                padding: "8px 10px",
                                border: "1px solid var(--border)",
                                borderRadius: 8,
                                background: "var(--card)",
                                color: "var(--text)",
                                textAlign: "right",
                                fontWeight: 600,
                              }}
                            />
                          </div>

                          <button className="btn btn-danger" onClick={() => setPOTools((p) => p.filter((x) => x.id !== tool.id))} style={{ padding: "8px 12px" }}>
                            ×
                          </button>
                        </div>

                        <div style={{ marginTop: 8, paddingTop: 8, borderTop: "1px dashed var(--border)", textAlign: "right", fontSize: 14, color: "var(--muted)" }}>
                          Subtotal: <strong style={{ color: "var(--text)" }}>{money((Number(tool.orderQty) || 0) * (Number(tool.orderPrice) || 0))}</strong>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {poTools.length > 0 && (
                <div style={{ marginTop: 20, padding: 16, background: "var(--bg)", borderRadius: 8, border: "1px solid var(--border)" }}>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
                    <div>
                      <div className="subtle" style={{ fontSize: 12 }}>Subtotal</div>
                      <div style={{ fontWeight: 700, fontSize: 18, color: "var(--text)" }}>{money(subtotal)}</div>
                    </div>
                    <div>
                      <div className="subtle" style={{ fontSize: 12 }}>Shipping</div>
                      <div style={{ fontWeight: 700, fontSize: 18, color: "var(--text)" }}>{money(shipping)}</div>
                      <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>{po.shippingType}</div>
                    </div>
                    <div>
                      <div className="subtle" style={{ fontSize: 12 }}>Total Cost</div>
                      <div style={{ fontWeight: 700, fontSize: 22, color: "var(--accent)" }}>{money(total)}</div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <div style={{ padding: 20, borderTop: "1px solid var(--border)", background: "var(--card)", display: "flex", justifyContent: "space-between" }}>
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={submit} disabled={!po.poNumber || poTools.length === 0 || !po.project}>
            Create Purchase Order
          </button>
        </div>
      </div>
    </div>
  );
}

/* ──────── MAIN ──────── */
export default function ToolInventoryApp({ session }) {
  const role = session?.profile?.role || "operator";
  const canCfoApprove = ["admin", "cfo"].includes(role);
  const canPurchasing = ["admin", "purchasing", "cfo"].includes(role);

  const [tools, setTools] = useState([]);
  const [queue, setQueue] = useState([]); // [{id, toolId, tool, createdAt}]
  const [orders, setOrders] = useState([]);

  const [expandedPOs, setExpandedPOs] = useState(new Set());
  const [showArchived, setShowArchived] = useState(false);

  const [toast, setToast] = useState("");
  const note = (msg) => {
    setToast(msg);
    clearTimeout(note.t);
    note.t = setTimeout(() => setToast(""), 2400);
  };

  // Add Tool modal state
  const [addOpen, setAddOpen] = useState(false);
  const [addShowAdvanced, setAddShowAdvanced] = useState(false);
  const [errors, setErrors] = useState({});
  const [form, setForm] = useState({
    name: "",
    manufacturer: "",
    partNumber: "",
    barcode: "",
    description: "",
    qtyEach: "",
    thresholdEach: "",
    unitPrice: "",
    vendor: "",
    machineGroup: "",
    toolType: "",
    uom: "EA",
    packSize: "",
    geometry: {},
    location: {},
  });

  // Edit modal
  const [modalOpen, setModalOpen] = useState(false);
  const [editShowAdvanced, setEditShowAdvanced] = useState(false);
  const [modal, setModal] = useState(null);

  // List/filter
  const [search, setSearch] = useState("");
  const [fMach, setFMach] = useState("");
  const [fType, setFType] = useState("");
  const [selId, setSelId] = useState(null);

  // PO modal
  const [poModalOpen, setPOModalOpen] = useState(false);

  // Barcode scan (USB scanner typing)
  const scanInputRef = useRef(null);
  const [scanMode, setScanMode] = useState(null); // "add" | "edit" | null
  const beginScan = (mode) => {
    setScanMode(mode);
    setTimeout(() => scanInputRef.current?.focus(), 0);
  };

  /* ──────── SUBSCRIBE: tools, reorderQueue, purchaseOrders ──────── */
  useEffect(() => {
    const tq = query(collection(db, "tools"), orderBy("updatedAt", "desc"));
    const unsubTools = onSnapshot(tq, (snap) => {
      setTools(
        snap.docs.map((d) => {
          const x = d.data() || {};
          return {
            id: d.id,
            name: x.name || "",
            manufacturer: x.manufacturer || "",
            partNumber: x.partNumber || "",
            barcode: x.barcode || "",
            description: x.description || "",
            qtyEach: Number(x.qtyEach ?? 0) || 0,
            thresholdEach: Number(x.thresholdEach ?? 0) || 0,
            unitPrice: Number(x.unitPrice ?? 0) || 0,
            vendor: x.vendor || "",
            machineGroup: x.machineGroup || "",
          trackingMode: x.trackingMode || "tracked",
            toolType: x.toolType || "",
            uom: x.uom || "EA",
            packSize: x.packSize || "",
            geometry: x.geometry || {},
            location: x.location || {},
          };
        })
      );
    });

    const qq = query(collection(db, "reorderQueue"), orderBy("createdAt", "desc"));
    const unsubQueue = onSnapshot(qq, (snap) => {
      setQueue(
        snap.docs.map((d) => {
          const x = d.data() || {};
          return {
            id: d.id,
            toolId: x.toolId || d.id,
            createdAt: x.createdAt || null,
            tool: {
              id: x.toolId || d.id,
              name: x.name || "",
              manufacturer: x.manufacturer || "",
              partNumber: x.partNumber || "",
              barcode: x.barcode || "",
              description: x.description || "",
              qtyEach: Number(x.qtyEach ?? 0) || 0,
              thresholdEach: Number(x.thresholdEach ?? 0) || 0,
              unitPrice: Number(x.unitPrice ?? 0) || 0,
              vendor: x.vendor || "",
              machineGroup: x.machineGroup || "",
              toolType: x.toolType || "",
              uom: x.uom || "EA",
              packSize: x.packSize || "",
              geometry: x.geometry || {},
              location: x.location || {},
            },
          };
        })
      );
    });

    const oq = query(collection(db, "purchaseOrders"), orderBy("createdAt", "desc"));
    const unsubOrders = onSnapshot(oq, (snap) => {
      setOrders(snap.docs.map((d) => ({ id: d.id, ...(d.data() || {}) })));
    });

    return () => {
      unsubTools();
      unsubQueue();
      unsubOrders();
    };
  }, []);

  /* ──────── DERIVED ──────── */
  const machOpts = useMemo(() => [...new Set([...MACHINE_GROUPS_BASE, ...tools.map((t) => t.machineGroup)])], [tools]);
  const typeOpts = useMemo(() => [...new Set([...TOOL_TYPES_BASE, ...tools.map((t) => t.toolType)])], [tools]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return tools.filter((t) => {
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
        JSON.stringify(t.geometry || {}),
      ]
        .join(" ")
        .toLowerCase();
      return (!q || hay.includes(q)) && (!fMach || t.machineGroup === fMach) && (!fType || t.toolType === fType);
    });
  }, [tools, search, fMach, fType]);

  const sel = tools.find((t) => t.id === selId);
  const activePOs = orders.filter((o) => o.status !== "received");
  const archivedPOs = orders.filter((o) => o.status === "received");
  const displayPOs = (showArchived ? archivedPOs : activePOs);

  const totalVal = tools.reduce((a, t) => a + (Number(t.qtyEach) || 0) * (Number(t.unitPrice) || 0), 0);

  /* ──────── ACTIONS ──────── */
  const validateTool = (mode = "add") => {
    const e = {};
    const payload = mode === "add" ? form : modal;

    if (!String(payload?.name || "").trim()) e.name = "Name required";
    const bc = String(payload?.barcode || "").trim();
    if (bc) {
      const dup = tools.some((t) => String(t.barcode || "").trim() === bc && (mode === "add" ? true : t.id !== payload.id));
      if (dup) e.barcode = "Barcode already exists";
    }
    if (payload?.packSize !== "" && payload?.packSize != null) {
      const ps = Number(payload.packSize);
      if (!Number.isFinite(ps) || ps <= 0) e.packSize = "Pack size must be > 0";
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const addTool = async () => {
    if (!validateTool("add")) return;

    const docData = {
      name: form.name.trim(),
      manufacturer: form.manufacturer.trim(),
      partNumber: form.partNumber.trim(),
      barcode: (form.barcode || "").trim(),
      description: form.description.trim(),
      qtyEach: Math.max(0, parseInt(form.qtyEach || 0) || 0),
      thresholdEach: Math.max(0, parseInt(form.thresholdEach || 0) || 0),
      unitPrice: Number(parseFloat(form.unitPrice || 0).toFixed(2)),
      vendor: (form.vendor || "").trim(),
      machineGroup: form.machineGroup || "",
      toolType: form.toolType || "",
      uom: form.uom || "EA",
      packSize: form.packSize === "" ? "" : Math.max(1, parseInt(form.packSize || 0) || 1),
      geometry: form.geometry || {},
      trackingMode: form.trackingMode || "tracked",
      trackingMode: form.trackingMode || "tracked",
      location: form.location || {},
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      updatedByUid: session?.user?.uid || null,
      updatedByName: session?.profile?.displayName || session?.user?.email || "",
    };

    await addDoc(collection(db, "tools"), docData);
    setAddOpen(false);
    setAddShowAdvanced(false);
    setErrors({});
    setScanMode(null);
    note("Tool added ✅");
  };

  const saveEdit = async () => {
    if (!modal?.id) return;
    if (!validateTool("edit")) return;

    const ref = doc(db, "tools", modal.id);
    await updateDoc(ref, {
      name: modal.name.trim(),
      manufacturer: modal.manufacturer.trim(),
      partNumber: modal.partNumber.trim(),
      barcode: (modal.barcode || "").trim(),
      description: modal.description.trim(),
      qtyEach: Math.max(0, parseInt(modal.qtyEach || 0) || 0),
      thresholdEach: Math.max(0, parseInt(modal.thresholdEach || 0) || 0),
      unitPrice: Number(parseFloat(modal.unitPrice || 0).toFixed(2)),
      vendor: (modal.vendor || "").trim(),
      machineGroup: modal.machineGroup || "",
      toolType: modal.toolType || "",
      uom: modal.uom || "EA",
      packSize: modal.packSize === "" ? "" : Math.max(1, parseInt(modal.packSize || 0) || 1),
      geometry: modal.geometry || {},
      trackingMode: modal.trackingMode || "tracked",
      location: modal.location || {},
      updatedAt: serverTimestamp(),
      updatedByUid: session?.user?.uid || null,
      updatedByName: session?.profile?.displayName || session?.user?.email || "",
    });
    setModalOpen(false);
    note("Saved 💾");
  };


const trackToolInInventory = async (tool) => {
  if (!tool?.id) return;
  const reorderRaw = window.prompt("Reorder point (each) for this tool? (leave blank for 0)", String(tool.thresholdEach ?? tool.threshold ?? 0));
  if (reorderRaw === null) return;
  const reorderPoint = Math.max(0, Number(reorderRaw || 0) || 0);

  await updateDoc(doc(db, "tools", tool.id), {
    trackingMode: "tracked",
    thresholdEach: reorderPoint,
    updatedAt: serverTimestamp(),
  });
  note("Tool is now TRACKED ✅");
};

  const setQtyDirect = async (toolId, nextQty) => {
    await updateDoc(doc(db, "tools", toolId), {
      qtyEach: Math.max(0, parseInt(nextQty || 0) || 0),
      updatedAt: serverTimestamp(),
    });
  };

  const toQueue = async (t) => {
    const ref = doc(db, "reorderQueue", t.id); // keyed by toolId
    await updateDoc(ref, {
      toolId: t.id,
      name: t.name,
      manufacturer: t.manufacturer,
      partNumber: t.partNumber,
      barcode: t.barcode,
      description: t.description,
      qtyEach: t.qtyEach,
      thresholdEach: t.thresholdEach,
      unitPrice: t.unitPrice,
      vendor: t.vendor,
      machineGroup: t.machineGroup,
      toolType: t.toolType,
      uom: t.uom,
      packSize: t.packSize || "",
      geometry: t.geometry || {},
      trackingMode: t.trackingMode || "tracked",
      location: t.location || {},
      createdAt: serverTimestamp(),
      requestedByUid: session?.user?.uid || null,
      requestedByName: session?.profile?.displayName || session?.user?.email || "",
    }).catch(async () => {
      // updateDoc fails if doc doesn't exist; create it via setDoc-like behavior using batch
      const b = writeBatch(db);
      b.set(ref, {
        toolId: t.id,
        name: t.name,
        manufacturer: t.manufacturer,
        partNumber: t.partNumber,
        barcode: t.barcode,
        description: t.description,
        qtyEach: t.qtyEach,
        thresholdEach: t.thresholdEach,
        unitPrice: t.unitPrice,
        vendor: t.vendor,
        machineGroup: t.machineGroup,
        toolType: t.toolType,
        uom: t.uom,
        packSize: t.packSize || "",
        geometry: t.geometry || {},
      trackingMode: t.trackingMode || "tracked",
        location: t.location || {},
        createdAt: serverTimestamp(),
        requestedByUid: session?.user?.uid || null,
        requestedByName: session?.profile?.displayName || session?.user?.email || "",
      });
      await b.commit();
    });
    note("Queued 📦");
  };

  const rmQueue = async (toolId) => {
    await deleteDoc(doc(db, "reorderQueue", toolId));
  };

  const createPO = async (poData) => {
    if (!poData?.tools?.length) return;

    await addDoc(collection(db, "purchaseOrders"), {
      poNumber: poData.poNumber,
      vendor: poData.vendor || "",
      project: poData.project || "",
      projectType: poData.projectType || "new",
      shippingType: poData.shippingType || "Standard",
      shippingCost: Number(poData.shippingCost || 0) || 0,
      notes: poData.notes || "",
      status: "pending",
      createdAt: serverTimestamp(),
      approvedAt: null,
      orderedAt: null,
      paidAt: null,
      receivedAt: null,
      createdByUid: session?.user?.uid || null,
      createdByName: session?.profile?.displayName || session?.user?.email || "",
      tools: poData.tools.map((t) => ({
        toolId: t.toolId || null,
        name: t.name || "",
        manufacturer: t.manufacturer || "",
        partNumber: t.partNumber || "",
        description: t.description || "",
        barcode: t.barcode || "",
        toolType: t.toolType || "",
        machineGroup: t.machineGroup || "",
        quantity: Number(t.quantity) || 0,
        unitPrice: Number(t.unitPrice) || 0,
      })),
    });

    // Remove from queue
    const b = writeBatch(db);
    poData.tools.forEach((t) => b.delete(doc(db, "reorderQueue", t.toolId)));
    await b.commit();

    setPOModalOpen(false);
    note(`PO ${poData.poNumber} created! Pending CFO approval ⏳`);
  };

  const markApproved = async (poId) => {
    await updateDoc(doc(db, "purchaseOrders", poId), { status: "approved", approvedAt: serverTimestamp() });
    note("CFO Approved ✅");
  };
  const markOrdered = async (poId) => {
    await updateDoc(doc(db, "purchaseOrders", poId), { status: "ordered", orderedAt: serverTimestamp() });
    note("Marked as ordered 📦");
  };
  const markPaid = async (poId) => {
    await updateDoc(doc(db, "purchaseOrders", poId), { status: "paid", paidAt: serverTimestamp() });
    note("Marked as paid 💰");
  };
  const receiveOrder = async (po) => {
  if (!po?.id || !po?.tools?.length) return;
  const b = writeBatch(db);

  po.tools.forEach((t) => {
    // Existing inventory tool
    if (t.toolId) {
      b.update(doc(db, "tools", t.toolId), {
        qtyEach: increment(Number(t.quantity) || 0),
        updatedAt: serverTimestamp(),
      });
      return;
    }

    // New / not-in-inventory tool line item: create as UNTRACKED (trial), but store qtyEach (Option A)
    const newRef = doc(collection(db, "tools"));
    b.set(newRef, {
      name: t.name || t.description || "New Tool",
      manufacturer: t.manufacturer || "",
      partNumber: t.partNumber || "",
      barcode: t.barcode || "",
      toolType: t.toolType || "Trial / Untracked",
      machineGroup: t.machineGroup || "",
      description: t.description || "",
      qtyEach: Number(t.quantity) || 0,
      thresholdEach: 0,
      packSize: null,
      price: Number(t.unitPrice) || 0,
      location: {},
      geometry: {},
      trackingMode: "untracked",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      createdFrom: { poId: po.id, poNumber: po.poNumber || "" },
    });
  });

  b.update(doc(db, "purchaseOrders", po.id), { status: "received", receivedAt: serverTimestamp() });
  await b.commit();
  note(`PO ${po.poNumber} received! Tools added to inventory ✅`);
};


  const deletePO = async (poId) => {
    if (!window.confirm("Delete this PO?")) return;
    await deleteDoc(doc(db, "purchaseOrders", poId));
    note("PO deleted 🗑️");
  };

  const togglePO = (poId) => {
    setExpandedPOs((prev) => {
      const next = new Set(prev);
      if (next.has(poId)) next.delete(poId);
      else next.add(poId);
      return next;
    });
  };

  // Incoming qty for selected tool
  const incomingForSelected = useMemo(() => {
    if (!sel) return 0;
    return orders
      .filter((o) => o.status !== "received")
      .reduce((acc, po) => {
        const row = (po.tools || []).find((x) => x.toolId === sel.id);
        return acc + (row ? Number(row.quantity || 0) : 0);
      }, 0);
  }, [orders, sel]);

  /* ──────── RENDER ──────── */
  return (
    <div className="app">
      {/* Hidden input to capture USB barcode scans (scanner types + Enter) */}
      <input
        ref={scanInputRef}
        value={scanMode === "add" ? form.barcode : scanMode === "edit" ? (modal?.barcode || "") : ""}
        onChange={(e) => {
          if (scanMode === "add") setForm((p) => ({ ...p, barcode: e.target.value }));
          if (scanMode === "edit") setModal((p) => ({ ...(p || {}), barcode: e.target.value }));
        }}
        onKeyDown={(e) => {
          if (e.key !== "Enter") return;
          if (!scanMode) return;
          note("Barcode captured ✅");
          setScanMode(null);
        }}
        onBlur={() => setScanMode(null)}
        style={{ position: "absolute", left: -9999, top: -9999, width: 1, height: 1, opacity: 0 }}
        aria-hidden="true"
      />

      {/* STATS */}
      <div
        className="metrics"
        style={{ margin: "16px 24px 0", gap: 16, display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))" }}
      >
        <div className="metric card stat-accent">
          <div className="label">Needs Attention</div>
          <div className="value">{tools.filter((t) => t.qtyEach <= t.thresholdEach).length}</div>
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
      <div className="controls" style={{ margin: "16px 24px 0", display: "flex", gap: 12, flexWrap: "wrap", alignItems: "end" }}>
        <div className="search" style={{ flex: 1, minWidth: 280 }}>
          <input placeholder="Search anything…" value={search} onChange={(e) => setSearch(e.target.value)} />
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
              qtyEach: "",
              thresholdEach: "",
              unitPrice: "",
              vendor: "",
              machineGroup: "",
              toolType: "",
              uom: "EA",
              packSize: "",
              geometry: {},
              location: {},
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
      <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: 24, margin: "16px 24px 0" }}>
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

                {filtered.map((t) => {
                  const low = t.qtyEach <= t.thresholdEach;
                  const zero = t.qtyEach === 0;

                  return (
                    <tr
                      key={t.id}
                      onClick={() => setSelId(t.id)}
                      style={{ cursor: "pointer", background: selId === t.id ? "var(--accent-50)" : "" }}
                    >
                      <td>
                        <div style={{ fontWeight: 600 }}>{t.name}</div>
                        <div className="subtle">
                          {t.manufacturer} · {t.partNumber}
                        </div>
                        {(t.machineGroup || t.toolType) && (
                          <div className="subtle" style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 4 }}>
                            {t.machineGroup && <span className="badge pill">{t.machineGroup}</span>}
                            {t.toolType && <span className="badge pill">{t.toolType}</span>}
                          </div>
                        )}
                      </td>

                      <td>
                        <input
                          type="number"
                          min="0"
                          value={t.qtyEach}
                          onChange={(e) => setQtyDirect(t.id, e.target.value)}
                          onClick={(e) => e.stopPropagation()}
                          style={{
                            width: 90,
                            padding: "8px 10px",
                            border: "1px solid var(--border)",
                            borderRadius: 8,
                            background: "var(--card)",
                            fontWeight: 600,
                            textAlign: "center",
                            color: "var(--text)",
                          }}
                        />
                        <div className="subtle" style={{ fontSize: 11, marginTop: 4 }}>
                          min {t.thresholdEach}{packDisplay(t.qtyEach, t.packSize) ? ` • ${packDisplay(t.qtyEach, t.packSize)}` : ""}
                        </div>
                      </td>

                      <td>{t.vendor || "—"}</td>
                      <td style={{ textAlign: "right" }}>{money((Number(t.qtyEach) || 0) * (Number(t.unitPrice) || 0))}</td>

                      <td style={{ whiteSpace: "nowrap" }}>
                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                          <button className="btn" onClick={(e) => { e.stopPropagation(); toQueue(t); }}>Reorder</button>
                          <button
                            className="btn"
                            onClick={(e) => {
                              e.stopPropagation();
                              setModal({ ...t });
                              setEditShowAdvanced(false);
                              setErrors({});
                              setModalOpen(true);
                            }}
                          >
                            Edit
                          </button>
                        </div>
                      </td>

                      <td>
                        {zero ? <span className="badge zero">❌ Out</span> : low ? <span className="badge low">⚠️ Low</span> : <span className="badge ok">✅ OK</span>}
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
                  {sel.trackingMode === "untracked" && (
                    <div style={{ marginTop: 8 }}>
                      <span className="badge low" style={{ marginLeft: 0 }}>UNTRACKED / TRIAL</span>
                      <button className="btn btn-primary btn-sm" style={{ marginLeft: 10 }} onClick={() => trackToolInInventory(sel)}>
                        Track in inventory
                      </button>
                    </div>
                  )}
                  <div style={{ fontSize: 13, color: "var(--muted)", marginTop: 4 }}>
                    {sel.manufacturer} · {sel.partNumber}
                  </div>

                  {sel.barcode && (
                    <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 4 }}>
                      Barcode: <span style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}>{sel.barcode}</span>
                    </div>
                  )}

                  {packDisplay(sel.qtyEach, sel.packSize) && (
                    <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 4 }}>
                      On hand: {packDisplay(sel.qtyEach, sel.packSize)}
                    </div>
                  )}
                </div>

                <span className={`badge ${sel.qtyEach === 0 ? "zero" : sel.qtyEach <= sel.thresholdEach ? "low" : "ok"}`} style={{ fontSize: 11 }}>
                  {sel.qtyEach === 0 ? "OUT" : sel.qtyEach <= sel.thresholdEach ? "LOW" : "OK"}
                </span>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, fontSize: 14, marginTop: 14 }}>
                <div>
                  <div style={{ color: "var(--muted)" }}>On Hand</div>
                  <div style={{ fontWeight: 700, fontSize: 20 }}>{sel.qtyEach}</div>
                </div>
                <div>
                  <div style={{ color: "var(--muted)" }}>Incoming</div>
                  <div style={{ fontWeight: 700, fontSize: 20 }}>{incomingForSelected}</div>
                </div>
                <div>
                  <div style={{ color: "var(--muted)" }}>Need</div>
                  <div style={{ fontWeight: 700, fontSize: 20 }}>{Math.max(0, (sel.thresholdEach || 0) - (sel.qtyEach || 0))}</div>
                </div>
                <div>
                  <div style={{ color: "var(--muted)" }}>Value</div>
                  <div style={{ fontWeight: 700, fontSize: 20 }}>{money((sel.qtyEach || 0) * (sel.unitPrice || 0))}</div>
                </div>
              </div>

              <div style={{ marginTop: 16, display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button className="btn" style={{ flex: 1 }} onClick={() => setQtyDirect(sel.id, (sel.qtyEach || 0) - 1)}>
                  -1
                </button>
                <button className="btn btn-success" style={{ flex: 2 }} onClick={() => { toQueue(sel); }}>
                  Reorder
                </button>
                <button className="btn btn-primary" style={{ flex: 2 }} onClick={() => setPOModalOpen(true)}>
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

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, fontSize: 13 }}>
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

      {/* REORDER QUEUE + PURCHASE ORDERS */}
      <div style={{ margin: "24px 24px 0", display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(340px,1fr))", gap: 16 }}>
        {/* REORDER QUEUE */}
        <div className="card" style={{ padding: 0, boxShadow: "var(--shadow)" }}>
          <div style={{ padding: "16px 20px", background: "#fef3c7", borderBottom: "1px solid #fde68a", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <strong style={{ fontSize: 16, color: "#78350f" }}>📦 Reorder Queue ({queue.length})</strong>
            {queue.length > 0 && <button className="btn btn-success btn-sm" onClick={() => setPOModalOpen(true)}>Create PO</button>}
          </div>

          <div style={{ maxHeight: 500, overflow: "auto" }}>
            {queue.length === 0 ? (
              <div style={{ padding: 40, textAlign: "center", color: "var(--muted)" }}>
                <div style={{ fontSize: 48 }}>✨</div>
                <p>No items — you're golden!</p>
              </div>
            ) : (
              <ul style={{ margin: 0, padding: 0, listStyle: "none" }}>
                {queue.map((q) => (
                  <li key={q.toolId} style={{ padding: "12px 20px", borderBottom: "1px dashed var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <div style={{ fontWeight: 600, color: "var(--text)" }}>{q.tool?.name || "Tool"}</div>
                      <div style={{ fontSize: 12, color: "var(--muted)" }}>
                        need {q.tool?.thresholdEach ?? 0} • {q.tool?.qtyEach ?? 0} on hand
                      </div>
                    </div>
                    <button className="btn btn-danger btn-sm" onClick={() => rmQueue(q.toolId)}>×</button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* PURCHASE ORDERS */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ display: "flex", gap: 8 }}>
            <button className={`pill ${!showArchived ? "active" : ""}`} onClick={() => setShowArchived(false)} style={{ padding: "10px 20px", flex: 1 }}>
              🧾 Active ({activePOs.length})
            </button>
            <button className={`pill ${showArchived ? "active" : ""}`} onClick={() => setShowArchived(true)} style={{ padding: "10px 20px", flex: 1 }}>
              📦 Archived ({archivedPOs.length})
            </button>
          </div>

          <div className="card" style={{ padding: 0, boxShadow: "var(--shadow)" }}>
            <div style={{ maxHeight: 500, overflow: "auto" }}>
              {displayPOs.length === 0 ? (
                <div style={{ padding: 40, textAlign: "center", color: "var(--muted)" }}>
                  <div style={{ fontSize: 48, marginBottom: 8 }}>{showArchived ? "📦" : "📋"}</div>
                  <p style={{ margin: 0 }}>{showArchived ? "No archived purchase orders" : "No active purchase orders"}</p>
                </div>
              ) : (
                <div>
                  {displayPOs.map((po) => {
                    const isExpanded = expandedPOs.has(po.id);
                    const subtotal = (po.tools || []).reduce((sum, t) => sum + (Number(t.quantity || 0) * Number(t.unitPrice || 0)), 0);
                    const totalCost = subtotal + (Number(po.shippingCost || 0) || 0);

                    return (
                      <div key={po.id} style={{ borderBottom: "1px solid var(--border)" }}>
                        {/* Header */}
                        <div
                          style={{ padding: 16, cursor: "pointer", background: isExpanded ? "var(--accent-50)" : "transparent", transition: "background 0.2s" }}
                          onClick={() => togglePO(po.id)}
                        >
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", marginBottom: 8 }}>
                            <div style={{ flex: 1 }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6, flexWrap: "wrap" }}>
                                <h4 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "var(--text)" }}>{po.poNumber || "PO"}</h4>
                                <StatusBadge status={po.status} />
                              </div>

                              <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 4 }}>
                                <strong style={{ color: "var(--text)" }}>{po.project || "—"}</strong>
                                {po.vendor ? <span> • {po.vendor}</span> : null}
                              </div>

                              <div style={{ display: "flex", gap: 12, fontSize: 11, color: "var(--muted)" }}>
                                <span>{(po.tools || []).length} tool{(po.tools || []).length !== 1 ? "s" : ""}</span>
                                <span>•</span>
                                <span style={{ color: "var(--accent)", fontWeight: 600 }}>{money(totalCost)}</span>
                                <span>•</span>
                                <span>{formatDateTime(po.createdAt)}</span>
                              </div>
                            </div>

                            <div style={{ fontSize: 20, color: "var(--muted)", marginLeft: 12, transition: "transform 0.2s", transform: isExpanded ? "rotate(180deg)" : "rotate(0deg)" }}>
                              ▼
                            </div>
                          </div>

                          {!showArchived && (
                            <div style={{ display: "flex", gap: 6, marginTop: 8 }} onClick={(e) => e.stopPropagation()}>
                              {po.status === "pending" && (
                                <>
                                  <button className="btn btn-success btn-sm" disabled={!canCfoApprove} title={!canCfoApprove ? "CFO/Admin only" : ""} onClick={() => markApproved(po.id)}>
                                    ✅ CFO Approve
                                  </button>
                                  <button className="btn btn-danger btn-sm" disabled={!canPurchasing} title={!canPurchasing ? "Purchasing/Admin only" : ""} onClick={() => deletePO(po.id)}>
                                    Delete
                                  </button>
                                </>
                              )}
                              {po.status === "approved" && (
                                <>
                                  <button className="btn btn-primary btn-sm" disabled={!canPurchasing} title={!canPurchasing ? "Purchasing/Admin only" : ""} onClick={() => markOrdered(po.id)}>
                                    📦 Mark Ordered
                                  </button>
                                  <button className="btn btn-danger btn-sm" disabled={!canPurchasing} onClick={() => deletePO(po.id)}>
                                    Delete
                                  </button>
                                </>
                              )}
                              {po.status === "ordered" && (
                                <>
                                  <button className="btn btn-primary btn-sm" disabled={!canPurchasing} onClick={() => markPaid(po.id)}>
                                    💰 Mark Paid
                                  </button>
                                  <button className="btn btn-danger btn-sm" disabled={!canPurchasing} onClick={() => deletePO(po.id)}>
                                    Delete
                                  </button>
                                </>
                              )}
                              {po.status === "paid" && (
                                <button className="btn btn-success btn-sm" disabled={!canPurchasing} onClick={() => receiveOrder(po)}>
                                  ✅ Receive Order
                                </button>
                              )}
                            </div>
                          )}
                        </div>

                        {isExpanded && (
                          <div style={{ padding: "0 16px 16px 16px", background: "var(--bg)", borderTop: "1px solid var(--border)" }}>
                            {/* Timeline */}
                            <div style={{ margin: "12px 0", padding: 12, background: "var(--card)", borderRadius: 8, border: "1px solid var(--border)" }}>
                              <h5 style={{ margin: "0 0 10px", fontSize: 12, fontWeight: 600, color: "var(--muted)", textTransform: "uppercase" }}>
                                📅 Order Timeline
                              </h5>
                              <div style={{ display: "grid", gap: 8 }}>
                                <div className="subtle">Created: {formatDateTime(po.createdAt)}</div>
                                <div className="subtle">Approved: {formatDateTime(po.approvedAt)}</div>
                                <div className="subtle">Ordered: {formatDateTime(po.orderedAt)}</div>
                                <div className="subtle">Paid: {formatDateTime(po.paidAt)}</div>
                                <div className="subtle">Received: {formatDateTime(po.receivedAt)}</div>
                              </div>
                            </div>

                            {/* Tools list */}
                            <h5 style={{ margin: "12px 0 8px", fontSize: 12, fontWeight: 600, color: "var(--muted)", textTransform: "uppercase" }}>
                              Tools on this order
                            </h5>

                            <div style={{ display: "grid", gap: 6 }}>
                              {(po.tools || []).map((tool, idx) => (
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
                                    fontSize: 12,
                                  }}
                                >
                                  <div>
                                    <div style={{ fontWeight: 600, color: "var(--text)" }}>{tool.name}</div>
                                    {tool.machineGroup && <span className="badge pill" style={{ fontSize: 9, marginTop: 2 }}>{tool.machineGroup}</span>}
                                  </div>
                                  <div className="subtle">
                                    Qty: <strong style={{ color: "var(--text)" }}>{tool.quantity}</strong> × {money(tool.unitPrice)}
                                  </div>
                                  <div style={{ textAlign: "right", fontWeight: 600, color: "var(--accent)" }}>{money(Number(tool.quantity || 0) * Number(tool.unitPrice || 0))}</div>
                                </div>
                              ))}
                            </div>

                            {/* Totals */}
                            <div style={{ marginTop: 12, padding: 10, background: "var(--card)", borderRadius: 8, border: "1px solid var(--border)", display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, fontSize: 11 }}>
                              <div>
                                <div className="subtle">Subtotal</div>
                                <div style={{ fontWeight: 600, color: "var(--text)" }}>{money(subtotal)}</div>
                              </div>
                              <div>
                                <div className="subtle">Shipping</div>
                                <div style={{ fontWeight: 600, color: "var(--text)" }}>{money(po.shippingCost || 0)}</div>
                              </div>
                              <div>
                                <div className="subtle">Total</div>
                                <div style={{ fontWeight: 700, fontSize: 14, color: "var(--accent)" }}>{money(totalCost)}</div>
                              </div>
                            </div>

                            {po.notes && (
                              <div style={{ marginTop: 8, padding: 8, background: "var(--card)", borderRadius: 6, fontSize: 11, color: "var(--muted)", fontStyle: "italic" }}>
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
          <div className="card" style={{ width: "min(920px,94vw)", padding: 20 }} onClick={(e) => e.stopPropagation()}>
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
              <Input label="Name" value={form.name} onChange={(v) => setForm((p) => ({ ...p, name: v }))} error={errors.name} />
              <Input label="Manufacturer" value={form.manufacturer} onChange={(v) => setForm((p) => ({ ...p, manufacturer: v }))} />
              <Input label="Part #" value={form.partNumber} onChange={(v) => setForm((p) => ({ ...p, partNumber: v }))} />

              <div style={{ gridColumn: "1/3" }}>
                <Input
                  label="Barcode"
                  value={form.barcode}
                  onChange={(v) => setForm((p) => ({ ...p, barcode: v }))}
                  error={errors.barcode}
                  placeholder="Scan or type…"
                />
              </div>
              <div style={{ display: "flex", alignItems: "end" }}>
                <button className="btn" style={{ width: "100%" }} onClick={() => beginScan("add")}>
                  📟 Scan Barcode
                </button>
              </div>

              <div style={{ gridColumn: "1/-1" }}>
                <Input label="Description" value={form.description} onChange={(v) => setForm((p) => ({ ...p, description: v }))} />
              </div>

              <Input label="Quantity" type="number" value={form.qtyEach} onChange={(v) => setForm((p) => ({ ...p, qtyEach: v }))} />
              <Input label="Low Threshold" type="number" value={form.thresholdEach} onChange={(v) => setForm((p) => ({ ...p, thresholdEach: v }))} />
              
<div className="input" style={{ display: "grid", gap: 6 }}>
  <span className="subtle">Track inventory</span>
  <label style={{ display: "flex", gap: 10, alignItems: "center" }}>
    <input
      type="checkbox"
      checked={(form.trackingMode || "tracked") === "tracked"}
      onChange={(e) => setForm((p) => ({ ...p, trackingMode: e.target.checked ? "tracked" : "untracked" }))}
    />
    <span className="subtle">
      {((form.trackingMode || "tracked") === "tracked") ? "Tracked (counts on-hand, reorder, etc.)" : "Untracked / Trial"}
    </span>
  </label>
</div>

<Input label="Unit Price" type="number" step="0.01" value={form.unitPrice} onChange={(v) => setForm((p) => ({ ...p, unitPrice: v }))} />

              <Input label="Vendor" value={form.vendor} onChange={(v) => setForm((p) => ({ ...p, vendor: v }))} />

              <SelectWithOther label="Machine Group" value={form.machineGroup} setValue={(v) => setForm((p) => ({ ...p, machineGroup: v }))} baseOptions={MACHINE_GROUPS_BASE} />
              <SelectWithOther label="Tool Type" value={form.toolType} setValue={(v) => setForm((p) => ({ ...p, toolType: v }))} baseOptions={TOOL_TYPES_BASE} />

              {isInsertType(form.toolType) ? (
                <Input label="Pack Size (optional)" type="number" value={form.packSize} onChange={(v) => setForm((p) => ({ ...p, packSize: v }))} error={errors.packSize} placeholder="e.g., 10" />
              ) : (
                <div />
              )}

              <div style={{ gridColumn: "1/-1" }}>
                <button className="btn" onClick={() => setAddShowAdvanced((s) => !s)} style={{ width: "100%", justifyContent: "space-between", display: "flex", alignItems: "center" }}>
                  <span>⚙️ Advanced fields</span>
                  <span style={{ fontSize: 12, opacity: 0.7 }}>{addShowAdvanced ? "Hide" : "Show"}</span>
                </button>

                {addShowAdvanced && (
                  <div className="card" style={{ marginTop: 10, padding: 14, background: "var(--card)", border: "1px solid var(--border)" }}>
                    <div className="subtle" style={{ fontSize: 12, marginBottom: 10 }}>
                      Optional: geometry + location for setup sheets / operators.
                    </div>
                    <LocationSection value={form.location} onChange={(loc) => setForm((p) => ({ ...p, location: loc }))} />
                    <div className="subtle" style={{ fontSize: 13, margin: "10px 0 6px" }}>
                      Geometry (advanced)
                    </div>
                    <GeometrySection
                      toolType={form.toolType}
                      geometry={form.geometry || {}}
                      setGeometry={(updater) => {
                        setForm((p) => {
                          const nextGeom = typeof updater === "function" ? updater(p.geometry || {}) : updater;
                          return { ...p, geometry: nextGeom };
                        });
                      }}
                    /></div>
                )}
              </div>
            </div>

            <div className="toolbar" style={{ marginTop: 16 }}>
              <button className="btn" onClick={() => setAddOpen(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={addTool}>Add Tool</button>
            </div>
          </div>
        </div>
      )}

      {/* EDIT MODAL */}
      {modalOpen && modal && (
        <div className="modal-backdrop" onClick={() => setModalOpen(false)}>
          <div className="card" style={{ width: "min(920px,94vw)", padding: 20 }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <h3 style={{ margin: 0 }}>Edit Tool</h3>
              <button className="btn" onClick={() => setModalOpen(false)}>✕</button>
            </div>

            <div className="form-grid" style={{ gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginTop: 14 }}>
              <Input label="Name" value={modal.name} onChange={(v) => setModal((p) => ({ ...p, name: v }))} error={errors.name} />
              <Input label="Manufacturer" value={modal.manufacturer} onChange={(v) => setModal((p) => ({ ...p, manufacturer: v }))} />
              <Input label="Part #" value={modal.partNumber} onChange={(v) => setModal((p) => ({ ...p, partNumber: v }))} />

              <div style={{ gridColumn: "1/3" }}>
                <Input label="Barcode" value={modal.barcode} onChange={(v) => setModal((p) => ({ ...p, barcode: v }))} error={errors.barcode} />
              </div>
              <div style={{ display: "flex", alignItems: "end" }}>
                <button className="btn" style={{ width: "100%" }} onClick={() => beginScan("edit")}>📟 Scan Barcode</button>
              </div>

              <div style={{ gridColumn: "1/-1" }}>
                <Input label="Description" value={modal.description} onChange={(v) => setModal((p) => ({ ...p, description: v }))} />
              </div>

              <Input label="Quantity" type="number" value={modal.qtyEach} onChange={(v) => setModal((p) => ({ ...p, qtyEach: v }))} />
              <Input label="Low Threshold" type="number" value={modal.thresholdEach} onChange={(v) => setModal((p) => ({ ...p, thresholdEach: v }))} />
              
<div className="input" style={{ display: "grid", gap: 6 }}>
  <span className="subtle">Track inventory</span>
  <label style={{ display: "flex", gap: 10, alignItems: "center" }}>
    <input
      type="checkbox"
      checked={(modal.trackingMode || "tracked") === "tracked"}
      onChange={(e) => setModal((p) => ({ ...p, trackingMode: e.target.checked ? "tracked" : "untracked" }))}
    />
    <span className="subtle">
      {((modal.trackingMode || "tracked") === "tracked") ? "Tracked (counts on-hand, reorder, etc.)" : "Untracked / Trial"}
    </span>
  </label>
</div>

<Input label="Unit Price" type="number" step="0.01" value={modal.unitPrice} onChange={(v) => setModal((p) => ({ ...p, unitPrice: v }))} />

              <Input label="Vendor" value={modal.vendor} onChange={(v) => setModal((p) => ({ ...p, vendor: v }))} />

              <SelectWithOther label="Machine Group" value={modal.machineGroup} setValue={(v) => setModal((p) => ({ ...p, machineGroup: v }))} baseOptions={MACHINE_GROUPS_BASE} />
              <SelectWithOther label="Tool Type" value={modal.toolType} setValue={(v) => setModal((p) => ({ ...p, toolType: v }))} baseOptions={TOOL_TYPES_BASE} />

              {isInsertType(modal.toolType) ? (
                <Input label="Pack Size (optional)" type="number" value={modal.packSize} onChange={(v) => setModal((p) => ({ ...p, packSize: v }))} error={errors.packSize} placeholder="e.g., 10" />
              ) : (
                <div />
              )}

              <div style={{ gridColumn: "1/-1" }}>
                <button className="btn" onClick={() => setEditShowAdvanced((s) => !s)} style={{ width: "100%", justifyContent: "space-between", display: "flex", alignItems: "center" }}>
                  <span>⚙️ Advanced fields</span>
                  <span style={{ fontSize: 12, opacity: 0.7 }}>{editShowAdvanced ? "Hide" : "Show"}</span>
                </button>

                {editShowAdvanced && (
                  <div className="card" style={{ marginTop: 10, padding: 14, background: "var(--card)", border: "1px solid var(--border)" }}>
                    <LocationSection value={modal.location} onChange={(loc) => setModal((p) => ({ ...p, location: loc }))} />
                    <div className="subtle" style={{ fontSize: 13, margin: "10px 0 6px" }}>
                      Geometry (advanced)
                    </div>
                    <GeometrySection
                      toolType={form.toolType}
                      geometry={form.geometry || {}}
                      setGeometry={(updater) => {
                        setForm((p) => {
                          const nextGeom = typeof updater === "function" ? updater(p.geometry || {}) : updater;
                          return { ...p, geometry: nextGeom };
                        });
                      }}
                    /></div>
                )}
              </div>
            </div>

            <div className="toolbar" style={{ marginTop: 16 }}>
              <button className="btn" onClick={() => setModalOpen(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={saveEdit}>Save</button>
            </div>
          </div>
        </div>
      )}

      {/* PO MODAL */}
      {poModalOpen && (
        <POModal tools={tools} queueItems={queue} onClose={() => setPOModalOpen(false)} onSubmit={createPO} />
      )}
    </div>
  );
}
