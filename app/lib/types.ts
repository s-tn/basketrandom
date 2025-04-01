export interface Room {
  id: string
  name: string
  createdBy: string
  players: string[]
  createdAt: number
  started: boolean
}

export interface CreateRoomParams {
  name: string
  createdBy: string
}

