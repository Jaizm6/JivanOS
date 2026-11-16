import { doc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { TaskItem } from '../types';
import { auth } from '../lib/firebase';

export interface LogEntry {
  type: 'warn' | 'info';
  message: string;
}

export interface SyncResult {
  status: 'synced' | 'diverged';
  logs: LogEntry[];
}

/**
 * Utility to diagnose task synchronization discrepancies between 
 * the current UI state and the actual Firestore persistence.
 */
export async function diagnoseTaskSync(uiTasks: TaskItem[]): Promise<SyncResult> {
  const userId = auth.currentUser?.uid;
  if (!userId) {
    return { status: 'diverged', logs: [{ type: 'warn', message: 'User not authenticated.' }] };
  }

  const logs: LogEntry[] = [];
  try {
    const userDocRef = doc(db, 'users', userId);
    const userDocSnap = await getDoc(userDocRef);

    if (!userDocSnap.exists()) {
      return { status: 'diverged', logs: [{ type: 'warn', message: 'User document not found in Firestore.' }] };
    }

    const userData = userDocSnap.data();
    let firestoreTasks: TaskItem[] = userData.tasks || [];
    if ((!firestoreTasks || firestoreTasks.length === 0) && userData.payload) {
      try {
        const parsed = typeof userData.payload === 'string' ? JSON.parse(userData.payload) : userData.payload;
        if (Array.isArray(parsed?.tasks)) {
          firestoreTasks = parsed.tasks;
        }
      } catch (err) {
        console.warn('Could not parse payload in diagnostic:', err);
      }
    }

    logs.push({ type: 'info', message: `UI Tasks: ${uiTasks.length}, Firestore Tasks: ${firestoreTasks.length}` });

    const uiTaskIds = new Set(uiTasks.map(t => t.id));
    const firestoreTaskIds = new Set(firestoreTasks.map((t: TaskItem) => t.id));

    uiTasks.forEach(uiTask => {
      if (!firestoreTaskIds.has(uiTask.id)) {
        logs.push({ type: 'warn', message: `Task ${uiTask.id} ("${uiTask.title}") missing in Firestore.` });
      } else {
        const fsTask = firestoreTasks.find((t: TaskItem) => t.id === uiTask.id);
        if (uiTask.title !== fsTask.title) {
          logs.push({ type: 'warn', message: `Task ${uiTask.id} title mismatch. UI: "${uiTask.title}", Firestore: "${fsTask.title}"` });
        }
        if (uiTask.completed !== fsTask.completed) {
          logs.push({ type: 'warn', message: `Task ${uiTask.id} status mismatch. UI: ${uiTask.completed}, Firestore: ${fsTask.completed}` });
        }
      }
    });

    firestoreTasks.forEach((fsTask: TaskItem) => {
      if (!uiTaskIds.has(fsTask.id)) {
        logs.push({ type: 'warn', message: `Task ${fsTask.id} ("${fsTask.title}") missing in UI.` });
      }
    });

    const isSynced = logs.every(log => log.type !== 'warn');
    return { status: isSynced ? 'synced' : 'diverged', logs: isSynced ? [{ type: 'info', message: 'All tasks synced.' }] : logs };
  } catch (error: any) {
    return { status: 'diverged', logs: [{ type: 'warn', message: `Error fetching data: ${error.message}` }] };
  }
}

/**
 * Fetch a single task from Firestore for version verification.
 */
export async function getTaskFromFirestore(taskId: string): Promise<TaskItem | null> {
  const userId = auth.currentUser?.uid;
  if (!userId) return null;

  try {
    const userDocRef = doc(db, 'users', userId);
    const userDocSnap = await getDoc(userDocRef);
    if (!userDocSnap.exists()) return null;
    
    const tasks = userDocSnap.data().tasks || [];
    const task = tasks.find((t: TaskItem) => t.id === taskId);
    return task || null;
  } catch (error) {
    console.error('Error fetching task version:', error);
    return null;
  }
}
