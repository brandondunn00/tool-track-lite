// src/Settings.jsx
import React, { useEffect, useMemo, useState } from "react";
import "./modern-light.css";
import { db } from "./firebase";
import {
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
} from "firebase/firestore";

const ROLES = ["operator", "setup", "purchasing", "cfo", "admin"];

const Input = ({ label, value, onChange, ...p }) => (
  <div className="input">
    <label>{label}</label>
    <input {...p} value={String(value ?? "")} onChange={(e) => onChange?.(e.target.value)} />
  </div>
);

const Select = ({ label, value, onChange, options }) => (
  <div className="input">
    <label>{label}</label>
    <select value={value ?? ""} onChange={(e) => onChange?.(e.target.value)}>
      {options.map((o) => (
        <option key={o} value={o}>
          {o}
        </option>
      ))}
    </select>
  </div>
);

export default function Settings({ session }) {
  const [users, setUsers] = useState([]);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteName, setInviteName] = useState("");
  const [inviteRole, setInviteRole] = useState("operator");
  const [toast, setToast] = useState("");

  useEffect(() => {
    const q = query(collection(db, "users"), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(q, (snap) => {
      setUsers(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, []);

  const note = (m) => {
    setToast(m);
    setTimeout(() => setToast(""), 2200);
  };

  const invite = async () => {
    const email = inviteEmail.trim().toLowerCase();
    if (!email) return;
    // "Invite" is just a record; user still needs an Auth account created in Firebase Auth console.
    await setDoc(doc(db, "invites", email), {
      email,
      displayName: inviteName.trim() || "",
      role: inviteRole,
      active: true,
      createdAt: serverTimestamp(),
      createdByUid: session?.user?.uid || null,
    });
    setInviteEmail("");
    setInviteName("");
    setInviteRole("operator");
    note("Invite saved. Create the Auth user in Firebase console.");
  };

  const updateUser = async (uid, patch) => {
    await updateDoc(doc(db, "users", uid), patch);
    note("Saved ✅");
  };

  const sortedUsers = useMemo(() => {
    return users.slice().sort((a, b) => (a.email || "").localeCompare(b.email || ""));
  }, [users]);

  return (
    <div className="app">
      <div className="card" style={{ padding: 16, marginBottom: 14 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 800 }}>⚙️ Settings — Users & Permissions</div>
            <div className="subtle" style={{ marginTop: 4 }}>
              Admins manage roles here. For now, create the login (email/password) in Firebase Auth, then assign role.
            </div>
          </div>
        </div>
      </div>

      <div className="card" style={{ padding: 16, marginBottom: 14 }}>
        <div style={{ fontWeight: 800, marginBottom: 8 }}>Invite / Pre-assign role (optional)</div>
        <div className="subtle" style={{ marginBottom: 10 }}>
          This saves an invite record for an email. It does <b>not</b> create the Auth user automatically.
        </div>
        <div className="form-grid" style={{ gridTemplateColumns: "1.5fr 1fr 1fr auto", gap: 12 }}>
          <Input label="Email" value={inviteEmail} onChange={setInviteEmail} placeholder="operator@shop.com" />
          <Input label="Name" value={inviteName} onChange={setInviteName} placeholder="Optional" />
          <Select label="Role" value={inviteRole} onChange={setInviteRole} options={ROLES} />
          <div style={{ display: "flex", alignItems: "end" }}>
            <button className="btn btn-primary" onClick={invite} disabled={!inviteEmail.trim()}>
              Save invite
            </button>
          </div>
        </div>
      </div>

      <div className="card table-wrap">
        <div style={{ padding: 12, borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between" }}>
          <strong>Users</strong>
          <span className="subtle">{sortedUsers.length} total</span>
        </div>
        <div className="table-scroll">
          <table className="table">
            <thead>
              <tr>
                <th style={{ width: "32%" }}>Email</th>
                <th style={{ width: "22%" }}>Name</th>
                <th style={{ width: "16%" }}>Role</th>
                <th style={{ width: "12%" }}>Active</th>
                <th>UID</th>
              </tr>
            </thead>
            <tbody>
              {sortedUsers.length === 0 && (
                <tr><td colSpan={5} className="subtle">No users yet.</td></tr>
              )}
              {sortedUsers.map((u) => (
                <tr key={u.id}>
                  <td>{u.email || <span className="subtle">—</span>}</td>
                  <td>
                    <input
                      value={u.displayName || ""}
                      onChange={(e) => {
                        const v = e.target.value;
                        setUsers((p) => p.map((x) => (x.id === u.id ? { ...x, displayName: v } : x)));
                      }}
                      onBlur={() => updateUser(u.id, { displayName: (u.displayName || "").trim() })}
                      style={{ width: "100%" }}
                    />
                  </td>
                  <td>
                    <select
                      value={u.role || "operator"}
                      onChange={(e) => updateUser(u.id, { role: e.target.value })}
                    >
                      {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                    </select>
                  </td>
                  <td>
                    <input
                      type="checkbox"
                      checked={u.active !== false}
                      onChange={(e) => updateUser(u.id, { active: e.target.checked })}
                    />
                  </td>
                  <td className="subtle">{u.id}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {toast && (
        <div className="toast" style={{ position: "fixed", bottom: 18, right: 18 }}>
          {toast}
        </div>
      )}
    </div>
  );
}
