// src/App.js
import React, { useEffect, useState } from "react";
import ToolInventoryApp from "./ToolInventoryApp"; // your main/admin page
import JobKitting from "./JobKitting";              // the kitting page

const LS_NAV = "ttl_active_tab";
const getActiveTab = () => localStorage.getItem(LS_NAV) || "inventory";

export default function App() {
  const [tab, setTab] = useState(getActiveTab());

  // allow any page to change tabs by writing LS + dispatching `ttl:navigate`
  useEffect(() => {
    const onNavigate = () => setTab(getActiveTab());
    window.addEventListener("ttl:navigate", onNavigate);
    return () => window.removeEventListener("ttl:navigate", onNavigate);
  }, []);

  const setActive = (t) => {
    localStorage.setItem(LS_NAV, t);
    setTab(t);
    // after setTab is defined
useEffect(() => {
  window.__TTL_SET_TAB = (t) => {
    localStorage.setItem("ttl_active_tab", t);
    setTab(t);
  };
  return () => { delete window.__TTL_SET_TAB; };
}, []);

    // optional notify listeners
    try { window.dispatchEvent(new Event("ttl:navigate")); } catch {}
  };

  return (
    <div style={{ minHeight: "100vh" }}>
      {/* Global tab bar */}
      <div className="toolbar" style={{ gap: 8, padding: "10px 16px" }}>
        <button
          className={`pill ${tab === "inventory" ? "active" : ""}`}
          onClick={() => setActive("inventory")}
        >
          Home / Admin
        </button>
        <button
          className={`pill ${tab === "jobkitting" ? "active" : ""}`}
          onClick={() => setActive("jobkitting")}
        >
          Job Kitting
        </button>
      </div>

      {/* Current page */}
      {tab === "inventory" ? <ToolInventoryApp /> : <JobKitting />}
    </div>
  );
}
