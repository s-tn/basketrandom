import { enumerate, ping } from './util';
import { getSockets } from './sockets';
import { setup } from './setup';
import { compress, decompress } from './compression';
import { tick } from './tick';
import { anticheat } from './anticheat';

document.getElementById('game').onload = () => {
    const cw = document.getElementById('game').contentWindow;
    anticheat(cw);
    cw.console.log = new Proxy(cw.console.log, {
        apply: function(target, thisArg, argumentsList) {
            if (argumentsList[0] === 'start game called') {
                setTimeout(() => start(), 500);
            }

            return Reflect.apply(target, thisArg, argumentsList);
        }
    });
}

async function start() {
    let baseEndpoint;

    try {
        baseEndpoint = atob(location.hash.match(/#(.+)/)[1]);
    } catch(e) {
        return alert('Invalid Endpoint');
    }

    const cw = document.getElementById('game').contentWindow;

    await setup(cw);

    const comms = getSockets(baseEndpoint);

    ['in', 'out'].forEach((type) => {
        comms[type].addEventListener('error', (event) => {
            window.postMessage({ type: 'error', data: "Socket tunnel error, reconnecting..." }, '*');
        });
        comms[type].addEventListener('close', (event) => {
            window.postMessage({ type: 'error', data: "Socket tunnel closed, reconnecting..." }, '*');
        });
    });

    window.ready = function() {
        if (comms.in.readyState === WebSocket.OPEN) {
            comms.in.send(JSON.stringify({ type: 'ready' }));
        }
    }

    window.unpause = function() {
        cw.c3_runtimeInterface._localRuntime.SetSuspended(false);
        document.querySelector('iframe').focus();
    }

    addEventListener('c3:sound', ({detail: { sound }}) => {
        if (sound === "file") {
            cw.globalVars.p1Score = 0;
            cw.globalVars.p2Score = 0;
        }
    });

    const keys = {
        w: false,
        up: false
    }

    cw.c3_runtimeInterface._localRuntime.Tick = new Proxy(cw.c3_runtimeInterface._localRuntime.Tick, {
        apply: function(target, thisArg, argumentsList) {
            let e = target.apply(thisArg, argumentsList);
            try {tick(cw, keys);} catch(e) {console.log('tick error', e)};
            return e;
        }
    });
    
    cw.addEventListener('basket-key', (event) => {
        if (event.detail.type === 'keydown') {
            if (event.detail.key === 'w') {
                keys.w = true;
            } else if (event.detail.key === 'ArrowUp') {
                keys.up = true;
            }
        } else if (event.detail.type === 'keyup') {
            if (event.detail.key === 'w') {
                keys.w = false;
            } else if (event.detail.key === 'ArrowUp') {
                keys.up = false;
            }
        }
    
        comms.out.send(JSON.stringify({ type: 'key', event: event.detail.type, key: event.detail.key }));

        window.dispatchEvent(new event.constructor(event.type, event));
    });
    
    let currentId = 0;
    let pingInterval = null;
    
    comms.out.addEventListener('open', () => {
        console.log('WebSocket connection established');
    
        if (pingInterval) {
            clearInterval(pingInterval);
        }
    
        pingInterval = setInterval(() => {
            ping(comms.out).then((ping) => {
                window.postMessage({ type: 'ping', data: ping }, '*');
            });
        }, 1000);
    
        currentId = 0;
    });
    
    comms.in.addEventListener('message', (event) => {
        try {
            const data = JSON.parse(event.data);
            if (data.type === 'update') {
                window.postMessage({ type: 'update', data: data.message }, '*');
            }
        } catch(e) {}
    
        if (event.data === 'loaded') {
            window.postMessage({ type: 'loaded' }, '*');
        }
    
        if (event.data === 'start') {
            document.querySelector('iframe').contentWindow.started = true;
            window.postMessage({ type: 'start' }, '*');
    
            comms.in.addEventListener('message', (event) => {
                if (!event.data.toString().startsWith('update[')) {
                    return;
                }
                const data = decompress(event.data.toString().replace('update[', ''));
    
                if (data.id < currentId) {
                    return;
                }
    
                currentId = data.id;
    
                if (data.event === 'update') {
                    document.querySelector('iframe').focus();
                    (function(window) {
                        if (data.globalVars) {
                            if (window.savedGlobalVars) {
                                if (window.savedGlobalVars.p1Score !== data.globalVars.p1Score) {
                                    setTimeout(() => window.showBasket('blue'), 10);
                                    
                                }
                                if (window.savedGlobalVars.p2Score !== data.globalVars.p2Score) {
                                    setTimeout(() => window.showBasket('red'), 10);
                                }
                            }
                            window.savedGlobalVars = data.globalVars || {
                                p1Score: 0,
                                p2Score: 0,
                                goal: 0
                            };
                        }
                        for (let [index, player] of enumerate(data.players)) {
                            const playerInstance = window.players.find((p, i) => index === i);
                            if (!playerInstance) {
                                continue;
                            }
    
                            ['x', 'y', 'angle'].forEach((key) => {
                                const delta = Math.abs(player[key] - playerInstance[key]);
    
                                if (key === 'x' && delta > 0) {
                                    //playerInstance.x = player.x;
                                    playerInstance.savedX = player.x;
                                    playerInstance.savedVelocity = player.velocity;
                                    playerInstance.savedAngularVelocity = player.angularVelocity;
                                }
    
                                if (key === 'y' && delta > 0) {
                                    //playerInstance.y = player.y;
                                    playerInstance.savedY = player.y;
                                    playerInstance.savedVelocity = player.velocity;
                                    playerInstance.savedAngularVelocity = player.angularVelocity;
                                }
    
                                if (key === 'angle' && delta > (Math.PI / 90, 0)) {
                                    //playerInstance.angle = player.angle;
                                    playerInstance.savedAngle = player.angle;
                                    playerInstance.savedVelocity = player.velocity;
                                    playerInstance.savedAngularVelocity = player.angularVelocity;
                                }
                            });
    
                            for (let [key, value] of Object.entries(player.instVars)) {
                                playerInstance.instVars[key] = value;
                            }
                        }
            
                        for (let [index, head] of enumerate(data.heads)) {
                            continue;
                            const headInstance = window.heads.find((p, i) => index === i);
                            if (!headInstance) {
                                continue;
                            }
    
                            ['x', 'y', 'angle'].forEach((key) => {
                                const delta = Math.abs(head[key] - headInstance[key]);
    
                                if (key === 'y' && delta > 1) {
                                    headInstance.y = head.y;
                                    headInstance.savedY = head.y;
                                    headInstance.savedVelocity = head.velocity;
                                }
    
                                if (key === 'angle' && delta > (Math.PI / 180, 0)) {
                                    headInstance.angle = head.angle;
                                    headInstance.savedAngle = head.angle;
                                    headInstance.savedVelocity = head.velocity;
                                }
    
                                if (key === 'x' && delta > 0) {
                                    //headInstance.x = head.x;
                                    headInstance.savedX = head.x;
                                    headInstance.savedVelocity = head.velocity;
                                }
                            });

                            //headInstance.behaviors.Physics.setVelocity(0, 0);
                            headInstance.behaviors.Physics.angularVelocity = 0;
    
                            for (let [key, value] of Object.entries(head.instVars)) {
                                headInstance.instVars[key] = value;
                            }
                        }
    
                        for (let [index, arm] of enumerate(data.arms)) {
                            const armInstance = window.arms.find((p, i) => index === i);
                            if (!armInstance) {
                                continue;
                            }
                            
                            ['x', 'y', 'angle'].forEach((key) => {
                                const delta = Math.abs(arm[key] - armInstance[key]);
    
                                if (key === 'x' && delta > 0) {
                                    //armInstance.x = arm.x;
                                    armInstance.savedX = arm.x;
                                    armInstance.savedVelocity = arm.velocity;
                                }
    
                                if (key === 'y' && delta > 0) {
                                    //armInstance.y = arm.y;
                                    armInstance.savedY = arm.y;
                                    armInstance.savedVelocity = arm.velocity;
                                }
    
                                if (key === 'angle' && delta > (Math.PI / 180, 0)) {
                                    //armInstance.angle = arm.angle;
                                    armInstance.savedAngle = arm.angle;
                                    armInstance.savedVelocity = arm.velocity;
                                }
                            });
    
                            for (let [key, value] of Object.entries(arm.instVars)) {
                                armInstance.instVars[key] = value;
                            }
                        }
            
                        const ballInstance = window.ball;
                        //ballInstance.x = data.ball.x;
                        //ballInstance.y = data.ball.y;
                        ballInstance.savedX = data.ball.x;
                        ballInstance.savedY = data.ball.y;
                        ballInstance.savedVelocity = data.ball.velocity;
                        for (let [key, value] of Object.entries(data.ball.instVars)) {
                            ballInstance.instVars[key] = value;
                        }
                        ballInstance.savedInstVars = data.ball.instVars || {};
                    })(document.querySelector('iframe').contentWindow);
                }
            });
            comms.in.send(JSON.stringify({ type: 'ready' }));
        } else return false;
    });

    await comms.connected;
    window.postMessage({type: "ready"}, '*');
}