import React, { useEffect, useMemo, useState } from "react";

function Input({ label, onChange, value, ...props }) {
  const safeValue =
    value == null
      ? ""
      : typeof value === "object"
      ? "" // prevent "[object Object]" from ever rendering
      : String(value);

  return (
    <label style={{ display: "grid", gap: 4 }}>
      <span style={{ fontSize: 12, color: "#555" }}>{label}</span>
      <input
        {...props}
        value={safeValue}
        onChange={(e) => onChange?.(e.target.value)}
        style={{
          padding: "8px 10px",
          borderRadius: 6,
          border: "1px solid #ccc",
          outline: "none",
        }}
      />
    </label>
  );
}


const formatCurrency = (v) =>
  (Number(v || 0)).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

export default function ToolInventoryApp() {
  // Seeded example tools (you can start empty if you prefer)
  const [tools, setTools] = useState(() => {
    const saved = localStorage.getItem("tools");
    return saved ? JSON.parse(saved) : [];
  });

  const [reorderQueue, setReorderQueue] = useState(() => {
    const saved = localStorage.getItem("reorderQueue");
    return saved ? JSON.parse(saved) : [];
  });

  const [pendingOrders, setPendingOrders] = useState(() => {
    const saved = localStorage.getItem("pendingOrders");
    return saved ? JSON.parse(saved) : [];
  });

  // Controlled inputs (strings)
  const [newTool, setNewTool] = useState({
    name: "",
    quantity: "",
    threshold: "",
    price: "",
  });

  // Persist to localStorage
  useEffect(() => {
    localStorage.setItem("tools", JSON.stringify(tools));
  }, [tools]);
  useEffect(() => {
    localStorage.setItem("reorderQueue", JSON.stringify(reorderQueue));
  }, [reorderQueue]);
  useEffect(() => {
    localStorage.setItem("pendingOrders", JSON.stringify(pendingOrders));
  }, [pendingOrders]);

  const toInt = (v, def = 0) => {
    const n = parseInt(v, 10);
    return Number.isFinite(n) ? n : def;
  };
  const toFloat = (v, def = 0) => {
    const n = parseFloat(v);
    return Number.isFinite(n) ? n : def;
  };

  /* ---------------- Add / Delete / Adjust ---------------- */
  const addTool = () => {
    if (!newTool.name.trim()) {
      alert("Please enter a tool name.");
      return;
    }
    const tool = {
      id: Date.now().toString(),
      name: newTool.name.trim(),
      quantity: toInt(newTool.quantity, 0),
      threshold: toInt(newTool.threshold, 0),
      price: toFloat(newTool.price, 0),
    };
    setTools((prev) => [...prev, tool]);
    setNewTool({ name: "", quantity: "", threshold: "", price: "" });
  };

  const deleteTool = (id) => {
    if (!window.confirm("Delete this tool?")) return;
    setTools((prev) => prev.filter((t) => t.id !== id));
    setReorderQueue((prev) => prev.filter((t) => t.id !== id));
    setPendingOrders((prev) => prev.filter((o) => o.toolId !== id));
  };

  const updateQuantity = (id, delta) => {
    setTools((prev) => {
      const next = prev.map((t) =>
        t.id === id ? { ...t, quantity: Math.max(0, (t.quantity || 0) + delta) } : t
      );
      const target = next.find((t) => t.id === id);
      if (target && target.quantity === 0) {
        // alert at zero and add to reorder queue if not already there
        alert(`${target.name} has hit 0!`);
        setReorderQueue((q) => (q.some((x) => x.id === id) ? q : [...q, target]));
      }
      return next;
    });
  };

  /* ---------------- Reorder Queue ---------------- */
  const addToReorderQueue = (tool) => {
    setReorderQueue((q) => (q.some((x) => x.id === tool.id) ? q : [...q, tool]));
  };
  const removeFromReorderQueue = (id) => {
    setReorderQueue((prev) => prev.filter((t) => t.id !== id));
  };
  const markOrdered = (toolId) => {
    const item = reorderQueue.find((t) => t.id === toolId);
    if (!item) return;
    const order = {
      orderId: `${toolId}-${Date.now()}`,
      toolId,
      name: item.name,
      quantity: item.quantity,
      threshold: item.threshold,
      price: item.price,
      orderedAt: new Date().toISOString(),
    };
    setPendingOrders((po) =>
      po.some((o) => o.toolId === toolId) ? po : [...po, order]
    );
    removeFromReorderQueue(toolId);
  };

  /* ---------------- Pending Orders ---------------- */
  const markReceived = (orderId) => {
    const order = pendingOrders.find((o) => o.orderId === orderId);
    if (!order) return;

    const defQty = order.threshold > 0 ? order.threshold : 1;
    const input = window.prompt(
      `Enter quantity received for "${order.name}":`,
      String(defQty)
    );
    if (input === null) return;
    const received = toInt(input, 0);
    if (received <= 0) return alert("Enter a valid positive number.");

    setTools((prev) =>
      prev.map((t) => (t.id === order.toolId ? { ...t, quantity: (t.quantity || 0) + received } : t))
    );
    setPendingOrders((prev) => prev.filter((o) => o.orderId !== orderId));
  };

  const undoOrdered = (orderId) => {
    const order = pendingOrders.find((o) => o.orderId === orderId);
    if (!order) return;
    addToReorderQueue({
      id: order.toolId,
      name: order.name,
      quantity: order.quantity,
      threshold: order.threshold,
      price: order.price,
    });
    setPendingOrders((prev) => prev.filter((o) => o.orderId !== orderId));
  };

  const removePending = (orderId) => {
    setPendingOrders((prev) => prev.filter((o) => o.orderId !== orderId));
  };

  /* ---------------- Totals ---------------- */
  const totalQty = useMemo(() => tools.reduce((s, t) => s + (t.quantity || 0), 0), [tools]);
  const totalValue = useMemo(
    () => tools.reduce((s, t) => s + (t.quantity || 0) * (t.price || 0), 0),
    [tools]
  );

  /* ---------------- UI ---------------- */
  return (
    <div style={{ padding: 20, fontFamily: "Arial, sans-serif", maxWidth: 1100, margin: "0 auto" }}>
      <h1>🛠️ Tool Inventory Dashboard</h1>

      {/* Summary */}
      <div style={{ display: "flex", gap: 12, marginBottom: 16 }}>
        <Metric label="Total Tools" value={tools.length} />
        <Metric label="Total Qty" value={totalQty} />
        <Metric label="Total Value" value={formatCurrency(totalValue)} />
      </div>

      {/* Add New Tool */}
      <div style={{ marginBottom: 20, border: "1px solid #eee", padding: 12, borderRadius: 8 }}>
        <h2 style={{ marginTop: 0 }}>Add a New Tool</h2>
        <div style={{ display: "grid", gridTemplateColumns: "2fr repeat(3, 1fr) auto", gap: 8, alignItems: "end" }}>
          <Input
            label="Tool Name"
            value={newTool.name}
            onChange={(v) => setNewTool({ ...newTool, name: v })}
            placeholder="e.g., Carbide Endmill 1/4in"
          />
          <Input
            label="Quantity"
            type="number"
            value={newTool.quantity}
            onChange={(v) => setNewTool({ ...newTool, quantity: v })}
            placeholder="e.g., 12"
          />
          <Input
            label="Low Stock Threshold"
            type="number"
            value={newTool.threshold}
            onChange={(v) => setNewTool({ ...newTool, threshold: v })}
            placeholder="e.g., 10"
          />
          <Input
            label="Price (USD)"
            type="number"
            step="0.01"
            value={newTool.price}
            onChange={(v) => setNewTool({ ...newTool, price: v })}
            placeholder="e.g., 15.50"
          />
          <button onClick={addTool} style={btnPrimary}>Add Tool</button>
        </div>
      </div>

      {/* Inventory Table */}
      <h2>Current Inventory</h2>
      <table border="1" cellPadding="8" style={{ borderCollapse: "collapse", width: "100%" }}>
        <thead>
          <tr>
            <th>Tool Name</th>
            <th>Quantity</th>
            <th>Low Stock Threshold</th>
            <th>Price</th>
            <th>Total Value</th>
            <th>Actions</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {tools.map((tool) => {
            const isLow = (tool.quantity || 0) <= (tool.threshold || 0); // <= per your rule
            const isZero = (tool.quantity || 0) === 0;
            return (
              <tr key={tool.id} style={{ background: isLow ? "#fff4e5" : "white" }}>
                <td>{tool.name}</td>
                <td style={{ textAlign: "center" }}>{tool.quantity || 0}</td>
                <td style={{ textAlign: "center" }}>{tool.threshold || 0}</td>
                <td style={{ textAlign: "center" }}>{formatCurrency(tool.price)}</td>
                <td style={{ textAlign: "center" }}>{formatCurrency((tool.price || 0) * (tool.quantity || 0))}</td>
                <td style={{ whiteSpace: "nowrap", textAlign: "center" }}>
                  <button onClick={() => updateQuantity(tool.id, -1)} style={btn}>-</button>{" "}
                  <button onClick={() => updateQuantity(tool.id, 1)} style={btn}>+</button>{" "}
                  <button onClick={() => addToReorderQueue(tool)} style={btn}>Add to Reorder Queue</button>{" "}
                  <button onClick={() => deleteTool(tool.id)} style={btnDanger}>Delete</button>
                </td>
                <td style={{ textAlign: "center" }}>
                  {isZero ? (
                    <span style={{ color: "red", fontWeight: "bold" }}>❌ Out of Stock</span>
                  ) : isLow ? (
                    <span style={{ color: "orange", fontWeight: "bold" }}>⚠️ Low Stock</span>
                  ) : (
                    <span style={{ color: "green" }}>✅ In Stock</span>
                  )}
                </td>
              </tr>
            );
          })}
          {tools.length === 0 && (
            <tr>
              <td colSpan={7} style={{ textAlign: "center", color: "#666" }}>(No tools yet)</td>
            </tr>
          )}
        </tbody>
      </table>

      {/* Reorder Queue */}
      <h2 style={{ marginTop: 28 }}>📦 Reorder Queue</h2>
      {reorderQueue.length === 0 ? (
        <p>No tools in reorder queue.</p>
      ) : (
        <ul style={{ paddingLeft: 18 }}>
          {reorderQueue.map((tool) => (
            <li key={tool.id} style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 8 }}>
              <span>
                <strong>{tool.name}</strong> — Current Qty: {tool.quantity}, Threshold: {tool.threshold}
              </span>
              <button onClick={() => markOrdered(tool.id)} style={btnPrimary}>Mark Ordered</button>
              <button onClick={() => removeFromReorderQueue(tool.id)} style={btn}>Remove</button>
            </li>
          ))}
        </ul>
      )}

      {/* Pending Orders */}
      <h2 style={{ marginTop: 28 }}>🧾 Pending Orders</h2>
      {pendingOrders.length === 0 ? (
        <p>No pending orders.</p>
      ) : (
        <ul style={{ paddingLeft: 18 }}>
          {pendingOrders.map((order) => (
            <li key={order.orderId} style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 8 }}>
              <span>
                <strong>{order.name}</strong> — Ordered:{" "}
                <em>{new Date(order.orderedAt).toLocaleString()}</em>
              </span>
              <button onClick={() => markReceived(order.orderId)} style={btnPrimary}>Mark Received</button>
              <button onClick={() => undoOrdered(order.orderId)} style={btn}>Undo</button>
              <button onClick={() => removePending(order.orderId)} style={btnDanger}>Remove</button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* ---------- Tiny UI helpers ---------- */
function Metric({ label, value }) {
  return (
    <div style={{
      border: "1px solid #eee",
      borderRadius: 8,
      padding: "10px 12px",
      background: "#fafafa",
      minWidth: 140
    }}>
      <div style={{ fontSize: 12, color: "#6b7280" }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: "bold" }}>{value}</div>
    </div>
  );
}

const btn = {
  border: "1px solid #ccc",
  padding: "6px 10px",
  borderRadius: 6,
  cursor: "pointer",
  background: "#fff",
};
const btnPrimary = {
  ...btn,
  background: "#111827",
  color: "#fff",
  border: "1px solid #111827",
};
const btnDanger = {
  ...btn,
  background: "crimson",
  color: "#fff",
  border: "1px solid crimson",
};
