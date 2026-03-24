"use client"

import { useState, useEffect, useCallback } from "react"
import { useParams } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

const PRESET_AMOUNTS = [50, 100, 250, 500];

function getSpectatorName(): string {
    if (typeof window === 'undefined') return '';
    let name = localStorage.getItem('spectatorName');
    if (!name) {
        name = 'spectator_' + Math.random().toString(36).slice(2, 8);
        localStorage.setItem('spectatorName', name);
    }
    return name;
}

export default function WatchPage() {
    const { id } = useParams<{ id: string }>();
    const [score, setScore] = useState<[number, number]>([0, 0]);
    const [roomInfo, setRoomInfo] = useState<any>(null);
    const [matchWinner, setMatchWinner] = useState<number | null>(null);

    // Betting state
    const [playerName, setPlayerName] = useState('');
    const [wallet, setWallet] = useState<{ balance: number } | null>(null);
    const [activeBet, setActiveBet] = useState<any>(null);
    const [pool, setPool] = useState<{ totals: Record<number, number> } | null>(null);
    const [betAmount, setBetAmount] = useState(100);
    const [customAmount, setCustomAmount] = useState('');
    const [betError, setBetError] = useState('');
    const [betLoading, setBetLoading] = useState(false);
    const [betResult, setBetResult] = useState<{ won: boolean; payout: number } | null>(null);

    useEffect(() => {
        setPlayerName(getSpectatorName());
    }, []);

    useEffect(() => {
        fetch(`/api/rooms/${id}`)
            .then(r => r.json())
            .then(data => {
                setRoomInfo(data);
                if (data.winner !== null && data.winner !== undefined) {
                    setMatchWinner(data.winner);
                }
            })
            .catch(() => {});
    }, [id]);

    // Listen for score/end updates from the game iframe
    useEffect(() => {
        const handler = (e: MessageEvent) => {
            if (e.data?.type === 'score' && Array.isArray(e.data.data)) {
                setScore([e.data.data[0] ?? 0, e.data.data[1] ?? 0]);
            }
            if (e.data?.type === 'end' && e.data.winner !== undefined) {
                setMatchWinner(e.data.winner);
            }
        };
        window.addEventListener('message', handler);
        return () => window.removeEventListener('message', handler);
    }, []);

    const fetchBetData = useCallback(async () => {
        if (!playerName) return;
        try {
            const [walletRes, poolRes] = await Promise.all([
                fetch(`/api/bets?player=${encodeURIComponent(playerName)}`),
                fetch(`/api/bets?roomId=${encodeURIComponent(id)}`),
            ]);
            const walletData = await walletRes.json();
            const poolData = await poolRes.json();
            setWallet(walletData.wallet);
            // Find any unresolved bet on this room
            const existing = walletData.bets?.find((b: any) => b.roomId === id && !b.resolved);
            // Find resolved bet on this room for result display
            const resolved = walletData.bets?.find((b: any) => b.roomId === id && b.resolved);
            if (existing) setActiveBet(existing);
            if (resolved && !betResult) {
                setBetResult({ won: resolved.won, payout: resolved.payout ?? 0 });
            }
            setPool(poolData);
        } catch {}
    }, [playerName, id, betResult]);

    // Poll bet data every 5 seconds
    useEffect(() => {
        if (!playerName) return;
        fetchBetData();
        const interval = setInterval(fetchBetData, 5000);
        return () => clearInterval(interval);
    }, [playerName, fetchBetData]);

    // When match ends, do a final fetch to get resolution
    useEffect(() => {
        if (matchWinner !== null) {
            setTimeout(fetchBetData, 2000);
        }
    }, [matchWinner, fetchBetData]);

    async function placeBet(side: number) {
        if (!playerName) return;
        setBetError('');
        setBetLoading(true);
        try {
            const res = await fetch('/api/bets', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    playerName,
                    roomId: id,
                    predictedWinner: side,
                    amount: betAmount,
                }),
            });
            const data = await res.json();
            if (!res.ok) {
                setBetError(data.error || 'Failed to place bet');
            } else {
                setActiveBet(data);
                await fetchBetData();
            }
        } catch {
            setBetError('Network error');
        } finally {
            setBetLoading(false);
        }
    }

    const iframeSrc = typeof window !== 'undefined'
        ? `/game.html?spectate=true#${btoa(`/api/headless/${id}`)}`
        : '';

    const hostName = roomInfo?.host || '?';
    const opponentName = roomInfo?.opponent || '?';
    const pool0 = pool?.totals?.[0] ?? 0;
    const pool1 = pool?.totals?.[1] ?? 0;
    const totalPool = pool0 + pool1;
    const odds0 = totalPool > 0 && pool0 > 0 ? (totalPool / pool0).toFixed(2) : '-';
    const odds1 = totalPool > 0 && pool1 > 0 ? (totalPool / pool1).toFixed(2) : '-';

    const effectiveAmount = customAmount ? parseInt(customAmount, 10) || 0 : betAmount;

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold">{roomInfo?.name || 'Loading...'}</h1>
                    <Badge variant="outline" className="mt-1">Spectating</Badge>
                </div>
                {wallet && (
                    <div className="text-right">
                        <div className="text-sm text-muted-foreground">Your wallet</div>
                        <div className="text-xl font-bold text-yellow-500">{wallet.balance.toLocaleString()} coins</div>
                    </div>
                )}
            </div>

            <Card className="overflow-hidden">
                <CardHeader className="bg-muted py-3">
                    <CardTitle className="flex items-center justify-between text-sm">
                        <span>{hostName} vs {opponentName}</span>
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

            {/* Betting Panel */}
            <Card>
                <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2">
                        Spectator Betting
                        {matchWinner !== null && (
                            <Badge variant="secondary">Match Over</Badge>
                        )}
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    {/* Bet result banner */}
                    {betResult && (
                        <div className={`rounded-md px-4 py-3 text-sm font-medium ${betResult.won ? 'bg-green-500/15 text-green-600 border border-green-500/30' : 'bg-red-500/15 text-red-600 border border-red-500/30'}`}>
                            {betResult.won
                                ? `You won! +${betResult.payout.toLocaleString()} coins`
                                : 'You lost your bet.'}
                        </div>
                    )}

                    {/* Pool display */}
                    <div className="grid grid-cols-2 gap-3 text-sm">
                        <div className="rounded-md bg-muted px-3 py-2">
                            <div className="font-medium truncate">{hostName}</div>
                            <div className="text-muted-foreground">{pool0.toLocaleString()} coins</div>
                            <div className="text-xs text-muted-foreground">Odds: {odds0}x</div>
                        </div>
                        <div className="rounded-md bg-muted px-3 py-2">
                            <div className="font-medium truncate">{opponentName}</div>
                            <div className="text-muted-foreground">{pool1.toLocaleString()} coins</div>
                            <div className="text-xs text-muted-foreground">Odds: {odds1}x</div>
                        </div>
                    </div>

                    {/* Active bet display */}
                    {activeBet && !betResult && (
                        <div className="rounded-md bg-blue-500/10 border border-blue-500/20 px-3 py-2 text-sm">
                            <span className="font-medium">Your bet: </span>
                            {activeBet.amount.toLocaleString()} coins on{' '}
                            <span className="font-medium">
                                {activeBet.predictedWinner === 0 ? hostName : opponentName}
                            </span>
                        </div>
                    )}

                    {/* Betting controls — only show if no bet placed yet and match not over */}
                    {!activeBet && !betResult && matchWinner === null && (
                        <div className="space-y-3">
                            <div>
                                <div className="text-sm text-muted-foreground mb-2">Bet amount</div>
                                <div className="flex flex-wrap gap-2">
                                    {PRESET_AMOUNTS.map(amt => (
                                        <Button
                                            key={amt}
                                            size="sm"
                                            variant={betAmount === amt && !customAmount ? 'default' : 'outline'}
                                            onClick={() => { setBetAmount(amt); setCustomAmount(''); }}
                                        >
                                            {amt}
                                        </Button>
                                    ))}
                                    <Input
                                        className="w-24 h-8 text-sm"
                                        placeholder="Custom"
                                        value={customAmount}
                                        onChange={e => setCustomAmount(e.target.value.replace(/\D/g, ''))}
                                        onFocus={() => setBetAmount(0)}
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-2">
                                <Button
                                    variant="outline"
                                    disabled={betLoading || effectiveAmount <= 0}
                                    onClick={() => placeBet(0)}
                                    className="border-blue-500/40 hover:bg-blue-500/10"
                                >
                                    Bet on {hostName}
                                </Button>
                                <Button
                                    variant="outline"
                                    disabled={betLoading || effectiveAmount <= 0}
                                    onClick={() => placeBet(1)}
                                    className="border-orange-500/40 hover:bg-orange-500/10"
                                >
                                    Bet on {opponentName}
                                </Button>
                            </div>

                            {betError && (
                                <div className="text-sm text-red-500">{betError}</div>
                            )}
                        </div>
                    )}

                    {/* Match over, no bet placed */}
                    {!activeBet && !betResult && matchWinner !== null && (
                        <div className="text-sm text-muted-foreground">
                            Betting closed — match has ended.
                        </div>
                    )}

                    <div className="text-xs text-muted-foreground">
                        Spectating as <span className="font-mono">{playerName}</span>
                        {wallet && <> · Balance: <span className="font-medium text-yellow-500">{wallet.balance.toLocaleString()} coins</span></>}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
