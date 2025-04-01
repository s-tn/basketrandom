"use client"

import { useState, useEffect } from "react"

export function PingIndicator({ping, status}: {
  ping: number | null
  status: "connected" | "connecting" | "disconnected"
}) {
  // const [status, setStatus] = useState<"connected" | "connecting" | "disconnected">("connecting")
  const getStatusColor = () => {
    if (status === "disconnected") return "bg-red-500"
    if (status === "connecting") return "bg-yellow-500"

    // Connected - color based on ping
    if (ping === null) return "bg-green-500"
    if (ping < 50) return "bg-green-500"
    if (ping < 100) return "bg-yellow-500"
    return "bg-red-500"
  }

  return (
    <div className="flex items-center space-x-2">
      <div className={`w-3 h-3 rounded-full ${getStatusColor()}`}></div>
      <span>
        {status === "connected" && ping !== null && `Connected (${ping}ms)`}
        {status === "connecting" && "Connecting..."}
        {status === "disconnected" && "Disconnected"}
      </span>
    </div>
  )
}

