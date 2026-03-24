"use client"
import { useEffect } from "react"

export function OnlineHeartbeat() {
  useEffect(() => {
    const name = localStorage.getItem('playerName');
    if (!name) return;

    const beat = () => {
      const roomMatch = window.location.pathname.match(/\/rooms\/(.+)/);
      fetch('/api/online', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerName: name, roomId: roomMatch?.[1] }),
      }).catch(() => {});
    };

    beat();
    const interval = setInterval(beat, 10000);
    return () => clearInterval(interval);
  }, []);

  return null;
}
