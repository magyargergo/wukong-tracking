"use client";

import { useProgressStore } from "@/lib/store";
import { useEffect, useRef, useState } from "react";
import { useData } from "@/lib/data";

export default function SettingsPage() {
  const { collected, reset, importProgress } = useProgressStore();
  const { items } = useData();
  const [exportHref, setExportHref] = useState<string>("");
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const data = {
      version: 1,
      date: new Date().toISOString(),
      collected
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    setExportHref(url);
    return () => URL.revokeObjectURL(url);
  }, [collected]);

  const onImport = async (file: File) => {
    const text = await file.text();
    try {
      const data = JSON.parse(text);
      if (!data.collected || typeof data.collected !== "object") throw new Error("Invalid file");
      importProgress(data.collected);
      alert("Import successful!");
    } catch (e:any) {
      alert("Import failed: " + e.message);
    }
  };

  const doneCount = Object.values(collected).filter(Boolean).length;

  return (
    <div className="space-y-6">
      <section className="card p-5 space-y-3">
        <div className="text-lg font-semibold">Export / Import</div>
        <div className="text-sm text-neutral-400">Back up your progress before starting NG+.</div>
        <div className="flex gap-2 flex-wrap">
          <a className="btn" href={exportHref} download="wukong-progress.json">Export JSON</a>
          <button className="btn" onClick={()=>fileRef.current?.click()}>Import JSON</button>
          <input type="file" accept="application/json" className="hidden" ref={fileRef} onChange={e => e.target.files && e.target.files[0] && onImport(e.target.files[0])} />
          <button className="btn" onClick={()=>{ if (confirm("Reset all progress?")) reset(); }}>Reset Progress</button>
        </div>
      </section>

      <section className="card p-5">
        <div className="font-semibold">Stats</div>
        <div className="text-neutral-400 text-sm">Collected items: {doneCount} / {items.length}</div>
      </section>
    </div>
  );
}



