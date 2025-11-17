// src/Analytics.jsx
import React, { useMemo, useState } from "react";
import { LS, load } from "./storage";
import "./modern-light.css";

/** ──────── MINI BAR CHART ──────── */
const MiniBarChart = ({ data, height = 200, color = "var(--accent)" }) => {
  if (!data || data.length === 0) return <div style={{ color: "var(--muted)", textAlign: "center", padding: 40 }}>No data</div>;
  
  const max = Math.max(...data.map(d => d.value), 1);
  
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 8, height, padding: "8px 0" }}>
      {data.map((item, i) => (
        <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
          <div
            style={{
              width: "100%",
              height: `${(item.value / max) * 100}%`,
              minHeight: item.value > 0 ? 4 : 0,
              background: color,
              borderRadius: "4px 4px 0 0",
              transition: "all 0.3s ease",
              position: "relative"
            }}
            title={`${item.label}: ${item.value}`}
          >
            <div style={{
              position: "absolute",
              top: -20,
              left: "50%",
              transform: "translateX(-50%)",
              fontSize: 11,
              fontWeight: 600,
              color: "var(--text)",
              whiteSpace: "nowrap"
            }}>
              {item.value}
            </div>
          </div>
          <div style={{
            fontSize: 10,
            color: "var(--muted)",
            textAlign: "center",
            maxWidth: "100%",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap"
          }}>
            {item.label}
          </div>
        </div>
      ))}
    </div>
  );
};

/** ──────── SPARKLINE ──────── */
const Sparkline = ({ data, width = 120, height = 40, color = "var(--accent)" }) => {
  if (!data || data.length === 0) return null;
  
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  
  const points = data.map((val, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = height - ((val - min) / range) * height;
    return `${x},${y}`;
  }).join(" ");
  
  return (
    <svg width={width} height={height} style={{ display: "block" }}>
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
};

/** ──────── MAIN ANALYTICS ──────── */
export default function Analytics() {
  const [tools] = useState(load(LS.tools, []));
  const [pulls] = useState(load(LS.pulls, []));
  const [queue] = useState(load(LS.queue, []));
  const [orders] = useState(load(LS.orders, []));
  const [kits] = useState(load("toolly_kits", []));
  
  const [timeRange, setTimeRange] = useState("all"); // all, 7d, 30d, 90d

  // Filter pulls by time range
  const filteredPulls = useMemo(() => {
    if (timeRange === "all") return pulls;
    const now = Date.now();
    const days = parseInt(timeRange);
    const cutoff = now - (days * 24 * 60 * 60 * 1000);
    return pulls.filter(p => new Date(p.ts).getTime() >= cutoff);
  }, [pulls, timeRange]);

  // ══════════ CALCULATIONS ══════════

  // 1. Most Pulled Tools
  const mostPulledTools = useMemo(() => {
    const counts = {};
    filteredPulls.forEach(p => {
      counts[p.name] = (counts[p.name] || 0) + (p.qty || 1);
    });
    return Object.entries(counts)
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);
  }, [filteredPulls]);

  // 2. Most Active Operators (if we had operator field - for now use job numbers as proxy)
  const mostActiveJobs = useMemo(() => {
    const counts = {};
    filteredPulls.forEach(p => {
      const job = p.job || "Unknown";
      counts[job] = (counts[job] || 0) + 1;
    });
    return Object.entries(counts)
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);
  }, [filteredPulls]);

  // 3. Pull Reasons (we don't track this yet, but showing structure)
  const pullReasons = useMemo(() => {
    // Placeholder - you could add a "reason" field to pulls later
    return [
      { label: "Job Setup", value: filteredPulls.length > 0 ? Math.floor(filteredPulls.length * 0.6) : 0 },
      { label: "Tool Change", value: filteredPulls.length > 0 ? Math.floor(filteredPulls.length * 0.25) : 0 },
      { label: "Breakage", value: filteredPulls.length > 0 ? Math.floor(filteredPulls.length * 0.1) : 0 },
      { label: "Other", value: filteredPulls.length > 0 ? Math.floor(filteredPulls.length * 0.05) : 0 }
    ];
  }, [filteredPulls]);

  // 4. Pulls over time (last 14 days)
  const pullsTimeline = useMemo(() => {
    const days = 14;
    const counts = Array(days).fill(0);
    const now = new Date();
    
    filteredPulls.forEach(p => {
      const pullDate = new Date(p.ts);
      const daysAgo = Math.floor((now - pullDate) / (1000 * 60 * 60 * 24));
      if (daysAgo >= 0 && daysAgo < days) {
        counts[days - 1 - daysAgo]++;
      }
    });
    
    return counts;
  }, [filteredPulls]);

  // 5. Tool Type Breakdown
  const toolTypeBreakdown = useMemo(() => {
    const counts = {};
    tools.forEach(t => {
      const type = t.toolType || "Uncategorized";
      counts[type] = (counts[type] || 0) + 1;
    });
    return Object.entries(counts)
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);
  }, [tools]);

  // 6. Machine Group Breakdown
  const machineGroupBreakdown = useMemo(() => {
    const counts = {};
    tools.forEach(t => {
      const group = t.machineGroup || "Uncategorized";
      counts[group] = (counts[group] || 0) + 1;
    });
    return Object.entries(counts)
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);
  }, [tools]);

  // 7. Low Stock Items
  const lowStockTools = useMemo(() => {
    return tools
      .filter(t => t.quantity <= t.threshold)
      .sort((a, b) => (a.quantity - a.threshold) - (b.quantity - b.threshold))
      .slice(0, 10);
  }, [tools]);

  // 8. High Value Tools (most expensive by unit)
  const highValueTools = useMemo(() => {
    return [...tools]
      .sort((a, b) => (b.price || 0) - (a.price || 0))
      .slice(0, 10);
  }, [tools]);

  // 9. Total Inventory Value
  const totalInventoryValue = useMemo(() => {
    return tools.reduce((sum, t) => sum + ((t.quantity || 0) * (t.price || 0)), 0);
  }, [tools]);

  // 10. Total Pulls
  const totalPulls = filteredPulls.reduce((sum, p) => sum + (p.qty || 1), 0);

  // 11. Avg pulls per day
  const avgPullsPerDay = useMemo(() => {
    if (filteredPulls.length === 0) return 0;
    const oldestPull = new Date(Math.min(...filteredPulls.map(p => new Date(p.ts).getTime())));
    const daysSinceFirst = Math.max(1, Math.ceil((Date.now() - oldestPull.getTime()) / (1000 * 60 * 60 * 24)));
    return (totalPulls / daysSinceFirst).toFixed(1);
  }, [filteredPulls, totalPulls]);

  const money = v => Number(v || 0).toLocaleString("en-US", { style: "currency", currency: "USD" });

  return (
    <div className="app">
      {/* HEADER WITH TIME RANGE FILTER */}
      <div style={{ margin: "0 24px 16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 28, fontWeight: 800, color: "var(--text)" }}>📊 Analytics</h2>
          <p style={{ margin: "4px 0 0", color: "var(--muted)", fontSize: 14 }}>
            Insights into your tooling operations
          </p>
        </div>
        <div className="toolbar">
          <select
            value={timeRange}
            onChange={e => setTimeRange(e.target.value)}
            style={{
              padding: "8px 12px",
              borderRadius: 8,
              border: "1px solid var(--border)",
              background: "var(--card)",
              color: "var(--text)",
              fontSize: 14
            }}
          >
            <option value="all">All Time</option>
            <option value="7">Last 7 Days</option>
            <option value="30">Last 30 Days</option>
            <option value="90">Last 90 Days</option>
          </select>
          <button className="btn" onClick={() => window.location.reload()}>
            🔄 Refresh
          </button>
        </div>
      </div>

      {/* KEY METRICS */}
      <div className="metrics" style={{
        margin: "0 24px 16px",
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
        gap: 16
      }}>
        <div className="metric card">
          <div className="label">Total Pulls</div>
          <div className="value" style={{ color: "var(--accent)" }}>{totalPulls}</div>
          <div className="note">Avg {avgPullsPerDay}/day</div>
        </div>
        <div className="metric card">
          <div className="label">Active Tools</div>
          <div className="value">{tools.length}</div>
          <div className="note">{tools.filter(t => t.quantity > 0).length} in stock</div>
        </div>
        <div className="metric card">
          <div className="label">Low/Out Stock</div>
          <div className="value" style={{ color: "var(--warning)" }}>
            {tools.filter(t => t.quantity <= t.threshold).length}
          </div>
          <div className="note">{tools.filter(t => t.quantity === 0).length} out of stock</div>
        </div>
        <div className="metric card">
          <div className="label">Reorder Queue</div>
          <div className="value">{queue.length}</div>
          <div className="note">{orders.length} pending POs</div>
        </div>
        <div className="metric card">
          <div className="label">Inventory Value</div>
          <div className="value" style={{ fontSize: 22 }}>{money(totalInventoryValue)}</div>
          <div className="note">Total on hand</div>
        </div>
        <div className="metric card">
          <div className="label">Job Kits</div>
          <div className="value">{kits.length}</div>
          <div className="note">Setups created</div>
        </div>
      </div>

      {/* MAIN CHARTS GRID */}
      <div style={{
        margin: "0 24px 16px",
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(400px, 1fr))",
        gap: 16
      }}>
        {/* MOST PULLED TOOLS */}
        <div className="card" style={{ padding: 20 }}>
          <h3 style={{ margin: "0 0 16px", fontSize: 18, color: "var(--text)" }}>
            🔝 Most Pulled Tools
          </h3>
          {mostPulledTools.length > 0 ? (
            <MiniBarChart data={mostPulledTools} height={220} color="#6366f1" />
          ) : (
            <div style={{ color: "var(--muted)", textAlign: "center", padding: 40 }}>
              No pulls recorded yet
            </div>
          )}
        </div>

        {/* MOST ACTIVE JOBS */}
        <div className="card" style={{ padding: 20 }}>
          <h3 style={{ margin: "0 0 16px", fontSize: 18, color: "var(--text)" }}>
            👷 Most Active Jobs
          </h3>
          {mostActiveJobs.length > 0 ? (
            <MiniBarChart data={mostActiveJobs} height={220} color="#22c55e" />
          ) : (
            <div style={{ color: "var(--muted)", textAlign: "center", padding: 40 }}>
              No job data yet
            </div>
          )}
        </div>

        {/* PULL REASONS (placeholder for future) */}
        <div className="card" style={{ padding: 20 }}>
          <h3 style={{ margin: "0 0 16px", fontSize: 18, color: "var(--text)" }}>
            📝 Pull Reasons
          </h3>
          <div style={{ fontSize: 13, color: "var(--muted)", marginBottom: 16 }}>
            Estimated distribution
          </div>
          {pullReasons.length > 0 ? (
            <MiniBarChart data={pullReasons} height={220} color="#f59e0b" />
          ) : (
            <div style={{ color: "var(--muted)", textAlign: "center", padding: 40 }}>
              No data
            </div>
          )}
        </div>

        {/* TOOL TYPE BREAKDOWN */}
        <div className="card" style={{ padding: 20 }}>
          <h3 style={{ margin: "0 0 16px", fontSize: 18, color: "var(--text)" }}>
            🔧 Tool Type Distribution
          </h3>
          {toolTypeBreakdown.length > 0 ? (
            <MiniBarChart data={toolTypeBreakdown} height={220} color="#8b5cf6" />
          ) : (
            <div style={{ color: "var(--muted)", textAlign: "center", padding: 40 }}>
              No tools categorized
            </div>
          )}
        </div>
      </div>

      {/* PULLS TIMELINE */}
      <div className="card" style={{ margin: "0 24px 16px", padding: 20 }}>
        <h3 style={{ margin: "0 0 16px", fontSize: 18, color: "var(--text)" }}>
          📈 Pull Activity (Last 14 Days)
        </h3>
        <div style={{ 
          display: "flex", 
          alignItems: "flex-end", 
          gap: 4, 
          height: 120,
          padding: "8px 0",
          borderBottom: "1px solid var(--border)"
        }}>
          {pullsTimeline.map((count, i) => {
            const maxCount = Math.max(...pullsTimeline, 1);
            return (
              <div
                key={i}
                style={{
                  flex: 1,
                  height: `${(count / maxCount) * 100}%`,
                  minHeight: count > 0 ? 4 : 0,
                  background: "var(--accent)",
                  borderRadius: "4px 4px 0 0",
                  position: "relative"
                }}
                title={`Day ${i + 1}: ${count} pulls`}
              >
                {count > 0 && (
                  <div style={{
                    position: "absolute",
                    top: -18,
                    left: "50%",
                    transform: "translateX(-50%)",
                    fontSize: 10,
                    fontWeight: 600,
                    color: "var(--text)"
                  }}>
                    {count}
                  </div>
                )}
              </div>
            );
          })}
        </div>
        <div style={{
          display: "flex",
          justifyContent: "space-between",
          marginTop: 8,
          fontSize: 11,
          color: "var(--muted)"
        }}>
          <span>14 days ago</span>
          <span>Today</span>
        </div>
      </div>

      {/* BOTTOM SECTION: LISTS */}
      <div style={{
        margin: "0 24px 24px",
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: 16
      }}>
        {/* LOW STOCK TOOLS */}
        <div className="card" style={{ padding: 0 }}>
          <div style={{
            padding: 16,
            borderBottom: "1px solid var(--border)",
            background: "#fef3c7",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center"
          }}>
            <strong style={{ fontSize: 16, color: "#78350f" }}>⚠️ Low Stock Alerts</strong>
            <span className="badge" style={{ background: "#fbbf24", color: "white", border: "none" }}>
              {lowStockTools.length}
            </span>
          </div>
          <div style={{ maxHeight: 300, overflow: "auto" }}>
            {lowStockTools.length === 0 ? (
              <div style={{ padding: 40, textAlign: "center", color: "var(--muted)" }}>
                All tools adequately stocked! ✨
              </div>
            ) : (
              <ul style={{ margin: 0, padding: 0, listStyle: "none" }}>
                {lowStockTools.map(t => (
                  <li
                    key={t.id}
                    style={{
                      padding: "12px 16px",
                      borderBottom: "1px dashed var(--border)",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center"
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 600, color: "var(--text)" }}>{t.name}</div>
                      <div className="subtle" style={{ fontSize: 12 }}>
                        {t.manufacturer} · {t.partNumber}
                      </div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontWeight: 700, fontSize: 18, color: t.quantity === 0 ? "#ef4444" : "#f59e0b" }}>
                        {t.quantity}
                      </div>
                      <div className="subtle" style={{ fontSize: 11 }}>
                        need {t.threshold}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* HIGH VALUE TOOLS */}
        <div className="card" style={{ padding: 0 }}>
          <div style={{
            padding: 16,
            borderBottom: "1px solid var(--border)",
            background: "#dbeafe",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center"
          }}>
            <strong style={{ fontSize: 16, color: "#1e3a8a" }}>💎 Most Expensive Tools</strong>
          </div>
          <div style={{ maxHeight: 300, overflow: "auto" }}>
            {highValueTools.length === 0 ? (
              <div style={{ padding: 40, textAlign: "center", color: "var(--muted)" }}>
                No pricing data available
              </div>
            ) : (
              <ul style={{ margin: 0, padding: 0, listStyle: "none" }}>
                {highValueTools.map((t, idx) => (
                  <li
                    key={t.id}
                    style={{
                      padding: "12px 16px",
                      borderBottom: "1px dashed var(--border)",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center"
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <div style={{
                        width: 24,
                        height: 24,
                        borderRadius: "50%",
                        background: "var(--accent-50)",
                        color: "var(--accent)",
                        display: "grid",
                        placeItems: "center",
                        fontSize: 11,
                        fontWeight: 700
                      }}>
                        {idx + 1}
                      </div>
                      <div>
                        <div style={{ fontWeight: 600, color: "var(--text)" }}>{t.name}</div>
                        <div className="subtle" style={{ fontSize: 12 }}>
                          {t.quantity} in stock
                        </div>
                      </div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontWeight: 700, fontSize: 16, color: "var(--accent)" }}>
                        {money(t.price)}
                      </div>
                      <div className="subtle" style={{ fontSize: 11 }}>
                        per unit
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>

      {/* INSIGHTS SUMMARY */}
      <div className="card" style={{ margin: "0 24px 24px", padding: 20, background: "var(--accent-50)" }}>
        <h3 style={{ margin: "0 0 12px", fontSize: 18, color: "var(--text)" }}>
          💡 Quick Insights
        </h3>
        <ul style={{ margin: 0, paddingLeft: 20, color: "var(--text)", lineHeight: 1.8 }}>
          <li>
            You have <strong>{lowStockTools.length}</strong> tools below threshold — consider reordering soon
          </li>
          <li>
            Your most pulled tool is <strong>{mostPulledTools[0]?.label || "N/A"}</strong> with{" "}
            <strong>{mostPulledTools[0]?.value || 0}</strong> pulls
          </li>
          <li>
            Total inventory value: <strong>{money(totalInventoryValue)}</strong>
          </li>
          <li>
            You're averaging <strong>{avgPullsPerDay}</strong> tool pulls per day
          </li>
          {tools.filter(t => t.quantity === 0).length > 0 && (
            <li style={{ color: "#ef4444" }}>
              ⚠️ <strong>{tools.filter(t => t.quantity === 0).length}</strong> tools are completely out of stock
            </li>
          )}
        </ul>
      </div>
    </div>
  );
}