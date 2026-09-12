'use client';

import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Basketball } from "@/components/basketball-icon"
import React, { useEffect, useRef } from "react"
import type { Room } from "@/lib/types";

// Default room values — rooms with these values don't show custom rule indicators
const DEFAULTS = { scoreMax: 10, roundGoal: 3, gravity: 4, timeLimit: 0, tournament: false };

function getMaxPlayers(mode: string) { return mode === '2v2' ? 4 : 2; }

function getRoomStatus(room: Room): 'waiting' | 'playing' | 'finished' {
  if (room.winner !== null) return 'finished';
  if (room.started) return 'playing';
  return 'waiting';
}

function hasCustomRules(room: Room) {
  return (
    room.scoreMax !== DEFAULTS.scoreMax ||
    room.roundGoal !== DEFAULTS.roundGoal ||
    room.gravity !== DEFAULTS.gravity ||
    room.timeLimit !== DEFAULTS.timeLimit ||
    room.tournament !== DEFAULTS.tournament
  );
}

async function fetchRooms(mode: string, status: string, sort: string): Promise<Room[]> {
  const params = new URLSearchParams();
  if (mode !== 'all') params.set('mode', mode);
  if (status !== 'all') params.set('status', status);
  params.set('sort', sort);
  const res = await fetch(`/api/rooms?${params.toString()}`);
  if (!res.ok) throw new Error('Failed to fetch rooms');
  const data = await res.json();
  return (Array.isArray(data) ? data : []).map((r: any) => ({
    ...r,
    players: [r.host, r.opponent, r.player3, r.player4].filter(Boolean),
    createdAt: typeof r.createdAt === 'number' ? r.createdAt : new Date(r.createdAt).getTime(),
    gravity: r.gravity ?? 4,
    timeLimit: r.timeLimit ?? 0,
    winner: r.winner ?? null,
  }));
}

export default function RoomsPage() {
  const [rooms, setRooms] = React.useState<Room[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [modeFilter, setModeFilter] = React.useState<'all' | '1v1' | '2v2'>('all');
  const [statusFilter, setStatusFilter] = React.useState<'all' | 'waiting' | 'playing'>('all');
  const [sort, setSort] = React.useState<'newest' | 'oldest'>('newest');
  const [autoRefresh, setAutoRefresh] = React.useState(true);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const data = await fetchRooms(modeFilter, statusFilter, sort);
        if (!cancelled) setRooms(data);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false); // Always clear loading, even if cancelled
      }
    }
    load();
    return () => { cancelled = true; };
  }, [modeFilter, statusFilter, sort]);

  useEffect(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (autoRefresh) {
      intervalRef.current = setInterval(async () => {
        try {
          const data = await fetchRooms(modeFilter, statusFilter, sort);
          setRooms(data);
        } catch (e) {
          console.error(e);
        }
      }, 5000);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [autoRefresh, modeFilter, statusFilter, sort]);

  const segBtn = (active: boolean) =>
    `px-3 py-1 text-xs font-medium transition-colors ${active
      ? 'bg-secondary text-foreground'
      : 'text-muted-foreground hover:text-foreground'}`;

  const filterGroup = (label: string, children: React.ReactNode) => (
    <div className="flex items-center gap-2">
      <span className="font-mono-game text-[10px] uppercase tracking-[0.15em] text-muted-foreground">{label}</span>
      <div className="flex rounded-md border divide-x overflow-hidden">{children}</div>
    </div>
  );

  return (
    <div className="container py-10">
      <div className="flex flex-wrap items-end justify-between gap-4 pb-5 mb-6 border-b">
        <div>
          <p className="font-mono-game text-[11px] uppercase tracking-[0.2em] text-primary mb-1.5">Multiplayer lobby</p>
          <h1 className="text-2xl font-bold tracking-tight">Rooms</h1>
        </div>
        <div className="flex gap-2">
          <Button asChild>
            <Link href="/rooms/create">Create room</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/rooms/join">Join by code</Link>
          </Button>
        </div>
      </div>

      {/* Filter toolbar */}
      <div className="flex flex-wrap gap-x-6 gap-y-3 mb-6 items-center">
        {filterGroup('Mode', (['all', '1v1', '2v2'] as const).map(m => (
          <button key={m} className={segBtn(modeFilter === m)} onClick={() => setModeFilter(m)}>
            {m === 'all' ? 'All' : m.toUpperCase()}
          </button>
        )))}

        {filterGroup('Status', (['all', 'waiting', 'playing'] as const).map(s => (
          <button key={s} className={segBtn(statusFilter === s)} onClick={() => setStatusFilter(s)}>
            {s === 'all' ? 'All' : s === 'waiting' ? 'Waiting' : 'In progress'}
          </button>
        )))}

        {filterGroup('Sort', (['newest', 'oldest'] as const).map(s => (
          <button key={s} className={segBtn(sort === s)} onClick={() => setSort(s)}>
            {s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        )))}

        {/* Auto-refresh toggle */}
        <button
          className="flex items-center gap-2 ml-auto text-xs text-muted-foreground hover:text-foreground transition-colors"
          onClick={() => setAutoRefresh(v => !v)}
        >
          <span className={`inline-block w-1.5 h-1.5 rounded-full ${autoRefresh ? 'bg-green-500 animate-pulse' : 'bg-border'}`} />
          Live updates {autoRefresh ? 'on' : 'off'}
        </button>
      </div>

      {/* Room count */}
      <p className="font-mono-game text-[11px] uppercase tracking-[0.15em] text-muted-foreground mb-4">
        {loading ? 'Loading…' : `${rooms.length} room${rooms.length !== 1 ? 's' : ''}`}
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {rooms.map((room) => {
          const { id, name, host, mode, players } = room;
          const maxPlayers = getMaxPlayers(mode);
          const status = getRoomStatus(room);
          const custom = hasCustomRules(room);

          const statusLabel = status === 'waiting' ? 'Waiting' : status === 'playing' ? 'In progress' : 'Finished';
          const statusDot = status === 'waiting' ? 'bg-green-500' : status === 'playing' ? 'bg-amber-500' : 'bg-border';

          return (
            <div key={id} className="rounded-lg border bg-card card-lift flex flex-col">
              <div className="p-4 flex-1 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="font-semibold leading-tight truncate">{name}</h2>
                    <p className="text-xs text-muted-foreground mt-0.5">hosted by {host}</p>
                  </div>
                  <span className="shrink-0 font-mono-game text-[10px] uppercase tracking-wider text-muted-foreground border rounded px-1.5 py-0.5">
                    {mode}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-xs">
                  <span className="flex items-center gap-1.5">
                    <span className={`w-1.5 h-1.5 rounded-full ${statusDot} ${status === 'waiting' ? 'animate-pulse' : ''}`} />
                    {statusLabel}
                  </span>
                  {custom && <span className="text-muted-foreground">Custom rules</span>}
                  {room.tournament && <span className="text-muted-foreground">Tournament</span>}
                </div>
                {custom && (
                  <div className="text-xs text-muted-foreground space-y-0.5">
                    {room.scoreMax !== DEFAULTS.scoreMax && <p>Score limit {room.scoreMax}</p>}
                    {room.roundGoal !== DEFAULTS.roundGoal && <p>First to {room.roundGoal} rounds</p>}
                    {room.gravity !== DEFAULTS.gravity && <p>Gravity {room.gravity}</p>}
                    {room.timeLimit !== DEFAULTS.timeLimit && <p>{room.timeLimit}s time limit</p>}
                  </div>
                )}
              </div>
              <div className="border-t px-4 py-2.5 flex items-center justify-between">
                <span className="font-mono-game text-xs text-muted-foreground">
                  {players.length}<span className="opacity-50">/{maxPlayers}</span> players
                </span>
                {status === 'waiting' && (
                  <Button size="sm" variant="outline" disabled={players.length >= maxPlayers} asChild={players.length < maxPlayers}>
                    {players.length >= maxPlayers ? <span>Full</span> : <Link href={`/rooms/join/${id}`}>Join</Link>}
                  </Button>
                )}
                {status === 'playing' && (
                  <Button size="sm" variant="ghost" asChild>
                    <Link href={`/rooms/${id}/watch`}>Watch</Link>
                  </Button>
                )}
                {status === 'finished' && (
                  <span className="text-xs text-muted-foreground">Game over</span>
                )}
              </div>
            </div>
          );
        })}

        {!loading && rooms.length === 0 && (
          <div className="col-span-full border border-dashed rounded-lg py-16 flex flex-col items-center justify-center text-center">
            <Basketball className="w-8 h-8 mb-3 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground mb-4">No rooms right now.</p>
            <Button variant="outline" asChild>
              <Link href="/rooms/create">Create the first one</Link>
            </Button>
          </div>
        )}

        {loading && (
          <div className="col-span-full border border-dashed rounded-lg py-16 flex items-center justify-center">
            <p className="font-mono-game text-xs uppercase tracking-[0.15em] text-muted-foreground">Loading…</p>
          </div>
        )}
      </div>
    </div>
  )
}

