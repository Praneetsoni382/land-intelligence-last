import {
  onSnapshot as rawOnSnapshot,
  getDoc as rawGetDoc,
  getDocs as rawGetDocs,
  setDoc as rawSetDoc,
  addDoc as rawAddDoc,
  updateDoc as rawUpdateDoc,
  deleteDoc as rawDeleteDoc,
  writeBatch as rawWriteBatch,
} from "firebase/firestore";
import { recordReads, recordWrites, recordDeletes } from "./quota-tracker";

// Re-export other Firestore things unmodified
export {
  collection,
  doc,
  query,
  where,
  orderBy,
  serverTimestamp,
  increment,
  limit,
} from "firebase/firestore";

// Track getDoc
export async function getDoc(ref: any) {
  const snap = await rawGetDoc(ref);
  recordReads(1);
  return snap;
}

// Track getDocs
export async function getDocs(queryRef: any) {
  const snap = await rawGetDocs(queryRef);
  recordReads(snap.size || 1);
  return snap;
}

// Track setDoc
export async function setDoc(ref: any, data: any, options?: any) {
  const res = await rawSetDoc(ref, data, options);
  recordWrites(1);
  return res;
}

// Track addDoc
export async function addDoc(colRef: any, data: any) {
  const res = await rawAddDoc(colRef, data);
  recordWrites(1);
  return res;
}

// Track updateDoc
export async function updateDoc(ref: any, ...args: any[]) {
  const res = await (rawUpdateDoc as any)(ref, ...args);
  recordWrites(1);
  return res;
}

// Track deleteDoc
export async function deleteDoc(ref: any) {
  const res = await rawDeleteDoc(ref);
  recordDeletes(1);
  return res;
}

// Track onSnapshot
export function onSnapshot(ref: any, ...args: any[]) {
  let nextCallback: ((snap: any) => void) | null = null;
  let nextIndex = -1;

  for (let i = 0; i < args.length; i++) {
    if (typeof args[i] === "function") {
      nextCallback = args[i];
      nextIndex = i;
      break;
    } else if (typeof args[i] === "object" && args[i] !== null && ("next" in args[i] || "error" in args[i])) {
      const observer = args[i];
      const rawNext = observer.next;
      observer.next = (snap: any) => {
        const size = snap && snap.size !== undefined ? snap.size : 1;
        recordReads(size);
        if (rawNext) rawNext(snap);
      };
      break;
    }
  }

  if (nextCallback && nextIndex !== -1) {
    const rawNext = nextCallback;
    args[nextIndex] = (snap: any) => {
      const size = snap && snap.size !== undefined ? snap.size : 1;
      recordReads(size);
      rawNext(snap);
    };
  }

  return rawOnSnapshot(ref, ...(args as any));
}

// Track writeBatch
export function writeBatch(db: any) {
  const batch = rawWriteBatch(db);
  const rawCommit = batch.commit.bind(batch);
  
  let writeCount = 0;
  let deleteCount = 0;

  const rawSet = batch.set.bind(batch);
  batch.set = (...args: any[]) => {
    writeCount++;
    return (rawSet as any)(...args);
  };

  const rawUpdate = batch.update.bind(batch);
  batch.update = (...args: any[]) => {
    writeCount++;
    return (rawUpdate as any)(...args);
  };

  const rawDelete = batch.delete.bind(batch);
  batch.delete = (...args: any[]) => {
    deleteCount++;
    return (rawDelete as any)(...args);
  };

  batch.commit = async () => {
    const res = await rawCommit();
    if (writeCount > 0) recordWrites(writeCount);
    if (deleteCount > 0) recordDeletes(deleteCount);
    return res;
  };

  return batch;
}
