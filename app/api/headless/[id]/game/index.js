import express from 'express';
import http from 'http';
import WebSocket from 'ws';
import run from './headless';
import { randomUUID } from 'crypto';

// Create an Express app
const app = express();
const server = http.createServer(app);

// Serve static files (HTML, JS, etc.)
app.use(express.static('public'));

(async function() {
    const wss = new WebSocket.Server({ server });
    const lobbies = {};
    
    wss.on('connection', (ws, req) => {
        const lobbyId = req.url.split('/')[2];
        ws.lobbyId = lobbyId;
        ws.id = randomUUID();
        ws.ready = false;

        ws.addEventListener('message', (message) => {
            if (message.toString() === 'ready') {
                ws.ready = true; 
                console.log(`Client ${ws.id} in lobby ${lobbyId} is ready`);
            }
        });


        console.log(`Client connected to lobby: ${lobbyId}`);

        if (!lobbies[lobbyId]) {
            lobbies[lobbyId] = [];
            createLobby(lobbyId);
        }
        lobbies[lobbyId].push(ws);
    });

    async function createLobby(id) {
        const twoPlayers = new Promise((resolve) => {
            const interval = setInterval(() => {
                const clients = [...wss.clients].filter(client => client.lobbyId === id);
                if (clients.length === 2) {
                    clearInterval(interval);
                    resolve(clients);
                }
            }, 500);
        });

        const clients = await twoPlayers;

        console.log('Starting game in lobby:', id);
        const browser = await run();
        const page = browser.page;
        await page.evaluate(() => {
            return new Promise((resolve) => {
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
                return new Promise((resolve) => {
                    if (window.c3_runtimeInterface && window.c3_runtimeInterface._localRuntime) {
                        window.c3_runtimeInterface._localRuntime.SetSuspended(true);
                        resolve(true);
                    } else {
                        resolve(false);
                    }
                });
            })
        } 

        async function resume() {
            return await browser.page.evaluate(() => {
                return new Promise((resolve) => {
                    if (window.c3_runtimeInterface && window.c3_runtimeInterface._localRuntime) {
                        window.c3_runtimeInterface._localRuntime.SetSuspended(false);
                        resolve(true);
                    } else {
                        resolve(false);
                    }
                });
            })
        }

        await browser.page.evaluate(() => {
            Object.defineProperties(window, {
                "ball": {
                    get: () => window.c3_runtimeInterface._localRuntime._iRuntime.objects.balls.getAllInstances()[0],
                },
                "players": {
                    get: () => [
                        window.c3_runtimeInterface._localRuntime._iRuntime.objects.body.getAllInstances()[0],
                        window.c3_runtimeInterface._localRuntime._iRuntime.objects.body2.getAllInstances()[0],
                        window.c3_runtimeInterface._localRuntime._iRuntime.objects.body3.getAllInstances()[0],
                        window.c3_runtimeInterface._localRuntime._iRuntime.objects.body4.getAllInstances()[0],
                    ],
                },
                "heads": {
                    get: () => [
                        window.c3_runtimeInterface._localRuntime._iRuntime.objects.head.getAllInstances()[0],
                        window.c3_runtimeInterface._localRuntime._iRuntime.objects.head2.getAllInstances()[0],
                        window.c3_runtimeInterface._localRuntime._iRuntime.objects.head3.getAllInstances()[0],
                        window.c3_runtimeInterface._localRuntime._iRuntime.objects.head4.getAllInstances()[0],
                    ],
                },
                "arms": {
                    get: () => [
                        window.c3_runtimeInterface._localRuntime._iRuntime.objects.arm.getAllInstances()[0],
                        window.c3_runtimeInterface._localRuntime._iRuntime.objects.arm2.getAllInstances()[0],
                        window.c3_runtimeInterface._localRuntime._iRuntime.objects.arm3.getAllInstances()[0],
                        window.c3_runtimeInterface._localRuntime._iRuntime.objects.arm4.getAllInstances()[0],
                    ],
                },
                "globalVars": {
                    get: () => window.c3_runtimeInterface._localRuntime._iRuntime.globalVars,
                }
            });
    
            window.soundsPlayed = [];
            window.AudioDOMHandler.prototype._Play = new Proxy(window.AudioDOMHandler.prototype._Play, {
                apply: (target, thisArg, argumentsList) => {
                    window.soundsPlayed.push(argumentsList[0].originalUrl);
    
                    if (argumentsList[0].originalUrl === "file") {
                        window.globalVars.p1Score = 0;
                        window.globalVars.p2Score = 0;
                    }
    
                    return target.apply(thisArg, argumentsList);
                }
            });
        });
    
        const { width, height } = browser.page.viewport();
    
        await browser.page.mouse.move(width / 2, height / 2);
        await browser.page.mouse.click(width / 2, height / 2);
    
        await browser.page.evaluate(() => {
            return new Promise((resolve) => {
                setInterval(() => {
                    if (window.soundsPlayed.includes('menu')) {
                        setTimeout(() => {
                            resolve();
                        }, 1500);
                    }
                }, 500);
            });
        });
    
        console.log(`Menu: ${id}`);
    
        await new Promise((resolve) => {
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

        await new Promise((resolve) => {
            setInterval(() => {
                if (clients.filter(cli => cli.ready).length === 2) {
                    console.log('Both clients are ready, starting game');
                    clients.forEach((cli) => {
                        cli.send(JSON.stringify({ type: 'start', message: 'Game start', timeout: 3000}));
                    });
                    resolve();
                }
            });
        });

        await new Promise((resolve) => {
            setTimeout(() => {
                resolve();
            }, 3000);
        });

        await resume();
    
        /*setInterval(async () => {
            await browser.page.screenshot({
                path: 'screenshot.png',
                type: 'png',
                optimizeForSpeed: true,
            })
    
            const data = fs.readFileSync('screenshot.png').toString('base64');
    
            fs.writeFileSync('screenshot.txt', `data:image/png;base64,${data}`);
        }, 1500);*/
    
        let gamers = [];
    
        [...wss.clients].forEach(client => {
            if (client.lobbyId === id) {
                client.send('start');
    
                client.on('message', async (message) => {
                    if (message.toString() === 'ping' || MessageChannel.toString() === 'ready') return;
    
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
        });
        
        let i = 0;
    
        function sendData(d) {
            i ++;
            gamers.forEach(gamer => {
                gamer.send(d);
            });
        }   
    
        console.log(`Starting transmission: ${id}`);
    
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
            setInterval(() => {
                console.log('data:' + btoa(JSON.stringify({
                    type: "event",
                    event: "update",
                    players: window.players.map((player) => ({ x: player.x, y: player.y, angle: player.angle, instVars: player.instVars })),
                    heads: window.heads.map((head) => ({ x: head.x, y: head.y, angle: head.angle, instVars: head.instVars })),
                    arms: window.arms.map((arm) => ({ x: arm.x, y: arm.y, angle: arm.angle, instVars: arm.instVars })),
                    ball: { x: window.ball.x, y: window.ball.y, instVars: {hold: window.ball.instVars.hold, who: window.ball.instVars.who} },
                })));
            }, 1000 / 200);
    
            return true;
        });
    }
})()

// Start the server on port 80
server.listen(9002, () => {
    console.log('Server running on port 9002');
});
