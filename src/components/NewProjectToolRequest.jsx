// src/components/NewProjectToolRequest.jsx - SIMPLIFIED VERSION
import React, { useState } from 'react';
import { submitToolRequest } from '../services/firebaseServiceEnhanced';

export default function NewProjectToolRequest() {
  const [form, setForm] = useState({
    toolName: '',
    manufacturer: '',
    partNumber: '',
    quantity: 1,
    estimatedUnitPrice: '',
    preferredVendor: '',
    shippingCost: 0,
    projectName: '',
    justification: '',
    isRushOrder: false,
    rushReason: ''
  });

  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  const validate = () => {
    const err = {};
    if (!form.toolName.trim()) err.toolName = 'Tool name required';
    if (!form.projectName.trim()) err.projectName = 'Project name required';
    if (!form.quantity || form.quantity < 1) err.quantity = 'Quantity must be ≥ 1';
    if (!form.estimatedUnitPrice) err.estimatedUnitPrice = 'Price required';
    if (form.isRushOrder && !form.rushReason.trim()) err.rushReason = 'Rush reason required';
    setErrors(err);
    return Object.keys(err).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    try {
      setSubmitting(true);
      await submitToolRequest(form);
      alert('Request submitted for approval! ✅');
      // Reset form
      setForm({
        toolName: '',
        manufacturer: '',
        partNumber: '',
        quantity: 1,
        estimatedUnitPrice: '',
        preferredVendor: '',
        shippingCost: 0,
        projectName: '',
        justification: '',
        isRushOrder: false,
        rushReason: ''
      });
      setErrors({});
    } catch (error) {
      console.error('Error submitting request:', error);
      alert('Error: ' + error.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      <h2 style={{ margin: '0 0 24px', fontSize: 24, color: 'var(--text)' }}>
        🆕 Request New Project Tool
      </h2>

      <form onSubmit={handleSubmit}>
        <div className="card" style={{ padding: 24 }}>
          {/* Basic Info */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 24 }}>
            <div>
              <label style={{ display: 'block', fontSize: 12, color: 'var(--muted)', marginBottom: 6 }}>
                Tool Name *
              </label>
              <input
                type="text"
                value={form.toolName}
                onChange={e => setForm(p => ({ ...p, toolName: e.target.value }))}
                placeholder="e.g., 1/2 inch Endmill"
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  border: `1px solid ${errors.toolName ? '#ef4444' : 'var(--border)'}`,
                  borderRadius: 10,
                  background: 'var(--card)',
                  color: 'var(--text)'
                }}
              />
              {errors.toolName && <div style={{ color: '#ef4444', fontSize: 12, marginTop: 4 }}>{errors.toolName}</div>}
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 12, color: 'var(--muted)', marginBottom: 6 }}>
                Manufacturer
              </label>
              <input
                type="text"
                value={form.manufacturer}
                onChange={e => setForm(p => ({ ...p, manufacturer: e.target.value }))}
                placeholder="Kennametal, Sandvik, etc."
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  border: '1px solid var(--border)',
                  borderRadius: 10,
                  background: 'var(--card)',
                  color: 'var(--text)'
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 12, color: 'var(--muted)', marginBottom: 6 }}>
                Part Number
              </label>
              <input
                type="text"
                value={form.partNumber}
                onChange={e => setForm(p => ({ ...p, partNumber: e.target.value }))}
                placeholder="Manufacturer part #"
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  border: '1px solid var(--border)',
                  borderRadius: 10,
                  background: 'var(--card)',
                  color: 'var(--text)'
                }}
              />
            </div>
          </div>

          {/* Pricing */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
            <div>
              <label style={{ display: 'block', fontSize: 12, color: 'var(--muted)', marginBottom: 6 }}>
                Quantity *
              </label>
              <input
                type="number"
                min="1"
                value={form.quantity}
                onChange={e => setForm(p => ({ ...p, quantity: parseInt(e.target.value) || 0 }))}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  border: `1px solid ${errors.quantity ? '#ef4444' : 'var(--border)'}`,
                  borderRadius: 10,
                  background: 'var(--card)',
                  color: 'var(--text)'
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 12, color: 'var(--muted)', marginBottom: 6 }}>
                Unit Price *
              </label>
              <input
                type="number"
                step="0.01"
                value={form.estimatedUnitPrice}
                onChange={e => setForm(p => ({ ...p, estimatedUnitPrice: e.target.value }))}
                placeholder="0.00"
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  border: `1px solid ${errors.estimatedUnitPrice ? '#ef4444' : 'var(--border)'}`,
                  borderRadius: 10,
                  background: 'var(--card)',
                  color: 'var(--text)'
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 12, color: 'var(--muted)', marginBottom: 6 }}>
                Vendor
              </label>
              <input
                type="text"
                value={form.preferredVendor}
                onChange={e => setForm(p => ({ ...p, preferredVendor: e.target.value }))}
                placeholder="McMaster, Grainger, etc."
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  border: '1px solid var(--border)',
                  borderRadius: 10,
                  background: 'var(--card)',
                  color: 'var(--text)'
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 12, color: 'var(--muted)', marginBottom: 6 }}>
                Shipping Cost
              </label>
              <input
                type="number"
                step="0.01"
                value={form.shippingCost}
                onChange={e => setForm(p => ({ ...p, shippingCost: parseFloat(e.target.value) || 0 }))}
                placeholder="0.00"
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  border: '1px solid var(--border)',
                  borderRadius: 10,
                  background: 'var(--card)',
                  color: 'var(--text)'
                }}
              />
            </div>
          </div>

          {/* Project Info */}
          <div style={{ marginBottom: 24 }}>
            <label style={{ display: 'block', fontSize: 12, color: 'var(--muted)', marginBottom: 6 }}>
              Project Name *
            </label>
            <input
              type="text"
              value={form.projectName}
              onChange={e => setForm(p => ({ ...p, projectName: e.target.value }))}
              placeholder="e.g., Aerospace-2024-Q4"
              style={{
                width: '100%',
                padding: '10px 12px',
                border: `1px solid ${errors.projectName ? '#ef4444' : 'var(--border)'}`,
                borderRadius: 10,
                background: 'var(--card)',
                color: 'var(--text)'
              }}
            />
            {errors.projectName && <div style={{ color: '#ef4444', fontSize: 12, marginTop: 4 }}>{errors.projectName}</div>}
          </div>

          {/* Justification */}
          <div style={{ marginBottom: 24 }}>
            <label style={{ display: 'block', fontSize: 12, color: 'var(--muted)', marginBottom: 6 }}>
              Justification
            </label>
            <textarea
              value={form.justification}
              onChange={e => setForm(p => ({ ...p, justification: e.target.value }))}
              placeholder="Why is this tool needed for the project?"
              rows={4}
              style={{
                width: '100%',
                padding: '10px 12px',
                border: '1px solid var(--border)',
                borderRadius: 10,
                background: 'var(--card)',
                color: 'var(--text)',
                fontFamily: 'inherit',
                resize: 'vertical'
              }}
            />
          </div>

          {/* Rush Order */}
          <div style={{ marginBottom: 24 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={form.isRushOrder}
                onChange={e => setForm(p => ({ ...p, isRushOrder: e.target.checked }))}
                style={{ width: 18, height: 18, cursor: 'pointer' }}
              />
              <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>
                ⚡ Rush Order (requires additional justification)
              </span>
            </label>

            {form.isRushOrder && (
              <div style={{ marginTop: 12 }}>
                <textarea
                  value={form.rushReason}
                  onChange={e => setForm(p => ({ ...p, rushReason: e.target.value }))}
                  placeholder="Why is rush shipping needed?"
                  rows={3}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    border: `1px solid ${errors.rushReason ? '#ef4444' : 'var(--border)'}`,
                    borderRadius: 10,
                    background: 'var(--card)',
                    color: 'var(--text)',
                    fontFamily: 'inherit',
                    resize: 'vertical'
                  }}
                />
                {errors.rushReason && <div style={{ color: '#ef4444', fontSize: 12, marginTop: 4 }}>{errors.rushReason}</div>}
              </div>
            )}
          </div>

          {/* Submit */}
          <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
            <button
              type="button"
              className="btn"
              onClick={() => {
                setForm({
                  toolName: '',
                  manufacturer: '',
                  partNumber: '',
                  quantity: 1,
                  estimatedUnitPrice: '',
                  preferredVendor: '',
                  shippingCost: 0,
                  projectName: '',
                  justification: '',
                  isRushOrder: false,
                  rushReason: ''
                });
                setErrors({});
              }}
            >
              Clear Form
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={submitting}
              style={{ minWidth: 180 }}
            >
              {submitting ? '⏳ Submitting...' : '📤 Submit for Approval'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}