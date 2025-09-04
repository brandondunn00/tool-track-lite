// src/Login.jsx
import React, { useEffect, useState } from "react";
import { LS, load, save } from "./storage";
import "./modern-light.css";

export default function Login({ onSuccess }) {
  const [username, setUsername] = useState("");
  const [pin, setPin] = useState("");
  const [err, setErr] = useState("");

  useEffect(() => {
    // Seed default operator if none
    const users = load(LS.users, []);
    if (!users || users.length === 0) {
      const seeded = [{ id: 1, username: "operator", pin: "1234", role: "operator" }];
      save(LS.users, seeded);
    }
  }, []);

  const handleLogin = (e) => {
    e.preventDefault();
    const users = load(LS.users, []);
    const user = users.find((u) => u.username === username && u.pin === pin);

    if (!user) {
      setErr("Invalid username or PIN");
      return;
    }

    // Save session
    const session = { username: user.username, role: user.role, ts: Date.now() };
    save(LS.session, session);

    // Tell the rest of the app in this same tab
    try {
      window.dispatchEvent(new Event("session-updated"));
      // also kick hash router
      window.dispatchEvent(new HashChangeEvent("hashchange"));
    } catch {}

    // Route to operator
    window.location.hash = "#/operator";

    // Optional callback
    onSuccess?.(user);
  };

  return (
    <div className="app" style={{ alignItems: "center", justifyContent: "center", display: "flex" }}>
      <div className="card" style={{ width: 360, padding: 18 }}>
        <h2 style={{ marginTop: 0, marginBottom: 10 }}>Operator Login</h2>
        <form onSubmit={handleLogin} className="input" style={{ gap: 10 }}>
          <div className="input">
            <label>Username</label>
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="operator"
              autoComplete="username"
            />
          </div>
          <div className="input">
            <label>PIN</label>
            <input
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              placeholder="1234"
              inputMode="numeric"
              autoComplete="current-password"
              type="password"
            />
          </div>
          {err && <div style={{ color: "#b91c1c", fontSize: 12 }}>{err}</div>}
          <button className="btn btn-primary" type="submit" style={{ marginTop: 6 }}>
            Sign in
          </button>
          <div className="subtle" style={{ marginTop: 8 }}>
            Tip: default user is <strong>operator / 1234</strong>
          </div>
        </form>
      </div>
    </div>
  );
}
