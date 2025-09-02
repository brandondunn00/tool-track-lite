import React from "react";

/**
 * LocationSection.jsx — drop-in section for your Tool Details page/modal
 * Purpose: Add a structured, shop-floor-friendly location block.
 */

export default function LocationSection({ value = {}, onChange = () => {}, readOnly = false }) {
  const loc = { ...DEFAULT_LOCATION, ...value };

  function update(field, v) {
    const next = { ...loc, [field]: v };
    next.code = buildLocationCode(next);
    onChange(next);
  }

  return (
    <section className="ttl-location-block">
      <header className="ttl-loc-header">
        <h3>Location</h3>
        <span className="ttl-loc-code" title="Compact location code">{loc.code || "—"}</span>
      </header>

      <div className="ttl-loc-grid">
        <Field label="Site" value={loc.site} onChange={(v) => update("site", v)} readOnly={readOnly} />
        <Field label="Building" value={loc.building} onChange={(v) => update("building", v)} readOnly={readOnly} />
        <Field label="Area" value={loc.area} onChange={(v) => update("area", v)} readOnly={readOnly} />
        <Field label="Aisle" value={loc.aisle} onChange={(v) => update("aisle", v)} readOnly={readOnly} />
        <Field label="Cabinet" value={loc.cabinet} onChange={(v) => update("cabinet", v)} readOnly={readOnly} />
        <Field label="Shelf" value={loc.shelf} onChange={(v) => update("shelf", v)} readOnly={readOnly} />
        <Field label="Bin" value={loc.bin} onChange={(v) => update("bin", v)} readOnly={readOnly} />
        <Field label="Slot" value={loc.slot} onChange={(v) => update("slot", v)} readOnly={readOnly} />
      </div>

      <div className="ttl-loc-notes">
        <label>Notes</label>
        <textarea
          value={loc.notes || ""}
          onChange={(e) => update("notes", e.target.value)}
          placeholder="e.g., Left bay, eye-level, near Speedio M200"
          disabled={readOnly}
        />
      </div>

      <style>{CSS}</style>
    </section>
  );
}

const DEFAULT_LOCATION = {
  site: "Main",
  building: "",
  area: "",
  aisle: "",
  cabinet: "",
  shelf: "",
  bin: "",
  slot: "",
  notes: "",
  code: "",
};

function buildLocationCode(loc) {
  // Compact, barcode/label-friendly. Skip blanks. Uppercase, hyphen-separated.
  const parts = [loc.site, loc.building, loc.area, loc.aisle, shortCabinet(loc.cabinet), loc.shelf, loc.bin, clean(loc.slot)]
    .map(clean)
    .filter(Boolean)
    .map((s) => s.toUpperCase());
  return parts.join("-");
}

function shortCabinet(c) {
  if (!c) return c;
  // Heuristics to shorten common words for label length
  return c
    .replace(/c(ab(inet)?)?/i, "C")
    .replace(/cab\.?/i, "C")
    .replace(/drawer/i, "DR")
    .replace(/shelf/i, "S")
    .replace(/cutter\s*cab(inet)?/i, "CC");
}

function clean(s) {
  if (!s) return "";
  return String(s).trim().replace(/\s+/g, " ").replace(/[^a-z0-9#\-\s]/gi, "").replace(/\s/g, "");
}

function Field({ label, value, onChange, readOnly }) {
  return (
    <div className="ttl-loc-field">
      <label>{label}</label>
      <input
        value={value || ""}
        onChange={(e) => onChange(e.target.value)}
        placeholder={label}
        disabled={readOnly}
      />
    </div>
  );
}

// Minimal CSS (scoped)
const CSS = `
  .ttl-location-block { border: 1px solid #e6e8ef; border-radius: 12px; padding: 14px; background: #fff; }
  .ttl-loc-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; }
  .ttl-loc-header h3 { margin: 0; font-size: 15px; color: #111827; }
  .ttl-loc-code { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 12px; color: #6b7280; background: #f3f4f6; padding: 4px 8px; border-radius: 8px; }

  .ttl-loc-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px; }
  .ttl-loc-field label { display: block; font-size: 12px; color: #4b5563; margin-bottom: 4px; }
  .ttl-loc-field input { width: 100%; padding: 8px 10px; border: 1px solid #d1d5db; border-radius: 8px; }
  .ttl-loc-field input:focus { outline: none; border-color: #8aa2ff; box-shadow: 0 0 0 3px rgba(138,162,255,0.15); }

  .ttl-loc-notes { margin-top: 10px; }
  .ttl-loc-notes label { display: block; font-size: 12px; color: #4b5563; margin-bottom: 4px; }
  .ttl-loc-notes textarea { width: 100%; min-height: 70px; padding: 8px 10px; border: 1px solid #d1d5db; border-radius: 8px; resize: vertical; }
`;
