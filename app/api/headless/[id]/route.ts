import type { Browser } from 'puppeteer-core';
import prisma from "@/lib/prisma";
import { randomUUID } from "node:crypto";
import ws from "ws";
import { resolve } from 'node:path';
// Dynamic import to avoid build-time crash from native deps
const puppeteerStream = () => import('puppeteer-stream');
import fs from 'fs';
import { encodeSnapshot, encodeDelta, encodeEvent, type GameState } from "@/lib/netcode";
import { completeMatch } from "@/lib/tournament";
// Dynamic import to avoid build-time issues
const getServerClipper = () => import("@/lib/server-clipper").then(m => m.createServerClipper);

function GET() {
    const headers = new Headers();
    headers.set('Connection', 'Upgrade');
    headers.set('Upgrade', 'websocket');
    return new Response('Upgrade Required', { status: 426, headers });
}

const lobbies: Record<string, Array<any>> = {};
const sockets: any[] = [];

type SocketListener = (client: any) => void;
const socketListeners: SocketListener[] = [];

let browserPromise: Promise<Browser> | null = null;
let browserEventsBound = false;
let signalHandlersBound = false;

// Track active pages for zombie detection
const activePages: Map<string, { page: any; createdAt: number; lobbyId: string }> = new Map();

// Max concurrent games
const MAX_PAGES = parseInt(process.env.MAX_GAME_PAGES || '10');

// Expose health metrics globally for /api/health
function updateHealth() {
    (globalThis as any).__gameHealth = {
        activePages: activePages.size,
        maxPages: MAX_PAGES,
        lobbies: Object.keys(lobbies).length,
    };
}
setInterval(updateHealth, 5000);

// Zombie page cleanup: kill pages older than 30 minutes with no active gamers
setInterval(() => {
    const now = Date.now();
    activePages.forEach((info, pageId) => {
        const age = now - info.createdAt;
        if (age > 30 * 60 * 1000) {
            console.warn(`Zombie page detected: ${pageId} (age: ${Math.round(age / 60000)}m), closing`);
            info.page.close().catch(() => {});
            activePages.delete(pageId);
            delete lobbies[pageId];
        }
    });
}, 60000); // Check every minute

 async function SOCKET(
    client: import("ws").WebSocket,
    request: import("http").IncomingMessage,
    server: import("ws").WebSocketServer
  ) {
    const lobbyId: string = request.url!.split('/')[3].split('?')[0];
    const streamType: string = request.url!.split('?')[1];
    (client as any).lobbyId = lobbyId;
    (client as any).type = streamType;
    (client as any).id = randomUUID();
    (client as any).ready = false;
    sockets.push(client);

    for (const listener of socketListeners) {
        listener(client);
    }

    client.addEventListener('close', () => {
        const idx = sockets.indexOf(client);
        if (idx !== -1) sockets.splice(idx, 1);
    });

    console.log(`Client connected to lobby: ${lobbyId} with goal: ${streamType}`);

    client.addEventListener('message', (message) => {
        try {
            if (JSON.parse(message.data.toString()).type === 'ready') {
                (client as any).ready = true; 
                (client as any).waitingRound = false;
                console.log(`Client ${(client as any).id} in lobby ${lobbyId} is ready`);
            }
        } catch(e) {}
        if (message.data.toString() === 'ping') {
            client.send('pong');
        }
    });

    if (streamType === 'stream') {
        if (!lobbies[lobbyId]) {
            lobbies[lobbyId] = [];
            createLobby(lobbyId);
        }
        lobbies[lobbyId].push(client);
    }
}

async function createLobby(id: string) {
    const roomInfo = () => prisma.room.findUnique({
        where: { id },
    });

    if (!await roomInfo()) {
        console.log('Room not found:', id);
        return;
    }

    const initialRoomData = await roomInfo();
    const is2v2 = initialRoomData?.mode === '2v2';
    const requiredPlayers = is2v2 ? 4 : 2;

    const playersReady = new Promise<any[]>((resolve, reject) => {
        const interval = setInterval(() => {
            const clients = [...sockets].filter(client => client.lobbyId === id && client.type === 'stream');
            if (clients.length === requiredPlayers) {
                clearInterval(interval);
                resolve(clients);
            }
        }, 500);
        // Timeout after 5 minutes
        setTimeout(() => {
            clearInterval(interval);
            reject(new Error('Lobby timeout'));
        }, 5 * 60 * 1000);
    });

    try {
        await playersReady;
    } catch {
        console.warn(`Lobby ${id} timed out waiting for players`);
        delete lobbies[id];
        return;
    }

    const clients: () => any[] = () => [...sockets].filter(client => client.lobbyId === id && client.type === 'stream');

    // Check page limit
    if (activePages.size >= MAX_PAGES) {
        console.warn(`Page limit reached (${MAX_PAGES}), rejecting lobby: ${id}`);
        clients().forEach(c => c.send(JSON.stringify({ type: 'error', message: 'Server full, try again later' })));
        delete lobbies[id];
        return;
    }

    console.log(`Starting game in lobby: ${id} (active pages: ${activePages.size + 1}/${MAX_PAGES})`);
    const browser = await run();
    const page = browser.page;

    // Track this page
    activePages.set(id, { page, createdAt: Date.now(), lobbyId: id });

    // Centralized cleanup function — ensures nothing leaks
    let cleaned = false;
    function cleanupGame() {
        if (cleaned) return;
        cleaned = true;
        activePages.delete(id);
        delete lobbies[id];
        if (disconnectCheck) clearInterval(disconnectCheck);
        // Remove socket listener
        const lIdx = socketListeners.indexOf(onNewSocketSubscribe);
        if (lIdx !== -1) socketListeners.splice(lIdx, 1);
        // Destroy server clipper
        if (serverClipper) { serverClipper.destroy(); serverClipper = null; }
        // Close page
        page.close().catch(() => {});
        console.log(`Game cleaned up: ${id} (active pages: ${activePages.size}/${MAX_PAGES})`);
    }
    // Declare variables that cleanupGame references (will be assigned later)
    let disconnectCheck: ReturnType<typeof setInterval> | null = null;
    let onNewSocketSubscribe: SocketListener = () => {};
    let serverClipper: any = null;

    // Enable streaming for tournament matches only
    let stream: any = null;
    const roomData = await roomInfo();
    if (roomData?.tournament && roomData?.private) {
        try {
            const { getStream } = await puppeteerStream();
            stream = await getStream(page, { audio: true, video: true, bitsPerSecond: 1000000, frameSize: 8 });
        } catch {
            console.warn('Could not get stream for tournament match');
        }

        // Pipe to Twitch if configured
        if (stream && process.env.TWITCH_STREAM_KEY) {
            try {
                const { startStreaming } = await import('twitch-stream-video');
                startStreaming(stream).catch(() => {});
            } catch {}
        }

        // Pipe to Discord voice channel if configured
        if (stream && process.env.DISCORD_VOICE_CHANNEL_ID) {
            const { startVoiceStream } = await import("@/lib/discord");
            startVoiceStream(stream);
        }
    }

    if (stream) {
        const createClipper = await getServerClipper();
        serverClipper = createClipper(stream, id);
    }

    await page.evaluate(() => {
        return new Promise<void>((resolve) => {
            const originalLog = console.log;
            console.log = (...args) => {
                if (args[0] === 'start game called') {
                    setTimeout(() => {
                        resolve();
                    }, 1000);
                }
                originalLog(...args);
            };
        });
    });
    console.log('Game loaded in lobby:', id);

    clients().forEach((cli) => {
        cli.send(JSON.stringify({ type: 'update', message: 'Server starting...' }));
    });

    // 2v2 role assignment
    const roles: Record<string, string> = {};
    if (is2v2) {
        const streamClients = clients();
        roles[streamClients[0]?.id] = 'team1-jumper';
        roles[streamClients[1]?.id] = 'team1-arm';
        roles[streamClients[2]?.id] = 'team2-jumper';
        roles[streamClients[3]?.id] = 'team2-arm';

        streamClients.forEach(client => {
            client.send(JSON.stringify({ type: 'role-assigned', role: roles[client.id] }));
        });
    }

    let paused = false;

    async function pause() {
        paused = true;
        return await browser.page.evaluate(() => {
            let win: any = window;
            return new Promise((resolve) => {
                if (win.c3_runtimeInterface && win.c3_runtimeInterface._localRuntime) {
                    win.c3_runtimeInterface._localRuntime.SetSuspended(true);
                    resolve(true);
                } else {
                    resolve(false);
                }
            });
        })
    } 

    async function resume() {
        paused = false;
        return await browser.page.evaluate(() => {
            let win: any = window;
            return new Promise((resolve) => {
                if (win.c3_runtimeInterface && win.c3_runtimeInterface._localRuntime) {
                    win.c3_runtimeInterface._localRuntime.SetSuspended(false);
                    resolve(true);
                } else {
                    resolve(false);
                }
            });
        })
    }

    const info = await roomInfo();

    await browser.page.evaluate((scores) => {
        let win: any = window;
        win.c3_runtimeInterface._localRuntime.SetTimeScale(10000000000);
        Object.defineProperties(win, {
            "ball": {
                get: () => win.c3_runtimeInterface._localRuntime._iRuntime.objects.balls.getAllInstances()[0],
            },
            "players": {
                get: () => [
                    win.c3_runtimeInterface._localRuntime._iRuntime.objects.body.getAllInstances()[0],
                    win.c3_runtimeInterface._localRuntime._iRuntime.objects.body2.getAllInstances()[0],
                    win.c3_runtimeInterface._localRuntime._iRuntime.objects.body3.getAllInstances()[0],
                    win.c3_runtimeInterface._localRuntime._iRuntime.objects.body4.getAllInstances()[0],
                ],
            },
            "heads": {
                get: () => [
                    win.c3_runtimeInterface._localRuntime._iRuntime.objects.head.getAllInstances()[0],
                    win.c3_runtimeInterface._localRuntime._iRuntime.objects.head2.getAllInstances()[0],
                    win.c3_runtimeInterface._localRuntime._iRuntime.objects.head3.getAllInstances()[0],
                    win.c3_runtimeInterface._localRuntime._iRuntime.objects.head4.getAllInstances()[0],
                ],
            },
            "arms": {
                get: () => [
                    win.c3_runtimeInterface._localRuntime._iRuntime.objects.arm.getAllInstances()[0],
                    win.c3_runtimeInterface._localRuntime._iRuntime.objects.arm2.getAllInstances()[0],
                    win.c3_runtimeInterface._localRuntime._iRuntime.objects.arm3.getAllInstances()[0],
                    win.c3_runtimeInterface._localRuntime._iRuntime.objects.arm4.getAllInstances()[0],
                ],
            },
            "globalVars": {
                get: () => win.c3_runtimeInterface._localRuntime._iRuntime.globalVars,
            }
        });

        win.score = {
            p1: scores[0] || 0,
            p2: scores[1] || 0
        }

        win.soundsPlayed = [];
        win.AudioDOMHandler.prototype._Play = new Proxy(win.AudioDOMHandler.prototype._Play, {
            apply: (target, thisArg, argumentsList) => {
                win.soundsPlayed.push(argumentsList[0].originalUrl);

                if (argumentsList[0].originalUrl === "file") {
                    if (win.globalVars.p1Score === 1) {
                        win.score.p1 ++;
                    } else if (win.globalVars.p2Score === 1) {
                        win.score.p2 ++;
                    }

                    win.globalVars.p1Score = 0;
                    win.globalVars.p2Score = 0;
                }

                return target.apply(thisArg, argumentsList);
            }
        });
    }, [info.score0, info.score1]);

    // Apply custom gravity if different from default
    if (info.gravity !== 4) {
        await page.evaluate((gravityVal) => {
            const win = window as any;
            win.c3_runtimeInterface._localRuntime._pluginManager._allBehaviors[0].SetGravity(gravityVal);
        }, info.gravity);
    }

    const { width, height } = browser.page.viewport()!;

    await browser.page.mouse.move(width / 2, height / 2);
    await browser.page.mouse.click(width / 2, height / 2);

    await browser.page.evaluate(() => {
        let win: any = window;
        return new Promise<void>((resolve) => {
            const int = setInterval(() => {
                if (win.soundsPlayed.includes('menu')) {
                    clearInterval(int);
                    setTimeout(() => resolve(), 1000);
                }
            }, 500);
        });
    });

    console.log(`Menu: ${id}`);

    await new Promise<void>((resolve) => {
        setTimeout(() => {
            resolve();
        }, 1250);
    });

    await browser.page.mouse.move((width / 2) + 100, height / 2);
    await browser.page.mouse.click((width / 2) + 100, height / 2);

    console.log(`Game started in lobby: ${id}`);

    // Inject arm control override for 2v2 mode
    if (is2v2) {
        await page.evaluate(() => {
            const win = window as any;
            // Override arm behavior: ArrowLeft controls team1 arms, ArrowRight controls team2 arms
            win._armOverride = { left: false, right: false };

            document.addEventListener('keydown', (e) => {
                if (e.key === 'ArrowLeft') win._armOverride.left = true;
                if (e.key === 'ArrowRight') win._armOverride.right = true;
            });
            document.addEventListener('keyup', (e) => {
                if (e.key === 'ArrowLeft') win._armOverride.left = false;
                if (e.key === 'ArrowRight') win._armOverride.right = false;
            });

            // Override the arm rotation in the game tick
            const ARM_SPEED = (Math.PI * (190 / 180)) / 0.35 / 60;

            const origTick = win.c3_runtimeInterface._localRuntime.Tick;
            win.c3_runtimeInterface._localRuntime.Tick = new Proxy(origTick, {
                apply: (target: any, thisArg: any, args: any[]) => {
                    const result = target.apply(thisArg, args);

                    // Team 1 arms (arm, arm2)
                    const arm0 = win.arms[0];
                    const arm1 = win.arms[1];
                    if (arm0 && win._armOverride.left) {
                        arm0.angle += ARM_SPEED / 60;
                    }
                    if (arm1 && win._armOverride.left) {
                        arm1.angle += ARM_SPEED / 60;
                    }

                    // Team 2 arms (arm3, arm4)
                    const arm2 = win.arms[2];
                    const arm3 = win.arms[3];
                    if (arm2 && win._armOverride.right) {
                        arm2.angle -= ARM_SPEED / 60;
                    }
                    if (arm3 && win._armOverride.right) {
                        arm3.angle -= ARM_SPEED / 60;
                    }

                    return result;
                }
            });
        });
    }

    await pause();

    clients().forEach(client => {
        client.send('loaded');
    });

    const onNewSocket = (newClient: any) => {
        if (newClient.lobbyId === id && newClient.type === 'stream')
            newClient.send('loaded');
    };
    socketListeners.push(onNewSocket);

    await new Promise<void>((resolve) => {
        let int = setInterval(() => {
            if (clients().filter(cli => cli.ready).length >= requiredPlayers) {
                console.log('All clients are ready, starting game');
                resolve();
                clearInterval(int);
            }
        }, 100);
    });

    // Side mapping: which client controls which game side
    // left = ArrowUp (player 0 in C3), right = W (player 1 in C3)
    let clientSideMap: Record<string, 'left' | 'right'> = {};
    let currentRound = 0;
    let flipWinnerIdx = 0;
    let flipClients = clients();
    let sideChoice = 'left';

    if (!is2v2) {
        // Coin flip: winner picks their side (left/right)
        // clients()[0] = host (player who created room), clients()[1] = opponent
        flipWinnerIdx = Math.random() < 0.5 ? 0 : 1;
        flipClients = clients();

        // Send coin flip result to both clients with player names
        const room = await roomInfo();
        const playerNames = [room.host, room.opponent || 'Player 2'];
        flipClients.forEach((client, i) => {
            client.send(JSON.stringify({
                type: 'coinflip',
                winner: flipWinnerIdx,
                winnerName: playerNames[flipWinnerIdx],
                youWon: i === flipWinnerIdx,
                players: playerNames,
            }));
        });

        // Wait for winner to pick a side
        sideChoice = await new Promise((resolve) => {
            const winnerClient = flipClients[flipWinnerIdx];
            const handler = (message: any) => {
                try {
                    const data = JSON.parse(message.toString());
                    if (data.type === 'side-pick' && (data.side === 'left' || data.side === 'right')) {
                        winnerClient.removeListener('message', handler);
                        resolve(data.side);
                    }
                } catch {}
            };
            winnerClient.on('message', handler);
            // Timeout: default to left after 15 seconds
            setTimeout(() => resolve('left'), 15000);
        });
    }

    // Assign sides based on winner's choice
    function assignSides(winnerSide: string, round: number) {
        // Alternate sides each round
        const swapped = round % 2 === 1;
        let wSide = winnerSide as 'left' | 'right';
        if (swapped) wSide = wSide === 'left' ? 'right' : 'left';

        const loserSide = wSide === 'left' ? 'right' : 'left';
        const loserIdx = flipWinnerIdx === 0 ? 1 : 0;

        clientSideMap = {};
        clientSideMap[flipClients[flipWinnerIdx]?.id] = wSide;
        clientSideMap[flipClients[loserIdx]?.id] = loserSide;

        // Notify clients of their sides
        flipClients.forEach((client, i) => {
            const side = i === flipWinnerIdx ? wSide : loserSide;
            client.send(JSON.stringify({ type: 'side-assigned', side, round }));
        });
    }

    if (!is2v2) {
        assignSides(sideChoice, 0);
        // Wait for animation to finish
        await new Promise<void>((resolve) => setTimeout(resolve, 3000));
    } else {
        // In 2v2, sides are fixed: team 1 = left, team 2 = right
        // Just wait a moment then proceed
        await new Promise<void>(r => setTimeout(r, 2000));
    }

    let gamers: any[] = [];

    async function subscribe(client) {
        if (client.lobbyId === id) {
            switch(client.type) {
                case 'events':
                    client.on('message', async (message: any) => {
                        if (message.toString() === 'ping') return;

                        // Handle binary input packets
                        if (message instanceof Buffer || message instanceof ArrayBuffer) {
                            const buf = Buffer.from(message);
                            if (buf.length >= 11 && buf.readUInt8(0) === 0x03) {
                                // Binary input: [type][seq4][ts4][playerIdx][action]
                                const action = buf.readUInt8(10); // 0=release, 1=press
                                let key: string;

                                if (is2v2) {
                                    const role = roles[client.id];
                                    switch (role) {
                                        case 'team1-jumper': key = 'ArrowUp'; break;
                                        case 'team1-arm': key = 'ArrowLeft'; break;
                                        case 'team2-jumper': key = 'w'; break;
                                        case 'team2-arm': key = 'ArrowRight'; break;
                                        default: return;
                                    }
                                } else {
                                    // 1v1: use side map (existing logic)
                                    const side = clientSideMap[client.id];
                                    key = side === 'left' ? 'ArrowUp' : 'w';
                                }

                                if (action === 1) {
                                    await browser.page.keyboard.down(key as any);
                                } else {
                                    await browser.page.keyboard.up(key as any);
                                }
                                return;
                            }
                        }

                        // Handle JSON messages (legacy/side-pick/draw)
                        try {
                            const data = JSON.parse(message.toString());
                            if (data.type === 'key') {
                                let key: string;
                                if (is2v2) {
                                    const role = roles[client.id];
                                    switch (role) {
                                        case 'team1-jumper': key = 'ArrowUp'; break;
                                        case 'team1-arm': key = 'ArrowLeft'; break;
                                        case 'team2-jumper': key = 'w'; break;
                                        case 'team2-arm': key = 'ArrowRight'; break;
                                        default: return;
                                    }
                                } else {
                                    const side = clientSideMap[client.id];
                                    key = side === 'left' ? 'ArrowUp' : 'w';
                                }
                                if (data.event === 'keydown') {
                                    await browser.page.keyboard.down(key as any);
                                }
                                if (data.event === 'keyup') {
                                    await browser.page.keyboard.up(key as any);
                                }
                            }
                            if (data.type === 'draw') {
                                // Broadcast drawing segments to all stream sockets in this lobby
                                for (const gamer of gamers) {
                                    if (gamer.readyState === 1) {
                                        gamer.send(JSON.stringify({ type: 'draw-remote', segments: data.segments }));
                                    }
                                }
                            }
                            if (data.type === 'chat') {
                                // Broadcast to all stream sockets in this lobby
                                for (const gamer of gamers) {
                                    if (gamer.readyState === 1) {
                                        gamer.send(JSON.stringify(data));
                                    }
                                }
                            }
                        } catch {}
                    });
                    break;
                case 'stream':
                    client.send('start');

                    if ((await roomInfo()).winner !== null) {
                        const w = (await roomInfo()).winner;
                        const ep = encodeEvent(seq++, 'end', { winner: w });
                        for (const g of gamers) if (g.readyState === 1) g.send(ep);
                    }

                    gamers.push(client);
                    break;
                case 'spectator':
                    // Spectators receive game state but can't send inputs
                    client.send('start');
                    (client as any).isSpectator = true;
                    gamers.push(client);
                    // Send current state snapshot immediately so they see live state
                    if (lastState) {
                        client.send(encodeSnapshot(seq, lastState));
                    }
                    break;
            }
        }
    }

    onNewSocketSubscribe = (newClient: any) => {
        if (newClient.lobbyId === id)
            subscribe(newClient);
    };
    // Replace the loaded listener with the subscribe listener
    const idx = socketListeners.indexOf(onNewSocket);
    if (idx !== -1) socketListeners[idx] = onNewSocketSubscribe;
    else socketListeners.push(onNewSocketSubscribe);

    [...sockets].forEach(client => {
        subscribe(client);
    });
    
    let lastState: GameState | null = null;
    let seq = 0;

    console.log(`Starting transmission: ${id}`);

    await new Promise<void>((resolve) => {
        setTimeout(() => {
            console.log(`Transmission started: ${id}`);
            resolve();
        }, 3000);
    });

    await resume();

    // Apply time limit per round if set
    let startTimeLimitTimer: () => void = () => {};
    if (info.timeLimit > 0) {
        for (const gamer of gamers) {
            if (gamer.readyState === 1) {
                gamer.send(JSON.stringify({ type: 'timelimit', seconds: info.timeLimit }));
            }
        }
        startTimeLimitTimer = () => setTimeout(async () => {
            const state = lastState;
            if (state && !paused) {
                if (state.score0 > state.score1) await addRound(0);
                else if (state.score1 > state.score0) await addRound(1);
                // Tie: sudden death — let play continue until next goal
            }
        }, info.timeLimit * 1000);
        startTimeLimitTimer();
    }

    let disconnectTimeout: ReturnType<typeof setTimeout> | null = null;

    disconnectCheck = setInterval(async () => {
        // Clean dead connections from gamers
        gamers = gamers.filter(g => g.readyState === 1); // WebSocket.OPEN = 1

        const activePlayers = gamers.filter(g => !g.isSpectator);

        if (activePlayers.length === 0) {
            try { const { stopVoiceStream } = await import("@/lib/discord"); stopVoiceStream(); } catch {}
            cleanupGame();
            return;
        }

        if (activePlayers.length < requiredPlayers && !paused && !disconnectTimeout) {
            pause();
            gamers.forEach(g => g.send(JSON.stringify({ type: 'opponent-disconnected' })));

            disconnectTimeout = setTimeout(() => {
                if (gamers.filter(g => !g.isSpectator && g.readyState === 1).length < requiredPlayers) {
                    const remaining = gamers.find(g => !g.isSpectator && g.readyState === 1);
                    if (remaining) {
                        const remainingIndex = clients().indexOf(remaining);
                        const winnerIdx = remainingIndex === 0 ? 0 : 1;
                        const forfeitPacket = encodeEvent(seq++, 'end', { winner: winnerIdx });
                        for (const g of gamers) if (g.readyState === 1) g.send(forfeitPacket);
                    }
                    setTimeout(() => cleanupGame(), 2000);
                }
                disconnectTimeout = null;
            }, 30000);
        }

        if (activePlayers.length >= requiredPlayers && disconnectTimeout) {
            // Player reconnected — cancel forfeit timer and resume
            clearTimeout(disconnectTimeout);
            disconnectTimeout = null;
            resume();
            gamers.forEach(g => g.send(JSON.stringify({ type: 'opponent-reconnected' })));
        }
    }, 2000);

    async function addRound(winner: number) {
        await pause();
        const room = await roomInfo();
        const rounds = JSON.parse(room.rounds);
        rounds.push([winner, room.score0, room.score1]);
        const finalScore0 = room.score0;
        const finalScore1 = room.score1;
        await prisma.room.update({
            where: { id },
            data: {
                wins0: winner === 0 ? { increment: 1 } : undefined,
                wins1: winner === 1 ? { increment: 1 } : undefined,
                score0: 0,
                score1: 0,
                rounds: JSON.stringify(rounds),
            }
        });
        const newRoom = await roomInfo();
        if (newRoom.wins0 === newRoom.roundGoal) {
            await prisma.room.update({
                where: { id },
                data: {
                    winner: 0,
                }
            });
            await completeMatch(id, 0);
            { const { resolveBets } = await import("@/lib/bets"); resolveBets(id, 0).catch(() => {}); }
            // Record season result, ranked ELO, and check achievements
            try {
                const room = await roomInfo();
                const winnerName = room.host;
                const loserName = room.opponent;
                if (winnerName && loserName) {
                    const { recordSeasonResult } = await import("@/lib/seasons");
                    recordSeasonResult(winnerName, loserName, finalScore0, finalScore1).catch(() => {});

                    const { updateRankedElo } = await import("@/lib/ranked");
                    updateRankedElo(winnerName, loserName).catch(() => {});

                    const { checkMatchAchievements } = await import("@/lib/achievements");
                    // Get total stats for achievement checking
                    const allRooms = await prisma.room.findMany({ where: { winner: { not: null }, OR: [{ host: winnerName }, { opponent: winnerName }] } });
                    const totalWins = allRooms.filter(r => (r.host === winnerName && r.winner === 0) || (r.opponent === winnerName && r.winner === 1)).length;
                    const totalGoals = allRooms.reduce((sum, r) => sum + (r.host === winnerName ? r.score0 : r.score1), 0) + finalScore0;
                    checkMatchAchievements(winnerName, {
                        won: true, goalsScored: finalScore0, opponentGoals: finalScore1,
                        totalWins, totalGoals, seriesScore: [room.wins0, room.wins1],
                        is2v2: room.mode === '2v2',
                    }).catch(() => {});
                    checkMatchAchievements(loserName, {
                        won: false, goalsScored: finalScore1, opponentGoals: finalScore0,
                        totalWins: 0, totalGoals: 0, seriesScore: [room.wins1, room.wins0],
                        is2v2: room.mode === '2v2',
                    }).catch(() => {});
                }
            } catch {}
            if (replayBuffer.length > 0) {
                prisma.replay.create({
                    data: {
                        roomId: id,
                        data: JSON.stringify(replayBuffer),
                        duration: Date.now() - replayStart,
                    },
                }).catch(() => {});
            }
            const endPacket0 = encodeEvent(seq++, 'end', { winner: 0 });
            for (const gamer of gamers) if (gamer.readyState === 1) gamer.send(endPacket0);
            setTimeout(async () => {
                try { const { stopVoiceStream } = await import("@/lib/discord"); stopVoiceStream(); } catch {}
                cleanupGame();
            }, 5000);
        }
        else if (newRoom.wins1 === newRoom.roundGoal) {
            await prisma.room.update({
                where: { id },
                data: {
                    winner: 1,
                }
            });
            await completeMatch(id, 1);
            { const { resolveBets } = await import("@/lib/bets"); resolveBets(id, 1).catch(() => {}); }
            // Record season result, ranked ELO, and check achievements
            try {
                const room = await roomInfo();
                const winnerName = room.opponent;
                const loserName = room.host;
                if (winnerName && loserName) {
                    const { recordSeasonResult } = await import("@/lib/seasons");
                    recordSeasonResult(winnerName, loserName, finalScore1, finalScore0).catch(() => {});

                    const { updateRankedElo } = await import("@/lib/ranked");
                    updateRankedElo(winnerName, loserName).catch(() => {});

                    const { checkMatchAchievements } = await import("@/lib/achievements");
                    // Get total stats for achievement checking
                    const allRooms = await prisma.room.findMany({ where: { winner: { not: null }, OR: [{ host: winnerName }, { opponent: winnerName }] } });
                    const totalWins = allRooms.filter(r => (r.host === winnerName && r.winner === 0) || (r.opponent === winnerName && r.winner === 1)).length;
                    const totalGoals = allRooms.reduce((sum, r) => sum + (r.host === winnerName ? r.score0 : r.score1), 0) + finalScore1;
                    checkMatchAchievements(winnerName, {
                        won: true, goalsScored: finalScore1, opponentGoals: finalScore0,
                        totalWins, totalGoals, seriesScore: [room.wins1, room.wins0],
                        is2v2: room.mode === '2v2',
                    }).catch(() => {});
                    checkMatchAchievements(loserName, {
                        won: false, goalsScored: finalScore0, opponentGoals: finalScore1,
                        totalWins: 0, totalGoals: 0, seriesScore: [room.wins0, room.wins1],
                        is2v2: room.mode === '2v2',
                    }).catch(() => {});
                }
            } catch {}
            if (replayBuffer.length > 0) {
                prisma.replay.create({
                    data: {
                        roomId: id,
                        data: JSON.stringify(replayBuffer),
                        duration: Date.now() - replayStart,
                    },
                }).catch(() => {});
            }
            const endPacket1 = encodeEvent(seq++, 'end', { winner: 1 });
            for (const gamer of gamers) if (gamer.readyState === 1) gamer.send(endPacket1);
            setTimeout(async () => {
                try { const { stopVoiceStream } = await import("@/lib/discord"); stopVoiceStream(); } catch {}
                cleanupGame();
            }, 5000);
        } else {
            currentRound++;
            assignSides(sideChoice, currentRound);

            const roundPacket = encodeEvent(seq++, 'round', { round: rounds.length });
            for (const gamer of gamers) if (gamer.readyState === 1) gamer.send(roundPacket);

            await browser.page.evaluate(() => {
                let win: any = window;
                win.score.p1 = 0;
                win.score.p2 = 0;
            });

            await new Promise<void>((resolve) => {
                clients().forEach(client => {
                    client.ready = false;
                    client.waitingRound = true;
                    //client.send('loaded');
                });
                let int = setInterval(() => {
                    clients().forEach(client => {
                        // console.log(client.ready, client.waitingRound);
                        if (!client.waitingRound && !client.ready) {
                            const rp = encodeEvent(seq++, 'round', { round: rounds.length });
                            client.send(rp);
                            client.waitingRound = true;
                        }
                    });
                    if (clients().filter(cli => cli.ready && !cli.waitingRound).length >= requiredPlayers) {
                        console.log('All clients are ready, starting game');
                        clients().forEach(client => {
                            client.send('start');
                        });
                        resolve();
                        clearInterval(int);
                    }
                }, 100);
            });

            await new Promise((resolve) => setTimeout(resolve, 3000));

            await resume();
            if (info.timeLimit > 0) {
                startTimeLimitTimer();
            }
        }
    }

    if ((await roomInfo()).winner !== null) {
        const w = (await roomInfo()).winner;
        const ep = encodeEvent(seq++, 'end', { winner: w });
        for (const g of gamers) if (g.readyState === 1) g.send(ep);
    }

    const replayBuffer: Array<{ t: number; s: number[] }> = [];
    const replayStart = Date.now();

    await page.exposeFunction('__sendState', (flatState: number[]) => {
        if (paused) return;

        const state: GameState = {
          p0x: flatState[0], p0y: flatState[1], p0angle: flatState[2],
          p0velX: flatState[3], p0velY: flatState[4], p0armAngle: flatState[5],
          p1x: flatState[6], p1y: flatState[7], p1angle: flatState[8],
          p1velX: flatState[9], p1velY: flatState[10], p1armAngle: flatState[11],
          ballX: flatState[12], ballY: flatState[13], ballAngle: flatState[14],
          ballVelX: flatState[15], ballVelY: flatState[16],
          ballHolder: flatState[17],
          score0: flatState[18], score1: flatState[19],
          flags: flatState[20],
        };

        replayBuffer.push({ t: Date.now() - replayStart, s: flatState });

        seq++;

        // Detect score changes and update DB
        if (lastState && (state.score0 !== lastState.score0 || state.score1 !== lastState.score1)) {
            prisma.room.update({
                where: { id },
                data: { score0: state.score0, score1: state.score1 }
            }).catch(() => {});

            if (serverClipper) serverClipper.trigger().catch(() => {});

            // Check for round win
            roomInfo().then(async (room) => {
                if (!room) return;
                if (state.score0 >= room.scoreMax) {
                    await addRound(0);
                } else if (state.score1 >= room.scoreMax) {
                    await addRound(1);
                }
            });
        }

        // Send binary to clients
        let packet: Buffer;
        if (!lastState || seq % 300 === 0) {
            packet = encodeSnapshot(seq, state);
        } else {
            const delta = encodeDelta(seq, lastState, state);
            packet = delta || encodeSnapshot(seq, state);
        }

        lastState = state;

        for (const gamer of gamers) {
            if (gamer.readyState === 1) {
                gamer.send(packet);
            }
        }
    });

    await browser.page.evaluate(() => {
        const win = window as any;
        setInterval(() => {
          try {
            const p0 = win.players[0];
            const p1 = win.players[2]; // body3 = player 1
            const ball = win.ball;
            const arm0 = win.arms[0];
            const arm1 = win.arms[2];
            const p0vel = p0.behaviors.Physics.getVelocity();
            const p1vel = p1.behaviors.Physics.getVelocity();
            const ballVel = ball.behaviors.Physics.getVelocity();

            win.__sendState([
              p0.x, p0.y, p0.angle,
              p0vel[0], p0vel[1], arm0.angle,
              p1.x, p1.y, p1.angle,
              p1vel[0], p1vel[1], arm1.angle,
              ball.x, ball.y, ball.angle,
              ballVel[0], ballVel[1],
              ball.instVars.hold ? ball.instVars.who : 0,
              win.score.p1, win.score.p2,
              0, // flags
            ]);
          } catch {}
        }, 1000 / 60); // 60 Hz
    });
}


const __dirname = (import.meta.url ?
    import.meta.url.replace(/^file:\/\//, '') :
    globalThis.__dirname || 
    (function() {
        try {
            return decodeURIComponent(process.execPath);
        } catch(e) {
            return '';
        }
    })()).replace('/game/run.js', '/game/');

const run = async () => {
    if (!browserPromise) {
        const platform = process.platform;
        const isMac = platform === 'darwin';
        const isLinux = platform === 'linux';
        const isWindows = platform === 'win32';

        const exec = process.env.CHROMIUM || (isMac ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' :
            isLinux ? '/usr/bin/chromium' :
            isWindows ? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe' :
            'google-chrome-stable');

        const { launch } = await puppeteerStream();
        browserPromise = launch({
                headless: process.env.HEADLESS !== 'false' ? 'new' : false,
                executablePath: exec,
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage',
                    '--disable-gpu',
                    '--disable-software-rasterizer',
                    '--disable-extensions',
                    '--disable-background-networking',
                    '--disable-default-apps',
                    '--disable-sync',
                    '--disable-translate',
                    '--disable-web-security',
                    '--allow-file-access-from-files',
                    '--js-flags=--max-old-space-size=128',
                    '--renderer-process-limit=4',
                    '--single-process',
                ],
                ignoreDefaultArgs: ['--enable-logging', '--v=1'],
                defaultViewport: {
                    width: 640,
                    height: 360,
                },
            });
    }
    const browser = await browserPromise;

    // Only bind browser events once (not per page)
    if (!browserEventsBound) {
        browserEventsBound = true;
        browser.on('disconnected', () => {
            console.log('Browser disconnected');
            browserPromise = null;
            browserEventsBound = false;
            // Clean up all active pages
            activePages.forEach((info, lid) => {
                info.page.close().catch(() => {});
                delete lobbies[lid];
            });
            activePages.clear();
        });
    }

    const page = await browser.newPage();
    await page.goto('http://localhost:9001/');

    // Only bind signal handlers once
    if (!signalHandlersBound) {
        signalHandlersBound = true;
        const shutdown = async () => {
            console.log('Shutting down browser...');
            try { await browser.close(); } catch {}
            process.exit(0);
        };
        process.on('SIGINT', shutdown);
        process.on('SIGTERM', shutdown);
    }

    await new Promise(res => setTimeout(res, 2000));

    return { browser, page };
}

export { GET, SOCKET };
