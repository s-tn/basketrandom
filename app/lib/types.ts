export interface Room {
  id: string
  name: string
  createdBy: string
  players: string[]
  createdAt: number
  maxScore?: number
  bestOf?: number
  tournament?: boolean
  tPassword?: string
  started: boolean
}

export interface CreateRoomParams {
  name: string
  createdBy: string
  score: string
  bestOf: string
  tournament: boolean
  tPassword: string
}

