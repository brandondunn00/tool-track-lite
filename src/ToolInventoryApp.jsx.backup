// src/ToolInventoryApp.jsx  ←  DELETE OLD, PASTE THIS
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
      {options.map(o => <option key={o} value={o}>{o || "—"}</option>)}
    </select>
  </div>
);
const SelectWithOther = ({ label, value, setValue, baseOptions }) => {
  const isOther = value && !baseOptions.includes(value);
  const sel = isOther ? "Other…" : (value ?? "");
  return (
    <div style={{ display: "grid", gap: 6 }}>
      <Select label={label} value={sel} onChange={v => v === "Other…" ? setValue(isOther ? value : "") : setValue(v)} options={baseOptions} />
      {sel === "Other…" && <Input label={`${label} (custom)`} value={value} onChange={setValue} placeholder={`Custom ${label.toLowerCase()}`} />}
    </div>
  );
};

/* ──────── HELPERS ──────── */
const money = v => Number(v || 0).toLocaleString("en-US", { style: "currency", currency: "USD" });
const sparklinePath = (pts, w = 300, h = 100, pad = 10) => {
  if (!pts.length) return "";
  const min = Math.min(...pts), max = Math.max(...pts), r = max - min || 1;
  const x = (i, n) => pad + (i / (n - 1)) * (w - pad * 2);
  const y = v => h - pad - ((v - min) / r) * (h - pad * 2);
  return pts.map((v, i, a) => `${i === 0 ? "M" : "L"} ${x(i, a.length).toFixed(1)} ${y(v).toFixed(1)}`).join(" ");
};
const fakeHistory = (qty = 0, thr = 0) => {
  const base = Math.max(thr * 1.2, 10);
  return Array.from({ length: 12 }, (_, i) => Math.round((qty + base - i * 2) / 1.5)).reverse();
};

/* ──────── MAIN APP ──────── */
export default function ToolInventoryApp() {
  const [tools, setTools] = useState([]);
  const [queue, setQueue] = useState([]);
  const [orders, setOrders] = useState([]);
  const [form, setForm] = useState({ name: "", manufacturer: "", partNumber: "", description: "", quantity: "", threshold: "", price: "", machineGroup: "", toolType: "" });
  const [errors, setErrors] = useState({});
  const [toast, setToast] = useState("");
  const [search, setSearch] = useState("");
  const [fMach, setFMach] = useState("");
  const [fType, setFType] = useState("");
  const [selId, setSelId] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [modal, setModal] = useState({ id: null, name: "", manufacturer: "", partNumber: "", description: "", quantity: 0, threshold: 0, price: 0, vendor: "", projects: "", location: {}, machineGroup: "", toolType: "" });
  const loaded = useRef(false);

  const note = msg => { setToast(msg); clearTimeout(note.t); note.t = setTimeout(() => setToast(""), 2400); };

  /* ── LOAD + DARK MODE PERSIST ── */
  useEffect(() => {
    const norm = a => (a || []).map(x => ({
      id: x.id ?? Date.now() + Math.random(),
      name: x.name ?? "", manufacturer: x.manufacturer ?? "", partNumber: x.partNumber ?? "", description: x.description ?? "",
      quantity: Number(x.quantity) || 0, threshold: Number(x.threshold) || 0, price: Number(parseFloat(x.price || 0).toFixed(2)) || 0,
      vendor: x.vendor ?? "", projects: Array.isArray(x.projects) ? x.projects : [],
      location: typeof x.location === "object" ? x.location : {}, machineGroup: x.machineGroup ?? "", toolType: x.toolType ?? ""
    }));
    setTools(norm(load(LS.tools, [])));
    setQueue(norm(load(LS.queue, [])));
    setOrders((load(LS.orders, []) || []).map(o => ({ orderId: o.orderId ?? `${o.id}-${Date.now()}`, ...o })));
    // DARK MODE
    if (localStorage.getItem("toolly_dark") === "true" || 
        (!localStorage.getItem("toolly_dark") && window.matchMedia("(prefers-color-scheme: dark)").matches)) {
      document.body.classList.add("dark");
    }
    setTimeout(() => loaded.current = true, 0);
  }, []);

  /* ── SAVE ── */
  useEffect(() => { if (loaded.current) save(LS.tools, tools); }, [tools]);
  useEffect(() => { if (loaded.current) save(LS.queue, queue); }, [queue]);
  useEffect(() => { if (loaded.current) save(LS.orders, orders); }, [orders]);

  /* ── DERIVED ── */
  const totalQty = tools.reduce((a, t) => a + t.quantity, 0);
  const totalVal = tools.reduce((a, t) => a + t.quantity * t.price, 0);
  const machOpts = useMemo(() => [...new Set([...MACHINE_GROUPS_BASE, ...tools.map(t => t.machineGroup)])], [tools]);
  const typeOpts = useMemo(() => [...new Set([...TOOL_TYPES_BASE, ...tools.map(t => t.toolType)])], [tools]);
  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return tools.filter(t => {
      const hay = [t.name, t.manufacturer, t.partNumber, t.description, t.vendor, t.machineGroup, t.toolType].join(" ").toLowerCase();
      return (!q || hay.includes(q)) && (!fMach || t.machineGroup === fMach) && (!fType || t.toolType === fType);
    });
  }, [tools, search, fMach, fType]);
  const sel = tools.find(t => t.id === selId);

  /* ── ACTIONS ── */
  const validate = () => {
    const e = {};
    if (!form.name.trim()) e.name = "Name required";
    if (form.quantity !== "" && (+form.quantity < 0)) e.quantity = "≥ 0";
    if (form.threshold !== "" && (+form.threshold < 0)) e.threshold = "≥ 0";
    if (form.price !== "" && (+form.price < 0)) e.price = "≥ 0.00";
    setErrors(e);
    return !Object.keys(e).length;
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
      vendor: "", projects: [], location: {}, machineGroup: form.machineGroup || "", toolType: form.toolType || ""
    };
    setTools(p => [...p, t]);
    setForm({ name: "", manufacturer: "", partNumber: "", description: "", quantity: "", threshold: "", price: "", machineGroup: "", toolType: "" });
    setErrors({});
    setSelId(t.id);
    note("Tool added ✅");
  };
  const updQty = (id, delta) => setTools(p => p.map(t => {
    if (t.id !== id) return t;
    const newQty = Math.max(0, t.quantity + delta);
    if (newQty <= t.threshold && !queue.some(q => q.id === id)) {
      setQueue(q => [...q, { ...t, quantity: newQty }]);
      note(`${t.name} → queue`);
    }
    return { ...t, quantity: newQty };
  }));
  const delTool = id => { if (window.confirm("Delete?")) { setTools(p => p.filter(t => t.id !== id)); setQueue(p => p.filter(t => t.id !== id)); setOrders(p => p.filter(o => o.id !== id)); if (selId === id) setSelId(null); note("Deleted 🗑️"); }};
  const toQueue = t => { setQueue(q => q.some(x => x.id === t.id) ? q : [...q, t]); note("Queued 📦"); };
  const rmQueue = id => setQueue(p => p.filter(t => t.id !== id));
  const ordered = id => {
    const t = tools.find(x => x.id === id);
    setOrders(p => [...p, { orderId: `${id}-${Date.now()}`, id, name: t.name, quantity: t.threshold || 1, price: t.price, orderedAt: new Date().toISOString() }]);
    rmQueue(id);
    note("Ordered 🧾");
  };
  const received = orderId => {
    const o = orders.find(x => x.orderId === orderId);
    const qty = prompt(`Qty received for "${o.name}"`, o.quantity);
    if (!qty) return;
    const n = Math.max(0, parseInt(qty) || 0);
    setTools(p => p.map(t => t.id === o.id ? { ...t, quantity: t.quantity + n } : t));
    setOrders(p => p.filter(x => x.orderId !== orderId));
    note(`+${n} received ✅`);
  };
  const receiveAll = () => {
    const qty = prompt(`Receive ALL ${queue.length} items — qty each:`, "10");
    if (!qty) return;
    const n = parseInt(qty) || 0;
    queue.forEach(t => updQty(t.id, n));
    setQueue([]);
    note(`Received ${queue.length} POs!`);
  };
  const exportCSV = () => {
    const rows = [["Name","Mfr","Part#","Qty","Thr","Price","Value","Machine","Type","Vendor"], ...tools.map(t => [t.name, t.manufacturer, t.partNumber, t.quantity, t.threshold, t.price, (t.quantity*t.price).toFixed(2), t.machineGroup, t.toolType, t.vendor])];
    const blob = new Blob([rows.map(r => r.join(",")).join("\n")], { type: "text/csv" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `toolly-${new Date().toISOString().slice(0,10)}.csv`; a.click();
    note("CSV ready 📊");
  };

  return (
    <div className="app">
      {/* FULCRUM HEADER */}
      <div className="header" style={{background:"white",borderBottom:"1px solid #e2e8f0",padding:"12px 24px",display:"flex",alignItems:"center",justifyContent:"space-between",boxShadow:"0 1px 3px rgba(0,0,0,0.1)"}}>
        <div style={{display:"flex",alignItems:"center",gap:16}}>
          <div style={{fontSize:32}}>🛠️</div>
          <div>
            <h1 style={{margin:0,fontSize:24,fontWeight:800,color:"#1e293b"}}>Toolly</h1>
            <p style={{margin:"4px 0 0",fontSize:13,color:"#64748b"}}>CNC Tooling • $10/mo • Unlimited users</p>
          </div>
        </div>
        <div className="toolbar" style={{gap:10}}>
          <button className="btn" onClick={exportCSV}>📊 CSV</button>
          <button className="btn btn-success" onClick={receiveAll}>Receive All POs</button>
          <a className="btn" href="#/kitting">Kitting</a>
          <a className="btn" href="#/operator">Operator</a>
        </div>
      </div>

      {/* DARK MODE TOGGLE */}
      <div style={{position:"fixed",bottom:24,right:24,zIndex:999}}>
        <button
          onClick={() => {
            document.body.classList.toggle("dark");
            const isDark = document.body.classList.contains("dark");
            localStorage.setItem("toolly_dark", isDark);
            note(isDark ? "Dark mode ON 🌙" : "Light mode ON ☀️");
          }}
          style={{
            width:56,height:56,borderRadius:"50%",background:"#1e293b",
            border:"3px solid #475569",boxShadow:"0 4px 12px rgba(0,0,0,0.3)",
            fontSize:28,cursor:"pointer",transition:"all 0.3s"
          }}
          title="Toggle dark mode"
        >
          {document.body.classList.contains("dark") ? "🌙" : "☀️"}
        </button>
      </div>

      {/* TONY CARD — FULL WIDTH, NO OVERFLOW */}
      <div style={{margin:"16px 24px 0",borderRadius:12,overflow:"hidden",boxShadow:"0 4px 12px rgba(0,0,0,0.1)"}}>
        <div style={{padding:20,background:"linear-gradient(135deg,#6366f1,#8b5cf6)",color:"white"}}>
          <strong style={{fontSize:18}}>🤖 Toolly Tony</strong>
          <p style={{fontSize:13,margin:"8px 0 0",opacity:0.9}}>Ask me speeds/feeds, tool life, or “best insert for 316 stainless”</p>
        </div>
        <div style={{padding:16,background:"white"}}>
          <button className="btn" style={{width:"100%",background:"#6366f1",color:"white"}} onClick={()=>note("Live Tony drops tomorrow — SuperGrok API")}>Unlock Tony (1 click)</button>
        </div>
      </div>

      {/* STATS */}
      <div className="metrics" style={{margin:"16px 24px 0",gap:16,display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(140px,1fr))"}}>
        <div className="metric card stat-accent"><div className="label">Low/Zero</div><div className="value">{tools.filter(t=>t.quantity<=t.threshold).length}</div></div>
        <div className="metric card"><div className="label">Queue</div><div className="value">{queue.length}</div></div>
        <div className="metric card"><div className="label">POs</div><div className="value">{orders.length}</div></div>
        <div className="metric card"><div className="label">Value</div><div className="value">{money(totalVal)}</div></div>
      </div>

      {/* FILTERS */}
      <div className="controls" style={{margin:"16px 24px 0",display:"flex",gap:12,flexWrap:"wrap",alignItems:"end"}}>
        <div className="search" style={{flex:1,minWidth:280}}><input placeholder="Search anything…" onChange={e=>setSearch(e.target.value)}/></div>
        <Select label="Machine" value={fMach} onChange={setFMach} options={machOpts}/>
        <Select label="Type" value={fType} onChange={setFType} options={typeOpts}/>
      </div>

      {/* ADD FORM — TIGHT GRID */}
      <div className="card form" style={{margin:"16px 24px 0"}}>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(140px,1fr))",gap:12,padding:16}}>
          <Input label="Name" value={form.name} onChange={v=>setForm(p=>({...p,name:v}))} error={errors.name}/>
          <Input label="Mfr" value={form.manufacturer} onChange={v=>setForm(p=>({...p,manufacturer:v}))}/>
          <Input label="Part#" value={form.partNumber} onChange={v=>setForm(p=>({...p,partNumber:v}))}/>
          <Input label="Desc" value={form.description} onChange={v=>setForm(p=>({...p,description:v}))}/>
          <Input label="Qty" type="number" value={form.quantity} onChange={v=>setForm(p=>({...p,quantity:v}))} error={errors.quantity}/>
          <Input label="Low" type="number" value={form.threshold} onChange={v=>setForm(p=>({...p,threshold:v}))} error={errors.threshold}/>
          <Input label="Price" type="number" step="0.01" value={form.price} onChange={v=>setForm(p=>({...p,price:v}))} error={errors.price}/>
          <SelectWithOther label="Machine" value={form.machineGroup} setValue={v=>setForm(p=>({...p,machineGroup:v}))} baseOptions={MACHINE_GROUPS_BASE}/>
          <SelectWithOther label="Type" value={form.toolType} setValue={v=>setForm(p=>({...p,toolType:v}))} baseOptions={TOOL_TYPES_BASE}/>
          <div style={{display:"flex",alignItems:"end"}}><button className="btn btn-primary" style={{width:"100%"}} onClick={addTool}>Add Tool</button></div>
        </div>
      </div>

      {/* MAIN LAYOUT — NO BLEED */}
      <div style={{display:"grid",gridTemplateColumns:"1fr 340px",gap:24,margin:"16px 24px 0"}}>
        {/* TABLE */}
        <div className="card table-wrap">
          <div className="table-scroll">
            <table className="table">
              <thead><tr><th>Item</th><th>On Hand</th><th>Vendor</th><th>Value</th><th>Actions</th><th>Status</th></tr></thead>
              <tbody>
                {filtered.length===0 && <tr><td colSpan={6} className="subtle">Nothing matches</td></tr>}
                {filtered.map(t => {
                  const low = t.quantity <= t.threshold, zero = t.quantity===0;
                  const pct = Math.min(100, Math.round((t.quantity/(t.threshold*2||10))*100));
                  return (
                    <tr key={t.id} onClick={()=>setSelId(t.id)} style={{cursor:"pointer",background:selId===t.id?"#f0f9ff":""}}>
                      <td>
                        <div style={{fontWeight:600}}>{t.name}</div>
                        <div className="subtle">{t.manufacturer} · {t.partNumber}</div>
                        {(t.machineGroup||t.toolType) && <div className="subtle" style={{display:"flex",gap:6,flexWrap:"wrap",marginTop:4}}>
                          {t.machineGroup && <span className="badge pill">{t.machineGroup}</span>}
                          {t.toolType && <span className="badge pill">{t.toolType}</span>}
                        </div>}
                      </td>
                      <td>
                        <div style={{display:"flex",alignItems:"center",gap:12}}>
                          <input type="number" min="0" value={t.quantity}
                            onChange={e=>setTools(p=>p.map(x=>x.id===t.id?{...x,quantity:Math.max(0,parseInt(e.target.value)||0)}:x))}
                            onClick={e=>e.stopPropagation()}
                            style={{width:80,padding:"8px 10px",border:"1px solid var(--border)",borderRadius:8,background:"white",fontWeight:600,textAlign:"center"}}/>
                          <div style={{flex:1}}>
                            <div className="progress"><span style={{width:`${pct}%`,background:zero?"#ef4444":low?"#f59e0b":"#10b981"}}/></div>
                            <div className="subtle" style={{fontSize:11}}>min {t.threshold}</div>
                          </div>
                        </div>
                      </td>
                      <td>{t.vendor||"—"}</td>
                      <td style={{textAlign:"right"}}>{money(t.quantity*t.price)}</td>
                      <td style={{whiteSpace:"nowrap"}}>
                        <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                          <button className="btn" onClick={e=>{e.stopPropagation();updQty(t.id,-1)}}>−1</button>
                          <button className="btn btn-primary" onClick={e=>{e.stopPropagation();navigator.clipboard.writeText(JSON.stringify({toolId:t.id,qty:1}));note("QR copied — scan!");}}>📱 Pull</button>
                          <button className="btn" onClick={e=>{e.stopPropagation();toQueue(t)}}>Reorder</button>
                          <button className="btn" onClick={e=>{e.stopPropagation();setModal({...t,projects:t.projects.join(", ")});setModalOpen(true)}}>Edit</button>
                          <button className="btn btn-danger" onClick={e=>{e.stopPropagation();delTool(t.id)}}>Del</button>
                        </div>
                      </td>
                      <td>{zero?<span className="badge zero">❌ Out</span>:low?<span className="badge low">⚠️ Low</span>:<span className="badge ok">✅ OK</span>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* SIDEBAR */}
        <aside style={{display:"flex",flexDirection:"column",gap:16}}>
          {sel ? (
            <div className="card" style={{padding:16,boxShadow:"0 4px 12px rgba(0,0,0,0.08)"}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"start"}}>
                <div>
                  <h2 style={{margin:0,fontSize:20}}>{sel.name}</h2>
                  <div style={{fontSize:13,color:"#64748b",marginTop:4}}>
                    {sel.manufacturer} · {sel.partNumber}
                  </div>
                </div>
                <span className={`badge ${sel.quantity===0?"zero":sel.quantity<=sel.threshold?"low":"ok"}`} style={{fontSize:11}}>
                  {sel.quantity===0?"OUT":sel.quantity<=sel.threshold?"LOW":"OK"}
                </span>
              </div>
              <svg width="100%" height="100" viewBox="0 0 300 100" style={{margin:"16px 0",background:"#fff",borderRadius:8,border:"1px solid #e2e8f0"}}>
                <path d={sparklinePath(fakeHistory(sel.quantity, sel.threshold),300,100)} fill="none" stroke="#3b82f6" strokeWidth="3"/>
                <line x1="0" x2="300" y1="80" y2="80" stroke="#f97316" strokeDasharray="6 6"/>
              </svg>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,fontSize:14}}>
                <div><div style={{color:"#64748b"}}>On Hand</div><div style={{fontWeight:700,fontSize:20}}>{sel.quantity}</div></div>
                <div><div style={{color:"#64748b"}}>Incoming</div><div style={{fontWeight:700,fontSize:20}}>{orders.filter(o=>o.id===sel.id).length}</div></div>
                <div><div style={{color:"#64748b"}}>Need</div><div style={{fontWeight:700,fontSize:20}}>{Math.max(0,sel.threshold-sel.quantity)}</div></div>
                <div><div style={{color:"#64748b"}}>Value</div><div style={{fontWeight:700,fontSize:20}}>{money(sel.quantity*sel.price)}</div></div>
              </div>
              <div style={{marginTop:16,display:"flex",gap:8,flexWrap:"wrap"}}>
                <button className="btn" style={{flex:1}} onClick={()=>updQty(sel.id,-1)}>-1</button>
                <button className="btn btn-primary" style={{flex:2}} onClick={()=>{navigator.clipboard.writeText(JSON.stringify({toolId:sel.id,qty:1}));note("QR copied!")}}>📱 Pull</button>
                <button className="btn btn-success" style={{flex:2}} onClick={()=>ordered(sel.id)}>Mark Ordered</button>
              </div>
            </div>
          ) : (
            <div className="card" style={{padding:32,textAlign:"center",color:"#64748b"}}>
              <div style={{fontSize:48}}>🛠️</div>
              <p style={{margin:"12px 0 0",fontSize:14}}>Select a tool to see<br/>Fulcrum-style details</p>
            </div>
          )}
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,fontSize:13}}>
            <div className="card" style={{padding:12,textAlign:"center"}}>
              <div style={{color:"#64748b"}}>Total Tools</div>
              <div style={{fontWeight:700,fontSize:18}}>{tools.length}</div>
            </div>
            <div className="card" style={{padding:12,textAlign:"center"}}>
              <div style={{color:"#64748b"}}>Queue</div>
              <div style={{fontWeight:700,fontSize:18}}>{queue.length}</div>
            </div>
          </div>
        </aside>
      </div>

      {/* QUEUE + POs — PERFECT STACK */}
      <div style={{margin:"24px 24px 0",display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(340px,1fr))",gap:16}}>
        <div className="card" style={{padding:0,boxShadow:"0 4px 12px rgba(0,0,0,0.08)"}}>
          <div style={{padding:"16px 20px",background:"#fef3c7",borderBottom:"1px solid #fde68a",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <strong style={{fontSize:16}}>📦 Reorder Queue ({queue.length})</strong>
            <button className="btn btn-success btn-sm" onClick={receiveAll}>Receive All</button>
          </div>
          <div style={{maxHeight:340,overflow:"auto"}}>
            {queue.length===0 ? (
              <div style={{padding:40,textAlign:"center",color:"#64748b"}}>
                <div style={{fontSize:48}}>✨</div>
                <p>No items — you’re golden!</p>
              </div>
            ) : (
              <ul style={{margin:0,padding:0,listStyle:"none"}}>
                {[...new Map(queue.map(t=>[t.id,t])).values()].map(t=>(
                  <li key={t.id} style={{padding:"12px 20px",borderBottom:"1px dashed #e2e8f0",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                    <div>
                      <div style={{fontWeight:600}}>{t.name}</div>
                      <div style={{fontSize:12,color:"#64748b"}}>need {t.threshold} • {t.quantity} on hand</div>
                    </div>
                    <div style={{display:"flex",gap:8}}>
                      <button className="btn btn-success btn-sm" onClick={()=>ordered(t.id)}>Ordered</button>
                      <button className="btn btn-danger btn-sm" onClick={()=>rmQueue(t.id)}>×</button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div className="card" style={{padding:0,boxShadow:"0 4px 12px rgba(0,0,0,0.08)"}}>
          <div style={{padding:"16px 20px",background:"#dbeafe",borderBottom:"1px solid #93c5fd"}}>
            <strong style={{fontSize:16}}>🧾 Pending POs ({orders.length})</strong>
          </div>
          <div style={{maxHeight:340,overflow:"auto"}}>
            {orders.length===0 ? (
              <div style={{padding:40,textAlign:"center",color:"#64748b"}}>No open POs</div>
            ) : (
              <ul style={{margin:0,padding:0,listStyle:"none"}}>
                {orders.map(o=>(
                  <li key={o.orderId} style={{padding:"12px 20px",borderBottom:"1px dashed #e2e8f0",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                    <div>
                      <div style={{fontWeight:600}}>{o.name}</div>
                      <div style={{fontSize:12,color:"#64748b"}}>{new Date(o.orderedAt).toLocaleDateString()}</div>
                    </div>
                    <button className="btn btn-success btn-sm" onClick={()=>received(o.orderId)}>+ Receive</button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>

      {/* TOAST */}
      {toast && <div className="toast"><span>✅</span><span>{toast}</span></div>}

      {/* EDIT MODAL */}
      {modalOpen && (
        <div className="modal-backdrop" onClick={()=>setModalOpen(false)}>
          <div className="card" style={{width:"min(820px,92vw)",padding:20}} onClick={e=>e.stopPropagation()}>
            <h3>Edit Tool</h3>
            <div className="form-grid" style={{gridTemplateColumns:"1fr 1fr 1fr",gap:12}}>
              <Input label="Name" value={modal.name} onChange={v=>setModal(p=>({...p,name:v}))}/>
              <Input label="Mfr" value={modal.manufacturer} onChange={v=>setModal(p=>({...p,manufacturer:v}))}/>
              <Input label="Part#" value={modal.partNumber} onChange={v=>setModal(p=>({...p,partNumber:v}))}/>
              <div style={{gridColumn:"1/-1"}}><Input label="Desc" value={modal.description} onChange={v=>setModal(p=>({...p,description:v}))}/></div>
              <Input label="Qty" type="number" value={modal.quantity} onChange={v=>setModal(p=>({...p,quantity:v}))}/>
              <Input label="Low" type="number" value={modal.threshold} onChange={v=>setModal(p=>({...p,threshold:v}))}/>
              <Input label="Price" type="number" step="0.01" value={modal.price} onChange={v=>setModal(p=>({...p,price:v}))}/>
              <Input label="Vendor" value={modal.vendor} onChange={v=>setModal(p=>({...p,vendor:v}))}/>
              <div style={{gridColumn:"1/-1"}}><Input label="Projects" value={modal.projects} onChange={v=>setModal(p=>({...p,projects:v}))}/></div>
              <SelectWithOther label="Machine" value={modal.machineGroup} setValue={v=>setModal(p=>({...p,machineGroup:v}))} baseOptions={MACHINE_GROUPS_BASE}/>
              <SelectWithOther label="Type" value={modal.toolType} setValue={v=>setModal(p=>({...p,toolType:v}))} baseOptions={TOOL_TYPES_BASE}/>
            </div>
            <LocationSection value={modal.location} onChange={loc=>setModal(p=>({...p,location:loc}))}/>
            <div className="toolbar" style={{marginTop:16}}>
              <button className="btn" onClick={()=>setModalOpen(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={()=>{
                setTools(p=>p.map(t=>t.id===modal.id?{...t,
                  name:modal.name.trim(),manufacturer:modal.manufacturer.trim(),partNumber:modal.partNumber.trim(),description:modal.description.trim(),
                  quantity:Math.max(0,parseInt(modal.quantity)||0),threshold:Math.max(0,parseInt(modal.threshold)||0),
                  price:Number(parseFloat(modal.price||0).toFixed(2)),vendor:modal.vendor.trim(),
                  projects:modal.projects.split(",").map(s=>s.trim()).filter(Boolean),
                  location:modal.location,machineGroup:modal.machineGroup,toolType:modal.toolType
                }:t));
                setModalOpen(false); note("Saved 💾");
              }}>Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}