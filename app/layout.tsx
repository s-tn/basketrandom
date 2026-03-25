import type React from "react"
import "./globals.css"
import { Inter } from "next/font/google"
import { ThemeProvider } from "@/components/theme-provider"
import { ThemeToggle } from "@/components/theme-toggle"
import { ServiceWorkerRegister } from "@/components/sw-register"
import { OnlineHeartbeat } from "@/components/online-heartbeat"
import { Navbar } from "@/components/navbar"

const inter = Inter({ subsets: ["latin"] })

export const metadata = {
  title: "Basket Random",
  description: "Create or join basketball courts to play with other ballers",
  manifest: '/manifest.json',
  themeColor: '#FF6B35',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent' as const,
    title: 'Basket Random',
  },
  viewport: {
    width: 'device-width',
    initialScale: 1,
    maximumScale: 1,
    userScalable: false,
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <div className="min-h-screen bg-background transition-colors duration-300 court-texture">
            <Navbar />
            <main className="pb-8">{children}</main>
          </div>
          <ServiceWorkerRegister />
          <OnlineHeartbeat />
        </ThemeProvider>
      </body>
    </html>
  )
}

