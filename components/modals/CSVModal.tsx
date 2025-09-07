"use client";

import { useState } from "react";
import { useData } from "@/lib/data";
import { useProgressStore } from "@/lib/store";

export function CSVModal({ open, onClose }: { open: boolean; onClose: ()=>void; }) {
  const [category, setCategory] = useState("Spirits");
  const [text, setText] = useState("");
  const { addBulkItems } = useData();
  const { ensureKnown } = useProgressStore();

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center p-4">
      <div className="card w-full sm:max-w-2xl p-4 space-y-3">
        <div className="text-lg font-semibold">CSV Paste</div>
        <div className="text-sm text-neutral-400">Paste names (one per line). Items will be added to the selected category.</div>
        <div className="flex gap-2">
          <select className="input" value={category} onChange={e=>setCategory(e.target.value)}>
            {["Spirits","Armor","Curios","Soaks","MeditationSpots"].map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <button className="btn ml-auto" onClick={onClose}>Close</button>
        </div>
        <textarea className="input w-full h-56" value={text} onChange={e=>setText(e.target.value)} placeholder="One item per line…" />
        <div className="flex gap-2">
          <button className="btn" onClick={() => { setText(""); }}>Clear</button>
          <button className="btn ml-auto" onClick={() => {
            const lines = text.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
            addBulkItems(category as any, lines);
            ensureKnown(lines);
            alert(`Added ${lines.length} items to ${category}`);
            onClose();
          }}>Add Items</button>
        </div>
      </div>
    </div>
  );
}


