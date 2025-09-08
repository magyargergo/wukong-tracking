"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, ListTodo, Settings } from "lucide-react";

export function FooterNav() {
  const pathname = usePathname();
  const isActive = (href: string) => pathname === href;
  return (
    <nav className="fixed bottom-0 inset-x-0 z-30 sm:hidden">
      <div className="mx-auto max-w-5xl px-4 pb-[max(env(safe-area-inset-bottom),0.5rem)]">
        <div className="surface rounded-2xl shadow-lg border grid grid-cols-3 overflow-hidden">
          <Link href="/" className={`flex items-center justify-center gap-2 py-3 ${isActive("/") ? "text-accent" : "text-neutral-700 dark:text-neutral-300"}`} aria-label="Home">
            <Home size={20} />
          </Link>
          <Link href="/tracker" className={`flex items-center justify-center gap-2 py-3 ${isActive("/tracker") ? "text-accent" : "text-neutral-700 dark:text-neutral-300"}`} aria-label="Tracker">
            <ListTodo size={20} />
          </Link>
          <Link href="/settings" className={`flex items-center justify-center gap-2 py-3 ${isActive("/settings") ? "text-accent" : "text-neutral-700 dark:text-neutral-300"}`} aria-label="Settings">
            <Settings size={20} />
          </Link>
        </div>
      </div>
    </nav>
  );
}


