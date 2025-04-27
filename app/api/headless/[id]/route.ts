//import prisma from "@/lib/prisma";
import { randomUUID } from "crypto";
import ws from "ws";
import { resolve } from 'path';

export function GET() {
    const headers = new Headers();
    headers.set('Connection', 'Upgrade');
    headers.set('Upgrade', 'websocket');
    return new Response('Upgrade Required', { status: 426, headers });
}

const lobbies: Record<string, Array<any>> = {};
const sockets: any[] = [];

let browserPromise: Promise<any> | null = null;

export async function SOCKET(
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

    console.log(`Client connected to lobby: ${lobbyId} with goal: ${streamType}`);

    client.addEventListener('message', (message) => {
        try {
            if (JSON.parse(message.data.toString()).type === 'ready') {
                (client as any).ready = true; 
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

    if (!browserPromise) {
        browserPromise = (await import('puppeteer')).launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--single-process', '--no-zygote', '--disable-gl-drawing-for-tests'],
            userDataDir: resolve(__dirname, '../../../../../', 'data')
        });
    }

    await twoPlayers;

    const clients: () => any[] = () => [...sockets].filter(client => client.lobbyId === id && client.type === 'stream');

    console.log('Starting game in lobby:', id);
    const browser = await run();
    const page = browser.page;
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

    async function pause() {
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

    await browser.page.evaluate(() => {
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
            p1: 0,
            p2: 0
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
    });

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
        }, 500);
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

    browser.page.on('console', async (msg) => {
        const data = msg.text();

        if (data.startsWith('data:')) {
            try {
                const d = JSON.parse(atob(data.slice(5)));

                d.id = i;

                sendData('update['+compress(d));
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
    const browser = await browserPromise;
    const page = await browser.newPage();
    page.setViewport({ width: 640, height: 360 });
    await page.goto('http://localhost:9001/');

    return { browser, page };
}

export default {
    GET,
    SOCKET,
}

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
