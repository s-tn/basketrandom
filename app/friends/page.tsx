"use client"
import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"

interface FriendStatus {
  online: boolean;
  roomId?: string;
}

export default function FriendsPage() {
  const [playerName, setPlayerName] = useState<string | null>(null)
  const [friends, setFriends] = useState<string[]>([])
  const [statuses, setStatuses] = useState<Record<string, FriendStatus>>({})
  const [newFriend, setNewFriend] = useState("")
  const [addError, setAddError] = useState("")
  const [loading, setLoading] = useState(true)

  // Load player name from localStorage
  useEffect(() => {
    const name = localStorage.getItem('playerName')
    setPlayerName(name)
  }, [])

  // Fetch friends list
  const fetchFriends = async (player: string) => {
    const res = await fetch(`/api/friends?player=${encodeURIComponent(player)}`)
    const data: string[] = await res.json()
    setFriends(data)
    return data
  }

  // Fetch online statuses
  const fetchStatuses = async (friendList: string[]) => {
    if (friendList.length === 0) return
    const res = await fetch(`/api/online?names=${friendList.map(encodeURIComponent).join(',')}`)
    const data: Record<string, FriendStatus> = await res.json()
    setStatuses(data)
  }

  // Initial load
  useEffect(() => {
    if (!playerName) return
    setLoading(true)
    fetchFriends(playerName).then(list => {
      fetchStatuses(list).finally(() => setLoading(false))
    })
  }, [playerName])

  // Heartbeat + polling every 10 seconds
  useEffect(() => {
    if (!playerName) return

    const beat = () => {
      const roomMatch = window.location.pathname.match(/\/rooms\/(.+)/)
      fetch('/api/online', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerName, roomId: roomMatch?.[1] }),
      }).catch(() => {})
    }

    beat()
    const interval = setInterval(() => {
      beat()
      fetchStatuses(friends)
    }, 10000)

    return () => clearInterval(interval)
  }, [playerName, friends])

  const handleAdd = async () => {
    setAddError("")
    const trimmed = newFriend.trim()
    if (!trimmed || !playerName) return
    const res = await fetch('/api/friends', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ player: playerName, friend: trimmed }),
    })
    if (!res.ok) {
      const data = await res.json()
      setAddError(data.error || 'Failed to add friend')
      return
    }
    setNewFriend("")
    const updated = await fetchFriends(playerName)
    fetchStatuses(updated)
  }

  const handleRemove = async (friend: string) => {
    if (!playerName) return
    await fetch('/api/friends', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ player: playerName, friend }),
    })
    const updated = await fetchFriends(playerName)
    fetchStatuses(updated)
  }

  if (!playerName) {
    return (
      <div className="container max-w-5xl mx-auto px-4 py-8 flex flex-col items-center space-y-4">
        <p className="text-muted-foreground text-lg">
          No player name found. Join a room first to set your name.
        </p>
      </div>
    )
  }

  return (
    <div className="container max-w-5xl mx-auto px-4 py-8 space-y-8">
      <div className="w-full flex items-center justify-between">
        <h1 className="text-3xl font-bold">
          Friends <span className="text-primary">List</span>
        </h1>
      </div>

      <p className="w-full text-sm text-muted-foreground">
        Playing as: <span className="font-semibold text-foreground">{playerName}</span>
      </p>

      {/* Add friend form */}
      <div className="w-full space-y-2">
        <div className="flex gap-2">
          <Input
            placeholder="Enter player name..."
            value={newFriend}
            onChange={e => setNewFriend(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleAdd()}
            className="flex-1"
          />
          <Button
            onClick={handleAdd}
            className="bg-primary hover:bg-primary/80 text-white"
          >
            Add
          </Button>
        </div>
        {addError && <p className="text-sm text-destructive">{addError}</p>}
      </div>

      {/* Friends list */}
      <div className="w-full space-y-3">
        {loading ? (
          <p className="text-muted-foreground text-sm text-center">Loading...</p>
        ) : friends.length === 0 ? (
          <p className="text-muted-foreground text-sm text-center">
            No friends yet. Add someone above!
          </p>
        ) : (
          friends.map(friend => {
            const status = statuses[friend]
            const isOnline = status?.online ?? false
            const roomId = status?.roomId

            return (
              <div
                key={friend}
                className="flex items-center justify-between p-3 rounded-lg border bg-card shadow-sm"
              >
                <div className="flex items-center gap-3">
                  {/* Online indicator dot */}
                  <span
                    className={`inline-block w-2.5 h-2.5 rounded-full flex-shrink-0 ${
                      isOnline ? 'bg-green-500' : 'bg-gray-400'
                    }`}
                    title={isOnline ? 'Online' : 'Offline'}
                  />
                  <span className="font-medium">{friend}</span>
                  {isOnline && roomId && (
                    <div className="flex items-center gap-1.5">
                      <Badge variant="secondary" className="text-xs">
                        In Game
                      </Badge>
                      <a
                        href={`/rooms/${roomId}`}
                        className="text-xs text-primary underline hover:no-underline"
                      >
                        Watch
                      </a>
                    </div>
                  )}
                  {isOnline && !roomId && (
                    <Badge variant="outline" className="text-xs text-green-600 border-green-500">
                      Online
                    </Badge>
                  )}
                </div>

                <Button
                  size="sm"
                  variant="ghost"
                  className="text-muted-foreground hover:text-destructive h-7 w-7 p-0"
                  onClick={() => handleRemove(friend)}
                  title="Remove friend"
                >
                  ✕
                </Button>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
