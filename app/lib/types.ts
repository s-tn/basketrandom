export interface Room {
  id: string
  name: string
  host: string
  opponent: string | null
  player3: string | null
  player4: string | null
  mode: string
  players: string[]
  createdAt: number
  scoreMax: number
  roundGoal: number
  tournament: boolean
  private: boolean
  started: boolean
  score0: number
  score1: number
  winner: number | null
  rounds: string
  wins0: number
  wins1: number
}

export interface CreateRoomParams {
  name: string
  host: string
  scoreMax: number
  roundGoal: number
  tournament: boolean
  tPassword: string
  mode?: string
}
