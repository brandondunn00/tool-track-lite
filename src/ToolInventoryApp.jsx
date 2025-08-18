import React, { useState, useEffect } from "react";

// ---------- Reusable Input ----------
function Input({ label, onChange, ...props }) {
  return (
    <label style={{ display: "grid", gap: 4, marginBottom: 8 }}>
      <span style={{ fontSize: 12, color: "#555" }}>{label}</span>
      <input
        {...props}
        onChange={(e) => onChange && onChange(e.target.value)}
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

// ---------- Main App ----------
export default function ToolInventoryApp() {
  const [tools, setTools] = useState(() => {
    const saved = localStorage.getItem("tools");
    return saved ? JSON.parse(saved) : [];
  });

  const [orders, setOrders] = useState(() => {
    const saved = localStorage.getItem("orders");
    return saved ? JSON.parse(saved) : [];
  });

  const [newTool, setNewTool] = useState({
    name: "",
    qty: "",
    min: "",
    price: "",
  });

  // Save to localStorage
  useEffect(() => {
    localStorage.setItem("tools", JSON.stringify(tools));
  }, [tools]);

  useEffect(() => {
    localStorage.setItem("orders", JSON.stringify(orders));
  }, [orders]);

  // ---------- Tool CRUD ----------
  const addTool = () => {
    if (!newTool.name || !newTool.qty) return;
    setTools([
      ...tools,
      {
        id: Date.now(),
        name: newTool.name,
        qty: parseInt(newTool.qty, 10),
        min: parseInt(newTool.min || "0", 10),
        price: parseFloat(newTool.price || "0"),
      },
    ]);
    setNewTool({ name: "", qty: "", min: "", price: "" });
  };

  const deleteTool = (id) => {
    setTools(tools.filter((t) => t.id !== id));
  };

  const pullTool = (id, amount = 1) => {
    setTools(
      tools.map((t) =>
        t.id === id
          ? { ...t, qty: Math.max(0, t.qty - amount) }
          : t
      )
    );
    const tool = tools.find((t) => t.id === id);
    if (tool && tool.qty - amount <= 0) {
      alert(`${tool.name} has hit 0!`);
    }
  };

  const markOrdered = (id) => {
    const tool = tools.find((t) => t.id === id);
    if (!tool) return;
    setOrders([...orders, { ...tool, orderedAt: new Date().toISOString() }]);
  };

  const removeOrder = (id) => {
    setOrders(orders.filter((o) => o.id !== id));
  };

  // ---------- CSV Export ----------
  const exportCSV = () => {
    const header = ["Employee", "Job", "Tool", "Qty", "Timestamp"];
    const rows = tools.map((t) => [
      "N/A",
      "N/A",
      t.name,
      t.qty,
      new Date().toISOString(),
    ]);
    const csv = [header, ...rows].map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "tools.csv";
    a.click();
  };

  // ---------- UI ----------
  return (
    <div style={{ padding: 20, fontFamily: "Arial, sans-serif" }}>
      <h2>Tool Track Lite</h2>

      {/* Add tool */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(140px,1fr))",
          gap: 12,
          marginBottom: 12,
        }}
      >
        <Input
          label="Tool Name"
          value={newTool.name}
          onChange={(v) => setNewTool({ ...newTool, name: v })}
        />
        <Input
          label="Quantity"
          type="number"
          value={newTool.qty}
          onChange={(v) => setNewTool({ ...newTool, qty: v })}
        />
        <Input
          label="Low Stock Threshold"
          type="number"
          value={newTool.min}
          onChange={(v) => setNewTool({ ...newTool, min: v })}
        />
        <Input
          label="Price (USD)"
          type="number"
          step="0.01"
          value={newTool.price}
          onChange={(v) => setNewTool({ ...newTool, price: v })}
        />
        <button
          onClick={addTool}
          style={{
            padding: "10px 16px",
            borderRadius: 6,
            background: "#2563eb",
            color: "#fff",
            border: "none",
            cursor: "pointer",
            alignSelf: "end",
          }}
        >
          Add Tool
        </button>
      </div>

      {/* Tools table */}
      <table
        style={{
          width: "100%",
          borderCollapse: "collapse",
          marginBottom: 20,
        }}
      >
        <thead>
          <tr style={{ background: "#f3f4f6" }}>
            <th style={{ padding: 8, textAlign: "left" }}>Name</th>
            <th style={{ padding: 8 }}>Qty</th>
            <th style={{ padding: 8 }}>Low Threshold</th>
            <th style={{ padding: 8 }}>Price</th>
            <th style={{ padding: 8 }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {tools.map((t) => (
            <tr
              key={t.id}
              style={{
                background:
                  t.qty <= t.min ? "rgba(254,226,226,0.5)" : "transparent",
              }}
            >
              <td style={{ padding: 8 }}>{t.name}</td>
              <td style={{ padding: 8, textAlign: "center" }}>{t.qty}</td>
              <td style={{ padding: 8, textAlign: "center" }}>{t.min}</td>
              <td style={{ padding: 8, textAlign: "center" }}>
                {t.price.toLocaleString("en-US", {
                  style: "currency",
                  currency: "USD",
                  minimumFractionDigits: 2,
                })}
              </td>
              <td style={{ padding: 8, textAlign: "center" }}>
                <button onClick={() => pullTool(t.id)}>Pull</button>{" "}
                <button onClick={() => markOrdered(t.id)}>Ordered</button>{" "}
                <button onClick={() => deleteTool(t.id)}>Delete</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Pending orders */}
      {orders.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <h3>Pending Orders</h3>
          <ul>
            {orders.map((o) => (
              <li key={o.id}>
                {o.name} (Qty {o.qty}) — Ordered{" "}
                {new Date(o.orderedAt).toLocaleString()}{" "}
                <button onClick={() => removeOrder(o.id)}>Remove</button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Export */}
      <button onClick={exportCSV}>Export CSV</button>
    </div>
  );
}

