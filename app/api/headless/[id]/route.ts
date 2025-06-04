import { Browser } from 'puppeteer-core';
//import prisma from "@/lib/prisma";
import { randomUUID } from "node:crypto";
import ws from "ws";
import { resolve } from 'node:path';
import { launch, getStream, wss } from 'puppeteer-stream';
import fs from 'fs';
import { Client } from 'discord.js';
import { joinVoiceChannel } from '@discordjs/voice';
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const conn = prisma.$connect();

const client = new Client({
    intents: [
        "Guilds",
        "GuildMessages",
        "GuildMessageTyping",
        "MessageContent",
        "GuildMessageReactions",
        "GuildVoiceStates",
        "GuildPresences",
        "GuildMembers",
        "GuildEmojisAndStickers",
        "GuildWebhooks",
        "GuildIntegrations",
        "GuildInvites",
        "GuildScheduledEvents",
        "GuildBans",
    ]
});

client.once('ready', () => {
    console.log('Discord bot is ready');
});

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
    await conn;
    const lobbyId: string = request.url!.split('/')[3].split('?')[0];
    const streamType: string = request.url!.split('?')[1];
    (client as any).lobbyId = lobbyId;
    (client as any).type = streamType;
    (client as any).id = randomUUID();
    (client as any).ready = false;
    sockets.push(client);

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
    const stream = browser.stream;
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

    console.log('Stream created in lobby:', id);

    // const writeStream = fs.createWriteStream(resolve(__dirname, '../../../../../', 'out', `${id}.webm`));
    async function runStream() {
        const p = (await import('twitch-stream-video').then(module => module.startStreaming))(stream);

        p.then(() => {
            runStream();
        });
    }
    if ((await roomInfo()).tournament) {
        runStream();
    }
    stream.on('error', (err) => {
        console.error('Stream error:', err);
    });
    stream.on('close', () => {
        console.log('Stream closed');   
    });
    stream.on('open', () => {
        console.log('Stream opened');
    });

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

    // await new Promise((resolve) => {
    //     setTimeout(() => {
    //         resolve();
    //     }, 3000);
    // })

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

    /*setInterval(async () => {
        await browser.page.screenshot({
            path: 'screenshot.png',
            type: 'png',
            optimizeForSpeed: true,
        })

        const data = fs.readFileSync('screenshot.png').toString('base64');

        fs.writeFileSync('screenshot.txt', `data:image/png;base64,${data}`);
    }, 1500);*/

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
                        sendData('end['+(await roomInfo()).winner+']');
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
    
    let i = 0;

    function sendData(d: string) {
        i ++;
        gamers.forEach(gamer => {
            
            gamer.send(d);
        });
    }   

    console.log(`Starting transmission: ${id}`);

    await new Promise<void>((resolve) => {
        setTimeout(() => {
            console.log(`Transmission started: ${id}`);
            resolve();
        }, 3000);
    });

    await resume();

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
            sendData('end[0]');
        }
        else if (newRoom.wins1 === newRoom.roundGoal) {
            await prisma.room.update({
                where: { id },
                data: {
                    winner: 1,
                }
            });
            sendData('end[1]');
        } else {
            sendData('round['+compress({ round: rounds.length, score0: room.score0, score1: room.score1 }));

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
                            client.send('round['+compress({ round: rounds.length, score0: room.score0, score1: room.score1 }));
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
        sendData('end['+(await roomInfo()).winner+']');
    }

    browser.page.on('console', async (msg) => {
        const data = msg.text();

        if (data.startsWith('data:')) {
            try {
                const d = JSON.parse(atob(data.slice(5)));

                d.id = i;

                if (i % 100 === 0) {
                    console.log('packet update', paused);
                }

                sendData('update['+compress(d));

                if (d.globalVars && !d.globalVars.goal && !paused) {
                    if (true) {
                        await prisma.room.update({
                            where: { id },
                            data: {
                                score0: d.globalVars.p1Score,
                                score1: d.globalVars.p2Score,
                            }
                        });

                        if (d.globalVars.p1Score === (await roomInfo()).scoreMax) {
                            await addRound(0);
                        } else if (d.globalVars.p2Score === (await roomInfo()).scoreMax) {
                            await addRound(1);
                        }
                    }
                }
            } catch {};
        }
    });

    await browser.page.evaluate(() => {
        let win: any = window;
        setInterval(() => {
            console.log('data:' + btoa(JSON.stringify({
                type: "event",
                event: "update",
                players: win.players.map((player) => ({ x: player.x, y: player.y, angle: player.angle, instVars: player.instVars, velocity: player.behaviors.Physics.getVelocity(), angularVelocity: player.behaviors.Physics.angularVelocity })),
                heads: win.heads.map((head) => ({ x: head.x, y: head.y, angle: head.angle, instVars: head.instVars, velocity: head.behaviors.Physics.getVelocity() })),
                arms: win.arms.map((arm) => ({ x: arm.x, y: arm.y, angle: arm.angle, instVars: arm.instVars, velocity: [0, 0] })),
                ball: { x: win.ball.x, y: win.ball.y, instVars: {hold: win.ball.instVars.hold, who: win.ball.instVars.who}, velocity: win.ball.behaviors.Physics.getVelocity() },
                globalVars: {
                    p1Score: win.score.p1,
                    p2Score: win.score.p2,
                    goal: win.globalVars.goal,
                },
            })));
            console.clear();
        }, 1000 / 96);

        return true;
    });
}

function compress(data) {
    const separators = [
        ',',
        '*',
        '&',
        '^',
        '~',
        '=',
        '@',
        '//',
        '??',
        '..',
        'AA',
        'QT',
        '``',
        '__'
    ];
    
    const replacements = [
        'ZA',
        'ZB',
        'ZC',
        'ZD',
        'ZE',
        'ZF',
        'ZG',
        'ZH',
        'ZI',
        'ZJ',
        'ZK',
        'ZL',
        'ZM',
        'ZN',
        'ZO',
        'ZP',
        'ZQ',
        'ZR'
    ];
    
    function iterCondense(data, layer = 0) {
        if (typeof data !== 'object') return data;
    
        const sep = separators[layer];
    
        return Object.keys(data).map((key, i, obj) => {
            if (!isNaN(parseFloat(data[key])) && !Array.isArray(data[key])) data[key] = parseFloat(data[key]);
    
            if (Array.isArray(data[key])) {
                return `${i === 0 ? '' : sep}${key}[${data[key].map(entry => `${iterCondense(entry, layer + 2)}`).join(separators[layer + 1])}]${i === obj.length - 1 ? '' : sep}`;
            } else if (typeof data[key] === 'object') {
                return `${i === 0 ? '' : sep}${key}{${iterCondense(data[key], layer + 1)}}${i === obj.length - 1 ? '' : sep}`;
            } else if (typeof data[key] === 'number') {
                return `${i === 0 ? '' : sep}${key}|${String(parseFloat(data[key].toFixed(8)))}|${i === obj.length - 1 ? '' : sep}`;
            } else {
                return `${i === 0 ? '' : sep}${key}|${String(data[key])}|${i === obj.length - 1 ? '' : sep}`;
            }
        }).join(sep);
    }
    
    function compressNames(data) {
        const matches = data.match(/\w{4,}/g);
        const obj = {};
        matches.forEach(match => obj[match] = (obj[match] || 0) + 1);
    
        for (var phrase in obj) {
            if (obj[phrase] < 4) {
                delete obj[phrase];
                continue;
            }
    
            obj[phrase] = replacements[Object.keys(obj).indexOf(phrase)];
    
            data = data.replaceAll(phrase, obj[phrase]);
        }
    
        const dict = Object.entries(obj).map(entry => entry.toReversed()).map(([key, prop]) => `${key}=${prop}`).join(';');
    
        return `${dict}()${data}`;
    }
    
    return compressNames(iterCondense(data));
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
                headless: "new",
                executablePath: exec,
                args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-blink-features=AutomationControlled', '--disable-infobars', '--disable-dev-shm-usage', '--disable-web-security', '--allow-file-access-from-files', '--disable-web-security'],
                ignoreDefaultArgs: ['--enable-automation', '--enable-logging', '--v=1'],
                defaultViewport: {
                    width: 1080,
                    height: 720,
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
    //page.setViewport({ width: 640, height: 360 });
    await page.goto('http://localhost:9001/');
    /*const stream = await getStream(page, { audio: false, video: true, }).catch((err) => {
        console.error('Error getting stream:', err);
        throw err;
    });*/

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

    const stream = await getStream(page, {
        audio: false,
        video: true,
        bitsPerSecond: 1000000,
        frameSize: 8
    }).catch((err) => {
        console.error('Error getting stream:', err);
        throw err;
    });

    return { browser, page, stream };
}

// client.login("");

export { GET, SOCKET };


// /*
// export async function SOCKET(
//     client: import("ws").WebSocket,
//     request: import("http").IncomingMessage,
//     server: import("ws").WebSocketServer
//   ) {
//     const id = request.url?.match(/^\/api\/headless\/(.*)/)?.[1];

//     if (!id) {
//       return client.close();
//     }

//     const proxySocket = new WebSocket(`ws://localhost:3001/headless/${id}`);

//     client.on('open', () => {
//         console.log('Client socket opened');
//     });

//     proxySocket.addEventListener('open', () => {
//       console.log('Proxy socket opened');
//     });

//     proxySocket.addEventListener('message', (event) => {
//       client.send(event.data);
//     });

//     proxySocket.addEventListener('close', () => {
//       client.close();
//     });

//     proxySocket.addEventListener('error', (error) => {
//       client.close();
//     });


//     client.on('message', (message: any) => {
//       proxySocket.send(message);
//     });

//     client.on('close', () => {
//       proxySocket.close();
//     });
//   }*/
