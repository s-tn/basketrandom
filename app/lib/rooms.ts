import type { Room, CreateRoomParams } from "./types"
import prisma from "./prisma"

// In a real application, this would be replaced with a database or real-time service
// For this example, we'll use localStorage to simulate persistence
const ROOMS_STORAGE_KEY = "esports_rooms"

// Helper to generate a random ID
const generateId = () => {
  return Math.random().toString(36).substring(2, 10)
}

// Get all rooms
export const getRooms = async (): Promise<Room[]> => {
  if (typeof window === "undefined") {
    return await prisma.room.findMany().then(rooms => {
      return rooms.map(room => ({
        id: room.id,
        name: room.name,
        createdBy: room.host,
        maxScore: room.scoreMax,
        score0: room.score0,
        score1: room.score1,
        players: [room.host, room.oppponent].filter(_ => _), // This would typically be populated with actual player names
        createdAt: room.createdAt.getTime(), // Convert to timestamp for consistency,
        started: room.started // Include started status
      }))
    }) as any;
  }

  const storedRooms = await fetch('/api/rooms', {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json'
    }
  }).then(res => {
    if (!res.ok) {
      throw new Error('Failed to fetch rooms')
    }
    return res.text()
  }).catch(() => {
    return localStorage.getItem(ROOMS_STORAGE_KEY) || "[]"
  })
  if (!storedRooms) return []

  try {
    const rooms = JSON.parse(storedRooms) as Room[]
    return rooms.map((room: any) => ({
      id: room.id,
      name: room.name,
      createdBy: room.host,
      players: [room.host, room.oppponent].filter(_ => _), // This would typically be populated with actual player names
      createdAt: new Date(room.createdAt).getTime(), // Convert to timestamp for consistency
      started: room.started || false // Ensure started is a boolean
    }))
  } catch (error) {
    console.error("Failed to parse rooms:", error)
    return []
  }
}

// Get a room by ID
export const getRoomById = async (id: string): Promise<Room | null> => {
  // Simulate network delay
  await new Promise((resolve) => setTimeout(resolve, 300))

  if (typeof window === "undefined") {
    // Server-side: Return mock data for SSR
    return (await prisma.room.findMany().then(rooms => {
      return rooms.map(room => ({
        id: room.id,
        name: room.name,
        createdBy: room.host,
        players: [room.host, room.oppponent].filter(_ => _), // This would typically be populated with actual player names
        createdAt: room.createdAt.getTime(), // Convert to timestamp for consistency
      }))
    }) as any).find((room: any) => room.id === id) || null;
  }

  const rooms = await getRooms()
  return rooms.find((room) => room.id === id) || null
}

// Check if a room exists
export const checkRoomExists = async (id: string): Promise<boolean> => {
  const room = await getRoomById(id)
  return room !== null
}

// Create a new room
export const createRoom = async (params: CreateRoomParams): Promise<string> => {
  // Simulate network delay
  await new Promise((resolve) => setTimeout(resolve, 800))

  if (typeof window === "undefined") throw new Error("Cannot create room on server")

  const rooms = await getRooms()

  const newRoom: Room = {
    id: generateId(),
    name: params.name,
    maxScore: parseInt(params.score, 10) || undefined,
    bestOf: parseInt(params.bestOf, 10) || undefined,
    tournament: params.tournament,
    tPassword: params.tPassword || undefined,
    createdBy: params.createdBy,
    players: [params.createdBy],
    createdAt: Date.now(),
    started: false
  }

  localStorage.setItem("playerName", params.createdBy) // Store the player name in localStorage for future reference

  const updatedRooms = [...rooms, newRoom];
  localStorage.setItem(ROOMS_STORAGE_KEY, JSON.stringify(updatedRooms));
  return await fetch('/api/rooms', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(newRoom)
  }).then(res => {
    if (!res.ok) {
      throw new Error('Failed to save room')
    }

    return newRoom.id
  }).catch(() => {
    alert('Failed to save room')
    throw new Error('Failed to save room')
  })
}

// Join a room
export const 
joinRoom = async (roomId: string, playerName: string): Promise<void> => {
  // Simulate network delay
  await new Promise((resolve) => setTimeout(resolve, 500))

  if (typeof window === "undefined") return

  const rooms = await getRooms()
  const roomIndex = rooms.findIndex((room) => room.id === roomId)

  if (roomIndex === -1) {
    throw new Error("Room not found")
  }

  const room = rooms[roomIndex]
  console.log(room)

  // Check if player is already in the room
  if (room.players.includes(playerName)) {
    return
  }

  // Check if room is full
  if (room.players.length >= 2) {
    throw new Error("Room is full")
  }

  // Add player to room
  const updatedRoom = {
    ...room,
    players: [...room.players, playerName],
  }

  const updatedRooms = [...rooms.slice(0, roomIndex), updatedRoom, ...rooms.slice(roomIndex + 1)]

  await fetch('/api/rooms', {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(updatedRoom)
  }).then(res => {
    if (!res.ok) {
      throw new Error('Failed to update room')
    }
  }).catch(() => {
    console.error('Failed to update room in localStorage')
  })

  localStorage.setItem(ROOMS_STORAGE_KEY, JSON.stringify(updatedRooms))

  // Notify subscribers
  notifyRoomSubscribers(roomId, updatedRoom)
}

// Leave a room
export const leaveRoom = async (roomId: string, playerName: string): Promise<void> => {
  // Simulate network delay
  await new Promise((resolve) => setTimeout(resolve, 300))

  if (typeof window === "undefined") return

  const rooms = await getRooms()
  const roomIndex = rooms.findIndex((room) => room.id === roomId)

  if (roomIndex === -1) {
    return
  }

  const room = rooms[roomIndex]

  // Remove player from room
  const updatedRoom = {
    ...room,
    players: room.players.filter((player) => player !== playerName),
  }

  let updatedRooms

  // If no players left, remove the room
  if (updatedRoom.players.length === 0) {
    updatedRooms = [...rooms.slice(0, roomIndex), ...rooms.slice(roomIndex + 1)]
  } else {
    updatedRooms = [...rooms.slice(0, roomIndex), updatedRoom, ...rooms.slice(roomIndex + 1)]
  }

  localStorage.setItem(ROOMS_STORAGE_KEY, JSON.stringify(updatedRooms))

  // Notify subscribers
  if (updatedRoom.players.length > 0) {
    notifyRoomSubscribers(roomId, updatedRoom)
  }
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

const notifyRoomSubscribers = (roomId: string, room: Room) => {
  if (!roomSubscribers[roomId]) return

  for (const callback of roomSubscribers[roomId]) {
    callback(room)
  }
}

