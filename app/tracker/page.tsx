"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useMemo, useState } from "react";
import { useData } from "@/lib/data";
import { useProgressStore } from "@/lib/store";
import { ItemRow } from "@/components/ItemRow";

function TrackerInner() {
  const { items } = useData();
  const search = useSearchParams();
  const qCat = (search?.get("category") as string | null) ?? "";
  const [query, setQuery] = useState("");
  const [onlyIncomplete, setOnlyIncomplete] = useState(false);
  const [onlyNGP, setOnlyNGP] = useState(false);
  const { collected } = useProgressStore();

  const filtered = useMemo(() => {
    return items.filter(it => {
      if (qCat && it.category !== qCat) return false;
      if (onlyNGP && !it.ngPlusOnly) return false;
      if (onlyIncomplete && collected[it.id]) return false;
      if (query && !(`${it.name} ${it.notes||""}`.toLowerCase().includes(query.toLowerCase()))) return false;
      return true;
    });
  }, [items, qCat, onlyNGP, onlyIncomplete, query, collected]);

  return (
    <div className="space-y-4">
      <div className="card sticky-card p-4 flex gap-3 flex-wrap items-center">
        <input className="input w-full sm:w-72" placeholder="Search name or notes..." value={query} onChange={e=>setQuery(e.target.value)} />
        <label className="badge gap-2 cursor-pointer">
          <input type="checkbox" className="accent-accent" checked={onlyIncomplete} onChange={e=>setOnlyIncomplete(e.target.checked)} />
          Only incomplete
        </label>
        <label className="badge gap-2 cursor-pointer">
          <input type="checkbox" className="accent-accent" checked={onlyNGP} onChange={e=>setOnlyNGP(e.target.checked)} />
          Only NG+
        </label>
        <div className="ml-auto" />
      </div>

      <ul className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2">
        {filtered.map(it => <ItemRow key={it.id} item={it} />)}
        {filtered.length===0 && <div className="text-neutral-400 p-6 text-center">No items match your filters.</div>}
      </ul>

    </div>
  );
}

export default function TrackerPage() {
  return (
    <Suspense fallback={<div className="p-6 text-neutral-400">Loading…</div>}>
      <TrackerInner />
    </Suspense>
  );
}


