// src/App.jsx
import React, { useEffect, useMemo, useState } from "react";
import "./modern-light.css";

import ToolInventoryApp from "./ToolInventoryApp";
import OperatorPull from "./OperatorPull";
import JobKitting from "./JobKitting";
import Analytics from "./Analytics";
import Login from "./Login";
import Settings from "./Settings";
import Requisitions from "./Requisitions";

import { auth, db } from "./firebase";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";

/** Hash routing */
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

/** Role-based access */
const ROLE_ORDER = ["operator", "buyer", "setup", "purchasing", "manager", "cfo", "admin"];
const roleAtLeast = (role, minimum) => {
  const r = ROLE_ORDER.indexOf(role);
  const m = ROLE_ORDER.indexOf(minimum);
  return r >= 0 && m >= 0 && r >= m;
};

function Header({ currentPage, session }) {
  const role = session?.role || "operator";

  const pages = [
    { id: "operator", label: "Operator", hash: "#/operator", allow: ["operator","setup","purchasing","cfo","admin"] },
    { id: "kitting", label: "Job Kitting", hash: "#/kitting", allow: ["setup","purchasing","manager","cfo","admin"] },
    { id: "admin", label: "Admin", hash: "#/", allow: ["purchasing","manager","cfo","admin"] },
    { id: "requisitions", label: "Requisitions", hash: "#/requisitions", allow: ["purchasing","manager","cfo","admin"] },
    { id: "analytics", label: "Analytics", hash: "#/analytics", allow: ["purchasing","manager","cfo","admin"] },
    { id: "settings", label: "Settings", hash: "#/settings", allow: ["admin"] },
  ].filter(p => p.allow.includes(role));

  return (
    <div
      className="header"
      style={{
        background: "var(--card)",
        borderBottom: "1px solid var(--border)",
        padding: "12px 24px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        boxShadow: "var(--shadow)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        <div style={{ fontSize: 32 }}>🛠️</div>
        <div>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: "var(--text)" }}>Toolly</h1>
          <p style={{ margin: "4px 0 0", fontSize: 13, color: "var(--muted)" }}>
            CNC Tooling Management
          </p>
        </div>
      </div>

      <div className="toolbar" style={{ gap: 10 }}>
        {pages.map((page) => (
          <a
            key={page.id}
            className={`pill ${currentPage === page.id ? "active" : ""}`}
            href={page.hash}
            style={{ textDecoration: "none" }}
          >
            {page.label}
          </a>
        ))}

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
            justifyContent: "center",
          }}
          title="Toggle dark mode"
        >
          {document.body.classList.contains("dark") ? "🌙" : "☀️"}
        </button>

        {session?.user && (
          <button
            className="btn"
            onClick={async () => {
              await signOut(auth);
              window.location.hash = "#/operator";
            }}
            title="Sign out"
          >
            Sign out
          </button>
        )}
      </div>
    </div>
  );
}

/** Load role/profile from Firestore users/{uid} */
async function fetchUserProfile(uid) {
  const snap = await getDoc(doc(db, "users", uid));
  if (snap.exists()) return snap.data();
  return null;
}

export default function App() {
  const route = useHashRoute();
  const [session, setSession] = useState({ loading: true, user: null, role: null, profile: null });

  useEffect(() => {
    // Initialize dark mode from localStorage or system preference
    if (
      localStorage.getItem("toolly_dark") === "true" ||
      (!localStorage.getItem("toolly_dark") &&
        window.matchMedia("(prefers-color-scheme: dark)").matches)
    ) {
      document.body.classList.add("dark");
    }
  }, []);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setSession({ loading: false, user: null, role: null, profile: null });
        return;
      }
      const profile = await fetchUserProfile(user.uid);
      const role = profile?.role || "operator";
      setSession({ loading: false, user, role, profile });
    });
    return () => unsub();
  }, []);

  const currentPage = useMemo(() => {
    if (route.startsWith("/settings")) return "settings";
    if (route.startsWith("/analytics")) return "analytics";
    if (route.startsWith("/kitting")) return "kitting";
    if (route.startsWith("/operator")) return "operator";
    return "admin";
  }, [route]);

  const requireAuth = (children) => {
    if (session.loading) return <div className="app"><div className="card" style={{ padding: 16 }}>Loading…</div></div>;
    if (!session.user) return <Login onSuccess={() => { /* App re-renders on auth */ }} />;
    return children;
  };

  const requireRole = (minimumRole, children) => {
    return requireAuth(
      roleAtLeast(session.role || "operator", minimumRole)
        ? children
        : (
          <div className="app">
            <div className="card" style={{ padding: 16 }}>
              <strong>Access denied.</strong>
              <div className="subtle" style={{ marginTop: 6 }}>
                Your role (<b>{session.role || "operator"}</b>) can’t access this page.
              </div>
            </div>
          </div>
        )
    );
  };

  // Routes
  if (route.startsWith("/operator")) {
    return (
      <>
        <Header currentPage={currentPage} session={session} />
        {requireAuth(<OperatorPull session={session} />)}
      </>
    );
  }

  if (route.startsWith("/kitting")) {
    return (
      <>
        <Header currentPage={currentPage} session={session} />
        {requireRole("setup", <JobKitting session={session} />)}
      </>
    );
  }

  if (route.startsWith("/analytics")) {
    return (
      <>
        <Header currentPage={currentPage} session={session} />
        {requireRole("purchasing", <Analytics session={session} />)}
      </>
    );
  }

  if (route.startsWith("/settings")) {
    return (
      <>
        <Header currentPage={currentPage} session={session} />
        {requireRole("admin", <Settings session={session} />)}
      </>
    );
  }

  
  if (route.startsWith("/requisitions")) {
    return (
      <>
        <Header currentPage={currentPage} session={session} />
        {requireRole("purchasing", <Requisitions session={session} />)}
      </>
    );
  }

// Default: Admin inventory
  return (
    <>
      <Header currentPage={currentPage} session={session} />
      {requireRole("purchasing", <ToolInventoryApp session={session} />)}
    </>
  );
}
