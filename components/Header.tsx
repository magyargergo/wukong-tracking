"use client";

import Link from "next/link";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { Sun, Moon, Home, ListTodo, Settings, ArrowLeft } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";

export function Header() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(()=>setMounted(true),[]);
  const pathname = usePathname();
  const router = useRouter();
  const [isSystemAdmin, setIsSystemAdmin] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/me", { cache: "no-store" });
        const data = await res.json();
        setIsSystemAdmin(!!data?.user?.isSystemAdmin);
      } catch {}
    })();
  }, []);

  const onLogout = async () => {
    await fetch("/api/logout", { method: "POST" });
    router.replace("/login");
    router.refresh();
  };

  return (
    pathname === "/login" ? null : (
    <header className="sticky top-0 z-30 border-b bg-white/80 border-neutral-200 backdrop-blur supports-[backdrop-filter]:bg-white/60 dark:bg-neutral-950/80 dark:border-neutral-800 dark:supports-[backdrop-filter]:bg-neutral-950/60">
      <div className="container mx-auto px-4 py-3 flex items-center gap-3">
        <button className="btn lg:hidden" onClick={() => router.back()} aria-label="Go back">
          <ArrowLeft size={16} /> Back
        </button>
        <Link href="/" className="font-semibold text-lg">Wukong 100%</Link>
        <nav className="ml-auto flex items-center gap-2">
          <Link className="btn" href="/"><Home size={16}/> Home</Link>
          {!isSystemAdmin && <Link className="btn" href="/tracker"><ListTodo size={16}/> Tracker</Link>}
          {!isSystemAdmin && <Link className="btn" href="/settings"><Settings size={16}/> Settings</Link>}
          {isSystemAdmin && <Link className="btn" href="/admin/users">System Admin</Link>}
          <button className="btn" onClick={()=> setTheme((theme ?? "dark")==="dark" ? "light" : "dark")}>
            {mounted && (theme ?? "dark")==="dark" ? <Sun size={16}/> : <Moon size={16}/>}
            Theme
          </button>
          <button className="btn" onClick={onLogout}>Logout</button>
        </nav>
      </div>
    </header>
    )
  );
}


