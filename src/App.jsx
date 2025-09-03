// src/App.jsx
import React, { useEffect, useMemo, useSyncExternalStore } from "react";
import ToolInventoryApp from "./ToolInventoryApp";
import Login from "./Login";
import OperatorPull from "./OperatorPull";
console.log("Router App mounted, hash =", window.location.hash);


function getHash() {
  // Normalize: "#/operator" -> "/operator", "" -> "/admin"
  const raw = (typeof window !== "undefined" ? window.location.hash : "") || "";
  const h = raw.replace(/^#/, "");
  return h || "/admin";
}
function subscribeHash(cb) {
  window.addEventListener("hashchange", cb);
  return () => window.removeEventListener("hashchange", cb);
}

export default function App() {
  // This forces React to re-render whenever the hash changes.
  const hash = useSyncExternalStore(subscribeHash, getHash, getHash);

  // ensure a default on first mount (e.g., direct hits to /)
  useEffect(() => {
    if (!window.location.hash) {
      window.location.hash = "#/admin";
    }
  }, []);

  const route = useMemo(() => {
    const h = hash.toLowerCase();
    if (h.startsWith("/operator")) return "operator";
    return "admin";
  }, [hash]);

  if (route === "operator") {
    const session = safeJSON(localStorage.getItem("ttl_session"));
    if (!session || session.role !== "operator") {
      return <Login onSuccess={() => (window.location.hash = "#/operator")} />;
    }
    return <OperatorPull onLogout={() => {}} />;
  }

  return <ToolInventoryApp />;
}

function safeJSON(s) {
  try { return JSON.parse(s || "null"); } catch { return null; }
}
