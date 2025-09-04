// src/storage.js
export const LS = {
  tools:   "ttl_tools",
  queue:   "ttl_queue",
  orders:  "ttl_orders",
  pulls:   "ttl_pulls",
  jobs:    "ttl_jobs",
  users:   "ttl_users",
  session: "ttl_session",
};

// Safe read/write
export const load = (k, fallback) => {
  try {
    const raw = localStorage.getItem(k);
    if (!raw) return fallback;
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
};
export const save = (k, value) => {
  try {
    localStorage.setItem(k, JSON.stringify(value));
  } catch {}
};

// ---- One-time migration from any legacy keys ----
export function migrateOnce() {
  const FLAG = "ttl_migrated_v1";
  if (localStorage.getItem(FLAG)) return;

  const legacy = {
    ttl_tools:  localStorage.getItem("ttl_tools"),
    ttl_queue:  localStorage.getItem("ttl_queue"),
    ttl_orders: localStorage.getItem("ttl_orders"),
    ttl_jobs:   localStorage.getItem("ttl_jobs"),
    ttl_pulls:  localStorage.getItem("ttl_pulls"),
    ttl_users:  localStorage.getItem("ttl_users"),
    ttl_session:localStorage.getItem("ttl_session"),
  };
  // If any exist, re-save them (normalizes JSON etc.)
  Object.entries(legacy).forEach(([key, raw]) => {
    if (raw != null) {
      try {
        localStorage.setItem(key, JSON.stringify(JSON.parse(raw)));
      } catch {
        // leave as-is if parsing fails
      }
    }
  });

  localStorage.setItem(FLAG, "1");
}
