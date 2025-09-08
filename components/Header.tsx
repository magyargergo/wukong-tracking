"use client";

import Link from "next/link";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { Sun, Moon, Home, ListTodo, Settings, ArrowLeft, LogOut, Shield } from "lucide-react";
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
        <button className="icon-btn btn-ghost rounded-full lg:hidden" onClick={() => router.back()} aria-label="Back">
          <ArrowLeft size={18} />
          <span className="sr-only">Back</span>
        </button>
        <Link href="/" className="font-semibold text-xl tracking-tight">Wukong</Link>
        <nav className="ml-auto hidden sm:flex items-center gap-1.5 overflow-x-auto overscroll-x-contain">
          <Link className="icon-btn btn-ghost rounded-full" href="/" aria-label="Home">
            <Home size={18}/>
            <span className="hidden md:inline"> Home</span>
          </Link>
          {!isSystemAdmin && (
            <Link className="icon-btn btn-ghost rounded-full" href="/tracker" aria-label="Tracker">
              <ListTodo size={18}/>
              <span className="hidden md:inline"> Tracker</span>
            </Link>
          )}
          {!isSystemAdmin && (
            <Link className="icon-btn btn-ghost rounded-full" href="/settings" aria-label="Settings">
              <Settings size={18}/>
              <span className="hidden md:inline"> Settings</span>
            </Link>
          )}
          {isSystemAdmin && (
            <Link className="icon-btn btn-ghost rounded-full" href="/admin/users" aria-label="Admin">
              <Shield size={18}/>
              <span className="hidden md:inline"> Admin</span>
            </Link>
          )}
          <button className="icon-btn btn-ghost rounded-full" aria-label="Toggle theme" onClick={()=> setTheme((theme ?? "dark")==="dark" ? "light" : "dark")}>
            {mounted && (theme ?? "dark")==="dark" ? <Sun size={18}/> : <Moon size={18}/>}
            <span className="hidden md:inline"> Theme</span>
          </button>
          <button className="icon-btn btn-ghost rounded-full" aria-label="Logout" onClick={onLogout}>
            <LogOut size={18} />
            <span className="hidden md:inline"> Logout</span>
          </button>
        </nav>
        {/* Mobile-only logout button on far right */}
        <button className="ml-auto icon-btn btn-ghost rounded-full shrink-0 sm:hidden" aria-label="Logout" onClick={onLogout}>
          <LogOut size={18} />
        </button>
      </div>
    </header>
    )
  );
}


