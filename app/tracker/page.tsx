"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useData } from "@/lib/data";
import { useProgressStore } from "@/lib/store";
import { ItemRow } from "@/components/ItemRow";

function TrackerInner() {
  const { items } = useData();
  const search = useSearchParams();
  const qCat = (search?.get("category") as string | null) ?? "";
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [onlyIncomplete, setOnlyIncomplete] = useState(false);
  const [onlyMissable, setOnlyMissable] = useState(false);
  const [chapterFilter, setChapterFilter] = useState<string>("");
  const [showFilters, setShowFilters] = useState(false);
  const { collected } = useProgressStore();

  // Debounce query updates for smoother typing on mobile/tablet
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query), 150);
    return () => clearTimeout(t);
  }, [query]);

  const filtered = useMemo(() => {
    const tokens = debouncedQuery.toLowerCase().trim().split(/\s+/).filter(Boolean);
    const matchTokens = (hay: string) => tokens.every(t => hay.includes(t));
    return items
      .filter(it => {
        if (qCat && it.category !== qCat) return false;
        if (onlyIncomplete && collected[it.id]) return false;
        if (onlyMissable && !it.missable) return false;
        if (chapterFilter) {
          const ch = typeof it.chapter === "number" ? String(it.chapter) : (it.chapter ?? "");
          if (ch !== chapterFilter) return false;
        }
        if (tokens.length > 0) {
          const haystack = [
            it.name,
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
  }, [items, qCat, onlyIncomplete, onlyMissable, chapterFilter, debouncedQuery, collected]);

  return (
    <div className="space-y-4">
      <div className="card sticky top-0 z-20 p-4 flex gap-3 flex-wrap items-center">
        <div className="relative w-full sm:w-96">
          <input
            className="input w-full"
            placeholder="Search name, sources, chapter, etc."
            aria-label="Search"
            type="search"
            inputMode="search"
            enterKeyHint="search"
            autoCorrect="off"
            autoCapitalize="none"
            autoComplete="off"
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
        <button
          type="button"
          className="sm:hidden btn"
          aria-expanded={showFilters}
          onClick={()=>setShowFilters(v=>!v)}
        >
          {showFilters ? "Hide filters" : "Filters"}
        </button>
        <div className="hidden sm:flex items-center gap-2">
          <label className="text-sm text-neutral-600 dark:text-neutral-300">Chapter</label>
          <select
            className="select"
            aria-label="Filter by chapter"
            value={chapterFilter}
            onChange={e=>setChapterFilter(e.target.value)}
          >
            <option value="">All</option>
            <option value="1">1</option>
            <option value="2">2</option>
            <option value="3">3</option>
            <option value="4">4</option>
            <option value="5">5</option>
            <option value="6">6</option>
            <option value="Secret">Secret</option>
            <option value="NG+">NG+</option>
          </select>
        </div>
        <div className="hidden sm:flex items-center gap-3">
          <label className="badge gap-2 cursor-pointer">
            <input type="checkbox" className="accent-accent" checked={onlyMissable} onChange={e=>setOnlyMissable(e.target.checked)} />
            Only missable
          </label>
          <label className="badge gap-2 cursor-pointer">
            <input type="checkbox" className="accent-accent" checked={onlyIncomplete} onChange={e=>setOnlyIncomplete(e.target.checked)} />
            Only incomplete
          </label>
        </div>
        <div className="ml-auto text-sm text-neutral-500 dark:text-neutral-400">{filtered.length} result{filtered.length===1?"":"s"}</div>
      </div>

      {/* Mobile / tablet filters drawer (simple collapsible) */}
      {showFilters && (
        <div className="card sm:hidden p-4 flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <label className="text-sm text-neutral-600 dark:text-neutral-300">Chapter</label>
            <select
              className="select flex-1"
              aria-label="Filter by chapter"
              value={chapterFilter}
              onChange={e=>setChapterFilter(e.target.value)}
            >
              <option value="">All</option>
              <option value="1">1</option>
              <option value="2">2</option>
              <option value="3">3</option>
              <option value="4">4</option>
              <option value="5">5</option>
              <option value="6">6</option>
              <option value="Secret">Secret</option>
              <option value="NG+">NG+</option>
            </select>
          </div>
          <label className="badge gap-2 cursor-pointer w-fit">
            <input type="checkbox" className="accent-accent" checked={onlyMissable} onChange={e=>setOnlyMissable(e.target.checked)} />
            Only missable
          </label>
          <label className="badge gap-2 cursor-pointer w-fit">
            <input type="checkbox" className="accent-accent" checked={onlyIncomplete} onChange={e=>setOnlyIncomplete(e.target.checked)} />
            Only incomplete
          </label>
          <button type="button" className="btn" onClick={()=>setShowFilters(false)}>Done</button>
        </div>
      )}

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


