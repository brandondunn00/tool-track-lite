// src/JobKitting.jsx
import React, { useCallback, useEffect, useMemo, useState } from "react";

/** ---------------- localStorage keys ---------------- */
const LS = {
  JOB_KITS: "ttl_job_kits",
  PULLS: "ttl_recent_pulls",
  TOOLS: "ttl_tools", // from your Inventory page
  NAV: "ttl_active_tab",
};

/** ---------------- small helpers ---------------- */
const nowISO = () => new Date().toISOString();
const fmtDate = (iso) =>
  new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

/** ---------------- status badge ---------------- */
function Status({ value }) {
  const map = {
    draft: { bg: "#eef2ff", bd: "#c7d2fe", fg: "#3730a3", label: "Draft" },
    allocated: { bg: "#fffbeb", bd: "#fde68a", fg: "#92400e", label: "Allocated" },
    staged: { bg: "#ecfeff", bd: "#a5f3fc", fg: "#155e75", label: "Staged" },
    issued: { bg: "#f0fdf4", bd: "#bbf7d0", fg: "#166534", label: "Issued" },
    canceled: { bg: "#fff1f2", bd: "#fecaca", fg: "#991b1b", label: "Canceled" },
  };
  const s = map[value] || map.draft;
  return (
    <span
      className="badge"
      style={{
        background: s.bg,
        borderColor: s.bd,
        color: s.fg,
        fontSize: 12,
        padding: "4px 8px",
      }}
    >
      {s.label}
    </span>
  );
}

/** tiny input */
function Field({ label, value, onChange, ...props }) {
  return (
    <label style={{ display: "grid", gap: 6 }}>
      <span className="subtle">{label}</span>
      <input
        {...props}
        value={String(value ?? "")}
        onChange={(e) => onChange?.(e.target.value)}
        style={{
          width: "100%",
          padding: "10px 12px",
          border: "1px solid var(--border)",
          borderRadius: 10,
          outline: "none",
        }}
      />
    </label>
  );
}

/** ---------------- main ---------------- */
export default function JobKitting() {
  const [jobKits, setJobKits] = useState([]);
  const [pulls, setPulls] = useState([]);
  const [tools, setTools] = useState([]);

  const [toast, setToast] = useState("");

  // create-new modal
  const [isNewOpen, setNewOpen] = useState(false);
  const [draft, setDraft] = useState({
    project: "",
    customer: "",
    partName: "",
    partNumber: "",
  });

  // requirements modal
  const [reqOpen, setReqOpen] = useState(false);
  const [reqJobId, setReqJobId] = useState(null);

  // load
  useEffect(() => {
    try {
      const j = JSON.parse(localStorage.getItem(LS.JOB_KITS) || "[]");
      const p = JSON.parse(localStorage.getItem(LS.PULLS) || "[]");
      const t = JSON.parse(localStorage.getItem(LS.TOOLS) || "[]");
      setJobKits(Array.isArray(j) ? j : []);
      setPulls(Array.isArray(p) ? p : []);
      setTools(Array.isArray(t) ? t : []);
    } catch {
      // ignore
    }
  }, []);

  // persist
  useEffect(() => {
    localStorage.setItem(LS.JOB_KITS, JSON.stringify(jobKits));
  }, [jobKits]);
  useEffect(() => {
    localStorage.setItem(LS.PULLS, JSON.stringify(pulls));
  }, [pulls]);

  const note = (m) => {
    setToast(m);
    clearTimeout(note._t);
    note._t = setTimeout(() => setToast(""), 2000);
  };

  /** ----------- derived lists ----------- */
  const recentJobs = useMemo(
    () =>
      [...jobKits]
        .sort((a, b) => (b.updatedAt || b.createdAt || "").localeCompare(a.updatedAt || a.createdAt || ""))
        .slice(0, 8),
    [jobKits]
  );

  const recentPulls = useMemo(
    () => [...pulls].sort((a, b) => (b.date || "").localeCompare(a.date || "")).slice(0, 8),
    [pulls]
  );

  /** ----------- actions ----------- */
  const createDraft = (openReqAfter = false) => {
    const id = `${Date.now()}`;
    const kit = {
      id,
      status: "draft",
      ...draft,
      requirements: [],
      setupSheet: null,
      createdAt: nowISO(),
      updatedAt: nowISO(),
    };
    setJobKits((prev) => [kit, ...prev]);
    setNewOpen(false);
    setDraft({ project: "", customer: "", partName: "", partNumber: "" });
    note("Job kit created");
    if (openReqAfter) {
      setReqJobId(id);
      setReqOpen(true);
    }
  };

  const removeJob = (id) => {
    if (!window.confirm("Remove this job kit?")) return;
    setJobKits((prev) => prev.filter((j) => j.id !== id));
    note("Removed");
  };

  const removePull = (id) => {
    setPulls((prev) => prev.filter((p) => p.id !== id));
  };

  // open job -> requirements editor (for draft in this phase)
  const openJob = (id) => {
    setReqJobId(id);
    setReqOpen(true);
  };

  /** ----------- nav tabs ----------- */
  const goHome = () => {
    // 1) set LS and emit event (used by App.js)
    localStorage.setItem(LS.NAV, "inventory");
    try {
      window.dispatchEvent(new Event("ttl:navigate"));
    } catch {}

    // 2) if App.js exposes a helper, call it directly
    if (typeof window.__TTL_SET_TAB === "function") {
      try {
        window.__TTL_SET_TAB("inventory");
      } catch {}
    }

    // 3) last resort: bump the hash (so Back works visually)
    if (!window.location.hash || window.location.hash !== "#inventory") {
      try {
        window.location.hash = "#inventory";
      } catch {}
    }
  };

  const viewAll = () => note("View All (we'll build list page)");

  /** ----------- ui ----------- */
  return (
    <div className="app">
      {/* Header */}
      <div className="header">
        <div className="brand" style={{ cursor: "pointer" }} onClick={goHome}>
          <div className="logo">🧰</div>
          <h1>Job Kitting</h1>
        </div>
        <div className="toolbar">
          <button className="btn" onClick={viewAll}>
            View All
          </button>
          <button className="btn btn-primary" onClick={() => setNewOpen(true)}>
            Create New
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="toolbar" style={{ marginBottom: 8 }}>
        <button className="pill" onClick={goHome}>
          Home / Admin
        </button>
        <button className="pill active">Job Kitting</button>
      </div>

      {/* Two column content */}
      <div className="card" style={{ padding: 16, marginBottom: 12 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
          {/* Recently Opened */}
          <section className="card" style={{ padding: 16 }}>
            <h3 style={{ marginTop: 0, marginBottom: 10 }}>Recently Opened</h3>
            {recentJobs.length === 0 ? (
              <div className="subtle">Nothing here yet — create a kit to get started.</div>
            ) : (
              <ul style={{ margin: 0, padding: 0, listStyle: "none" }}>
                {recentJobs.map((j) => (
                  <li
                    key={j.id}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr auto auto auto",
                      alignItems: "center",
                      gap: 12,
                      padding: "10px 0",
                      borderBottom: "1px solid var(--border)",
                    }}
                  >
                    <div
                      style={{ cursor: "pointer" }}
                      onClick={() => openJob(j.id)}
                      title="Open job kit"
                    >
                      <div style={{ fontWeight: 700 }}>
                        {j.project || "Untitled Project"} — {j.partName || "Part ?"}
                      </div>
                      <div className="subtle">
                        {j.customer || "Customer ?"} · PN {j.partNumber || "—"} · {fmtDate(j.updatedAt || j.createdAt)}
                      </div>
                    </div>
                    <Status value={j.status} />
                    <button className="btn" onClick={() => openJob(j.id)}>
                      Edit Requirements
                    </button>
                    <button className="btn btn-danger" onClick={() => removeJob(j.id)}>
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Recent Inventory Pulls */}
          <section className="card" style={{ padding: 16 }}>
            <h3 style={{ marginTop: 0, marginBottom: 10 }}>Recent Inventory Pulls</h3>
            {recentPulls.length === 0 ? (
              <div className="subtle">No pulls yet. When kits are issued, you’ll see them here.</div>
            ) : (
              <ul style={{ margin: 0, padding: 0, listStyle: "none" }}>
                {recentPulls.map((p) => (
                  <li
                    key={p.id}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr auto",
                      alignItems: "center",
                      gap: 12,
                      padding: "10px 0",
                      borderBottom: "1px solid var(--border)",
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 600 }}>{p.toolName} — qty {p.qty}</div>
                      <div className="subtle">
                        {p.reason || "Pull"} · {p.jobRef ? `Job ${p.jobRef} · ` : ""}
                        {fmtDate(p.date)}
                      </div>
                    </div>
                    <button className="btn" onClick={() => removePull(p.id)}>
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div className="toast">
          <span>ℹ️</span>
          <span>{toast}</span>
        </div>
      )}

      {/* Create New modal */}
      {isNewOpen && (
        <div
          onClick={() => setNewOpen(false)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,.35)",
            display: "grid",
            placeItems: "center",
            zIndex: 50,
          }}
        >
          <div
            className="card"
            onClick={(e) => e.stopPropagation()}
            style={{ width: "min(820px, 96vw)", padding: 16 }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h3 style={{ margin: 0 }}>Create New Job Kit</h3>
              <button className="btn" onClick={() => setNewOpen(false)}>
                Close
              </button>
            </div>

            <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <Field label="Project" value={draft.project} onChange={(v) => setDraft({ ...draft, project: v })} placeholder="e.g., Cobalt Chrome V2" />
              <Field label="Customer" value={draft.customer} onChange={(v) => setDraft({ ...draft, customer: v })} placeholder="Acme MedTech" />
              <Field label="Part Name" value={draft.partName} onChange={(v) => setDraft({ ...draft, partName: v })} placeholder="Bracket - Upper" />
              <Field label="Part Number" value={draft.partNumber} onChange={(v) => setDraft({ ...draft, partNumber: v })} placeholder="PN-12345" />
            </div>

            <div className="toolbar" style={{ marginTop: 14, justifyContent: "flex-end" }}>
              <button className="btn" onClick={() => setNewOpen(false)}>
                Cancel
              </button>
              <button className="btn" onClick={() => createDraft(false)} disabled={!draft.project.trim() || !draft.partName.trim()} title="Project and Part Name are required">
                Save Job Kit
              </button>
              <button className="btn btn-primary" onClick={() => createDraft(true)} disabled={!draft.project.trim() || !draft.partName.trim()} title="Project and Part Name are required">
                Save & Add Requirements
              </button>
            </div>

            <div className="subtle" style={{ marginTop: 6 }}>
              Next modal lets you search inventory and set Qty per kit.
            </div>
          </div>
        </div>
      )}

      {/* Requirements Editor (Phase 2, larger with quick filters) */}
      {reqOpen && (
        <RequirementsModal
          job={jobKits.find((j) => j.id === reqJobId)}
          tools={tools}
          onClose={() => setReqOpen(false)}
          onSave={(updated) => {
            setJobKits((prev) =>
              prev.map((j) => (j.id === updated.id ? { ...updated, updatedAt: nowISO() } : j))
            );
            setReqOpen(false);
            note("Requirements saved");
          }}
        />
      )}
    </div>
  );
}

/** ---------------- Requirements Modal ---------------- */
function RequirementsModal({ job, tools, onClose, onSave }) {
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all"); // quick filter
  const [reqs, setReqs] = useState(job?.requirements || []);
  const [custom, setCustom] = useState({ name: "", qtyPerKit: "" });

  useEffect(() => {
    setReqs(job?.requirements || []);
  }, [job]);

  // Build set of available types (toolType/category; fallback to heuristic)
  const allTypes = useMemo(() => {
    const set = new Set();
    const guessType = (t) => {
      const hay = `${t.name || ""} ${t.description || ""}`.toLowerCase();
      if (t.toolType) return t.toolType;
      if (t.category) return t.category;
      if (hay.includes("endmill") || hay.includes("end mill")) return "Endmill";
      if (hay.includes("drill")) return "Drill";
      if (hay.includes("tap")) return "Tap";
      if (hay.includes("insert")) return "Insert";
      if (hay.includes("ream")) return "Reamer";
      if (hay.includes("holder") || hay.includes("collet")) return "Holder";
      if (hay.includes("saw")) return "Saw";
      if (hay.includes("burr")) return "Burr";
      return "Other";
    };
    tools.forEach((t) => set.add(guessType(t)));
    return ["all", ...Array.from(set).sort()];
  }, [tools]);

  const filterMatch = useCallback(
    (t) => {
      if (typeFilter === "all") return true;
      const ty = (t.toolType || t.category || "").toString();
      if (ty && ty.toLowerCase() === typeFilter.toLowerCase()) return true;

      const hay = `${t.name || ""} ${t.description || ""}`.toLowerCase();
      const map = {
        Endmill: ["endmill", "end mill"],
        Drill: ["drill"],
        Tap: ["tap"],
        Insert: ["insert"],
        Reamer: ["ream"],
        Holder: ["holder", "collet"],
        Saw: ["saw"],
        Burr: ["burr"],
        Other: [],
      };
      const keys = map[typeFilter] || [];
      if (keys.length === 0) {
        return !/end ?mill|drill|tap|insert|ream|holder|collet|saw|burr/.test(hay);
        }
      return keys.some((k) => hay.includes(k));
    },
    [typeFilter]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = tools;
    if (typeFilter !== "all") list = list.filter(filterMatch);
    if (!q) return list.slice(0, 50);
    return list
      .filter((t) => {
        const hay = [t.name, t.manufacturer, t.partNumber, t.description]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return hay.includes(q);
      })
      .slice(0, 50);
  }, [tools, search, typeFilter, filterMatch]);

  const addTool = (t) => {
    setReqs((prev) => {
      const idx = prev.findIndex((r) => r.toolId === t.id);
      if (idx !== -1) {
        const next = [...prev];
        next[idx] = { ...next[idx], qtyPerKit: (next[idx].qtyPerKit || 0) + 1 };
        return next;
      }
      return [
        ...prev,
        {
          toolId: t.id,
          name: t.name,
          manufacturer: t.manufacturer || "",
          partNumber: t.partNumber || "",
          description: t.description || "",
          qtyPerKit: 1,
        },
      ];
    });
  };

  const addCustom = () => {
    const name = custom.name.trim();
    const qty = Math.max(1, parseInt(custom.qtyPerKit || 1, 10));
    if (!name) return;
    setReqs((prev) => [
      ...prev,
      {
        toolId: null,
        name,
        manufacturer: "",
        partNumber: "",
        description: "",
        qtyPerKit: qty,
      },
    ]);
    setCustom({ name: "", qtyPerKit: "" });
  };

  const setQty = (toolId, nameKey, value) => {
    const qty = Math.max(0, parseInt(value || 0, 10));
    setReqs((prev) =>
      prev.map((r) =>
        (toolId ? r.toolId === toolId : r.toolId === null && r.name === nameKey)
          ? { ...r, qtyPerKit: qty }
          : r
      )
    );
  };

  const removeLine = (toolId, nameKey) => {
    setReqs((prev) =>
      prev.filter((r) => (toolId ? r.toolId !== toolId : !(r.toolId === null && r.name === nameKey)))
    );
  };

  const save = () => {
    onSave({ ...job, requirements: reqs });
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,.35)",
        display: "grid",
        placeItems: "center",
        zIndex: 60,
      }}
    >
      <div
        className="card"
        onClick={(e) => e.stopPropagation()}
        style={{ width: "min(1220px, 98vw)", padding: 16 }} // larger modal
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h3 style={{ margin: 0 }}>
            Requirements — {job.project || "Untitled"} / {job.partName || "Part"}
          </h3>
          <button className="btn" onClick={onClose}>
            Close
          </button>
        </div>

        <div
          style={{
            marginTop: 12,
            display: "grid",
            gridTemplateColumns: "1.25fr 1fr",
            gap: 16,
          }}
        >
          {/* LEFT: inventory search & add */}
          <section className="card" style={{ padding: 12 }}>
            <div className="subtle" style={{ marginBottom: 6 }}>
              Search your inventory and click Add
            </div>

            {/* quick filter chips */}
            <div className="toolbar" style={{ marginBottom: 8, flexWrap: "wrap" }}>
              {allTypes.map((ty) => (
                <button
                  key={ty}
                  className={`pill ${typeFilter === ty ? "active" : ""}`}
                  onClick={() => setTypeFilter(ty)}
                >
                  {ty === "all" ? "All Types" : ty}
                </button>
              ))}
            </div>

            <input
              placeholder="Search name, manufacturer, part #, description…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{
                width: "100%",
                padding: "10px 12px",
                border: "1px solid var(--border)",
                borderRadius: 10,
                outline: "none",
                marginBottom: 10,
              }}
            />
            <div style={{ maxHeight: 520, overflowY: "auto" }}>
              {filtered.length === 0 ? (
                <div className="subtle">No matches.</div>
              ) : (
                <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
                  {filtered.map((t) => (
                    <li
                      key={t.id}
                      style={{
                        display: "grid",
                        gridTemplateColumns: "1fr auto",
                        alignItems: "center",
                        gap: 10,
                        padding: "8px 0",
                        borderBottom: "1px solid var(--border)",
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 600 }}>{t.name || "(No name)"}</div>
                        <div className="subtle">
                          {(t.manufacturer || "—") + " · " + (t.partNumber || "—")}
                          {t.description ? " · " + t.description : ""}
                          {(t.toolType || t.category) ? " · " + (t.toolType || t.category) : ""}
                        </div>
                      </div>
                      <button className="btn" onClick={() => addTool(t)}>
                        Add
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="subtle" style={{ marginTop: 10 }}>Add custom line (not in inventory)</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 120px auto", gap: 8 }}>
              <input
                placeholder="Custom item name"
                value={custom.name}
                onChange={(e) => setCustom({ ...custom, name: e.target.value })}
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  border: "1px solid var(--border)",
                  borderRadius: 10,
                  outline: "none",
                }}
              />
              <input
                type="number"
                min="1"
                placeholder="Qty/kit"
                value={custom.qtyPerKit}
                onChange={(e) => setCustom({ ...custom, qtyPerKit: e.target.value })}
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  border: "1px solid var(--border)",
                  borderRadius: 10,
                  outline: "none",
                }}
              />
              <button className="btn" onClick={addCustom}>
                Add Custom
              </button>
            </div>
          </section>

          {/* RIGHT: selected requirements */}
          <section className="card" style={{ padding: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h4 style={{ margin: "4px 0 8px" }}>Items in this kit</h4>
              <div className="subtle">{reqs.length} line(s)</div>
            </div>

            {reqs.length === 0 ? (
              <div className="subtle">No items yet. Add from the left, or add a custom line.</div>
            ) : (
              <ul style={{ listStyle: "none", margin: 0, padding: 0, maxHeight: 520, overflowY: "auto" }}>
                {reqs.map((r) => (
                  <li
                    key={r.toolId ? r.toolId : `custom-${r.name}`}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 120px auto",
                      alignItems: "center",
                      gap: 10,
                      padding: "8px 0",
                      borderBottom: "1px solid var(--border)",
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 600 }}>{r.name}</div>
                      <div className="subtle">
                        {r.toolId
                          ? `${r.manufacturer || "—"} · ${r.partNumber || "—"}${r.description ? ` · ${r.description}` : ""}`
                          : "Custom line"}
                      </div>
                    </div>
                    <input
                      type="number"
                      min="0"
                      value={r.qtyPerKit}
                      onChange={(e) => setQty(r.toolId, r.name, e.target.value)}
                      style={{
                        width: "100%",
                        padding: "10px 12px",
                        border: "1px solid var(--border)",
                        borderRadius: 10,
                        outline: "none",
                      }}
                    />
                    <button className="btn btn-danger" onClick={() => removeLine(r.toolId, r.name)}>
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
            )}

            <div className="toolbar" style={{ marginTop: 12, justifyContent: "flex-end" }}>
              <button className="btn" onClick={onClose}>
                Cancel
              </button>
              <button className="btn btn-primary" onClick={save}>
                Save Requirements
              </button>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
