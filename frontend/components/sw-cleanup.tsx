"use client";

import { useEffect } from "react";

export function SwCleanup() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;

    void (async () => {
      try {
        const registrations = await navigator.serviceWorker.getRegistrations();
        await Promise.all(registrations.map((registration) => registration.unregister()));
      } catch {
        // Ignore cleanup errors; app should continue to work.
      }

      try {
        if (!("caches" in window)) return;
        const names = await caches.keys();
        await Promise.all(names.map((name) => caches.delete(name)));
      } catch {
        // Ignore cleanup errors; app should continue to work.
      }
    })();
  }, []);

  return null;
}
