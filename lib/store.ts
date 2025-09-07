"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

type CollectedEntry = { done: boolean; note?: string };
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

export const useProgressStore = create<ProgressState>()(persist((set) => ({
  collected: {},
  toggle: (id) => set((s) => ({
    collected: { ...s.collected, [id]: { ...s.collected[id], done: !s.collected[id]?.done } }
  })),
  setNote: (id, note) => set((s) => ({
    collected: { ...s.collected, [id]: { ...s.collected[id], note, done: s.collected[id]?.done ?? false } }
  })),
  reset: () => set({ collected: {} }),
  importProgress: (incoming) => {
    const clean: CollectedMap = {};
    for (const [k, v] of Object.entries(incoming)) {
      if (typeof v === "object" && v) clean[k] = { done: !!(v as any).done, note: typeof (v as any).note==="string" ? (v as any).note : undefined };
      else clean[k] = { done: !!v };
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
        const incoming = data.collected as Record<string, { done?: boolean; note?: string }>;
        const clean: CollectedMap = {};
        for (const [k, v] of Object.entries(incoming)) {
          clean[k] = { done: !!v?.done, note: typeof v?.note === "string" ? v.note : undefined };
        }
        set({ collected: clean });
      }
    } catch {}
  }
}), { name: "wukong-100-tracker-v1" }));

// Client-side background sync for mutations
let syncTimer: any = null;
let currentController: AbortController | null = null;

async function sendSnapshot(collected: CollectedMap) {
  // Cancel any in-flight request; always send the newest snapshot
  if (currentController) currentController.abort();
  const controller = new AbortController();
  currentController = controller;
  try {
    const csrf = (document.cookie.match(/(?:^|; )csrfToken=([^;]+)/)?.[1]) || "";
    const res = await fetch("/api/progress", {
      method: "PUT",
      headers: { "content-type": "application/json", "x-csrf-token": csrf },
      body: JSON.stringify({ collected: Object.fromEntries(Object.entries(collected).map(([k, v]) => [k, { ...v, updatedAt: Math.floor(Date.now()/1000) }])) }),
      signal: controller.signal
    });
    if (res.status === 409) {
      const latest = await fetch(`/api/progress?ts=${Date.now()}`, { cache: "no-store" });
      if (latest.ok) {
        const data = await latest.json();
        const incoming = data?.collected as Record<string, { done?: boolean; note?: string }>|undefined;
        if (incoming) {
          const clean: CollectedMap = {};
          for (const [k, v] of Object.entries(incoming)) clean[k] = { done: !!v?.done, note: typeof v?.note === "string" ? v.note : undefined };
          useProgressStore.setState({ collected: clean });
        }
      }
    }
  } catch {}
  finally {
    if (currentController === controller) currentController = null;
  }
}

function schedulePush(collected: CollectedMap) {
  if (syncTimer) clearTimeout(syncTimer);
  syncTimer = setTimeout(() => { void sendSnapshot(collected); }, 200);
}

if (typeof window !== "undefined") {
  // Initial pull on load
  (async () => {
    try {
      const res = await fetch("/api/progress", { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        const incoming = data?.collected as Record<string, { done?: boolean; note?: string }> | undefined;
        if (incoming) {
          const clean: CollectedMap = {};
          for (const [k, v] of Object.entries(incoming)) clean[k] = { done: !!v?.done, note: typeof v?.note === "string" ? v.note : undefined };
          useProgressStore.setState({ collected: clean });
        }
      }
    } catch {}
  })();

  // Watch state changes and push to server
  useProgressStore.subscribe((state) => {
    // Send only deltas could be implemented here; for now keep full but consider future optimization.
    schedulePush(state.collected);
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
      const incoming = data?.collected as Record<string, { done?: boolean; note?: string }> | undefined;
      if (!incoming) return;
      const clean: CollectedMap = {};
      for (const [k, v] of Object.entries(incoming)) clean[k] = { done: !!v?.done, note: typeof v?.note === "string" ? v.note : undefined };
      useProgressStore.setState({ collected: clean });
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


