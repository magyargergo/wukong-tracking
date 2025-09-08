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
  const { collected } = useProgressStore();

  const filtered = useMemo(() => {
    const tokens = query.toLowerCase().trim().split(/\s+/).filter(Boolean);
    const matchTokens = (hay: string) => tokens.every(t => hay.includes(t));
    return items
      .filter(it => {
        if (qCat && it.category !== qCat) return false;
        if (onlyIncomplete && collected[it.id]) return false;
        if (tokens.length > 0) {
          const haystack = [
            it.name,
            it.notes,
            it.description,
            it.howToGet,
            Array.isArray(it.sources) ? it.sources.join(" ") : "",
            it.category,
            it.chapter ? `chapter ${it.chapter}` : "",
            it.ngPlusOnly ? "ng+" : "",
            it.missable ? "missable" : "",
          ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase();
          if (!matchTokens(haystack)) return false;
        }
        return true;
      })
      .sort((a, b) => {
        if (a.category !== b.category) return a.category.localeCompare(b.category);
        const normalizeChapter = (c: any) => {
          if (typeof c === "number") return c;
          if (c === "Secret") return 100;
          if (c === "NG+") return 200;
          return 999;
        };
        const ca = normalizeChapter(a.chapter);
        const cb = normalizeChapter(b.chapter);
        if (ca !== cb) return ca - cb;
        return a.name.localeCompare(b.name);
      });
  }, [items, qCat, onlyIncomplete, query, collected]);

  return (
    <div className="space-y-4">
      <div className="card sticky-card p-4 flex gap-3 flex-wrap items-center">
        <div className="relative w-full sm:w-80">
          <input
            className="input w-full"
            placeholder="Search name, description, chapter, etc."
            aria-label="Search"
            value={query}
            onChange={e=>setQuery(e.target.value)}
            onKeyDown={e=>{ if (e.key === "Escape" && query) { e.preventDefault(); setQuery(""); } }}
            style={{ paddingLeft: "2.5rem", paddingRight: "3rem" }}
          />
          <div className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500 dark:text-neutral-400">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M21 21l-4.35-4.35" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <circle cx="10" cy="10" r="7" stroke="currentColor" strokeWidth="2"/>
            </svg>
          </div>
          {query && (
            <button
              type="button"
              title="Clear"
              aria-label="Clear search"
              onMouseDown={e=>e.preventDefault()}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full w-7 h-7 flex items-center justify-center text-neutral-600 dark:text-neutral-300 bg-neutral-200 hover:bg-neutral-300 dark:bg-neutral-700 dark:hover:bg-neutral-600 focus:outline-none focus:ring-2 focus:ring-accent/60"
              onClick={()=>setQuery("")}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              </svg>
            </button>
          )}
        </div>
        <label className="badge gap-2 cursor-pointer">
          <input type="checkbox" className="accent-accent" checked={onlyIncomplete} onChange={e=>setOnlyIncomplete(e.target.checked)} />
          Only incomplete
        </label>
        <div className="ml-auto text-sm text-neutral-500 dark:text-neutral-400">{filtered.length} result{filtered.length===1?"":"s"}</div>
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


