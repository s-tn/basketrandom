import prisma from "@/lib/prisma";
import { randomUUID } from "crypto";
import ws from "ws";
import run from './game/run.js';

export function GET() {
    const headers = new Headers();
    headers.set('Connection', 'Upgrade');
    headers.set('Upgrade', 'websocket');
    return new Response('Upgrade Required', { status: 426, headers });
}

const lobbies: Record<string, Array<any>> = {};
const sockets: any[] = [];

export async function SOCKET(
    client: import("ws").WebSocket,
    request: import("http").IncomingMessage,
    server: import("ws").WebSocketServer
  ) {
    const lobbyId: string = request.url!.split('/')[3];
    (client as any).lobbyId = lobbyId;
    (client as any).id = randomUUID();
    (client as any).ready = false;
    sockets.push(client);

    console.log(`Client connected to lobby: ${lobbyId}`);

    client.addEventListener('message', (message) => {
        try {
            if (JSON.parse(message.data.toString()).type === 'ready') {
                (client as any).ready = true; 
                console.log(`Client ${(client as any).id} in lobby ${lobbyId} is ready`);
            }
        } catch(e) {console.log(e);}
        if (message.data.toString() === 'ping') {
            client.send('pong');
        }
    });

    if (!lobbies[lobbyId]) {
        lobbies[lobbyId] = [];
        createLobby(lobbyId);
    }
    lobbies[lobbyId].push(ws);
}

async function createLobby(id: string) {
    const twoPlayers = new Promise<any[]>((resolve) => {
        const interval = setInterval(() => {
            const clients = [...sockets].filter(client => client.lobbyId === id);
            if (clients.length === 2) {
                clearInterval(interval);
                resolve(clients);
            }
        }, 500);
    });

    const clients: any[] = await twoPlayers;

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
                    }, 3000);
                }
                originalLog(...args);
            };
        });
    });
    console.log('Game loaded in lobby:', id);

    clients.forEach((cli) => {
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

        win.soundsPlayed = [];
        win.AudioDOMHandler.prototype._Play = new Proxy(win.AudioDOMHandler.prototype._Play, {
            apply: (target, thisArg, argumentsList) => {
                win.soundsPlayed.push(argumentsList[0].originalUrl);

                if (argumentsList[0].originalUrl === "file") {
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
                    }, 1500);
                }
            }, 500);
        });
    });

    console.log(`Menu: ${id}`);

    await new Promise<void>((resolve) => {
        setTimeout(() => {
            resolve();
        }, 2000);
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

    [...sockets].forEach(client => {
        if (client.lobbyId === id) {
            client.send('loaded');
        }
    });


    await new Promise<void>((resolve) => {
        let int = setInterval(() => {
            if (clients.filter(cli => cli.ready).length === 2) {
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

    function subscribe(client) {
        if (client.lobbyId === id) {
            client.send('start');

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

            gamers.push(client);
        }
    }

    sockets.push = new Proxy(sockets.push, {
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

                sendData(JSON.stringify(d));
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
            })));
            console.clear();
        }, 1000 / 200);

        return true;
    });
}

/*
export async function SOCKET(
    client: import("ws").WebSocket,
    request: import("http").IncomingMessage,
    server: import("ws").WebSocketServer
  ) {
    const id = request.url?.match(/^\/api\/headless\/(.*)/)?.[1];

    if (!id) {
      return client.close();
    }

    const proxySocket = new WebSocket(`ws://localhost:3001/headless/${id}`);

    client.on('open', () => {
        console.log('Client socket opened');
    });

    proxySocket.addEventListener('open', () => {
      console.log('Proxy socket opened');
    });

    proxySocket.addEventListener('message', (event) => {
      client.send(event.data);
    });

    proxySocket.addEventListener('close', () => {
      client.close();
    });

    proxySocket.addEventListener('error', (error) => {
      client.close();
    });


    client.on('message', (message: any) => {
      proxySocket.send(message);
    });

    client.on('close', () => {
      proxySocket.close();
    });
  }*/