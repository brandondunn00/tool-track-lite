// src/storage.js
// Centralized, namespaced localStorage helpers
const APP_PREFIX = "ttl:v1"; // bump to v2 if you ever change schema

export const LS = {
  tools:   `${APP_PREFIX}:tools`,
  queue:   `${APP_PREFIX}:queue`,
  orders:  `${APP_PREFIX}:orders`,
  tx:      `${APP_PREFIX}:tx`,        // pull history
  users:   `${APP_PREFIX}:users`,
  session: `${APP_PREFIX}:session`,
  backup:  `${APP_PREFIX}:backup`,     // rolling snapshot (optional)
};

export function load(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw == null ? fallback : JSON.parse(raw);
  } catch {
    return fallback;
  }
}

export function save(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // quota or other errors — swallow safely
  }
}
