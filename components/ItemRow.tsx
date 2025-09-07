"use client";

import { Item } from "@/lib/types";

export function ItemRow({ item, done, note, onToggle, onNote }: { item: Item; done: boolean; note: string; onToggle: (id:string)=>void; onNote: (id:string, note:string)=>void; }) {
  const hasDetails = Boolean((Array.isArray(item.sources) && item.sources.length > 0) || item.description || item.howToGet || item.notes);
  return (
    <li className="card p-4 flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <label className="flex items-center gap-3 cursor-pointer">
          <input type="checkbox" className="accent-accent w-6 h-6" checked={done} onChange={()=>onToggle(item.id)} />
          <span className="font-medium text-base sm:text-lg">{item.name}</span>
        </label>
        <div className="flex gap-2 flex-wrap">
          {item.category && <span className="badge">{item.category}</span>}
          {item.chapter && <span className="badge">Chapter {item.chapter}</span>}
          {item.missable && <span className="badge">Missable</span>}
          {item.ngPlusOnly && <span className="badge">NG+</span>}
        </div>
      </div>
      <div className="flex flex-col sm:flex-row sm:items-start gap-4 sm:gap-6">
        <div className="sm:w-72">
          <div className="text-sm font-medium text-accent">Guides</div>
          <div className="text-sm text-neutral-700 dark:text-neutral-300 mt-2 max-w-prose space-y-2">
            {Array.isArray(item.sources) && item.sources.length > 0 ? (
              <div className="text-xs text-neutral-500 dark:text-neutral-400 flex flex-wrap gap-2">
                {item.sources.map((u, i) => {
                  let label = `Source ${i+1}`;
                  try { label = new URL(u).hostname.replace(/^www\./, ""); } catch {}
                  return (
                    <a key={i} className="underline hover:text-accent" href={u} target="_blank" rel="noreferrer noopener">
                      {label}
                    </a>
                  );
                })}
              </div>
            ) : (
              <div className="text-xs text-neutral-500 dark:text-neutral-400">No links available.</div>
            )}
          </div>
        </div>
        <div className="w-full sm:w-80 sm:ml-auto">
          <input
            className="input w-full text-base"
            placeholder="Your note…"
            value={note}
            onChange={e=>onNote(item.id, e.target.value)}
          />
        </div>
      </div>
    </li>
  );
}


