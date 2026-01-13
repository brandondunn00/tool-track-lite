// src/JobKitting.jsx (Firestore-backed)
import React, { useMemo, useEffect, useState } from "react";
import "./modern-light.css";

import { db } from "./firebase";
import {
  addDoc,
  collection,
  doc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";

/** ──────── HELPERS ──────── */
const packDisplay = (qtyEach, packSize) => {
  const ps = Number(packSize);
  const q = Number(qtyEach) || 0;
  if (!ps || ps <= 1) return null;
  const packs = Math.floor(q / ps);
  const each = q % ps;
  return `${packs} pk + ${each} ea`;
};

/** ──────── 2D TOOL SVG ──────── */
const ToolSVG = ({ type = "default" }) => {
  const svg = {
    Endmill: `<svg viewBox="0 0 100 200"><rect x="40" y="0" width="20" height="150" fill="currentColor"/><rect x="35" y="150" width="30" height="50" fill="currentColor" opacity="0.7"/><circle cx="50" cy="150" r="15" fill="currentColor" opacity="0.5"/></svg>`,
    Drill: `<svg viewBox="0 0 100 200"><rect x="45" y="0" width="10" height="140" fill="currentColor"/><path d="M50 140 L30 180 L70 180 Z" fill="currentColor" opacity="0.7"/><circle cx="50" cy="180" r="10" fill="currentColor" opacity="0.5"/></svg>`,
    Tap: `<svg viewBox="0 0 100 200"><rect x="45" y="0" width="10" height="120" fill="currentColor"/><path d="M50 120 L35 160 Q50 170 65 160 L50 120" fill="currentColor" opacity="0.7"/><circle cx="50" cy="160" r="12" fill="currentColor" opacity="0.5"/></svg>`,
    default: `<svg viewBox="0 0 100 200"><rect x="40" y="0" width="20" height="150" fill="currentColor"/><circle cx="50" cy="150" r="15" fill="currentColor" opacity="0.5"/></svg>`,
  };
  return (
    <div
      dangerouslySetInnerHTML={{ __html: svg[type] || svg.default }}
      style={{ width: 72, height: 140, margin: "0 auto", color: "var(--muted)" }}
    />
  );
};

/** ──────── FIELD COMPONENT ──────── */
function Field({ label, value, onChange, ...props }) {
  return (
    <label style={{ display: "grid", gap: 6 }}>
      <span className="subtle">{label}</span>
      <input
        {...props}
        value={String(value || "")}
        onChange={(e) => onChange?.(e.target.value)}
        style={{
          width: "100%",
          padding: "10px 12px",
          border: "1px solid var(--border)",
          borderRadius: 10,
          outline: "none",
          background: "var(--card)",
          color: "var(--text)",
        }}
      />
    </label>
  );
}

/** ──────── MAIN ──────── */
export default function JobKitting({ session }) {
  const [kits, setKits] = useState([]);
  const [tools, setTools] = useState([]);
  const [toast, setToast] = useState("");

  // Toggles
  const [showRecentKits, setShowRecentKits] = useState(false);
  const [showRecentPulls, setShowRecentPulls] = useState(false);

  // Popup
  const [popupOpen, setPopupOpen] = useState(false);
  const [selectedKit, setSelectedKit] = useState(null);
  const [toolDetail, setToolDetail] = useState(null);

  // Drafts

  const [newRequestOpen, setNewRequestOpen] = useState(false);
  const [requestDraft, setRequestDraft] = useState({
    manufacturer: "",
    partNumber: "",
    description: "",
    qty: 1,
    unitCost: 0,
    priority: "Normal",
    machineDown: false,
    dateRequiredBy: "",
    notes: "",
  });

  const [draft, setDraft] = useState({
    project: "",
    customer: "",
    partName: "",
    partNumber: "",
    machine: "",
    program: "",
    numOps: 5,
    tools: [],
    requestedItems: [],
    notes: "",
  });

  // Inventory filters
  const [inventorySearch, setInventorySearch] = useState("");
  const [filterMachine, setFilterMachine] = useState("");
  const [filterType, setFilterType] = useState("");

  // Drag state
  const [dragOverIndex, setDragOverIndex] = useState(null);
  const [draggedTile, setDraggedTile] = useState(null);

  const note = (m) => {
    setToast(m);
    setTimeout(() => setToast(""), 2000);
  };

  // Subscribe: tools + kits (Firestore)
  useEffect(() => {
    const tq = query(collection(db, "tools"), orderBy("updatedAt", "desc"));
    const unsubTools = onSnapshot(tq, (snap) => {
      const next = snap.docs.map((d) => {
        const x = d.data() || {};
        return {
          id: d.id,
          name: x.name || "",
          manufacturer: x.manufacturer || "",
          partNumber: x.partNumber || "",
          barcode: x.barcode || "",
          description: x.description || "",
          toolType: x.toolType || "",
          machineGroup: x.machineGroup || "",
          quantity: Number(x.qtyEach ?? 0) || 0,
          threshold: Number(x.thresholdEach ?? 0) || 0,
          packSize: x.packSize || "",
          geometry: x.geometry || {},
        };
      });
      setTools(next);
    });

    const kq = query(collection(db, "kits"), orderBy("updatedAt", "desc"));
    const unsubKits = onSnapshot(kq, (snap) => {
      const next = snap.docs.map((d) => ({ id: d.id, ...(d.data() || {}) }));
      setKits(next);
    });

    return () => {
      unsubTools();
      unsubKits();
    };
  }, []);

  // Initialize tool slots when numOps changes
  useEffect(() => {
    const count = parseInt(draft.numOps) || 5;
    setDraft((p) => ({
      ...p,
      tools: Array(count)
        .fill(null)
        .map((_, i) => p.tools[i] || { qty: 1 }),
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft.numOps]);

  // Close modal with Esc
  useEffect(() => {
    if (!popupOpen) return;
    const onKey = (e) => e.key === "Escape" && setPopupOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [popupOpen]);

  // Prevent background scroll while modal is open
  useEffect(() => {
    if (popupOpen) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = prev;
      };
    }
  }, [popupOpen]);

  const createKit = async () => {
    const payload = {
      project: draft.project || "",
      customer: draft.customer || "",
      partName: draft.partName || "",
      partNumber: draft.partNumber || "",
      machine: draft.machine || "",
      program: draft.program || "",
      numOps: Number(draft.numOps) || 5,
      notes: draft.notes || "",
      status: "draft",
      // Keep a denormalized tool list for easy operator pulling later.
      tools: (draft.tools || []).map((t) =>
        t?.id
          ? {
              toolId: t.id,
              name: t.name || "",
              manufacturer: t.manufacturer || "",
              partNumber: t.partNumber || "",
              barcode: t.barcode || "",
              toolType: t.toolType || "",
              machineGroup: t.machineGroup || "",
              qtyEachNeeded: Number(t.qty) || 1,
              notes: t.notes || "",
            }
          : null
      ),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      createdByUid: session?.user?.uid || null,
      createdByName: session?.profile?.displayName || session?.user?.email || "",
    };

    const ref = await addDoc(collection(db, "kits"), payload);
    const created = { id: ref.id, ...payload };
    setPopupOpen(false);
    setSelectedKit(created);
    note("Kit created!");
  };

  const printSheet = () => {
    if (!selectedKit) return;
    const win = window.open("", "_blank");
    // Keep the original QR behavior, but now the QR encodes the Firestore kit id
    win.document.write(`
      <html><body style="font-family:Arial;margin:40px">
        <h1>Toolly Setup Sheet</h1>
        <h2>${selectedKit.customer || ""} — ${selectedKit.partName || ""} (${selectedKit.partNumber || ""})</h2>
        <p><strong>Machine:</strong> ${selectedKit.machine || ""} | <strong>Program:</strong> ${selectedKit.program || ""}</p>
        <table border="1" style="width:100%;border-collapse:collapse;margin:20px 0">
          <tr style="background:#6366f1;color:white"><th>#</th><th>Tool</th><th>Qty</th><th>Notes</th></tr>
          ${(selectedKit.tools || []).map((t,i) => t ? `<tr><td>T${i+1}</td><td>${t.name || "—"}</td><td>${t.qtyEachNeeded || t.qty || 1}</td><td>${t.notes || ""}</td></tr>` : "").join("")}
        </table>
        <div style="text-align:center">
          <img src="https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${selectedKit.id}" alt="QR Code for kit" />
          <p>Scan to pull kit</p>
        </div>
        <script>window.print()</script>
      </body></html>
    `);
  };

  // DRAG HANDLERS
  const handleDragStart = (e, tool) => {
    e.dataTransfer.setData("tool", JSON.stringify(tool));
  };

  const handleTileDragStart = (e, index) => {
    setDraggedTile(index);
  };

  const handleDrop = (e, index) => {
    e.preventDefault();
    setDragOverIndex(null);

    const toolData = e.dataTransfer.getData("tool");
    if (toolData) {
      const tool = JSON.parse(toolData);
      setDraft((p) => ({
        ...p,
        tools: p.tools.map((t, i) =>
          i === index ? { ...tool, qty: t?.qty || 1, notes: t?.notes || "" } : t
        ),
      }));
      setToolDetail({ index, ...tool });
      note(`${tool.name} → T${index + 1}`);
      // Reorder logic moved elsewhere (transactions). For now, just a UI hint.
    } else if (draggedTile !== null && draggedTile !== index) {
      setDraft((p) => {
        const next = [...p.tools];
        [next[draggedTile], next[index]] = [next[index], next[draggedTile]];
        return { ...p, tools: next };
      });
    }
    setDraggedTile(null);
  };

  const handleDragOver = (e, index) => {
    e.preventDefault();
    setDragOverIndex(index);
  };

  const handleDragLeave = () => setDragOverIndex(null);

  // FILTERED TOOLS
  const filteredTools = useMemo(() => {
    return tools.filter((t) => {
      const q = inventorySearch.toLowerCase();
      const hay = `${t.name} ${t.manufacturer} ${t.partNumber} ${t.barcode} ${t.description}`.toLowerCase();
      return (
        (!q || hay.includes(q)) &&
        (!filterMachine || t.machineGroup === filterMachine) &&
        (!filterType || t.toolType === filterType)
      );
    });
  }, [tools, inventorySearch, filterMachine, filterType]);

  const machineOptions = [...new Set(tools.map((t) => t.machineGroup))].filter(Boolean);
  const typeOptions = [...new Set(tools.map((t) => t.toolType))].filter(Boolean);

  // Layout: when a tool is selected, open a 3rd column for the inspector
  const mainCols = toolDetail ? "1.2fr 1.3fr 0.8fr" : "1.1fr 1.3fr";

  // Recent pulls panel: show the latest 20 transactions of type PULL
  const [recentPulls, setRecentPulls] = useState([]);
  useEffect(() => {
    const tq = query(collection(db, "transactions"), orderBy("createdAt", "desc"), limit(20));
    const unsub = onSnapshot(tq, (snap) => {
      const next = snap.docs
        .map((d) => ({ id: d.id, ...(d.data() || {}) }))
        .filter((x) => x.type === "PULL");
      setRecentPulls(next);
    });
    return () => unsub();
  }, []);

  return (
    <div className="app">
      {/* TOGGLED PANELS */}
      <div style={{ margin: "0 24px 12px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        {/* RECENT KITS */}
        <div className="card">
          <div
            style={{
              padding: 16,
              borderBottom: "1px solid var(--border)",
              background: "#fef3c7",
              cursor: "pointer",
              display: "flex",
              justifyContent: "space-between",
            }}
            onClick={() => setShowRecentKits((p) => !p)}
          >
            <strong style={{ color: "#78350f" }}>Recently Opened</strong>
            <span style={{ color: "#78350f" }}>{showRecentKits ? "−" : "+"}</span>
          </div>
          {showRecentKits && (
            <ul style={{ margin: 0, padding: 16, listStyle: "none", maxHeight: 200, overflow: "auto" }}>
              {kits.length === 0 && <li className="subtle">No kits yet — create one!</li>}
              {kits.slice(0, 8).map((k) => (
                <li
                  key={k.id}
                  onClick={() => setSelectedKit(k)}
                  style={{
                    padding: "8px 0",
                    borderBottom: "1px dashed var(--border)",
                    cursor: "pointer",
                  }}
                >
                  <div style={{ fontWeight: 600, color: "var(--text)" }}>{k.partName || "—"}</div>
                  <div className="subtle">{k.customer || "—"} · {k.partNumber || "—"}</div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* RECENT PULLS */}
        <div className="card">
          <div
            style={{
              padding: 16,
              borderBottom: "1px solid var(--border)",
              background: "#dbeafe",
              cursor: "pointer",
              display: "flex",
              justifyContent: "space-between",
            }}
            onClick={() => setShowRecentPulls((p) => !p)}
          >
            <strong style={{ color: "#1e3a8a" }}>Recent Inventory Pulls</strong>
            <span style={{ color: "#1e3a8a" }}>{showRecentPulls ? "−" : "+"}</span>
          </div>
          {showRecentPulls && (
            <ul style={{ margin: 0, padding: 16, listStyle: "none", maxHeight: 200, overflow: "auto" }}>
              {recentPulls.length === 0 && <li className="subtle">No pulls yet</li>}
              {recentPulls.map((p) => (
                <li key={p.id} style={{ padding: "8px 0", borderBottom: "1px dashed var(--border)" }}>
                  <div style={{ fontWeight: 600, color: "var(--text)" }}>
                    {p.toolName || "Tool"} — {Math.abs(Number(p.qtyEachDelta || 0))} ea
                  </div>
                  <div className="subtle">
                    {p.performedByName || "—"} {p.jobNumber ? `· Job ${p.jobNumber}` : ""}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* CREATE NEW KIT BUTTON */}
      <div style={{ margin: "0 24px 24px", display: "flex", justifyContent: "flex-end" }}>
        <button className="btn btn-primary" onClick={() => setPopupOpen(true)}>
          + Create New Kit
        </button>
      </div>

      {/* POPUP: INVENTORY + TILES + RIGHT-SIDE INSPECTOR */}
      {popupOpen && (
        <div className="modal-backdrop" onClick={() => setPopupOpen(false)}>
          <div
            className="card"
            style={{
              width: "min(1920px, 98vw)",
              height: "92vh",
              padding: 0,
              display: "flex",
              flexDirection: "column",
              background: "var(--card)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* HEADER */}
            <div style={{ padding: 24, borderBottom: "1px solid var(--border)", background: "var(--card)" }}>
              <h2 style={{ margin: 0, color: "var(--text)" }}>Create New Job Kit</h2>
            </div>

            {/* TOP FORM */}
            <div
              style={{
                padding: 24,
                display: "grid",
                gridTemplateColumns: "1fr 1fr 1fr 1fr",
                gap: 16,
                borderBottom: "1px solid var(--border)",
                background: "var(--card)",
              }}
            >
              <Field label="Project" value={draft.project} onChange={(v) => setDraft((p) => ({ ...p, project: v }))} />
              <Field label="Customer" value={draft.customer} onChange={(v) => setDraft((p) => ({ ...p, customer: v }))} />
              <Field label="Part Name" value={draft.partName} onChange={(v) => setDraft((p) => ({ ...p, partName: v }))} />
              <Field label="Part Number" value={draft.partNumber} onChange={(v) => setDraft((p) => ({ ...p, partNumber: v }))} />
              <Field label="Machine" value={draft.machine} onChange={(v) => setDraft((p) => ({ ...p, machine: v }))} />
              <Field label="Program #" value={draft.program} onChange={(v) => setDraft((p) => ({ ...p, program: v }))} />
              <Field
                label="Number of Tools"
                type="number"
                min="1"
                max="31"
                value={draft.numOps}
                onChange={(v) => setDraft((p) => ({ ...p, numOps: v }))}
              />
            </div>

            {/* MAIN */}
            <div
              style={{
                flex: 1,
                display: "grid",
                gridTemplateColumns: mainCols,
                gap: 0,
                overflow: "hidden",
                background: "var(--card)",
              }}
            >
              {/* LEFT: INVENTORY */}
              <div style={{ padding: 24, borderRight: "1px solid var(--border)", overflow: "auto", background: "var(--card)" }}>
                <strong style={{ fontSize: 16, display: "block", marginBottom: 12, color: "var(--text)" }}>Tool Inventory</strong>

                <div style={{ display: "flex", gap: 10, margin: "10px 0 14px" }}>
                  <button className="btn" onClick={() => setNewRequestOpen(true)}>
                    + Request new tool (not in inventory)
                  </button>
                  <div className="subtle" style={{ alignSelf: "center" }}>
                    Requests are sent to Requisitions for approval/PO.
                  </div>
                </div>
                <input
                  placeholder="Search tools…"
                  style={{
                    width: "100%",
                    padding: 10,
                    borderRadius: 8,
                    border: "1px solid var(--border)",
                    marginBottom: 12,
                    background: "var(--card)",
                    color: "var(--text)",
                  }}
                  value={inventorySearch}
                  onChange={(e) => setInventorySearch(e.target.value)}
                />
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 12 }}>
                  <select
                    value={filterMachine}
                    onChange={(e) => setFilterMachine(e.target.value)}
                    style={{ padding: 8, borderRadius: 8, border: "1px solid var(--border)", background: "var(--card)", color: "var(--text)" }}
                  >
                    <option value="">All Machines</option>
                    {machineOptions.map((m) => (
                      <option key={m}>{m}</option>
                    ))}
                  </select>
                  <select
                    value={filterType}
                    onChange={(e) => setFilterType(e.target.value)}
                    style={{ padding: 8, borderRadius: 8, border: "1px solid var(--border)", background: "var(--card)", color: "var(--text)" }}
                  >
                    <option value="">All Types</option>
                    {typeOptions.map((t) => (
                      <option key={t}>{t}</option>
                    ))}
                  </select>
                </div>

                <div>
                  {filteredTools.map((tool) => {
                    const isLow = tool.quantity <= tool.threshold;
                    const isOut = tool.quantity === 0;
                    const pack = packDisplay(tool.quantity, tool.packSize);
                    return (
                      <div
                        key={tool.id}
                        draggable
                        onDragStart={(e) => handleDragStart(e, tool)}
                        style={{
                          padding: 12,
                          borderBottom: "1px solid var(--border)",
                          cursor: "grab",
                          background: dragOverIndex !== null ? "var(--accent-50)" : "var(--card)",
                          borderRadius: 8,
                          marginBottom: 8,
                        }}
                      >
                        <div style={{ fontWeight: 600, color: "var(--text)" }}>{tool.name}</div>
                        <div className="subtle">
                          {tool.manufacturer} · {tool.partNumber} · {tool.quantity} in stock
                          {pack ? ` (${pack})` : ""}
                        </div>
                        <div style={{ marginTop: 4 }}>
                          {isOut ? (
                            <span className="badge zero">Out</span>
                          ) : isLow ? (
                            <span className="badge low">Low</span>
                          ) : (
                            <span className="badge ok">OK</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* MIDDLE: TILES */}
              <div style={{ padding: 24, overflow: "auto", background: "var(--card)" }}>
                <strong style={{ display: "block", marginBottom: 8, color: "var(--text)" }}>Tool Tiles</strong>
                <div style={{ border: "2px dashed var(--border)", borderRadius: 12, padding: 24, background: "var(--bg)", minHeight: 400 }}>
                  <p style={{ margin: "0 0 16px", color: "var(--muted)", textAlign: "center" }}>
                    Drag tools from left → T1-T{draft.numOps}
                  </p>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(80px,1fr))", gap: 12 }}>
                    {draft.tools.map((t, i) => (
                      <div
                        key={i}
                        draggable={!!t?.name}
                        onDragStart={(e) => handleTileDragStart(e, i)}
                        onDrop={(e) => handleDrop(e, i)}
                        onDragOver={(e) => handleDragOver(e, i)}
                        onDragLeave={handleDragLeave}
                        onClick={() => t?.name && setToolDetail({ index: i, ...t })}
                        style={{
                          background: "var(--card)",
                          border: dragOverIndex === i ? "3px dashed var(--accent)" : "2px solid var(--border)",
                          borderRadius: 12,
                          padding: 12,
                          textAlign: "center",
                          cursor: t?.name ? "grab" : "pointer",
                          boxShadow: t?.name ? "var(--shadow)" : "none",
                          transition: "all 0.2s",
                        }}
                      >
                        <div style={{ fontWeight: 700, fontSize: 16, color: "var(--text)" }}>T{i + 1}</div>
                        {t?.name ? (
                          <>
                            <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 4 }}>{t.name.split(" ")[0]}</div>
                            <div style={{ fontSize: 10, marginTop: 4 }}>
                              {t.quantity === 0 ? (
                                <span className="badge zero">Out</span>
                              ) : t.quantity <= t.threshold ? (
                                <span className="badge low">Low</span>
                              ) : (
                                <span className="badge ok">OK</span>
                              )}
                            </div>
                          </>
                        ) : (
                          <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 4 }}>—</div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                <textarea
                  placeholder="Job notes, speeds/feeds, coolant..."
                  style={{
                    width: "100%",
                    marginTop: 20,
                    padding: 16,
                    borderRadius: 12,
                    border: "1px solid var(--border)",
                    minHeight: 100,
                    background: "var(--card)",
                    color: "var(--text)",
                  }}
                  value={draft.notes}
                  onChange={(e) => setDraft((p) => ({ ...p, notes: e.target.value }))}
                />
              </div>

              {/* RIGHT: TOOL INSPECTOR */}
              {toolDetail && (
                <div style={{ padding: 24, borderLeft: "1px solid var(--border)", overflow: "auto", background: "var(--card)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                    <h3 style={{ margin: 0, color: "var(--text)" }}>Tool Info</h3>
                    <button className="btn" onClick={() => setToolDetail(null)}>
                      Close
                    </button>
                  </div>

                  <div className="subtle" style={{ marginBottom: 12 }}>
                    Editing: <strong>T{toolDetail.index + 1}</strong> {toolDetail.name ? `— ${toolDetail.name}` : ""}
                  </div>

                  <div style={{ display: "grid", placeItems: "center", margin: "8px 0 16px" }}>
                    <div style={{ width: 72, height: 140 }}>
                      <ToolSVG type={toolDetail.toolType} />
                    </div>
                  </div>

                  {/* Minimal per-slot fields */}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, fontSize: 14 }}>
                    <Field
                      label="Qty needed"
                      type="number"
                      min="1"
                      value={draft.tools[toolDetail.index]?.qty || 1}
                      onChange={(v) =>
                        setDraft((p) => ({
                          ...p,
                          tools: p.tools.map((t, i) => (i === toolDetail.index ? { ...(t || {}), qty: Number(v) || 1 } : t)),
                        }))
                      }
                    />
                    <Field
                      label="Notes"
                      value={draft.tools[toolDetail.index]?.notes || ""}
                      onChange={(v) =>
                        setDraft((p) => ({
                          ...p,
                          tools: p.tools.map((t, i) => (i === toolDetail.index ? { ...(t || {}), notes: v } : t)),
                        }))
                      }
                    />
                  </div>

                  <button className="btn btn-primary" style={{ marginTop: 16, width: "100%" }} onClick={() => setToolDetail(null)}>
                    Done
                  </button>
                </div>
              )}
            </div>

            {/* FOOTER */}
            <div
              style={{
                padding: 24,
                borderTop: "1px solid var(--border)",
                background: "var(--card)",
                display: "flex",
                justifyContent: "space-between",
              }}
            >
              <button className="btn" onClick={() => setPopupOpen(false)}>
                Cancel
              </button>
              <div style={{ display: "flex", gap: 12 }}>
                <button className="btn btn-primary" onClick={createKit}>
                  Save Kit
                </button>
                <button
                  className="btn btn-success"
                  onClick={async () => {
                    await createKit();
                    // selectedKit is set after createKit; printing is best from selecting list
                    note("Kit saved. Open it from Recent Kits to print.");
                  }}
                >
                  Create Setup Sheet
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* If a kit is selected (from recent), offer print */}
      {selectedKit && (
        <div className="card" style={{ margin: "0 24px 16px", padding: 14, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontWeight: 800 }}>{selectedKit.partName || "Kit"}</div>
            <div className="subtle">{selectedKit.customer || "—"} · {selectedKit.partNumber || "—"}</div>
          </div>
          <button className="btn btn-primary" onClick={printSheet}>Print setup sheet</button>
        </div>
      )}

      {/* TOAST */}
      
      {/* NEW TOOL REQUEST MODAL */}
      {newRequestOpen && (
        <div className="modal-backdrop" onClick={() => setNewRequestOpen(false)}>
          <div className="card" style={{ width: "min(900px, 96vw)", padding: 0 }} onClick={(e) => e.stopPropagation()}>
            <div style={{ padding: 18, borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ fontSize: 18, fontWeight: 900, color: "var(--text)" }}>Request tool not in inventory</div>
                <div className="subtle">This will be added to the kit and submitted as a requisition when you save the kit.</div>
              </div>
              <div style={{ display: "flex", gap: 10 }}>
                <button className="btn" onClick={() => setNewRequestOpen(false)}>Cancel</button>
                <button
                  className="btn btn-primary"
                  onClick={() => {
                    const it = {
                      manufacturer: requestDraft.manufacturer,
                      partNumber: requestDraft.partNumber,
                      description: requestDraft.description,
                      qty: Number(requestDraft.qty) || 1,
                      unitCost: Number(requestDraft.unitCost) || 0,
                      priority: requestDraft.priority,
                      notes: requestDraft.notes,
                    };
                    if (!it.description && !it.partNumber) {
                      note("Enter at least description or part #");
                      return;
                    }
                    setDraft((p) => ({ ...p, requestedItems: [...(p.requestedItems || []), it] }));
                    setRequestDraft({ manufacturer:"", partNumber:"", description:"", qty:1, unitCost:0, priority:"Normal", machineDown:false, dateRequiredBy:"", notes:"" });
                    setNewRequestOpen(false);
                    note("Added request to kit ✅");
                  }}
                >
                  Add to kit
                </button>
              </div>
            </div>

            <div style={{ padding: 18, display: "grid", gap: 12 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <Field label="Manufacturer" value={requestDraft.manufacturer} onChange={(v) => setRequestDraft((p) => ({ ...p, manufacturer: v }))} />
                <Field label="Part Number" value={requestDraft.partNumber} onChange={(v) => setRequestDraft((p) => ({ ...p, partNumber: v }))} />
              </div>
              <Field label="Description" value={requestDraft.description} onChange={(v) => setRequestDraft((p) => ({ ...p, description: v }))} />
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
                <Field label="Qty" type="number" value={requestDraft.qty} onChange={(v) => setRequestDraft((p) => ({ ...p, qty: v }))} />
                <Field label="Unit Cost (optional)" type="number" value={requestDraft.unitCost} onChange={(v) => setRequestDraft((p) => ({ ...p, unitCost: v }))} />
                <label style={{ display: "grid", gap: 6 }}>
                  <span className="subtle">Priority</span>
                  <select
                    value={requestDraft.priority}
                    onChange={(e) => setRequestDraft((p) => ({ ...p, priority: e.target.value }))}
                    style={{ padding: "10px 12px", border: "1px solid var(--border)", borderRadius: 10, background: "var(--card)", color: "var(--text)" }}
                  >
                    {["Critical", "High", "Normal", "Low"].map((x) => <option key={x} value={x}>{x}</option>)}
                  </select>
                </label>
              </div>
              <Field label="Notes" value={requestDraft.notes} onChange={(v) => setRequestDraft((p) => ({ ...p, notes: v }))} />
              <div className="card" style={{ padding: 12 }}>
                <div style={{ fontWeight: 800, marginBottom: 6 }}>Requests in this kit</div>
                {(draft.requestedItems || []).length === 0 ? (
                  <div className="subtle">None yet.</div>
                ) : (
                  <ul style={{ margin: 0, paddingLeft: 18 }}>
                    {(draft.requestedItems || []).map((it, i) => (
                      <li key={i} className="subtle" style={{ marginBottom: 6 }}>
                        {it.manufacturer} {it.partNumber} — {it.description} · Qty {it.qty}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

{toast && (
        <div className="toast">
          <span>✅</span>
          <span>{toast}</span>
        </div>
      )}
    </div>
  );
}
