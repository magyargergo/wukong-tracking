"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

type CollectedEntry = { done: boolean; note?: string };
type CollectedMap = Record<string, CollectedEntry>;

interface ProgressState {
  collected: CollectedMap;
  toggle: (id: string) => void;
  setNote: (id: string, note: string) => void;
  reset: () => void;
  importProgress: (incoming: Record<string, any>) => void;
  ensureKnown: (names: string[]) => void;
}

export const useProgressStore = create<ProgressState>()(persist((set, get) => ({
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
  ensureKnown: (_names) => {}
}), { name: "wukong-100-tracker-v1" }));


