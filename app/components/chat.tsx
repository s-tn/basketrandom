"use client"
import { useState, useEffect, useRef } from "react"
import { Button } from "./ui/button"
import { Input } from "./ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card"
import ReconnectingWebSocket from "reconnecting-websocket"

interface ChatMessage {
  sender: string
  text: string
  time: string
}

interface ChatProps {
  socket: ReconnectingWebSocket | null
  playerName: string
  compact?: boolean
}

export function Chat({ socket, playerName, compact }: ChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState("")
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!socket) return
    const handler = (e: MessageEvent) => {
      if (typeof e.data !== "string") return
      try {
        const data = JSON.parse(e.data)
        if (data.type === "chat") {
          setMessages(prev => {
            const next = [
              ...prev,
              {
                sender: data.sender,
                text: data.text,
                time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
              },
            ]
            return next.slice(-100)
          })
        }
      } catch {}
    }
    socket.addEventListener("message", handler)
    return () => socket.removeEventListener("message", handler)
  }, [socket])

  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight
    }
  }, [messages])

  function send() {
    if (!input.trim() || !socket || socket.readyState !== WebSocket.OPEN) return
    socket.send(JSON.stringify({ type: "chat", sender: playerName, text: input.trim() }))
    setInput("")
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault()
      send()
    }
  }

  if (compact) {
    return (
      <div className="flex flex-col w-[300px] h-[150px] bg-black/60 rounded-md overflow-hidden backdrop-blur-sm">
        <div
          ref={listRef}
          className="flex-1 overflow-y-auto px-2 py-1 space-y-0.5 scrollbar-thin"
        >
          {messages.length === 0 && (
            <p className="text-white/40 text-[10px] italic mt-1">No messages yet...</p>
          )}
          {messages.map((msg, i) => (
            <div key={i} className="text-[11px] leading-tight">
              <span className="text-white/50 mr-1">[{msg.time}]</span>
              <span className="font-semibold text-white/90">{msg.sender}:</span>
              <span className="text-white/80 ml-1 break-words">{msg.text}</span>
            </div>
          ))}
        </div>
        <div className="flex flex-row items-center gap-1 px-1.5 py-1 border-t border-white/10">
          <Input
            className="h-6 text-[11px] bg-white/10 border-white/20 text-white placeholder:text-white/30 focus-visible:ring-0 px-2 py-0"
            placeholder="Chat..."
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
          />
          <Button
            size="sm"
            className="h-6 px-2 text-[11px] shrink-0"
            onClick={send}
          >
            Send
          </Button>
        </div>
      </div>
    )
  }

  return (
    <Card>
      <CardHeader className="pb-2 pt-3 px-4">
        <CardTitle className="text-sm font-semibold">Lobby Chat</CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-3 flex flex-col gap-2">
        <div
          ref={listRef}
          className="overflow-y-auto h-[160px] border rounded-md p-2 space-y-1 bg-muted/30"
        >
          {messages.length === 0 && (
            <p className="text-muted-foreground text-xs italic">No messages yet. Say hello!</p>
          )}
          {messages.map((msg, i) => (
            <div key={i} className="text-sm">
              <span className="text-muted-foreground text-xs mr-1">[{msg.time}]</span>
              <span className="font-semibold">{msg.sender}:</span>
              <span className="ml-1 break-words">{msg.text}</span>
            </div>
          ))}
        </div>
        <div className="flex flex-row items-center gap-2">
          <Input
            className="flex-1 h-8 text-sm"
            placeholder="Type a message..."
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
          />
          <Button size="sm" className="h-8 px-3 shrink-0" onClick={send}>
            Send
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
