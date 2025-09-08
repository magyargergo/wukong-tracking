"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

type CollectedEntry = { done: boolean; note?: string; updatedAt?: number };
type CollectedMap = Record<string, CollectedEntry>;

interface ProgressState {
  collected: CollectedMap;
  toggle: (_id: string) => void;
  setNote: (_id: string, _note: string) => void;
  reset: () => void;
  importProgress: (_incoming: Record<string, any>) => void;
  ensureKnown: (_names: string[]) => void;
  syncFromServer: () => Promise<void>;
}

let hasHydrated = false;
let hasDoneInitialServerSync = false;
let isApplyingRemote = false;
const dirtyIds = new Set<string>();
let drainTimer: any = null;
let isDraining = false;

function mergeByTimestamp(local: CollectedMap, remote: CollectedMap): CollectedMap {
  const result: CollectedMap = { ...local };
  for (const [id, r] of Object.entries(remote)) {
    const lt = typeof local[id]?.updatedAt === "number" ? Number(local[id]!.updatedAt) : 0;
    const rt = typeof r?.updatedAt === "number" ? Number(r.updatedAt) : 0;
    if (rt > lt) result[id] = { done: !!r.done, note: typeof r.note === "string" ? r.note : undefined, updatedAt: rt };
  }
  return result;
}

function markDirty(id: string) {
  dirtyIds.add(id);
  scheduleDrain();
}

function scheduleDrain() {
  if (!hasHydrated || !hasDoneInitialServerSync || isApplyingRemote) return;
  if (drainTimer) clearTimeout(drainTimer);
  drainTimer = setTimeout(() => { void drainDirtyQueue(); }, 150);
}

async function drainDirtyQueue() {
  if (isDraining) return;
  isDraining = true;
  try {
    while (dirtyIds.size > 0) {
      const id = Array.from(dirtyIds)[0];
      const state = useProgressStore.getState();
      const entry = state.collected[id];
      if (!entry) { dirtyIds.delete(id); continue; }
      const csrf = (document.cookie.match(/(?:^|; )csrfToken=([^;]+)/)?.[1]) || "";
      const payload = { itemId: id, done: !!entry.done, note: typeof entry.note === "string" ? entry.note : undefined, updatedAt: typeof entry.updatedAt === 'number' ? Math.floor(entry.updatedAt) : Math.floor(Date.now()/1000) };
      let ok = false;
      try {
        const res = await fetch("/api/progress", { method: "POST", headers: { "content-type": "application/json", "x-csrf-token": csrf }, body: JSON.stringify(payload) });
        if (res.ok) { ok = true; }
        else if (res.status === 409) {
          const latest = await fetch(`/api/progress?ts=${Date.now()}`, { cache: "no-store" });
          if (latest.ok) {
            const data = await latest.json();
            const incoming = data?.collected as Record<string, { done?: boolean; note?: string; updatedAt?: number }>|undefined;
            if (incoming) {
              const clean: CollectedMap = {};
              for (const [k, v] of Object.entries(incoming)) clean[k] = { done: !!v?.done, note: typeof v?.note === "string" ? v.note : undefined, updatedAt: typeof v?.updatedAt === "number" ? Math.floor(v.updatedAt) : undefined };
              isApplyingRemote = true;
              useProgressStore.setState(s => ({ collected: mergeByTimestamp(s.collected, clean) }));
              isApplyingRemote = false;
            }
          }
        }
      } catch {}
      finally {
        // Determine if this item still needs syncing
        const after = useProgressStore.getState().collected[id];
        if (!after) { dirtyIds.delete(id); }
        else {
          const sentTs = payload.updatedAt as number;
          const curTs = typeof after.updatedAt === 'number' ? Math.floor(after.updatedAt!) : 0;
          if (ok && curTs <= sentTs) dirtyIds.delete(id);
          else if (!ok) {
            // Keep dirty; move it to the end of the queue
            dirtyIds.delete(id);
            dirtyIds.add(id);
          }
        }
      }
    }
  } finally {
    isDraining = false;
  }
}

function nextMonotonicSecond(previous?: number): number {
  const now = Math.floor(Date.now() / 1000);
  if (typeof previous === 'number' && now <= previous) return previous + 1;
  return now;
}

export const useProgressStore = create<ProgressState>()(persist((set) => ({
  collected: {},
  toggle: (id) => set((s) => {
    const prev = s.collected[id] || {};
    const now = nextMonotonicSecond(prev.updatedAt);
    const next = {
      collected: {
        ...s.collected,
        [id]: { done: !prev.done, note: prev.note, updatedAt: now }
      }
    };
    markDirty(id);
    return next;
  }),
  setNote: (id, note) => set((s) => {
    const prev = s.collected[id] || {};
    const now = nextMonotonicSecond(prev.updatedAt);
    const next = {
      collected: {
        ...s.collected,
        [id]: { done: prev.done ?? false, note, updatedAt: now }
      }
    };
    markDirty(id);
    return next;
  }),
  reset: () => set({ collected: {} }),
  importProgress: (incoming) => {
    const clean: CollectedMap = {};
    for (const [k, v] of Object.entries(incoming)) {
      if (typeof v === "object" && v) {
        const ts = typeof (v as any).updatedAt === "number" ? Math.floor((v as any).updatedAt) : undefined;
        clean[k] = { done: !!(v as any).done, note: typeof (v as any).note === "string" ? (v as any).note : undefined, updatedAt: ts };
      } else clean[k] = { done: !!v };
    }
    set({ collected: clean });
  },
  ensureKnown: (_names) => {},
  async syncFromServer() {
    try {
      const res = await fetch("/api/progress", { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json();
      if (data?.collected && typeof data.collected === "object") {
        const incoming = data.collected as Record<string, { done?: boolean; note?: string; updatedAt?: number }>;
        const clean: CollectedMap = {};
        for (const [k, v] of Object.entries(incoming)) {
          clean[k] = { done: !!v?.done, note: typeof v?.note === "string" ? v.note : undefined, updatedAt: typeof v?.updatedAt === "number" ? Math.floor(v.updatedAt) : undefined };
        }
        set({ collected: clean });
      }
    } catch {}
  }
}), { name: "wukong-100-tracker-v1", onRehydrateStorage: () => {
  return () => { hasHydrated = true; };
} }));

// Snapshot sync deprecated; using per-item delta queue instead

if (typeof window !== "undefined") {
  // Initial pull on load
  (async () => {
    try {
      const res = await fetch("/api/progress", { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        const incoming = data?.collected as Record<string, { done?: boolean; note?: string; updatedAt?: number }> | undefined;
        if (incoming) {
          const clean: CollectedMap = {};
          for (const [k, v] of Object.entries(incoming)) clean[k] = { done: !!v?.done, note: typeof v?.note === "string" ? v.note : undefined, updatedAt: typeof v?.updatedAt === "number" ? Math.floor(v.updatedAt) : undefined };
          isApplyingRemote = true;
          useProgressStore.setState(s => ({ collected: mergeByTimestamp(s.collected, clean) }));
          isApplyingRemote = false;
        }
      }
    } catch {}
    finally {
      hasDoneInitialServerSync = true;
    }
  })();

  // Watch state changes and push to server
  useProgressStore.subscribe((_state) => {
    if (!hasHydrated || !hasDoneInitialServerSync || isApplyingRemote) return;
    scheduleDrain();
  });

  // Lightweight background sync to reflect server/other-device changes without full refresh
  let isSyncing = false;
  async function backgroundSync() {
    if (isSyncing) return;
    isSyncing = true;
    try {
      const res = await fetch(`/api/progress?ts=${Date.now()}`, { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json();
      const incoming = data?.collected as Record<string, { done?: boolean; note?: string; updatedAt?: number }> | undefined;
      if (!incoming) return;
      const clean: CollectedMap = {};
      for (const [k, v] of Object.entries(incoming)) clean[k] = { done: !!v?.done, note: typeof v?.note === "string" ? v.note : undefined, updatedAt: typeof v?.updatedAt === "number" ? Math.floor(v.updatedAt) : undefined };
      isApplyingRemote = true;
      useProgressStore.setState(s => ({ collected: mergeByTimestamp(s.collected, clean) }));
      isApplyingRemote = false;
    } catch {}
    finally { isSyncing = false; }
  }

  const pollIntervalMs = 20000;
  setInterval(backgroundSync, pollIntervalMs);
  window.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") backgroundSync();
  });
  window.addEventListener("focus", () => backgroundSync());
}


