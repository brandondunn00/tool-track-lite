import React, { useEffect, useMemo, useState } from "react";
import { db } from "./firebase";
import {
  collection, addDoc, doc, updateDoc, deleteDoc,
  onSnapshot, serverTimestamp, query, orderBy, setDoc, getDoc
} from "firebase/firestore";

export default function ToolInventoryApp() {
  // Firestore-backed state
  const [tools, setTools] = useState([]);
  const [reorderQueue, setReorderQueue] = useState([]);
  const [pendingOrders, setPendingOrders] = useState([]);

  const [newTool, setNewTool] = useState({ name: "", quantity: "", threshold: "", price: "" });

  const formatCurrency = (v) => `$${Number(v || 0).toFixed(2)}`;
  const toInt = (v, def=0) => { const n = parseInt(v,10); return Number.isFinite(n) ? n : def; };

  // ---- Realtime subscriptions ----
  useEffect(() => {
    const unsubTools = onSnapshot(query(collection(db, "tools"), orderBy("name")), snap => {
      setTools(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    const unsubQueue = onSnapshot(collection(db, "reorderQueue"), snap => {
      setReorderQueue(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    const unsubPO = onSnapshot(query(collection(db, "pendingOrders"), orderBy("orderedAt", "desc")), snap => {
      setPendingOrders(snap.docs.map(d => ({ orderId: d.id, ...d.data() })));
    });
    return () => { unsubTools(); unsubQueue(); unsubPO(); };
  }, []);

  // ---- Tools CRUD ----
  const addTool = async () => {
    if (!newTool.name || newTool.quantity === "" || newTool.threshold === "" || newTool.price === "") {
      alert("Please fill out all fields."); return;
    }
    await addDoc(collection(db, "tools"), {
      name: newTool.name,
      quantity: toInt(newTool.quantity),
      threshold: toInt(newTool.threshold),
      price: parseFloat(newTool.price),
      createdAt: serverTimestamp(),
    });
    setNewTool({ name: "", quantity: "", threshold: "", price: "" });
  };

  const deleteTool = async (id) => {
    if (!window.confirm("Delete this tool?")) return;
    await deleteDoc(doc(db, "tools", id));
    // also clean up queue/pending for this tool
    const qDoc = doc(db, "reorderQueue", id);
    const qSnap = await getDoc(qDoc);
    if (qSnap.exists()) await deleteDoc(qDoc);
    const po = pendingOrders.filter(p => p.toolId === id);
    await Promise.all(po.map(p => deleteDoc(doc(db, "pendingOrders", p.orderId))));
  };

  const updateQuantity = async (id, delta) => {
    const t = tools.find(x => x.id === id);
    if (!t) return;
    const newQty = Math.max(0, (t.quantity || 0) + delta);
    await updateDoc(doc(db, "tools", id), { quantity: newQty });

    // auto-add to queue if hits 0
    if (newQty === 0) {
      // one queue row per tool: use the toolId as doc id to avoid dupes
      await setDoc(doc(db, "reorderQueue", id), {
        id,
        name: t.name,
        quantity: newQty,
        threshold: t.threshold,
        price: t.price,
        addedAt: serverTimestamp(),
      });
    }
  };

  // ---- Reorder Queue ----
  const addToReorderQueue = async (tool) => {
    await setDoc(doc(db, "reorderQueue", tool.id), {
      id: tool.id,
      name: tool.name,
      quantity: tool.quantity,
      threshold: tool.threshold,
      price: tool.price,
      addedAt: serverTimestamp(),
    });
  };

  const removeFromReorderQueue = async (toolId) => {
    await deleteDoc(doc(db, "reorderQueue", toolId));
  };

  const markOrdered = async (toolId) => {
    const item = reorderQueue.find(r => r.id === toolId);
    if (!item) return;
    // unique order row separate from tool id
    await addDoc(collection(db, "pendingOrders"), {
      toolId,
      name: item.name,
      quantity: item.quantity,
      threshold: item.threshold,
      price: item.price,
      orderedAt: serverTimestamp(),
    });
    await removeFromReorderQueue(toolId);
  };

  // ---- Pending Orders ----
  const toIntPos = (v) => { const n = toInt(v); return n > 0 ? n : 0; };

  const markReceived = async (orderId) => {
    const order = pendingOrders.find(o => o.orderId === orderId);
    if (!order) return;
    const defaultQty = order.threshold > 0 ? order.threshold : 1;
    const input = window.prompt(`Enter quantity received for "${order.name}":`, String(defaultQty));
    if (input === null) return;
    const received = toIntPos(input);
    if (received <= 0) return alert("Enter a valid positive number.");

    const t = tools.find(x => x.id === order.toolId);
    if (t) {
      await updateDoc(doc(db, "tools", t.id), { quantity: (t.quantity || 0) + received });
    }
    await deleteDoc(doc(db, "pendingOrders", orderId));
  };

  const undoOrdered = async (orderId) => {
    const order = pendingOrders.find(o => o.orderId === orderId);
    if (!order) return;
    await setDoc(doc(db, "reorderQueue", order.toolId), {
      id: order.toolId,
      name: order.name,
      quantity: order.quantity,
      threshold: order.threshold,
      price: order.price,
      addedAt: serverTimestamp(),
    });
    await deleteDoc(doc(db, "pendingOrders", orderId));
  };

  const removePending = async (orderId) => {
    await deleteDoc(doc(db, "pendingOrders", orderId));
  };

  // ---- Derived totals ----
  const totalQty = useMemo(() => tools.reduce((s,t)=>s+(t.quantity||0),0), [tools]);
  const totalValue = useMemo(() => tools.reduce((s,t)=>s+(t.quantity||0)*(t.price||0),0), [tools]);

  // ---- UI (your same layout, now uses Firestore handlers) ----
  return (
    <div style={{ padding: 20, fontFamily: "Arial, sans-serif", maxWidth: 1100, margin: "0 auto" }}>
      <h1>🛠️ Tool Inventory Dashboard</h1>

      <div style={{ display: "flex", gap: 12, marginBottom: 16 }}>
        <Metric label="Total Tools" value={tools.length} />
        <Metric label="Total Qty" value={totalQty} />
        <Metric label="Total Value" value={formatCurrency(totalValue)} />
      </div>

      <div style={{ marginBottom: 20, border: "1px solid #eee", padding: 12, borderRadius: 8 }}>
        <h2 style={{ marginTop: 0 }}>Add a New Tool</h2>
        <div style={{ display: "grid", gridTemplateColumns: "2fr repeat(3, 1fr) auto", gap: 8, alignItems: "end" }}>
          <Input label="Tool Name" value={newTool.name} onChange={(v)=>setNewTool({...newTool,name:v})} placeholder="e.g., Carbide Endmill 1/4in" />
          <Input label="Quantity" type="number" value={newTool.quantity} onChange={(v)=>setNewTool({...newTool,quantity:v})} />
          <Input label="Low Stock Threshold" type="number" value={newTool.threshold} onChange={(v)=>setNewTool({...newTool,threshold:v})} />
          <Input label="Price (USD)" type="number" step="0.01" value={newTool.price} onChange={(v)=>setNewTool({...newTool,price:v})} />
          <button onClick={addTool} style={btnPrimary}>Add Tool</button>
        </div>
      </div>

      <h2>Current Inventory</h2>
      <table border="1" cellPadding="8" style={{ borderCollapse: "collapse", width: "100%" }}>
        <thead>
          <tr>
            <th>Tool Name</th><th>Quantity</th><th>Low Stock Threshold</th><th>Price</th><th>Total Value</th><th>Actions</th><th>Status</th>
          </tr>
        </thead>
        <tbody>
          {tools.map(tool => {
            const isLow = (tool.quantity||0) <= (tool.threshold||0);
            const isZero = (tool.quantity||0) === 0;
            return (
              <tr key={tool.id} style={{ background: isLow ? "#fff4e5" : "white" }}>
                <td>{tool.name}</td>
                <td>{tool.quantity||0}</td>
                <td>{tool.threshold||0}</td>
                <td>{formatCurrency(tool.price)}</td>
                <td>{formatCurrency((tool.price||0)*(tool.quantity||0))}</td>
                <td style={{ whiteSpace: "nowrap" }}>
                  <button onClick={()=>updateQuantity(tool.id, -1)} style={btn}>-</button>{" "}
                  <button onClick={()=>updateQuantity(tool.id, 1)} style={btn}>+</button>{" "}
                  <button onClick={()=>addToReorderQueue(tool)} style={btn}>Add to Reorder Queue</button>{" "}
                  <button onClick={()=>deleteTool(tool.id)} style={btnDanger}>Delete</button>
                </td>
                <td>
                  {isZero ? <span style={{ color: "red", fontWeight: "bold" }}>❌ Out of Stock</span> :
                   isLow  ? <span style={{ color: "orange", fontWeight: "bold" }}>⚠️ Low Stock</span> :
                            <span style={{ color: "green" }}>✅ In Stock</span>}
                </td>
              </tr>
            );
          })}
          {tools.length === 0 && (
            <tr><td colSpan={7} style={{ textAlign: "center", color: "#666" }}>(No tools yet)</td></tr>
          )}
        </tbody>
      </table>

      <h2 style={{ marginTop: 28 }}>📦 Reorder Queue</h2>
      {reorderQueue.length === 0 ? <p>No tools in reorder queue.</p> : (
        <ul style={{ paddingLeft: 18 }}>
          {reorderQueue.map(tool => (
            <li key={tool.id} style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 8 }}>
              <span><strong>{tool.name}</strong> — Current Qty: {tool.quantity}, Threshold: {tool.threshold}</span>
              <button onClick={()=>markOrdered(tool.id)} style={btnPrimary}>Mark Ordered</button>
              <button onClick={()=>removeFromReorderQueue(tool.id)} style={btn}>Remove</button>
            </li>
          ))}
        </ul>
      )}

      <h2 style={{ marginTop: 28 }}>🧾 Pending Orders</h2>
      {pendingOrders.length === 0 ? <p>No pending orders.</p> : (
        <ul style={{ paddingLeft: 18 }}>
          {pendingOrders.map(order => (
            <li key={order.orderId} style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 8 }}>
              <span><strong>{order.name}</strong> — Ordered: <em>{order.orderedAt?.toDate ? order.orderedAt.toDate().toLocaleString() : "…"}</em></span>
              <button onClick={()=>markReceived(order.orderId)} style={btnPrimary}>Mark Received</button>
              <button onClick={()=>undoOrdered(order.orderId)} style={btn}>Undo</button>
              <button onClick={()=>removePending(order.orderId)} style={btnDanger}>Remove</button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* --- Tiny UI helpers --- */
function Input({ label, ...props }) {
  return (
    <label style={{ display: "grid", gap: 4 }}>
      <span style={{ fontSize: 12, color: "#555" }}>{label}</span>
      <input {...props} style={{ padding: "8px 10px", borderRadius: 6, border: "1px solid #ccc", outline: "none" }} />
    </label>
  );
}

function Metric({ label, value }) {
  return (
    <div style={{ border: "1px solid #eee", borderRadius: 8, padding: "10px 12px", background: "#fafafa", minWidth: 140 }}>
      <div style={{ fontSize: 12, color: "#6b7280" }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: "bold" }}>{value}</div>
    </div>
  );
}

const btn = { border: "1px solid #ccc", padding: "6px 10px", borderRadius: 6, cursor: "pointer", background: "#fff" };
const btnPrimary = { ...btn, background: "#111827", color: "#fff", border: "1px solid #111827" };
const btnDanger  = { ...btn, background: "crimson", color: "#fff", border: "1px solid crimson" };


