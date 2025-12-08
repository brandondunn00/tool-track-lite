// src/services/firebaseServiceEnhanced.js
import { db, auth } from '../firebase';
import { 
  collection, 
  addDoc, 
  updateDoc, 
  doc, 
  query, 
  where, 
  getDocs,
  serverTimestamp,
  getDoc
} from 'firebase/firestore';

// ═══════════════════════════════════════════════════════════════
// APPROVAL WORKFLOW FUNCTIONS
// ═══════════════════════════════════════════════════════════════

/**
 * Submit a new tool request for approval
 */
export async function submitToolRequest(requestData) {
  try {
    const user = auth.currentUser;
    if (!user) throw new Error('User must be authenticated');

    const request = {
      ...requestData,
      requestedBy: user.email,
      requestedAt: serverTimestamp(),
      status: 'pending_manager',
      approvalHistory: [],
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };

    const docRef = await addDoc(collection(db, 'approvalQueue'), request);
    
    // Send email notification (webhook would go here)
    console.log('Tool request submitted:', docRef.id);
    
    return docRef.id;
  } catch (error) {
    console.error('Error submitting tool request:', error);
    throw error;
  }
}

/**
 * Get approval queue for a specific role
 */
export async function getApprovalQueue(role) {
  try {
    const status = role === 'manager' ? 'pending_manager' : 'pending_cfo';
    
    const q = query(
      collection(db, 'approvalQueue'),
      where('status', '==', status)
    );
    
    const snapshot = await getDocs(q);
    const requests = [];
    
    snapshot.forEach((doc) => {
      requests.push({
        id: doc.id,
        ...doc.data()
      });
    });
    
    // Sort by rush orders first, then by date
    requests.sort((a, b) => {
      if (a.isRushOrder && !b.isRushOrder) return -1;
      if (!a.isRushOrder && b.isRushOrder) return 1;
      return new Date(b.requestedAt) - new Date(a.requestedAt);
    });
    
    return requests;
  } catch (error) {
    console.error('Error getting approval queue:', error);
    throw error;
  }
}

/**
 * Approve a request
 */
export async function approveRequest(requestId, approverEmail, approverRole) {
  try {
    const requestRef = doc(db, 'approvalQueue', requestId);
    const requestSnap = await getDoc(requestRef);
    
    if (!requestSnap.exists()) {
      throw new Error('Request not found');
    }
    
    const requestData = requestSnap.data();
    const approvalEntry = {
      approverEmail,
      approverRole,
      approvedAt: new Date().toISOString(),
      action: 'approved'
    };
    
    const updatedHistory = [...(requestData.approvalHistory || []), approvalEntry];
    
    // Determine next status
    let newStatus;
    if (approverRole === 'manager') {
      // Manager approved - send to CFO
      newStatus = 'pending_cfo';
    } else if (approverRole === 'cfo') {
      // CFO approved - fully approved!
      newStatus = 'approved';
    }
    
    await updateDoc(requestRef, {
      status: newStatus,
      approvalHistory: updatedHistory,
      updatedAt: serverTimestamp()
    });
    
    console.log(`Request ${requestId} approved by ${approverRole}`);
    
    // Send notification email (webhook would go here)
    
    return true;
  } catch (error) {
    console.error('Error approving request:', error);
    throw error;
  }
}

/**
 * Reject a request
 */
export async function rejectRequest(requestId, rejectorEmail, reason) {
  try {
    const requestRef = doc(db, 'approvalQueue', requestId);
    
    await updateDoc(requestRef, {
      status: 'rejected',
      rejectedBy: rejectorEmail,
      rejectionReason: reason,
      rejectedAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    
    console.log(`Request ${requestId} rejected by ${rejectorEmail}`);
    
    // Send notification email (webhook would go here)
    
    return true;
  } catch (error) {
    console.error('Error rejecting request:', error);
    throw error;
  }
}

/**
 * Get current user info
 */
export async function getCurrentUser() {
  const user = auth.currentUser;
  if (!user) throw new Error('No user authenticated');
  
  return {
    email: user.email,
    uid: user.uid
  };
}

/**
 * Get user role from Firestore
 */
export async function getUserRole(email) {
  try {
    const q = query(
      collection(db, 'users'),
      where('email', '==', email)
    );
    
    const snapshot = await getDocs(q);
    
    if (snapshot.empty) {
      return 'operator'; // Default role
    }
    
    const userData = snapshot.docs[0].data();
    return userData.role || 'operator';
  } catch (error) {
    console.error('Error getting user role:', error);
    return 'operator';
  }
}