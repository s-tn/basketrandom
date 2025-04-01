'use client';

import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Basketball } from "@/components/basketball-icon"
import React, { useEffect } from "react"
import { getRooms } from "@/lib/rooms"
import { Room } from "@prisma/client";

export default function RoomsPage() {
  const [ rooms, setRooms ] = React.useState<{id: string, players: string[], createdBy: string, name: string}[]>([]);
  const [ refetch, setRefetch ] = React.useState(0);

  useEffect(() => {
    // Fetch rooms when the component mounts
    async function fetchRooms() {
      const roomsData = await getRooms();
      setRooms(roomsData.toSorted((a, b) => b.createdAt - a.createdAt));
    }
    
    fetchRooms();
  }, []);

  setTimeout(() => {
    setRefetch(refetch + 1);
  }, 2500);

  return (
    <div className="container py-8">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="basketball-texture w-10 h-10 flex items-center justify-center shadow-md">
            <Basketball className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold">Available Rooms</h1>
        </div>
        <Button asChild className="bg-basketball-orange hover:bg-basketball-darkOrange">
          <Link href="/rooms/create">Create Room</Link>
        </Button>
      </div>

      <div className="basketball-divider w-full mb-8"></div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {rooms.map(({id, name, players, createdBy}) => {
          const full = players.length === 2;
          return (
          <div
            key={id}
            className="border rounded-lg overflow-hidden hover:shadow-md transition-shadow dark:border-muted bg-background"
          >
            <div className="bg-basketball-orange text-white p-4">
              <h2 className="text-xl font-semibold">{name} <span className="opacity-80 text-sm font-light">#{id}</span></h2>
              <p className="text-sm opacity-80">{full ? "Full" : "Waiting for players..."}</p>
            </div>
            <div className="p-4 bg-accent/30 dark:bg-accent/10">
              <p className="text-sm mb-4">Created by Player {createdBy}</p>
              <div className="flex justify-between items-center">
                <span className="text-xs bg-muted px-2 py-1 rounded-full dark:bg-muted/30">{full ? '2' : '1'}/2 Players</span>
                <Button size="sm" disabled={full} onClick={() => {
                  const username = prompt("Enter your name to join the game:");
                  if (!username?.trim()) {
                    alert("You must enter a name to join the game.");
                    return;
                  }
                  if (username === createdBy) {
                    alert("You cannot join your own room as the creator.");
                    return;
                  }
                  localStorage.setItem('playerName', username); // Store the username in local storage
                  location.href = `/rooms/${id}`
                }}>Join Game</Button>
              </div>
            </div>
          </div>
        )})}

        <div className="border border-dashed rounded-lg p-6 flex flex-col items-center justify-center text-muted-foreground dark:border-muted/50">
          <Basketball className="w-12 h-12 mb-2 text-muted-foreground" />
          <p>More courts coming soon...</p>
        </div>
      </div>
    </div>
  )
}

