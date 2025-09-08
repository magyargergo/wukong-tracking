"use client";

import { useMemo } from "react";
import { useData } from "@/lib/data";
import { useProgressStore } from "@/lib/store";
import { ProgressRing } from "@/components/ProgressRing";
import { ListTodo, Settings as SettingsIcon } from "lucide-react";
import Link from "next/link";

export default function HomePage() {
  const { expectedCounts, items } = useData();
  const { collected } = useProgressStore();

  const byCategory = useMemo(() => {
    const map: Record<string, { total:number; done:number; }> = {};
    Object.entries(expectedCounts).forEach(([cat, total]) => map[cat] = { total, done: 0 });
    items.forEach((it) => {
      if (!map[it.category]) return;
      if (collected[it.id]) map[it.category].done += 1;
    });
    return map;
  }, [items, expectedCounts, collected]);

  const total = useMemo(() => {
    const t = Object.values(expectedCounts).reduce((a,b)=>a+b,0);
    const d = Object.entries(expectedCounts).reduce((acc,[cat,_]) => acc + (byCategory[cat]?.done ?? 0), 0);
    return { t, d, pct: Math.round((d / Math.max(1,t))*100) };
  }, [expectedCounts, byCategory]);

  return (
    <div className="space-y-6">
      <section className="card p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-4">
          <ProgressRing value={total.pct} size={72} strokeWidth={10} />
          <div>
            <div className="h1">Overall Progress</div>
            <div className="muted">{total.d} / {total.t} items tracked</div>
          </div>
        </div>
        <div className="hidden sm:flex gap-2 flex-wrap">
          <Link className="btn btn-ghost" href="/tracker"><ListTodo size={16}/> Open Tracker</Link>
          <Link className="btn btn-ghost" href="/settings"><SettingsIcon size={16}/> Settings</Link>
        </div>
      </section>

      <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {Object.entries(expectedCounts).map(([cat, total]) => {
          const done = byCategory[cat]?.done ?? 0;
          const pct = Math.round((done/Math.max(1,total))*100);
          return (
            <Link key={cat} href={`/tracker?category=${encodeURIComponent(cat)}`} className="card p-5 hover:border-accent/60 transition-colors">
              <div className="flex items-center gap-4">
                <ProgressRing value={pct} size={56} strokeWidth={8} />
                <div>
                  <div className="text-lg font-semibold">{cat}</div>
                  <div className="text-neutral-400">{done} / {total}</div>
                </div>
              </div>
            </Link>
          );
        })}
      </section>
    </div>
  );
}


