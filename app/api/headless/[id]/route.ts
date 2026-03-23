import { Browser } from 'puppeteer-core';
import prisma from "@/lib/prisma";
import { randomUUID } from "node:crypto";
import ws from "ws";
import { resolve } from 'node:path';
import { launch, getStream, wss } from 'puppeteer-stream';
import fs from 'fs';
import { encodeSnapshot, encodeDelta, encodeEvent, type GameState } from "@/lib/netcode";
import { completeMatch } from "@/lib/tournament";

function GET() {
    const headers = new Headers();
    headers.set('Connection', 'Upgrade');
    headers.set('Upgrade', 'websocket');
    return new Response('Upgrade Required', { status: 426, headers });
}

const lobbies: Record<string, Array<any>> = {};
const sockets: any[] = [];

let browserPromise: Promise<Browser> | null = null;

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
        lobbies[lobbyId].push(ws);
    }
}

async function createLobby(id: string) {
    const twoPlayers = new Promise<any[]>((resolve) => {
        const interval = setInterval(() => {
            const clients = [...sockets].filter(client => client.lobbyId === id && client.type === 'stream');
            if (clients.length === 2) {
                clearInterval(interval);
                resolve(clients);
            }
        }, 500);
    });

    const roomInfo = () => prisma.room.findUnique({
        where: { id },
    });

    if (!await roomInfo()) {
        console.log('Room not found:', id);
        return;
    }

    await twoPlayers;

    const clients: () => any[] = () => [...sockets].filter(client => client.lobbyId === id && client.type === 'stream');

    console.log('Starting game in lobby:', id);
    const browser = await run();
    const page = browser.page;

    // Enable streaming for tournament matches only
    let stream: any = null;
    const roomData = await roomInfo();
    if (roomData?.tournament && roomData?.private) {
        try {
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

    const { width, height } = browser.page.viewport()!;

    await browser.page.mouse.move(width / 2, height / 2);
    await browser.page.mouse.click(width / 2, height / 2);

    await browser.page.evaluate(() => {
        let win: any = window;
        return new Promise<void>((resolve) => {
            setInterval(() => {
                if (win.soundsPlayed.includes('menu')) {
                    setTimeout(() => {
                        resolve();
                    }, 1000);
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

    await pause();

    const _push = sockets.push;

    clients().forEach(client => {
        client.send('loaded');
    });

    sockets.push = new Proxy(_push, {
        apply: (target, thisArg, argumentsList) => {
            const result = target.apply(thisArg, argumentsList);
            if (argumentsList[0].lobbyId === id && argumentsList[0].type === 'stream')
                argumentsList[0].send('loaded');
            return result;
        }
    });

    await new Promise<void>((resolve) => {
        let int = setInterval(() => {
            if (clients().filter(cli => cli.ready).length >= 2) {
                console.log('Both clients are ready, starting game');
                resolve();
                clearInterval(int);
            }
        }, 100);
    });

    // flip a coin 1 or 2
    const flip = Math.random() < 0.5 ? 1 : 2;

    clients().forEach(client => {
        client.send(`coin flipped: ${flip}`);
    });

    await new Promise<void>((resolve) => {
        setTimeout(() => {
            resolve();
        }, 5000);
    });

    let gamers: any[] = [];

    async function subscribe(client) {
        if (client.lobbyId === id) {
            switch(client.type) {
                case 'events':
                    console.log('event', client.id)
                    client.on('message', async (message: any) => {
                        if (message.toString() === 'ping') return;
        
                        const data = JSON.parse(message.toString());
        
                        if (data.type === 'key') {
                            if (data.event === 'keydown') {
                                await browser.page.keyboard.down(data.key);
                            }
        
                            if (data.event === 'keyup') {
                                await browser.page.keyboard.up(data.key);
                            }
                        }
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
            }
        }
    }

    sockets.push = new Proxy(_push, {
        apply: (target, thisArg, argumentsList) => {
            const result = target.apply(thisArg, argumentsList);
            if (argumentsList[0].lobbyId === id)
                subscribe(argumentsList[0]);
            return result;
        }
    });

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

    let disconnectCheck: ReturnType<typeof setInterval> | null = null;
    let disconnectTimeout: ReturnType<typeof setTimeout> | null = null;

    disconnectCheck = setInterval(() => {
        // Clean dead connections from gamers
        gamers = gamers.filter(g => g.readyState === 1); // WebSocket.OPEN = 1

        if (gamers.length === 0) {
            // Both disconnected — close everything
            clearInterval(disconnectCheck!);
            page.close().catch(() => {});
            delete lobbies[id];
            return;
        }

        if (gamers.length < 2 && !paused && !disconnectTimeout) {
            // One player disconnected — pause and wait
            pause();
            gamers.forEach(g => g.send(JSON.stringify({ type: 'opponent-disconnected' })));

            disconnectTimeout = setTimeout(() => {
                // 30 seconds passed, no reconnect — forfeit
                if (gamers.filter(g => g.readyState === 1).length < 2) {
                    const remaining = gamers.find(g => g.readyState === 1);
                    if (remaining) {
                        // Determine which player the remaining one is
                        const remainingIndex = clients().indexOf(remaining);
                        const winnerIdx = remainingIndex === 0 ? 0 : 1;
                        const forfeitPacket = encodeEvent(seq++, 'end', { winner: winnerIdx });
                        for (const g of gamers) if (g.readyState === 1) g.send(forfeitPacket);
                    }
                    clearInterval(disconnectCheck!);
                    setTimeout(() => page.close().catch(() => {}), 2000);
                    delete lobbies[id];
                }
                disconnectTimeout = null;
            }, 30000);
        }

        if (gamers.length >= 2 && disconnectTimeout) {
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
            const endPacket0 = encodeEvent(seq++, 'end', { winner: 0 });
            for (const gamer of gamers) if (gamer.readyState === 1) gamer.send(endPacket0);
            setTimeout(() => {
                page.close().catch(() => {});
                delete lobbies[id];
                clearInterval(disconnectCheck!);
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
            const endPacket1 = encodeEvent(seq++, 'end', { winner: 1 });
            for (const gamer of gamers) if (gamer.readyState === 1) gamer.send(endPacket1);
            setTimeout(() => {
                page.close().catch(() => {});
                delete lobbies[id];
                clearInterval(disconnectCheck!);
            }, 5000);
        } else {
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
                    if (clients().filter(cli => cli.ready && !cli.waitingRound).length >= 2) {
                        console.log('Both clients are ready, starting game');
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
        }
    }

    if ((await roomInfo()).winner !== null) {
        const w = (await roomInfo()).winner;
        const ep = encodeEvent(seq++, 'end', { winner: w });
        for (const g of gamers) if (g.readyState === 1) g.send(ep);
    }

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

        seq++;

        // Detect score changes and update DB
        if (lastState && (state.score0 !== lastState.score0 || state.score1 !== lastState.score1)) {
            prisma.room.update({
                where: { id },
                data: { score0: state.score0, score1: state.score1 }
            }).catch(() => {});

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

        browserPromise = launch({
                headless: process.env.HEADLESS !== 'false' ? 'new' : false,
                executablePath: exec,
                args: ['--enable-automation', '--no-sandbox', '--disable-setuid-sandbox', '--disable-blink-features=AutomationControlled', '--disable-infobars', '--disable-dev-shm-usage', '--disable-web-security', '--allow-file-access-from-files'],
                ignoreDefaultArgs: ['--enable-logging', '--v=1'],
                defaultViewport: {
                    width: 640,
                    height: 360,
                },
            });
    }
    const browser = await browserPromise;
    browser.on('disconnected', () => {
        console.log('Browser disconnected');
        sockets.forEach((socket) => {
            socket.close();
        });
        browserPromise = null;
    });
    browser.on('close', () => {
        console.log('Browser closed');
        sockets.forEach((socket) => {
            socket.close();
        });
        browserPromise = null;
    });
    browser.on('targetdestroyed', (target) => {
        console.log('Target destroyed:', target.url());
    });
    const page = await browser.newPage();
    await page.goto('http://localhost:9001/');

    process.on('SIGINT', async () => {
        console.log('SIGINT received, closing browser...');
        try {
            await browser.close();
        } catch (err) {
            console.error('Error closing browser:', err);
        }
        process.exit(0);
    });
    process.on('SIGTERM', async () => {
        console.log('SIGTERM received, closing browser...');
        try {
            await browser.close();
        } catch (err) {
            console.error('Error closing browser:', err);
        }
        process.exit(0);
    });
    process.on('exit', async () => {
        console.log('Exit received, closing browser...');
        try {
            await browser.close();
        } catch (err) {
            console.error('Error closing browser:', err);
        }
        process.exit(0);
    });

    await new Promise(res => setTimeout(res, 2000));

    return { browser, page };
}

export { GET, SOCKET };
