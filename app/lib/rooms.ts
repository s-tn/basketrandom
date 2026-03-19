import type { Room, CreateRoomParams } from "./types"
import prisma from "./prisma"

// Helper to convert a Prisma Room row to the Room interface
function toRoom(r: any): Room {
  return {
    id: r.id,
    name: r.name,
    host: r.host,
    opponent: r.opponent || null,
    players: [r.host, r.opponent].filter(Boolean) as string[],
    createdAt: r.createdAt instanceof Date ? r.createdAt.getTime() : new Date(r.createdAt).getTime(),
    scoreMax: r.scoreMax,
    roundGoal: r.roundGoal,
    tournament: r.tournament,
    private: r.private || false,
    started: r.started,
    score0: r.score0 || 0,
    score1: r.score1 || 0,
    winner: r.winner ?? null,
    rounds: r.rounds || '[]',
    wins0: r.wins0 || 0,
    wins1: r.wins1 || 0,
  }
}

// Get all rooms
export const getRooms = async (): Promise<Room[]> => {
  if (typeof window === "undefined") {
    const rooms = await prisma.room.findMany()
    return rooms.map(toRoom)
  }

  const res = await fetch('/api/rooms', {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
  })
  if (!res.ok) throw new Error('Failed to fetch rooms')
  const data = await res.json()
  return (Array.isArray(data) ? data : []).map(toRoom)
}

// Get a room by ID
export const getRoomById = async (id: string): Promise<Room | null> => {
  if (typeof window === "undefined") {
    const room = await prisma.room.findUnique({ where: { id } })
    return room ? toRoom(room) : null
  }

  const res = await fetch(`/api/rooms/${id}`, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
  })
  if (res.status === 404) return null
  if (!res.ok) throw new Error('Failed to fetch room')
  const data = await res.json()
  return toRoom(data)
}

// Create a new room
export const createRoom = async (params: CreateRoomParams): Promise<string> => {
  if (typeof window === "undefined") throw new Error("Cannot create room on server")

  const res = await fetch('/api/rooms', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  })
  if (!res.ok) throw new Error('Failed to create room')
  const data = await res.json()
  return data.id
}

// Join a room
export const joinRoom = async (roomId: string, playerName: string): Promise<void> => {
  if (typeof window === "undefined") return

  const res = await fetch(`/api/rooms/${roomId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ opponent: playerName }),
  })
  if (!res.ok) throw new Error('Failed to join room')

  const updatedRoom = toRoom(await res.json())
  notifyRoomSubscribers(roomId, updatedRoom)
}

// Leave a room
export const leaveRoom = async (roomId: string, playerName: string): Promise<void> => {
  if (typeof window === "undefined") return

  const res = await fetch(`/api/rooms/${roomId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ leave: playerName }),
  })
  if (!res.ok) throw new Error('Failed to leave room')

  const updatedRoom = toRoom(await res.json())
  notifyRoomSubscribers(roomId, updatedRoom)
}

// Room subscription system
const roomSubscribers: Record<string, ((room: Room) => void)[]> = {}

export const subscribeToRoomUpdates = (roomId: string, callback: (room: Room) => void): (() => void) => {
  if (!roomSubscribers[roomId]) {
    roomSubscribers[roomId] = []
  }

  roomSubscribers[roomId].push(callback)

  // Return unsubscribe function
  return () => {
    roomSubscribers[roomId] = roomSubscribers[roomId].filter((cb) => cb !== callback)

    if (roomSubscribers[roomId].length === 0) {
      delete roomSubscribers[roomId]
    }
  }
}

export const notifyRoomSubscribers = (roomId: string, room: Room) => {
  if (!roomSubscribers[roomId]) return

  for (const callback of roomSubscribers[roomId]) {
    callback(room)
  }
}
