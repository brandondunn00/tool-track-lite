// src/App.jsx
import React, { useEffect, useState } from "react";
import { migrateOnce, LS, load } from "./storage";
import ToolInventoryApp from "./ToolInventoryApp";
import OperatorPull from "./OperatorPull";  // keep this file in place
import JobKitting from "./JobKitting";      // keep this file in place
import Login from "./Login";                // keep this file in place
import "./modern-light.css";

// Temporary lightweight Analytics placeholder
function AnalyticsPlaceholder() {
  return (
    <div className="app">
      <div className="header">
        <div className="brand">
          <div className="logo">📊</div>
          <h1>Analytics</h1>
        </div>
        <div className="toolbar">
          <a className="btn" href="#/">Admin</a>
          <a className="btn" href="#/kitting">Job Kitting</a>
          <a className="btn" href="#/operator">Operator</a>
        </div>
      </div>
      <div className="card" style={{ padding: 16 }}>
        Analytics page not yet added. Create <code>src/Analytics.jsx</code> and replace this placeholder.
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
  return [route, (to) => (window.location.hash = to)];
}

export default function App() {
  const [route] = useHashRoute();

  useEffect(() => {
    // Normalize any legacy data once per browser
    migrateOnce();
  }, []);

  // simple route switcher
  if (route.startsWith("/operator")) {
    const session = load(LS.session, null);
    if (!session) {
      return (
        <Login
          onSuccess={() => {
            window.location.hash = "#/operator/home";
          }}
        />
      );
    }
    return <OperatorPull />;
  }

  if (route.startsWith("/analytics")) {
    return <AnalyticsPlaceholder />; // replace with your real <Analytics /> once you add it
  }

  if (route.startsWith("/kitting")) {
    return <JobKitting />;
  }

  // default: admin (inventory)
  return <ToolInventoryApp />;
}
