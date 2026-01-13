// src/Requisitions.jsx
import React, { useEffect, useMemo, useState } from "react";
import "./modern-light.css";
import { db } from "./firebase";
import {
  addDoc,
  arrayUnion,
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  writeBatch,
} from "firebase/firestore";

const ROLES = ["operator", "buyer", "purchasing", "setup", "manager", "cfo", "admin"];
const canManagerApprove = (role) => ["manager", "cfo", "admin"].includes(role);
const canCFOApprove = (role) => ["cfo", "admin"].includes(role);
const canCreatePO = (role) => ["purchasing", "manager", "cfo", "admin"].includes(role);

const Input = ({ label, value, onChange, ...p }) => (
  <div className="input">
    <label>{label}</label>
    <input {...p} value={String(value ?? "")} onChange={(e) => onChange?.(e.target.value)} />
  </div>
);

const Select = ({ label, value, onChange, options }) => (
  <div className="input">
    <label>{label}</label>
    <select value={value ?? ""} onChange={(e) => onChange?.(e.target.value)}>
      {options.map((o) => (
        <option key={o} value={o}>{o}</option>
      ))}
    </select>
  </div>
);

const statusChip = (s) => {
  const map = {
    draft: ["badge", "subtle", "Draft"],
    submitted: ["badge", "low", "Submitted"],
    approved_manager: ["badge", "ok", "Mgr Approved"],
    approved_cfo: ["badge", "ok", "CFO Approved"],
    po_created: ["badge", "ok", "PO Created"],
    ordered: ["badge", "ok", "Ordered"],
    received: ["badge", "ok", "Received"],
    rejected: ["badge", "zero", "Rejected"],
  };
  const v = map[s] || ["badge", "subtle", s || "—"];
  return <span className={`${v[0]} ${v[1]}`}>{v[2]}</span>;
};

const money = (n) => {
  const x = Number(n) || 0;
  return x.toLocaleString(undefined, { style: "currency", currency: "USD" });
};

export default function Requisitions({ session }) {
  const role = session?.role || "operator";
  const [reqs, setReqs] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  const [toast, setToast] = useState("");

  const [openReq, setOpenReq] = useState(false);
  const [reqForm, setReqForm] = useState({
    department: "",
    type: "Disp. Tooling",
    otherType: "",
    projectJob: "",
    customer: "",
    machineDown: "No",
    dateRequiredBy: "",
    notes: "",
    items: [{ manufacturer: "", partNumber: "", description: "", qty: 1, unitCost: 0 }],
  });

  const [openPO, setOpenPO] = useState(false);
  const [poForm, setPoForm] = useState({
    poNumber: "",
    vendor: "",
    shippingType: "Standard",
    shippingCost: 0,
    notes: "",
    projectJob: "",
  });

  const note = (m) => {
    setToast(m);
    setTimeout(() => setToast(""), 2200);
  };

  useEffect(() => {
    const q = query(collection(db, "requisitions"), orderBy("updatedAt", "desc"));
    const unsub = onSnapshot(q, (snap) => {
      setReqs(snap.docs.map((d) => ({ id: d.id, ...(d.data() || {}) })));
    });
    return () => unsub();
  }, []);

  const totalsByReq = useMemo(() => {
    const out = {};
    for (const r of reqs) {
      const items = Array.isArray(r.items) ? r.items : [];
      const total = items.reduce((a, it) => a + (Number(it.qty) || 0) * (Number(it.unitCost) || 0), 0);
      out[r.id] = total;
    }
    return out;
  }, [reqs]);

  const selectedReqs = useMemo(
    () => reqs.filter((r) => selectedIds.includes(r.id)),
    [reqs, selectedIds]
  );

  const selectedTotal = useMemo(
    () => selectedReqs.reduce((a, r) => a + (totalsByReq[r.id] || 0), 0),
    [selectedReqs, totalsByReq]
  );

  const createRequisition = async () => {
    if (!reqForm.projectJob.trim()) return note("Project / Job is required");
    const cleanItems = (reqForm.items || [])
      .map((it) => ({
        manufacturer: (it.manufacturer || "").trim(),
        partNumber: (it.partNumber || "").trim(),
        description: (it.description || "").trim(),
        qty: Math.max(1, Number(it.qty) || 1),
        unitCost: Math.max(0, Number(it.unitCost) || 0),
        toolId: it.toolId || null,
      }))
      .filter((it) => it.description || it.partNumber || it.manufacturer);

    if (cleanItems.length === 0) return note("Add at least one line item");

    await addDoc(collection(db, "requisitions"), {
      department: reqForm.department.trim(),
      type: reqForm.type,
      otherType: reqForm.type === "Other" ? reqForm.otherType.trim() : "",
      projectJob: reqForm.projectJob.trim(),
      customer: reqForm.customer.trim(),
      machineDown: reqForm.machineDown === "Yes",
      dateRequiredBy: reqForm.dateRequiredBy || "",
      notes: reqForm.notes || "",
      items: cleanItems,
      status: "submitted",
      approvals: {},
      linkedPOIds: [],
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      createdByUid: session?.user?.uid || null,
      createdByName: session?.profile?.displayName || session?.user?.email || "",
    });
    setOpenReq(false);
    note("Requisition submitted ✅");
  };

  const setReqStatus = async (reqId, patch) => {
    await updateDoc(doc(db, "requisitions", reqId), { ...patch, updatedAt: serverTimestamp() });
  };

  const approveManager = async (r) => {
    if (!canManagerApprove(role)) return note("Not permitted");
    await setReqStatus(r.id, {
      status: "approved_manager",
      approvals: {
        ...(r.approvals || {}),
        manager: {
          uid: session?.user?.uid || null,
          name: session?.profile?.displayName || session?.user?.email || "",
          at: serverTimestamp(),
        },
      },
    });
    note("Manager approved ✅");
  };

  const approveCFO = async (r) => {
    if (!canCFOApprove(role)) return note("Not permitted");
    await setReqStatus(r.id, {
      status: "approved_cfo",
      approvals: {
        ...(r.approvals || {}),
        cfo: {
          uid: session?.user?.uid || null,
          name: session?.profile?.displayName || session?.user?.email || "",
          at: serverTimestamp(),
        },
      },
    });
    note("CFO approved ✅");
  };

  const openCreatePO = () => {
    if (!canCreatePO(role)) return note("Not permitted");
    const ok = selectedReqs.length > 0 && selectedReqs.every((r) => r.status === "approved_cfo" || r.status === "approved_manager");
    if (!ok) return note("Select approved requisitions");
    const pj = selectedReqs[0]?.projectJob || "";
    setPoForm((p) => ({ ...p, projectJob: pj }));
    setOpenPO(true);
  };

  const createPOFromSelected = async () => {
    if (!poForm.poNumber.trim()) return note("PO Number is required");
    if (!poForm.projectJob.trim()) return note("Project / Job is required");
    if (selectedReqs.length === 0) return note("Select requisitions");

    const lineItems = [];
    for (const r of selectedReqs) {
      for (const it of (r.items || [])) {
        lineItems.push({
          toolId: it.toolId || null,
          manufacturer: it.manufacturer || "",
          partNumber: it.partNumber || "",
          description: it.description || "",
          qty: Math.max(1, Number(it.qty) || 1),
          unitCost: Math.max(0, Number(it.unitCost) || 0),
          sourceReqIds: [r.id],
        });
      }
    }

    const batch = writeBatch(db);
    const poRef = doc(collection(db, "purchaseOrders"));
    const subtotal = lineItems.reduce((a, it) => a + (Number(it.qty) || 0) * (Number(it.unitCost) || 0), 0);
    const shippingCost = Math.max(0, Number(poForm.shippingCost) || 0);
    const total = subtotal + shippingCost;

    batch.set(poRef, {
      poNumber: poForm.poNumber.trim(),
      vendor: poForm.vendor.trim(),
      projectJob: poForm.projectJob.trim(),
      shippingType: poForm.shippingType,
      shippingCost,
      notes: poForm.notes || "",
      status: "pending",
      requisitionIds: selectedReqs.map((r) => r.id),
      items: lineItems.map((it) => ({ ...it, subtotal: (Number(it.qty)||0) * (Number(it.unitCost)||0) })),
      subtotal,
      total,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      createdByUid: session?.user?.uid || null,
      createdByName: session?.profile?.displayName || session?.user?.email || "",
    });

    for (const r of selectedReqs) {
      batch.update(doc(db, "requisitions", r.id), {
        status: "po_created",
        linkedPOIds: arrayUnion(poRef.id),
        updatedAt: serverTimestamp(),
      });
    }

    await batch.commit();
    setOpenPO(false);
    setSelectedIds([]);
    note("PO created ✅");
  };

  return (
    <div className="app">
      <div className="card" style={{ padding: 16, marginBottom: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 900 }}>🧾 Purchase Requisitions</div>
            <div className="subtle" style={{ marginTop: 4 }}>
              Submit requests → approve → optionally bundle multiple requisitions into one PO.
            </div>
          </div>
          <div className="toolbar" style={{ gap: 10 }}>
            <button className="btn btn-primary" onClick={() => setOpenReq(true)}>＋ New Requisition</button>
            <button className="btn" onClick={openCreatePO} disabled={selectedReqs.length === 0}>
              Create PO from selected ({selectedReqs.length})
            </button>
          </div>
        </div>
      </div>

      <div className="card table-wrap">
        <div className="table-scroll">
          <table className="table">
            <thead>
              <tr>
                <th style={{ width: 40 }} />
                <th>Project / Job</th>
                <th>Type</th>
                <th>Status</th>
                <th>Total</th>
                <th>Requested by</th>
                <th style={{ textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {reqs.length === 0 && (
                <tr><td colSpan={7} className="subtle">No requisitions yet.</td></tr>
              )}
              {reqs.map((r) => {
                const checked = selectedIds.includes(r.id);
                return (
                  <tr key={r.id}>
                    <td>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(e) => {
                          const on = e.target.checked;
                          setSelectedIds((p) => on ? [...p, r.id] : p.filter((x) => x !== r.id));
                        }}
                      />
                    </td>
                    <td>
                      <div style={{ fontWeight: 700 }}>{r.projectJob || "—"}</div>
                      <div className="subtle">{r.customer || ""} {r.machineDown ? "· Machine Down" : ""}</div>
                    </td>
                    <td>{r.type === "Other" ? `Other: ${r.otherType || ""}` : (r.type || "—")}</td>
                    <td>{statusChip(r.status)}</td>
                    <td>{money(totalsByReq[r.id] || 0)}</td>
                    <td className="subtle">{r.createdByName || "—"}</td>
                    <td style={{ textAlign: "right" }}>
                      <div className="toolbar" style={{ justifyContent: "flex-end" }}>
                        <button className="btn" disabled={!canManagerApprove(role) || r.status !== "submitted"} onClick={() => approveManager(r)}>
                          Manager approve
                        </button>
                        <button className="btn" disabled={!canCFOApprove(role) || !(r.status === "approved_manager" || r.status === "submitted")} onClick={() => approveCFO(r)}>
                          CFO approve
                        </button>
                        <button className="btn" onClick={() => setReqStatus(r.id, { status: "rejected" })} disabled={!canManagerApprove(role) || r.status === "received"}>
                          Reject
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {selectedReqs.length > 0 && (
          <div style={{ padding: 12, borderTop: "1px solid var(--border)", display: "flex", justifyContent: "space-between" }}>
            <div className="subtle">
              Selected total: <b>{money(selectedTotal)}</b>
            </div>
            <div className="subtle">
              Only approved requisitions can be converted to a PO.
            </div>
          </div>
        )}
      </div>

      {/* New Requisition Modal */}
      {openReq && (
        <div className="modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) setOpenReq(false); }}>
          <div className="modal card" style={{ width: "min(1100px, 96vw)" }}>
            <div style={{ padding: 14, borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", gap: 12 }}>
              <div>
                <div style={{ fontSize: 18, fontWeight: 900 }}>New Purchase Requisition</div>
                <div className="subtle" style={{ marginTop: 4 }}>Use this when tools/materials need approval before ordering.</div>
              </div>
              <div className="toolbar" style={{ gap: 8 }}>
                <button className="btn" onClick={() => setOpenReq(false)}>Cancel</button>
                <button className="btn btn-primary" onClick={createRequisition}>Submit</button>
              </div>
            </div>

            <div style={{ padding: 14, display: "grid", gap: 14 }}>
              <div className="form-grid" style={{ gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
                <Input label="Department" value={reqForm.department} onChange={(v) => setReqForm((p) => ({ ...p, department: v }))} />
                <Select label="Type" value={reqForm.type} onChange={(v) => setReqForm((p) => ({ ...p, type: v }))} options={["Disp. Tooling", "Raw Material", "Repairs-Maintenance", "Other"]} />
                {reqForm.type === "Other" ? (
                  <Input label="Other (type)" value={reqForm.otherType} onChange={(v) => setReqForm((p) => ({ ...p, otherType: v }))} />
                ) : <div />}

                <Input label="Project / Job *" value={reqForm.projectJob} onChange={(v) => setReqForm((p) => ({ ...p, projectJob: v }))} />
                <Input label="Customer" value={reqForm.customer} onChange={(v) => setReqForm((p) => ({ ...p, customer: v }))} />
                <Select label="Machine down?" value={reqForm.machineDown} onChange={(v) => setReqForm((p) => ({ ...p, machineDown: v }))} options={["No", "Yes"]} />

                <Input label="Date required by" type="date" value={reqForm.dateRequiredBy} onChange={(v) => setReqForm((p) => ({ ...p, dateRequiredBy: v }))} />
              </div>

              <div>
                <div style={{ fontWeight: 800, marginBottom: 8 }}>Line items</div>
                <div className="card" style={{ padding: 12 }}>
                  {(reqForm.items || []).map((it, idx) => (
                    <div key={idx} className="form-grid" style={{ gridTemplateColumns: "1fr 1fr 2fr 120px 140px 48px", gap: 10, alignItems: "end", marginBottom: 10 }}>
                      <Input label="Mfr" value={it.manufacturer} onChange={(v) => setReqForm((p) => ({ ...p, items: p.items.map((x,i)=> i===idx ? { ...x, manufacturer: v } : x) }))} />
                      <Input label="Part #" value={it.partNumber} onChange={(v) => setReqForm((p) => ({ ...p, items: p.items.map((x,i)=> i===idx ? { ...x, partNumber: v } : x) }))} />
                      <Input label="Item / Service" value={it.description} onChange={(v) => setReqForm((p) => ({ ...p, items: p.items.map((x,i)=> i===idx ? { ...x, description: v } : x) }))} />
                      <Input label="Qty" type="number" value={it.qty} onChange={(v) => setReqForm((p) => ({ ...p, items: p.items.map((x,i)=> i===idx ? { ...x, qty: v } : x) }))} />
                      <Input label="Unit cost" type="number" value={it.unitCost} onChange={(v) => setReqForm((p) => ({ ...p, items: p.items.map((x,i)=> i===idx ? { ...x, unitCost: v } : x) }))} />
                      <button className="btn" title="Remove" onClick={() => setReqForm((p) => ({ ...p, items: p.items.filter((_,i)=>i!==idx) }))}>✕</button>
                    </div>
                  ))}
                  <button className="btn" onClick={() => setReqForm((p) => ({ ...p, items: [...p.items, { manufacturer:"", partNumber:"", description:"", qty:1, unitCost:0 }] }))}>
                    ＋ Add line
                  </button>
                </div>
              </div>

              <div className="input">
                <label>Notes</label>
                <textarea rows={3} value={reqForm.notes} onChange={(e) => setReqForm((p) => ({ ...p, notes: e.target.value }))} />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Create PO modal (from requisitions) */}
      {openPO && (
        <div className="modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) setOpenPO(false); }}>
          <div className="modal card" style={{ width: "min(980px, 96vw)" }}>
            <div style={{ padding: 14, borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", gap: 12 }}>
              <div>
                <div style={{ fontSize: 18, fontWeight: 900 }}>Create PO from Requisitions</div>
                <div className="subtle" style={{ marginTop: 4 }}>
                  Bundling <b>{selectedReqs.length}</b> requisition(s). Total: <b>{money(selectedTotal + (Number(poForm.shippingCost)||0))}</b>
                </div>
              </div>
              <div className="toolbar" style={{ gap: 8 }}>
                <button className="btn" onClick={() => setOpenPO(false)}>Cancel</button>
                <button className="btn btn-primary" onClick={createPOFromSelected}>Create PO</button>
              </div>
            </div>

            <div style={{ padding: 14, display: "grid", gap: 12 }}>
              <div className="form-grid" style={{ gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <Input label="PO Number *" value={poForm.poNumber} onChange={(v) => setPoForm((p) => ({ ...p, poNumber: v }))} />
                <Input label="Vendor" value={poForm.vendor} onChange={(v) => setPoForm((p) => ({ ...p, vendor: v }))} />
                <Input label="Project / Job *" value={poForm.projectJob} onChange={(v) => setPoForm((p) => ({ ...p, projectJob: v }))} />
                <Select label="Shipping Type" value={poForm.shippingType} onChange={(v) => setPoForm((p) => ({ ...p, shippingType: v }))} options={["Standard", "Expedite", "Overnight", "Pickup"]} />
                <Input label="Shipping Cost" type="number" value={poForm.shippingCost} onChange={(v) => setPoForm((p) => ({ ...p, shippingCost: v }))} />
              </div>

              <div className="input">
                <label>Notes</label>
                <textarea rows={3} value={poForm.notes} onChange={(e) => setPoForm((p) => ({ ...p, notes: e.target.value }))} />
              </div>

              <div className="card" style={{ padding: 12 }}>
                <div style={{ fontWeight: 800, marginBottom: 8 }}>Items</div>
                <div className="subtle" style={{ marginBottom: 8 }}>
                  Items are pulled from the requisitions. Edit quantities/costs in the requisition if needed.
                </div>
                <ul style={{ margin: 0, paddingLeft: 16 }}>
                  {selectedReqs.flatMap((r) => (r.items || []).map((it, idx) => (
                    <li key={`${r.id}-${idx}`}>
                      {it.manufacturer} {it.partNumber} — {it.description} · {it.qty} × {money(it.unitCost)}
                    </li>
                  )))}
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className="toast" style={{ position: "fixed", bottom: 18, right: 18 }}>
          {toast}
        </div>
      )}
    </div>
  );
}
