import { getSockets } from './sockets';
import { setup } from './setup';
import { decodePacket, encodeInput, PACKET } from './protocol';
import { createStateBuffer } from './interpolation';
import { applyState } from './tick';
import { anticheat } from './anticheat';
import { createClipper } from './clipper';
import { setupTouchControls } from './touch';
import { createDrawer } from './drawer';
import { playGoalSound, playCountdownBeep, playGoBeep, playMatchEnd } from './sounds';

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
        // Strip any ?... query params from the hash value before decoding
        const hashVal = location.hash.match(/#([^?]+)/)[1];
        baseEndpoint = atob(hashVal);
    } catch(e) {
        return alert('Invalid Endpoint');
    }

    const isSpectator = new URL(location.href).searchParams.has('spectate') ||
                        location.hash.includes('spectate=true');

    const cw = document.getElementById('game').contentWindow;
    await setup(cw);

    let drawer = null;
    let clipper = null;

    if (!isSpectator) {
        setupTouchControls(cw);
        drawer = createDrawer(cw);

        try {
            const gameCanvas = cw.document.querySelector('canvas');
            if (gameCanvas) {
                const clipDuration = parseInt(localStorage.getItem('clipDuration') || '10', 10);
                clipper = createClipper(gameCanvas, clipDuration);
            }
        } catch {}
    }

    const comms = getSockets(baseEndpoint, isSpectator);

    if (!isSpectator) {
        setInterval(() => {
            const segments = drawer.flush();
            if (segments && comms.out.readyState === WebSocket.OPEN) {
                comms.out.send(JSON.stringify({ type: 'draw', segments }));
            }
        }, 50); // 20Hz sync rate for drawings
    }

    const socketTypes = isSpectator ? ['in'] : ['in', 'out'];
    socketTypes.forEach((type) => {
        comms[type].addEventListener('error', () => {
            window.postMessage({ type: 'error', data: "Socket tunnel error, reconnecting..." }, '*');
        });
        comms[type].addEventListener('close', () => {
            window.postMessage({ type: 'error', data: "Socket tunnel closed, reconnecting..." }, '*');
        });
    });

    window.ready = function() {
        if (!isSpectator && comms.in.readyState === WebSocket.OPEN) {
            comms.in.send(JSON.stringify({ type: 'ready' }));
        }
    };

    window.unpause = function() {
        cw.c3_runtimeInterface._localRuntime.SetSuspended(false);
        document.querySelector('iframe').focus();
    };

    addEventListener('c3:sound', ({detail: { sound }}) => {
        if (sound === "file") {
            cw.globalVars.p1Score = 0;
            cw.globalVars.p2Score = 0;
            if (!isSpectator && clipper) {
                const blob = clipper.trigger();
                if (blob) window.postMessage({ type: 'clip', blob, auto: true }, '*');
            }
            playGoalSound();
        }
    });

    window.addEventListener('message', (e) => {
        if (!isSpectator) {
            if (e.data?.type === 'manualClip' && clipper) {
                const blob = clipper.trigger();
                if (blob) window.postMessage({ type: 'clip', blob, auto: false }, '*');
            }
            if (e.data?.type === 'clipDuration' && clipper) {
                clipper.setDuration(e.data.duration);
            }
            if (e.data?.type === 'side-pick') {
                // Parent sent the winner's side choice — relay to server
                comms.in.send(JSON.stringify({ type: 'side-pick', side: e.data.side }));
            }
            if (e.data?.type === 'toggleDraw') {
                const isActive = drawer.toggle();
                window.postMessage({ type: 'drawActive', active: isActive }, '*');
            }
            if (e.data?.type === 'clearDraw') {
                drawer.clear();
            }
            if (e.data?.type === 'drawColor') {
                drawer.setColor(e.data.color);
            }
        }
        if (e.data?.type === 'countdown-beep') {
            playCountdownBeep();
        }
        if (e.data?.type === 'countdown-go') {
            playGoBeep();
        }
        if (e.data?.type === 'applySkins') {
            const skins = e.data.skins;
            function hexToRgb(hex) {
                const r = parseInt(hex.slice(1, 3), 16) / 255;
                const g = parseInt(hex.slice(3, 5), 16) / 255;
                const b = parseInt(hex.slice(5, 7), 16) / 255;
                return [r, g, b];
            }
            if (skins.player0 && skins.player0 !== '#ffffff') {
                const [r, g, b] = hexToRgb(skins.player0);
                if (cw.players[0]) cw.players[0].colorRgb = [r, g, b];
                if (cw.players[1]) cw.players[1].colorRgb = [r, g, b];
            }
            if (skins.player1 && skins.player1 !== '#ffffff') {
                const [r, g, b] = hexToRgb(skins.player1);
                if (cw.players[2]) cw.players[2].colorRgb = [r, g, b];
                if (cw.players[3]) cw.players[3].colorRgb = [r, g, b];
            }
        }
    });

    const stateBuffer = createStateBuffer();
    let gameStarted = false;

    function renderLoop() {
        if (gameStarted) {
            const interpolated = stateBuffer.interpolate();
            if (interpolated) {
                applyState(cw, interpolated);
                window.postMessage({ type: 'score', data: [interpolated.score0, interpolated.score1] }, '*');
            }
        }
        requestAnimationFrame(renderLoop);
    }

    comms.in.addEventListener('open', () => {
        comms.in.binaryType = 'arraybuffer';
        if (!isSpectator && gameStarted) {
            comms.in.send(JSON.stringify({ type: 'ready' }));
            window.postMessage({ type: 'update', data: 'Reconnected, syncing...' }, '*');
        }
    });

    cw.c3_runtimeInterface._localRuntime.Tick = new Proxy(cw.c3_runtimeInterface._localRuntime.Tick, {
        apply: function(target, thisArg, argumentsList) {
            return target.apply(thisArg, argumentsList);
        }
    });

    if (!isSpectator) {
        cw.addEventListener('basket-key', (event) => {
            const { key, type } = event.detail;
            const playerIndex = key === 'ArrowUp' ? 0 : 1;
            const action = type === 'keydown' ? 1 : 0;
            const inputPacket = encodeInput(playerIndex, action, performance.now());
            if (comms.out.readyState === WebSocket.OPEN) {
                comms.out.send(inputPacket);
            }
            window.dispatchEvent(new event.constructor(event.type, event));
        });

        let pingInterval = null;
        comms.out.addEventListener('open', () => {
            if (pingInterval) clearInterval(pingInterval);
            pingInterval = setInterval(() => {
                if (comms.out.readyState === WebSocket.OPEN) {
                    const start = performance.now();
                    comms.out.send('ping');
                    const handler = (e) => {
                        if (typeof e.data === 'string' && e.data === 'pong') {
                            window.postMessage({ type: 'ping', data: Math.round(performance.now() - start) }, '*');
                            comms.out.removeEventListener('message', handler);
                        }
                    };
                    comms.out.addEventListener('message', handler);
                }
            }, 1000);
        });
    }

    comms.in.addEventListener('message', (event) => {
        if (typeof event.data === 'string') {
            if (event.data === 'loaded') {
                window.postMessage({ type: 'loaded' }, '*');
            }
            if (event.data === 'start') {
                window.postMessage({ type: 'start' }, '*');
                if (!gameStarted) {
                    gameStarted = true;
                    requestAnimationFrame(renderLoop);
                    comms.in.send(JSON.stringify({ type: 'ready' }));
                }
            }
            // Try parsing JSON messages
            try {
                const json = JSON.parse(event.data);
                if (json.type === 'coinflip') {
                    // Coin flip result — show animation then side pick if winner
                    const result = json.winner + 1; // 0-indexed to 1-indexed for flipCoin
                    window.postMessage({ type: 'coinflip', phase: 'start' }, '*');
                    cw.flipCoin(json.players[0], json.players[1], "Coin Flip", result, () => {
                        window.postMessage({
                            type: 'coinflip',
                            phase: 'end',
                            youWon: json.youWon,
                            winnerName: json.winnerName,
                            players: json.players,
                        }, '*');
                    });
                }
                if (json.type === 'side-assigned') {
                    window.postMessage({
                        type: 'side-assigned',
                        side: json.side,
                        round: json.round,
                    }, '*');
                }
                if (json.type === 'draw-remote' && drawer) {
                    drawer.applyRemote(json.segments);
                }
            } catch {}
            return;
        }

        const packet = decodePacket(event.data);
        switch (packet.type) {
            case PACKET.SNAPSHOT:
                stateBuffer.push(packet.state);
                break;
            case PACKET.DELTA: {
                const latest = stateBuffer.latest;
                if (latest) {
                    stateBuffer.push({ ...latest, ...packet.changes });
                }
                break;
            }
            case PACKET.EVENT:
                if (packet.event.type === 'end') {
                    playMatchEnd();
                    window.postMessage({ type: 'end', winner: packet.event.winner }, '*');
                    gameStarted = false;
                }
                if (packet.event.type === 'round') {
                    window.postMessage({ type: 'newround', data: packet.event }, '*');
                    gameStarted = false;
                }
                break;
        }
    });

    await comms.connected;
    window.postMessage({ type: 'ready' }, '*');
}
