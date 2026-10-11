// Tiny global session store: uid, role, creatorId (creator: their own; fan: the one picked in S5).
import { useSyncExternalStore } from 'react';
import type { Role } from '../services/api';

export interface Session {
  uid: string | null;
  role: Role | null;
  creatorId: string | null;
}

let state: Session = { uid: null, role: null, creatorId: null };
const listeners = new Set<() => void>();

export const getSession = () => state;

export function setSession(patch: Partial<Session>) {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
}

export const clearSession = () => setSession({ uid: null, role: null, creatorId: null });

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

export const useSession = () => useSyncExternalStore(subscribe, getSession, getSession);
