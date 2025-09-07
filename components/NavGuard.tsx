"use client";

import { useEffect } from "react";

function hasPending(): boolean {
  return /(?:^|; )progress_pending=1(?:;|$)/.test(document.cookie);
}

export function NavGuard() {
  useEffect(() => {
    const beforeUnload = (e: BeforeUnloadEvent) => {
      if (hasPending()) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    const onClick = (e: MouseEvent) => {
      if (!hasPending()) return;
      const target = e.target as HTMLElement | null;
      if (!target) return;
      const anchor = target.closest("a[href]") as HTMLAnchorElement | null;
      if (!anchor) return;
      const href = anchor.getAttribute("href") || "";
      if (href.startsWith("#") || href.startsWith("javascript:")) return;
      try {
        const url = new URL(href, window.location.href);
        if (url.origin === window.location.origin) {
          e.preventDefault();
          alert("Please Finalise your changes before navigating.");
        }
      } catch {}
    };
    window.addEventListener("beforeunload", beforeUnload);
    document.addEventListener("click", onClick, true);
    return () => {
      window.removeEventListener("beforeunload", beforeUnload);
      document.removeEventListener("click", onClick, true);
    };
  }, []);

  return null;
}


