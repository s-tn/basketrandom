import type React from "react"
import "./globals.css"
import { DM_Sans, Space_Mono } from "next/font/google"
import { ThemeProvider } from "@/components/theme-provider"
import { ServiceWorkerRegister } from "@/components/sw-register"
import { OnlineHeartbeat } from "@/components/online-heartbeat"
import { Navbar } from "@/components/navbar"
import { NotificationProvider } from "@/components/notifications"

const dmSans = DM_Sans({ subsets: ["latin"], variable: "--font-sans" })
const spaceMono = Space_Mono({ weight: ["400", "700"], subsets: ["latin"], variable: "--font-mono" })

export const metadata = {
  title: "Basket Random",
  description: "Real-time multiplayer basketball",
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent' as const,
    title: 'Basket Random',
  },
}

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#0f1114',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${dmSans.variable} ${spaceMono.variable}`}>
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
          <NotificationProvider>
            <div className="min-h-screen bg-background">
              <Navbar />
              <main>{children}</main>
            </div>
            <ServiceWorkerRegister />
            <OnlineHeartbeat />
          </NotificationProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
