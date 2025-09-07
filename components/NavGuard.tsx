"use client";

import { useEffect } from "react";
import { useProgressStore } from "@/lib/store";

export function NavGuard() {
  const { dirty } = useProgressStore();

  useEffect(() => {
    const beforeUnload = (e: BeforeUnloadEvent) => {
      if (dirty) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    const onClick = (e: MouseEvent) => {
      if (!dirty) return;
      const target = e.target as HTMLElement | null;
      if (!target) return;
      const anchor = target.closest("a[href]") as HTMLAnchorElement | null;
      if (!anchor) return;
      const href = anchor.getAttribute("href") || "";
      if (href.startsWith("#") || href.startsWith("javascript:")) return;
      // Block same-origin navigations
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
  }, [dirty]);

  return null;
}


