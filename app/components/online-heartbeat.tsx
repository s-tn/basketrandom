"use client"
import { useEffect, useRef } from "react"

export function OnlineHeartbeat() {
  const prevOnline = useRef<Set<string>>(new Set());

  useEffect(() => {
    const name = localStorage.getItem('playerName');
    if (!name) return;

    const beat = async () => {
      const roomMatch = window.location.pathname.match(/\/rooms\/(.+)/);
      fetch('/api/online', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerName: name, roomId: roomMatch?.[1] }),
      }).catch(() => {});

      const friends = await fetch(`/api/friends?player=${name}`).then(r => r.json()).catch(() => []);
      if (friends.length > 0) {
        const statuses = await fetch(`/api/online?names=${friends.join(',')}`).then(r => r.json()).catch(() => ({}));
        for (const [friend, status] of Object.entries(statuses)) {
          if ((status as any).online && !prevOnline.current.has(friend)) {
            window.dispatchEvent(new CustomEvent('friend-online', { detail: { name: friend } }));
          }
        }
        prevOnline.current = new Set(Object.entries(statuses).filter(([, s]) => (s as any).online).map(([n]) => n));
      }
    };

    beat();
    const interval = setInterval(beat, 10000);
    return () => clearInterval(interval);
  }, []);

  return null;
}
