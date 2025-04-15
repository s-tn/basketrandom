window.init = async function startGame(url) {
    const ws = new WebSocket(`${location.protocol.replace('http', 'ws')}//${location.host}${url}`);

    function setupBackup() {
        ws.onclose = function() {
            location.reload();
        }
    }

    const ping = async (ws) => {
        return new Promise((resolve, reject) => {
            const start = Date.now();
            ws.send('ping');
            ws.onmessage = (event) => {
                if (event.data === 'pong') {
                    resolve(Date.now() - start);
                }
            }
        });
    }

    setupBackup();

    const keys = {
        w: false,
        up: false
    }

    window.addEventListener('basket-key', (event) => {
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

        ws.send(JSON.stringify({ type: 'key', event: event.detail.type, key: event.detail.key }));
    });

    window.ready = function() {
        if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'ready' }));

            setInterval(() => {
                ping(ws).then((ping) => {
                    window.postMessage({ type: 'ping', data: ping }, '*');
                });
            }, 1000);
        }
    }

    window.unpause = function() {
        document.querySelector('iframe').contentWindow.c3_runtimeInterface._localRuntime.SetSuspended(false);
        document.querySelector('iframe').focus();
    }

    let currentId = 0;

    ws.addEventListener('message', (event) => {
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
            setInterval(() => {
                /*getPing(ws).then((ping) => {
                    window.postMessage({ type: 'ping', ping: ping }, '*');
                });*/
            }, 1000);
            const tick = () => {
                const gv = document.querySelector('iframe').contentWindow.savedGlobalVars || {
                    p1Score: 0,
                    p2Score: 0,
                    goal: 0
                };

                for (const head of document.querySelector('iframe').contentWindow.heads) {
                    //head.x = head.savedX;
                    //head.y = head.savedY;
                    //head.angle = head.savedAngle;
                }

                for (const player of document.querySelector('iframe').contentWindow.players) {
                    player.x = player.savedX;
                    player.y = player.savedY;
                    player.angle = player.savedAngle;
                    if (Array.isArray(player.savedVelocity)) {
                        player.savedX += (player.savedVelocity[0]) / 60;
                        player.savedY += (player.savedVelocity[1]) / 60;
                        if (player.savedVelocity[1] > 100) {
                            player.savedVelocity[1] = 100;
                        }
                        if (player.y < 140 || player.savedVelocity[1] < 0) {
                            player.savedVelocity[1] += 4;
                        }
                        if (player.savedVelocity[1] > 0 && player.y > 140) {
                            player.savedVelocity[1] = 0;
                        }
                    }
                    if (player.savedAngularVelocity) {
                        player.savedAngle += (player.savedAngularVelocity) / 60;
                    }
                }

                for (const arm of document.querySelector('iframe').contentWindow.arms) {
                    arm.x = arm.savedX;
                    arm.y = arm.savedY;
                    arm.angle = arm.savedAngle;

                    const index = document.querySelector('iframe').contentWindow.arms.indexOf(arm);

                    switch(index) {
                        case 0:
                        case 1: {
                            if (keys.up && arm.angleDegrees < 178) {
                                arm.savedAngle += ((Math.PI * (190 / 180)) / 0.35) / 60;
                            }
                            if (!keys.up && arm.angleDegrees > 2 && arm.angleDegrees < 180) {
                                arm.savedAngle -= ((Math.PI * (190 / 180)) / 0.35) / 60;
                                if (arm.savedAngle < 0) {
                                    arm.savedAngle = 0;
                                }
                            }
                            break;
                        };
                        case 2:
                        case 3: {
                            if (keys.w && arm.angleDegrees > 182) {
                                arm.savedAngle -= ((Math.PI * (190 / 180)) / 0.35) / 60;
                            }
                            if (!keys.w && arm.angleDegrees < 358 && arm.angleDegrees > 182) {
                                arm.savedAngle += ((Math.PI * (190 / 180)) / 0.35) / 60;
                                if (arm.savedAngle > Math.PI * 2) {
                                    arm.savedAngle = Math.PI * 2;
                                }
                            }
                            break;
                        }
                    }
                }

                const ball = document.querySelector('iframe').contentWindow.ball;

                ball.x = ball.savedX;
                ball.y = ball.savedY;

                if (Array.isArray(ball.savedVelocity) && !gv.goal) {
                    ball.savedX += (ball.savedVelocity[0]) / 60;
                    ball.savedY += (ball.savedVelocity[1]) / 60;
                    if (ball.savedVelocity[1] > 100) {
                        ball.savedVelocity[1] = 100;
                    }
                    if (ball.y < 136 || ball.savedVelocity[1] < 0) {
                        ball.savedVelocity[1] += 4;
                    }
                    if (ball.savedVelocity[1] > 0 && ball.y > 136) {
                        ball.savedVelocity[1] = 0;
                    }
                }
            }

            document.querySelector('iframe').contentWindow.c3_runtimeInterface._localRuntime.Tick = new Proxy(document.querySelector('iframe').contentWindow.c3_runtimeInterface._localRuntime.Tick, {
                apply: function(target, thisArg, argumentsList) {
                    let e = target.apply(thisArg, argumentsList);
                    try {tick();} catch(e) {};
                    return e;
                }
            });

            function decompress(fullData) {
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
                
                let dict = fullData.match(/([A-Z]{2})=([a-zA-Z0-9_]+)/g);
                let data = fullData.replace(/^[^()]+\(\)/, '');
                let obj = Object.fromEntries(dict.map(entry => entry.split('=').map(e => e.trim())));
            
                for (var phrase in obj) {
                    data = data.replaceAll(phrase, obj[phrase]);
                }
            
                function layer(d, l = 0) {
                    const obj = {};
                    const sep = separators[l];
                    const split = d.split(sep);
            
                    for (const section of split) {
                        if (section.match(/^([^\|\{\}\[]+)\|(.+)\|/)) {
                            let [ key, value ] = section.match(/^([^\|\{\}\[]+)\|(.+)\|/).slice(1, 3);
            
                            if (value.match(/^[\-\d\.]+$/)) value = parseFloat(value);
            
                            obj[key] = value;
                        } else if (section.match(/^([^\|\{\}\[]+)\[(.+)\]/)) {
                            const [ key, value ] = section.match(/^([^\|\{\}\[]+)\[(.+)\]/).slice(1, 3);
            
                            obj[key] = layerArray(value, l + 1);
                        } else if (section.match(/^([^\|\{\}\[]+)\{(.+)\}/)) {
                            const [ key, value ] = section.match(/^([^\|\{\}\[]+)\{(.+)\}/).slice(1, 3);
            
                            obj[key] = layer(value, l + 1);
                        }
                    }
                    return obj;
                }
            
                function layerArray(d, l = 0) {
                    const arr = [];
                    const sep = separators[l];
                    const split = d.split(sep);
            
                    for (const section of split) {
                        if (section.match(/^[\-\d\.]+$/)) {
                            arr.push(parseFloat(section));
                            continue;
                        }
                        arr.push(layer(section, l + 1))
                    }
                    
                    return arr;
                }
            
                return layer(data)
            }

            ws.addEventListener('message', (event) => {
                if (!event.data.toString().startsWith('update[')) {
                    return;
                }
                const data = decompress(event.data.toString().replace('update[', ''));

                // console.log(data);

                if (data.id < currentId) {
                    return;
                }

                currentId = data.id;

                if (data.event === 'update') {
                    (function(window) {
                        if (data.globalVars) {
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
                            const headInstance = window.heads.find((p, i) => index === i);
                            if (!headInstance) {
                                continue;
                            }

                            ['x', 'y', 'angle'].forEach((key) => {
                                const delta = Math.abs(head[key] - headInstance[key]);

                                if (key === 'y' && delta > 0) {
                                    //headInstance.y = head.y;
                                    headInstance.savedY = head.y;
                                    headInstance.savedVelocity = head.velocity;
                                }

                                if (key === 'angle' && delta > (Math.PI / 180, 0)) {
                                    //headInstance.angle = head.angle;
                                    headInstance.savedAngle = head.angle;
                                    headInstance.savedVelocity = head.velocity;
                                }

                                if (key === 'x' && delta > 0) {
                                    //headInstance.x = head.x;
                                    headInstance.savedX = head.x;
                                    headInstance.savedVelocity = head.velocity;
                                }
                            });

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
                    })(document.querySelector('iframe').contentWindow);
                }
            });
            ws.send(JSON.stringify({ type: 'ready' }));
        } else return false;
    });
}

function enumerate(iterable) {
    let i = 0;
    let e = [];
    for (let item of iterable) {
        e.push([i, item]);
        i++;
    }
    return e;
}

setTimeout(() => {
    window.dispatchEvent(new Event('ready'));
}, 1000);