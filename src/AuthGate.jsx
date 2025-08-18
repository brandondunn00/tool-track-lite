// src/AuthGate.jsx
import React, { useEffect, useState } from "react";
import { auth } from "./firebase";
import { onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut } from "firebase/auth";

export default function AuthGate({ children }) {
  const [user, setUser] = useState(null);
  const [busy, setBusy] = useState(true);
  const [mode, setMode] = useState("login"); // "login" | "signup"
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [err, setErr] = useState("");

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => { setUser(u); setBusy(false); });
    return unsub;
  }, []);

  const handleLogin = async () => {
    setErr(""); try { await signInWithEmailAndPassword(auth, email, pw); } catch (e) { setErr(e.message); }
  };
  const handleSignup = async () => {
    setErr(""); try { await createUserWithEmailAndPassword(auth, email, pw); } catch (e) { setErr(e.message); }
  };

  if (busy) return <div style={{ padding: 20 }}>Loading…</div>;
  if (!user) {
    return (
      <div style={{ maxWidth: 360, margin: "40px auto", fontFamily: "Arial, sans-serif" }}>
        <h2>{mode === "login" ? "Sign in" : "Create account"}</h2>
        <label style={{ display: "block", marginBottom: 8 }}>
          Email
          <input style={{ width: "100%", padding: 8 }} value={email} onChange={e=>setEmail(e.target.value)} />
        </label>
        <label style={{ display: "block", marginBottom: 8 }}>
          Password
          <input style={{ width: "100%", padding: 8 }} type="password" value={pw} onChange={e=>setPw(e.target.value)} />
        </label>
        {err && <div style={{ color: "crimson", marginBottom: 8 }}>{err}</div>}
        <div style={{ display: "flex", gap: 8 }}>
          {mode === "login" ? (
            <>
              <button onClick={handleLogin}>Sign in</button>
              <button onClick={()=>setMode("signup")}>Create account</button>
            </>
          ) : (
            <>
              <button onClick={handleSignup}>Create account</button>
              <button onClick={()=>setMode("login")}>Back to sign in</button>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div>
      <div style={{ padding: "8px 12px", background: "#f8fafc", borderBottom: "1px solid #e5e7eb", display: "flex", justifyContent: "space-between" }}>
        <span>Signed in as {user.email}</span>
        <button onClick={() => signOut(auth)}>Sign out</button>
      </div>
      {children}
    </div>
  );
}
