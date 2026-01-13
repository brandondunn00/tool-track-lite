// src/OperatorPull.jsx (Firestore-backed)
import React, { useEffect, useMemo, useRef, useState } from "react";
import "./modern-light.css";

import { db } from "./firebase";
import {
  addDoc,
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  limit,
  serverTimestamp,
  updateDoc,
  writeBatch,
} from "firebase/firestore";

const Input = ({ label, value, onChange, ...p }) => (
  <div className="input">
    <label>{label}</label>
    <input {...p} value={String(value ?? "")} onChange={(e) => onChange?.(e.target.value)} />
  </div>
);

const packDisplay = (qtyEach, packSize) => {
  const ps = Number(packSize);
  const q = Number(qtyEach) || 0;
  if (!ps || ps <= 1) return null;
  const packs = Math.floor(q / ps);
  const each = q % ps;
  return `${packs} pk + ${each} ea`;
};


const poStatusChip = (s) => {
  const map = {
    pending: ["low", "Pending"],
    approved: ["ok", "Approved"],
    ordered: ["ok", "Ordered"],
    received: ["ok", "Received"],
    paid: ["ok", "Paid"],
    cancelled: ["zero", "Cancelled"],
  };
  const v = map[String(s || "").toLowerCase()] || ["subtle", s || "—"];
  return <span className={`badge ${v[0]}`}>{v[1]}</span>;
};



export default function OperatorPull({ session }) {
  const [tools, setTools] = useState([]);
  const [search, setSearch] = useState("");
  const [toast, setToast] = useState("");

  // PO Status (read-only for operators)
  const [showPOStatus, setShowPOStatus] = useState(false);
  const [pos, setPos] = useState([]);

  useEffect(() => {
    const pq = query(collection(db, "purchaseOrders"), orderBy("updatedAt", "desc"), limit(20));
    const unsub = onSnapshot(pq, (snap) => {
      setPos(snap.docs.map((d) => ({ id: d.id, ...(d.data() || {}) })));
    });
    return () => unsub();
  }, []);

  // Simple barcode scan (keyboard wedge)
  const scanRef = useRef(null);
  const [scanValue, setScanValue] = useState("");
  const [scanMode, setScanMode] = useState(false);

  const note = (m) => {
    setToast(m);
    setTimeout(() => setToast(""), 2200);
  };

  useEffect(() => {
    const q = query(collection(db, "tools"), orderBy("updatedAt", "desc"));
    const unsub = onSnapshot(q, (snap) => {
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
          packSize: x.packSize || "",
          quantity: Number(x.qtyEach ?? x.quantity ?? 0) || 0,
          threshold: Number(x.thresholdEach ?? x.threshold ?? 0) || 0,
          location: x.location || {},
          trackingMode: x.trackingMode || "tracked",
        };
      });
      setTools(next);
    });
    return () => unsub();
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return tools;
    return tools.filter((t) => {
      const hay = [
        t.name, t.manufacturer, t.partNumber, t.barcode, t.description,
        t.machineGroup, t.toolType,
      ].filter(Boolean).join(" ").toLowerCase();
      return hay.includes(q);
    });
  }, [tools, search]);

  const beginScan = () => {
    setScanMode(true);
    setScanValue("");
    setTimeout(() => scanRef.current?.focus(), 0);
  };

  const pullTool = async (tool, qty = 1, jobNumber = "") => {
    if (!tool) return;
    const q = Number(qty) || 0;
    if (q <= 0) return;

    // Fetch current from local state (optimistic), but write safely: clamp at 0
    const nextQty = Math.max(0, (tool.quantity || 0) - q);

    const batch = writeBatch(db);
    if ((tool.trackingMode || "tracked") === "tracked") {
      batch.update(doc(db, "tools", tool.id), {
        qtyEach: nextQty,
        updatedAt: serverTimestamp(),
      });
    }
    batch.set(doc(collection(db, "transactions")), {
      toolId: tool.id,
      toolName: tool.name,
      type: "PULL",
      qtyEachDelta: -q,
      jobNumber: jobNumber || "",
      performedByUid: session?.user?.uid || null,
      performedByName: session?.profile?.displayName || session?.user?.email || "",
      createdAt: serverTimestamp(),
    });
    await batch.commit();
    note(`Pulled ${q} × ${tool.name} ✅`);
  };

  const requestReorder = async (tool) => {
    if (!tool) return;
    await addDoc(collection(db, "transactions"), {
      toolId: tool.id,
      toolName: tool.name,
      type: "ORDER_REQUEST",
      qtyEachDelta: 0,
      jobNumber: "",
      performedByUid: session?.user?.uid || null,
      performedByName: session?.profile?.displayName || session?.user?.email || "",
      createdAt: serverTimestamp(),
    });
    note(`Requested reorder for "${tool.name}"`);
  };

  return (
    <div className="app">
      {/* Hidden scan input */}
      <input
        ref={scanRef}
        value={scanValue}
        onChange={(e) => setScanValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key !== "Enter") return;
          const raw = String(scanValue || "").trim();
          if (!raw) return;
          const hit = tools.find((t) => String(t.barcode || "").trim() === raw);
          if (!hit) {
            note("Barcode not found.");
            setScanMode(false);
            setScanValue("");
            return;
          }
          // Minimal operator flow: pull 1 with job prompt
          const job = window.prompt(`Job number for pulling "${hit.name}"?`) || "";
          pullTool(hit, 1, job.trim());
          setScanMode(false);
          setScanValue("");
        }}
        onBlur={() => setScanMode(false)}
        style={{ position: "absolute", left: -9999, top: -9999, width: 1, height: 1, opacity: 0 }}
        aria-hidden="true"
      />

      <div className="card" style={{ padding: 16, marginBottom: 14 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 800 }}>👷 Operator — Pull Tools</div>
            <div className="subtle" style={{ marginTop: 4 }}>
              Search, or scan a tool barcode to pull 1.
            </div>
          </div>

          <div className="toolbar" style={{ gap: 10 }}>
            <button className="btn btn-primary" onClick={beginScan} title="Click then scan barcode">
              📟 Scan Barcode
            </button>
            <div className="subtle" style={{ fontSize: 12 }}>
              {scanMode ? "Ready to scan…" : ""}
            </div>
          </div>
        </div>

        <div style={{ marginTop: 12 }}>
          <Input
            label="Search"
            value={search}
            onChange={setSearch}
            placeholder="Search tools (name, part #, barcode, type…)"
          />
        </div>
      </div>

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
                const pack = packDisplay(t.quantity, t.packSize);
                return (
                  <tr key={t.id}>
                    <td>
                      <div style={{ fontWeight: 600 }}>{t.name}</div>
                      <div className="subtle">
                        {t.manufacturer || "—"} · {t.partNumber || "—"} {t.barcode ? `· ${t.barcode}` : ""}
                      </div>
                      {t.description && (
                        <div className="subtle" style={{ marginTop: 2 }}>{t.description}</div>
                      )}
                    </td>
                    <td>
                      {(t.quantity || 0)}
                      {pack && <div className="subtle" style={{ fontSize: 12 }}>{pack}</div>}
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
                          onClick={() => {
                            const job = window.prompt(`Job number for pulling "${t.name}"?`) || "";
                            pullTool(t, 1, job.trim());
                          }}
                          title="Pull 1 and log job #"
                        >
                          Pull 1
                        </button>
                        <button
                          className="btn"
                          onClick={() => requestReorder(t)}
                          title="Ask Purchasing/Admin to reorder"
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

      {toast && (
        <div className="toast" style={{ position: "fixed", bottom: 18, right: 18 }}>
          {toast}
        </div>
      )}
    
      {/* PO STATUS */}
      <div className="card" style={{ marginTop: 16 }}>
        <div
          style={{
            padding: 16,
            borderBottom: "1px solid var(--border)",
            background: "#dbeafe",
            cursor: "pointer",
            display: "flex",
            justifyContent: "space-between",
          }}
          onClick={() => setShowPOStatus((p) => !p)}
        >
          <strong style={{ color: "#1e3a8a" }}>PO Status</strong>
          <span style={{ color: "#1e3a8a" }}>{showPOStatus ? "−" : "+"}</span>
        </div>
        {showPOStatus && (
          <div style={{ padding: 16, maxHeight: 260, overflow: "auto" }}>
            {pos.length === 0 && <div className="subtle">No purchase orders yet</div>}
            {pos.map((po) => (
              <div key={po.id} style={{ padding: "10px 0", borderBottom: "1px dashed var(--border)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
                  <div style={{ fontWeight: 700, color: "var(--text)" }}>
                    PO {po.poNumber || "—"} {po.vendor ? `· ${po.vendor}` : ""}
                  </div>
                  {poStatusChip(po.status)}
                </div>
                <div className="subtle">
                  {po.projectJob || ""} {Array.isArray(po.requisitionIds) && po.requisitionIds.length ? `· Reqs: ${po.requisitionIds.length}` : ""}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

</div>
  );
}
