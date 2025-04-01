import type React from "react"
export default function RoomsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen">
      <div className="container py-4">
        <nav className="mb-4">
          <a href="/" className="text-sm text-muted-foreground hover:text-foreground">
            ← Back Home
          </a>
        </nav>
        {children}
      </div>
    </div>
  )
}

import Link from "next/link"

