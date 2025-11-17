// src/App.jsx
import React, { useEffect, useState } from "react";
import { migrateOnce } from "./storage";
import ToolInventoryApp from "./ToolInventoryApp";
import OperatorPull from "./OperatorPull";
import JobKitting from "./JobKitting";
import Analytics from "./Analytics";
import Login from "./Login";
import "./modern-light.css";

// Shared header component
function Header({ currentPage, onToggleDark }) {
  const pages = [
    { id: "admin", label: "Admin", hash: "#/" },
    { id: "operator", label: "Operator", hash: "#/operator" },
    { id: "kitting", label: "Job Kitting", hash: "#/kitting" },
    { id: "analytics", label: "Analytics", hash: "#/analytics" }
  ];

  return (
    <div className="header" style={{
      background: "var(--card)",
      borderBottom: "1px solid var(--border)",
      padding: "12px 24px",
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      boxShadow: "var(--shadow)"
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        <div style={{ fontSize: 32 }}>🛠️</div>
        <div>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: "var(--text)" }}>Toolly</h1>
          <p style={{ margin: "4px 0 0", fontSize: 13, color: "var(--muted)" }}>
            CNC Tooling Management • $10/mo • Unlimited users
          </p>
        </div>
      </div>

      <div className="toolbar" style={{ gap: 10 }}>
        {/* Navigation Pills */}
        {pages.map(page => (
          <a
            key={page.id}
            className={`pill ${currentPage === page.id ? "active" : ""}`}
            href={page.hash}
            style={{ textDecoration: "none" }}
          >
            {page.label}
          </a>
        ))}

        {/* Dark Mode Toggle */}
        <button
          className="btn"
          onClick={() => {
            document.body.classList.toggle("dark");
            const isDark = document.body.classList.contains("dark");
            localStorage.setItem("toolly_dark", isDark);
          }}
          style={{
            fontSize: 20,
            padding: "6px 12px",
            minWidth: 44,
            display: "flex",
            alignItems: "center",
            justifyContent: "center"
          }}
          title="Toggle dark mode"
        >
          {document.body.classList.contains("dark") ? "🌙" : "☀️"}
        </button>
      </div>
    </div>
  );
}

function useHashRoute() {
  const getRoute = () => (window.location.hash || "#/").replace(/^#/, "");
  const [route, setRoute] = useState(getRoute());
  
  useEffect(() => {
    const onHash = () => setRoute(getRoute());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);
  
  return route;
}

export default function App() {
  const route = useHashRoute();

  useEffect(() => {
    // Normalize any legacy data once per browser
    migrateOnce();
    
    // Initialize dark mode from localStorage or system preference
    if (localStorage.getItem("toolly_dark") === "true" || 
        (!localStorage.getItem("toolly_dark") && window.matchMedia("(prefers-color-scheme: dark)").matches)) {
      document.body.classList.add("dark");
    }
  }, []);

  // Determine current page for header
  let currentPage = "admin";
  if (route.startsWith("/operator")) currentPage = "operator";
  else if (route.startsWith("/kitting")) currentPage = "kitting";
  else if (route.startsWith("/analytics")) currentPage = "analytics";

  // Operator page requires login
  if (route.startsWith("/operator")) {
    const session = JSON.parse(localStorage.getItem("ttl_session") || "null");
    if (!session) {
      return <Login onSuccess={() => { window.location.hash = "#/operator"; }} />;
    }
    return (
      <>
        <Header currentPage={currentPage} />
        <OperatorPull />
      </>
    );
  }

  // Analytics page
  if (route.startsWith("/analytics")) {
    return (
      <>
        <Header currentPage={currentPage} />
        <Analytics />
      </>
    );
  }

  // Job Kitting page
  if (route.startsWith("/kitting")) {
    return (
      <>
        <Header currentPage={currentPage} />
        <JobKitting />
      </>
    );
  }

  // Default: Admin page (inventory)
  return <ToolInventoryApp />;
}