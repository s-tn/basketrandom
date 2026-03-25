'use client';

import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Basketball } from "@/components/basketball-icon"
import React, { useEffect, useRef } from "react"
import type { Room } from "@/app/lib/types";

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
        if (!cancelled) setLoading(false);
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

  const filterBtn = (active: boolean) =>
    `px-3 py-1.5 text-sm rounded-md border transition-colors ${active
      ? 'bg-basketball-orange text-white border-basketball-orange'
      : 'bg-background border-muted text-muted-foreground hover:border-basketball-orange hover:text-foreground'}`;

  return (
    <div className="container py-8">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="basketball-texture w-10 h-10 flex items-center justify-center shadow-md">
            <Basketball className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold">Available Rooms</h1>
        </div>
        <div className="space-x-2">
          <Button asChild className="bg-basketball-orange hover:bg-basketball-darkOrange">
            <Link href="/rooms/create">Create Room</Link>
          </Button>
          <Button variant="outline" onClick={() => {
            const code = prompt("Enter the room code to join:");
            if (!code?.trim()) {
              alert("You must enter a room code to join.");
              return;
            }
            return location.href = `/rooms/${code}`;
          }}>
            Join Room
          </Button>
        </div>
      </div>

      <div className="basketball-divider w-full mb-6"></div>

      {/* Filter toolbar */}
      <div className="flex flex-wrap gap-4 mb-6 items-center">
        {/* Mode filter */}
        <div className="flex items-center gap-1.5">
          <span className="text-sm font-medium text-muted-foreground mr-1">Mode:</span>
          {(['all', '1v1', '2v2'] as const).map(m => (
            <button key={m} className={filterBtn(modeFilter === m)} onClick={() => setModeFilter(m)}>
              {m === 'all' ? 'All' : m.toUpperCase()}
            </button>
          ))}
        </div>

        {/* Status filter */}
        <div className="flex items-center gap-1.5">
          <span className="text-sm font-medium text-muted-foreground mr-1">Status:</span>
          {(['all', 'waiting', 'playing'] as const).map(s => (
            <button key={s} className={filterBtn(statusFilter === s)} onClick={() => setStatusFilter(s)}>
              {s === 'all' ? 'All' : s === 'waiting' ? 'Waiting' : 'In Progress'}
            </button>
          ))}
        </div>

        {/* Sort */}
        <div className="flex items-center gap-1.5">
          <span className="text-sm font-medium text-muted-foreground mr-1">Sort:</span>
          {(['newest', 'oldest'] as const).map(s => (
            <button key={s} className={filterBtn(sort === s)} onClick={() => setSort(s)}>
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>

        {/* Auto-refresh toggle */}
        <button
          className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md border transition-colors ml-auto ${autoRefresh
            ? 'bg-green-600 text-white border-green-600'
            : 'bg-background border-muted text-muted-foreground hover:border-green-600'}`}
          onClick={() => setAutoRefresh(v => !v)}
        >
          <span className={`inline-block w-2 h-2 rounded-full ${autoRefresh ? 'bg-white animate-pulse' : 'bg-muted-foreground'}`} />
          Auto-refresh {autoRefresh ? 'on' : 'off'}
        </button>
      </div>

      {/* Room count */}
      <p className="text-sm text-muted-foreground mb-4">
        {loading ? 'Loading rooms...' : `${rooms.length} room${rooms.length !== 1 ? 's' : ''} found`}
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {rooms.map((room) => {
          const { id, name, host, mode, players } = room;
          const maxPlayers = getMaxPlayers(mode);
          const status = getRoomStatus(room);
          const custom = hasCustomRules(room);

          const statusLabel = status === 'waiting' ? 'Waiting' : status === 'playing' ? 'In Progress' : 'Finished';
          const statusColor = status === 'waiting'
            ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
            : status === 'playing'
            ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400'
            : 'bg-muted text-muted-foreground';

          return (
            <div
              key={id}
              className="border rounded-lg overflow-hidden hover:shadow-md transition-shadow dark:border-muted bg-background"
            >
              <div className="bg-basketball-orange text-white p-4">
                <div className="flex items-start justify-between gap-2">
                  <h2 className="text-xl font-semibold leading-tight">{name} <span className="opacity-80 text-sm font-light">#{id}</span></h2>
                  <span className="shrink-0 text-xs font-bold bg-white/20 px-2 py-0.5 rounded-full">{mode.toUpperCase()}</span>
                </div>
                <p className="text-sm opacity-80 mt-1">Host: {host}</p>
              </div>
              <div className="p-4 bg-accent/30 dark:bg-accent/10 space-y-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${statusColor}`}>{statusLabel}</span>
                  <span className="text-xs bg-muted px-2 py-0.5 rounded-full dark:bg-muted/30">
                    {players.length}/{maxPlayers} Players
                  </span>
                  {custom && (
                    <span className="text-xs bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400 px-2 py-0.5 rounded-full">
                      Custom rules
                    </span>
                  )}
                  {room.tournament && (
                    <span className="text-xs bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400 px-2 py-0.5 rounded-full">
                      Tournament
                    </span>
                  )}
                </div>
                <div className="text-xs text-muted-foreground space-y-0.5">
                  {room.scoreMax !== DEFAULTS.scoreMax && <p>Score limit: {room.scoreMax}</p>}
                  {room.roundGoal !== DEFAULTS.roundGoal && <p>Rounds to win: {room.roundGoal}</p>}
                  {room.gravity !== DEFAULTS.gravity && <p>Gravity: {room.gravity}</p>}
                  {room.timeLimit !== DEFAULTS.timeLimit && <p>Time limit: {room.timeLimit}s</p>}
                </div>
                <div className="flex justify-end gap-2">
                  {status === 'waiting' && (
                    <Button size="sm" disabled={players.length >= maxPlayers} onClick={() => {
                      const username = prompt("Enter your name to join the game:");
                      if (!username?.trim()) {
                        alert("You must enter a name to join the game.");
                        return;
                      }
                      if (username === host) {
                        alert("You cannot join your own room as the creator.");
                        return;
                      }
                      localStorage.setItem('playerName', username);
                      location.href = `/rooms/${id}`;
                    }}>
                      {players.length >= maxPlayers ? 'Full' : 'Join'}
                    </Button>
                  )}
                  {status === 'playing' && (
                    <Button size="sm" variant="outline" asChild>
                      <Link href={`/rooms/${id}/watch`}>Watch</Link>
                    </Button>
                  )}
                  {status === 'finished' && (
                    <span className="text-xs text-muted-foreground self-center">Game over</span>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {!loading && rooms.length === 0 && (
          <div className="col-span-full border border-dashed rounded-lg p-10 flex flex-col items-center justify-center text-muted-foreground dark:border-muted/50">
            <Basketball className="w-12 h-12 mb-2 text-muted-foreground" />
            <p className="mb-4">No rooms match your filters.</p>
            <Button asChild className="bg-basketball-orange hover:bg-basketball-darkOrange">
              <Link href="/rooms/create">Create a Room</Link>
            </Button>
          </div>
        )}

        {loading && (
          <div className="col-span-full border border-dashed rounded-lg p-10 flex flex-col items-center justify-center text-muted-foreground dark:border-muted/50">
            <Basketball className="w-12 h-12 mb-2 text-muted-foreground" />
            <p>Loading rooms...</p>
          </div>
        )}
      </div>
    </div>
  )
}

