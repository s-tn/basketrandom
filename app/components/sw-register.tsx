"use client"
import { useEffect } from "react"

export function ServiceWorkerRegister() {
  useEffect(() => {
    // Unregister any existing service worker to prevent redirect loops
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations().then((registrations) => {
        for (const registration of registrations) {
          registration.unregister();
        }
      });
    }
  }, []);
  return null;
}
