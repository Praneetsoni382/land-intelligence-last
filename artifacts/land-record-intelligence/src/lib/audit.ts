import { db, handleFirestoreError, OperationType } from "./firebase";
import { collection, addDoc, serverTimestamp, query, orderBy, limit, where, getDocs, onSnapshot } from "./firestore-tracked";
import type { AuditLog, AuditAction } from "./types";
import { DEV_OFFICER } from "./auth";

export async function logAuditEvent(params: {
  action: AuditAction;
  description: string;
  caseId?: string | null;
  documentId?: string | null;
  userId?: string;
  metadata?: Record<string, any>;
}): Promise<string> {
  try {
    const colRef = collection(db, "audit_logs");
    const docRef = await addDoc(colRef, {
      caseId: params.caseId || null,
      documentId: params.documentId || null,
      userId: params.userId || DEV_OFFICER.id,
      action: params.action,
      description: params.description,
      metadata: params.metadata || {},
      timestamp: serverTimestamp(),
    });
    return docRef.id;
  } catch (error) {
    console.error("Audit log error:", error);
    // Don't crash the user action if audit log write fails, but report
    return "";
  }
}

export function subscribeToRecentAuditLogs(
  onUpdate: (logs: AuditLog[]) => void,
  maxItems: number = 20
) {
  try {
    const q = query(
      collection(db, "audit_logs"),
      orderBy("timestamp", "desc"),
      limit(maxItems)
    );
    return onSnapshot(
      q,
      (snapshot) => {
        const items = snapshot.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        })) as AuditLog[];
        onUpdate(items);
      },
      (error) => {
        console.warn("Audit logs subscription error:", error);
        onUpdate([]);
      }
    );
  } catch (error) {
    console.warn("Audit logs listener init error:", error);
    return () => {};
  }
}

export function subscribeToCaseAuditLogs(
  caseId: string,
  onUpdate: (logs: AuditLog[]) => void
) {
  try {
    const q = query(
      collection(db, "audit_logs"),
      where("caseId", "==", caseId),
      orderBy("timestamp", "desc"),
      limit(50)
    );
    return onSnapshot(
      q,
      (snapshot) => {
        const items = snapshot.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        })) as AuditLog[];
        onUpdate(items);
      },
      (error) => {
        console.warn(`Case ${caseId} audit logs error:`, error);
        onUpdate([]);
      }
    );
  } catch (error) {
    console.warn("Case audit logs listener init error:", error);
    return () => {};
  }
}

export const subscribeRecentAuditLogs = subscribeToRecentAuditLogs;
export const subscribeCaseAuditLogs = subscribeToCaseAuditLogs;
