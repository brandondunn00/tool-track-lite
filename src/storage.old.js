// src/storage.js
export const LS = {
  tools: "ttl_tools",
  queue: "ttl_queue",
  orders: "ttl_orders",
  users: "ttl_users",
  session: "ttl_session",
  tx: "ttl_transactions",
};

export function load(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback)); }
  catch { return fallback; }
}

export function save(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

export function nowIso() {
  return new Date().toISOString();
}
