import { getSockets } from './sockets';
import { setup } from './setup';
import { decodePacket, encodeInput, PACKET } from './protocol';
import { createStateBuffer } from './interpolation';
import { applyState } from './tick';
import { anticheat } from './anticheat';
import { createClipper } from './clipper';
import { setupTouchControls } from './touch';

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
    setupTouchControls(cw);

    let clipper = null;
    try {
        const gameCanvas = cw.document.querySelector('canvas');
        if (gameCanvas) {
            const clipDuration = parseInt(localStorage.getItem('clipDuration') || '10', 10);
            clipper = createClipper(gameCanvas, clipDuration);
        }
    } catch {}

    const comms = getSockets(baseEndpoint);

    ['in', 'out'].forEach((type) => {
        comms[type].addEventListener('error', () => {
            window.postMessage({ type: 'error', data: "Socket tunnel error, reconnecting..." }, '*');
        });
        comms[type].addEventListener('close', () => {
            window.postMessage({ type: 'error', data: "Socket tunnel closed, reconnecting..." }, '*');
        });
    });

    window.ready = function() {
        if (comms.in.readyState === WebSocket.OPEN) {
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
            if (clipper) {
                const blob = clipper.trigger();
                if (blob) window.postMessage({ type: 'clip', blob, auto: true }, '*');
            }
        }
    });

    window.addEventListener('message', (e) => {
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
        if (gameStarted) {
            comms.in.send(JSON.stringify({ type: 'ready' }));
            window.postMessage({ type: 'update', data: 'Reconnected, syncing...' }, '*');
        }
    });

    cw.c3_runtimeInterface._localRuntime.Tick = new Proxy(cw.c3_runtimeInterface._localRuntime.Tick, {
        apply: function(target, thisArg, argumentsList) {
            return target.apply(thisArg, argumentsList);
        }
    });

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
