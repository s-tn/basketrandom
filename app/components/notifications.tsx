"use client"
import { createContext, useContext, useState, useCallback, useEffect, useRef } from "react"
import { Card, CardContent } from "./ui/card"

interface Notification {
  id: string
  title: string
  message: string
  type: 'info' | 'success' | 'warning'
  timestamp: number
}

interface NotificationContextType {
  notify: (title: string, message: string, type?: 'info' | 'success' | 'warning') => void
}

const NotificationContext = createContext<NotificationContextType>({ notify: () => {} });

export function useNotifications() { return useContext(NotificationContext); }

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const timeoutRefs = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const notify = useCallback((title: string, message: string, type: 'info' | 'success' | 'warning' = 'info') => {
    const id = Math.random().toString(36).slice(2);
    setNotifications(prev => [...prev, { id, title, message, type, timestamp: Date.now() }]);
    // Auto-dismiss after 5 seconds
    const timeout = setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== id));
      timeoutRefs.current.delete(id);
    }, 5000);
    timeoutRefs.current.set(id, timeout);
  }, []);

  const dismiss = (id: string) => {
    const timeout = timeoutRefs.current.get(id);
    if (timeout) { clearTimeout(timeout); timeoutRefs.current.delete(id); }
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  useEffect(() => {
    const refs = timeoutRefs.current;
    return () => { refs.forEach(clearTimeout); refs.clear(); };
  }, []);

  useEffect(() => {
    const handler = (e: CustomEvent) => {
      notify('Friend Online', `${e.detail.name} is now online`, 'info');
    };
    window.addEventListener('friend-online', handler as EventListener);
    return () => window.removeEventListener('friend-online', handler as EventListener);
  }, [notify]);

  return (
    <NotificationContext.Provider value={{ notify }}>
      {children}
      {/* Toast container - fixed bottom-right */}
      <div className="fixed bottom-4 right-4 z-50 space-y-2 max-w-sm">
        {notifications.map(n => (
          <Card
            key={n.id}
            className={`glass-card shadow-lg cursor-pointer transition-all animate-in slide-in-from-right-5 ${
              n.type === 'success' ? 'border-green-500/30' :
              n.type === 'warning' ? 'border-yellow-500/30' : 'border-primary/30'
            }`}
            onClick={() => dismiss(n.id)}
          >
            <CardContent className="py-3 px-4">
              <p className="font-semibold text-sm">{n.title}</p>
              <p className="text-xs text-muted-foreground">{n.message}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </NotificationContext.Provider>
  );
}
