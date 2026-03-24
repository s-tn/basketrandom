"use client"

import { useState, useEffect } from "react"
import { useParams } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

export default function WatchPage() {
    const { id } = useParams<{ id: string }>();
    const [score, setScore] = useState<[number, number]>([0, 0]);
    const [roomInfo, setRoomInfo] = useState<any>(null);

    useEffect(() => {
        fetch(`/api/rooms/${id}`)
            .then(r => r.json())
            .then(setRoomInfo)
            .catch(() => {});
    }, [id]);

    // Listen for score updates from the game iframe
    useEffect(() => {
        const handler = (e: MessageEvent) => {
            if (e.data?.type === 'score' && Array.isArray(e.data.data)) {
                setScore([e.data.data[0] ?? 0, e.data.data[1] ?? 0]);
            }
        };
        window.addEventListener('message', handler);
        return () => window.removeEventListener('message', handler);
    }, []);

    const iframeSrc = typeof window !== 'undefined'
        ? `/game.html?spectate=true#${btoa(`/api/headless/${id}`)}`
        : '';

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold">{roomInfo?.name || 'Loading...'}</h1>
                    <Badge variant="outline" className="mt-1">Spectating</Badge>
                </div>
            </div>
            <Card className="overflow-hidden">
                <CardHeader className="bg-muted py-3">
                    <CardTitle className="flex items-center justify-between text-sm">
                        <span>{roomInfo?.host || '?'} vs {roomInfo?.opponent || '?'}</span>
                        <span className="font-mono text-lg">{score[0]} - {score[1]}</span>
                    </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="flex items-center justify-center bg-black aspect-video">
                        {iframeSrc && (
                            <iframe
                                src={iframeSrc}
                                className="w-full h-full"
                                title="Spectator View"
                                id="spectator-frame"
                                allow="autoplay"
                            />
                        )}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
