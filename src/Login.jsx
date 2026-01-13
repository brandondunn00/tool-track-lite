// src/Login.jsx
import React, { useState } from "react";
import "./modern-light.css";
import { auth } from "./firebase";
import { signInWithEmailAndPassword } from "firebase/auth";

export default function Login({ onSuccess }) {
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setErr("");
    setBusy(true);
    try {
      await signInWithEmailAndPassword(auth, email.trim(), pw);
      onSuccess?.();
    } catch (ex) {
      setErr(ex?.message || "Login failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="app" style={{ maxWidth: 520 }}>
      <div className="card" style={{ padding: 18 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
          <div style={{ fontSize: 28 }}>🔐</div>
          <div>
            <div style={{ fontSize: 18, fontWeight: 800 }}>Sign in</div>
            <div className="subtle" style={{ marginTop: 2 }}>Use your Toolly shop login.</div>
          </div>
        </div>

        <form onSubmit={submit} style={{ display: "grid", gap: 12 }}>
          <div className="input">
            <label>Email</label>
            <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@company.com" />
          </div>

          <div className="input">
            <label>Password</label>
            <input type="password" value={pw} onChange={(e) => setPw(e.target.value)} placeholder="••••••••" />
          </div>

          {err && (
            <div style={{ color: "#ef4444", fontSize: 13 }}>
              {err}
            </div>
          )}

          <button className="btn btn-primary" disabled={busy || !email || !pw} type="submit">
            {busy ? "Signing in…" : "Sign in"}
          </button>

          <div className="subtle" style={{ fontSize: 12 }}>
            If you don’t have a login yet, ask your admin to create one in Firebase Auth and assign your role in Toolly Settings.
          </div>
        </form>
      </div>
    </div>
  );
}
