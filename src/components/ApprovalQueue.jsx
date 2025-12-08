// src/components/ApprovalQueue.jsx - SIMPLIFIED VERSION
import React, { useState, useEffect } from 'react';
import { 
  getApprovalQueue, 
  approveRequest, 
  rejectRequest,
  getCurrentUser 
} from '../services/firebaseServiceEnhanced';

export default function ApprovalQueue({ userRole = 'manager' }) {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    loadQueue();
    // eslint-disable-next-line
  }, [userRole]);

  const loadQueue = async () => {
    try {
      setLoading(true);
      const queue = await getApprovalQueue(userRole);
      setRequests(queue);
    } catch (error) {
      console.error('Error loading approval queue:', error);
      setRequests([]); // Show empty state if error
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (requestId) => {
    try {
      setActionLoading(true);
      const user = await getCurrentUser();
      await approveRequest(requestId, user.email, userRole);
      await loadQueue();
      setSelectedRequest(null);
      alert('Request approved! ✅');
    } catch (error) {
      console.error('Error approving:', error);
      alert('Error: ' + error.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async (requestId) => {
    const reason = prompt('Reason for rejection:');
    if (!reason) return;

    try {
      setActionLoading(true);
      const user = await getCurrentUser();
      await rejectRequest(requestId, user.email, reason);
      await loadQueue();
      setSelectedRequest(null);
      alert('Request rejected');
    } catch (error) {
      console.error('Error rejecting:', error);
      alert('Error: ' + error.message);
    } finally {
      setActionLoading(false);
    }
  };

  const money = (v) => Number(v || 0).toLocaleString('en-US', { style: 'currency', currency: 'USD' });

  if (loading) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: 'var(--muted)' }}>
        <div style={{ fontSize: 48 }}>⏳</div>
        <p>Loading...</p>
      </div>
    );
  }

  return (
    <div>
      <h2 style={{ margin: '0 0 24px', fontSize: 24, color: 'var(--text)' }}>
        {userRole === 'manager' ? '👔 Manager' : '💼 CFO'} Approval Queue
      </h2>

      {requests.length === 0 ? (
        <div className="card" style={{ padding: 60, textAlign: 'center' }}>
          <div style={{ fontSize: 64 }}>✨</div>
          <h3 style={{ margin: '16px 0 8px', color: 'var(--text)' }}>All caught up!</h3>
          <p style={{ margin: 0, color: 'var(--muted)' }}>No requests pending</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 16 }}>
          {requests.map((req) => {
            const total = (req.quantity * req.estimatedUnitPrice) + (req.shippingCost || 0);
            const isExpanded = selectedRequest?.id === req.id;

            return (
              <div key={req.id} className="card" style={{ padding: 0 }}>
                <div
                  style={{ padding: 20, cursor: 'pointer', borderBottom: isExpanded ? '1px solid var(--border)' : 'none' }}
                  onClick={() => setSelectedRequest(isExpanded ? null : req)}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <div>
                      <h3 style={{ margin: '0 0 8px', fontSize: 18, color: 'var(--text)' }}>{req.toolName}</h3>
                      <div style={{ fontSize: 13, color: 'var(--muted)' }}>
                        {req.projectName} · {req.requestedBy}
                      </div>
                    </div>
                    <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--accent)' }}>
                      {money(total)}
                    </div>
                  </div>
                </div>

                {isExpanded && (
                  <div style={{ padding: 20, background: 'var(--bg)' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 20 }}>
                      <div>
                        <div style={{ fontSize: 12, color: 'var(--muted)' }}>Quantity</div>
                        <div style={{ fontSize: 18, fontWeight: 700 }}>{req.quantity}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: 12, color: 'var(--muted)' }}>Unit Price</div>
                        <div style={{ fontSize: 18, fontWeight: 700 }}>{money(req.estimatedUnitPrice)}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: 12, color: 'var(--muted)' }}>Vendor</div>
                        <div style={{ fontSize: 18, fontWeight: 700 }}>{req.preferredVendor || '—'}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: 12, color: 'var(--muted)' }}>Shipping</div>
                        <div style={{ fontSize: 18, fontWeight: 700 }}>{money(req.shippingCost || 0)}</div>
                      </div>
                    </div>

                    {req.justification && (
                      <div style={{ padding: 16, background: 'var(--card)', borderRadius: 8, marginBottom: 20 }}>
                        <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 8 }}>Justification</div>
                        <div style={{ fontSize: 14 }}>{req.justification}</div>
                      </div>
                    )}

                    <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
                      <button className="btn btn-danger" onClick={() => handleReject(req.id)} disabled={actionLoading}>
                        ❌ Reject
                      </button>
                      <button className="btn btn-success" onClick={() => handleApprove(req.id)} disabled={actionLoading}>
                        {actionLoading ? '⏳ Processing...' : '✅ Approve'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}