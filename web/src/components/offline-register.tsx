"use client";

import { useEffect } from "react";

/** Registers the service worker that keeps the field screen working offline (FS-08). */
export function OfflineRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator) || process.env.NODE_ENV !== "production") return;
    navigator.serviceWorker.register("/sw.js").catch(() => undefined);
  }, []);
  return null;
}
