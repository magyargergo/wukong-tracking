"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export const dynamic = "force-dynamic";

function LoginInner() {
  const router = useRouter();
  const params = useSearchParams();
  const next = (params?.get("next") as string | null) || "/";
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ username, password })
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: "Login failed" }));
        throw new Error(data.error || "Login failed");
      }
      router.replace(next);
      router.refresh();
    } catch (e: any) {
      setError(e.message || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-sm mx-auto mt-16 card p-6">
      <div className="text-xl font-semibold mb-4">Sign in</div>
      {error && <div className="mb-3 text-sm text-red-600">{error}</div>}
      <form className="space-y-3" onSubmit={onSubmit}>
        <div className="space-y-1">
          <label className="text-sm">Username</label>
          <input className="input w-full" value={username} onChange={e=>setUsername(e.target.value)} autoComplete="username" suppressHydrationWarning />
        </div>
        <div className="space-y-1">
          <label className="text-sm">Password</label>
          <input className="input w-full" type="password" value={password} onChange={e=>setPassword(e.target.value)} autoComplete="current-password" suppressHydrationWarning />
        </div>
        <button className="btn w-full justify-center" disabled={loading}>
          {loading ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="p-6 text-neutral-400">Loading…</div>}>
      <LoginInner />
    </Suspense>
  );
}


