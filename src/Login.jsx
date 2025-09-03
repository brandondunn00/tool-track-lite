// src/Login.jsx
import React, { useEffect, useState } from "react";
import { LS, load, save } from "./storage.old";
import "./modern-light.css";

export default function Login({ onSuccess }) {
  const [username, setUsername] = useState("");
  const [pin, setPin] = useState("");
  const [err, setErr] = useState("");

  useEffect(() => {
    // Seed a default operator if none exist
    const users = load(LS.users, []);
    if (!users.length) {
      const seeded = [{ id: 1, username: "operator", pin: "1234", role: "operator" }];
      save(LS.users, seeded);
    }
  }, []);

  const handleLogin = (e) => {
    e.preventDefault();
    setErr("");

    const users = load(LS.users, []);
    const user = users.find(
      (u) => u.username.trim() === username.trim() && u.pin === pin
    );

    if (!user) {
      setErr("Invalid username or PIN");
      return;
    }

    // Save session
    save(LS.session, { username: user.username, role: user.role, ts: Date.now() });

    // Navigate and force a hard refresh so the router re-mounts immediately
    window.location.hash = "#/operator/home";
    window.location.reload(); // <- guarantees you land in OperatorPull right away

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
              autoFocus
            />
          </div>

        <div className="input">
            <label>PIN</label>
            <input
              type="password"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              placeholder="1234"
              inputMode="numeric"
            />
          </div>

          {err && <div style={{ color: "#b91c1c", fontSize: 12 }}>{err}</div>}

          <button className="btn btn-primary" type="submit" style={{ marginTop: 6 }}>
            Sign in
          </button>
        </form>

        <div className="subtle" style={{ marginTop: 12 }}>
          Default operator: <strong>operator / 1234</strong>
        </div>
      </div>
    </div>
  );
}
