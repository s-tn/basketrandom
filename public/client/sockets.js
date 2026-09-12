import ReconnectingWebSocket from 'reconnecting-websocket';

export function getSockets(url, spectator = false) {
    const wsBase = `${location.protocol.replace('http', 'ws')}//${location.host}${url}`;
    // Shared per-player id: the server uses it to recognize that the stream and
    // events sockets belong to the same player (sides/roles are assigned per player)
    const cid = (crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2));

    if (spectator) {
        const inSock = new ReconnectingWebSocket(`${wsBase}?spectator&cid=${cid}`);
        const sockets = {
            in: inSock,
            out: null,
        };
        sockets.connected = Promise.allSettled([
            new Promise((resolve) => inSock.addEventListener('open', resolve)),
        ]);
        return sockets;
    }

    const sockets = {
        in: new ReconnectingWebSocket(`${wsBase}?stream&cid=${cid}`),
        out: new ReconnectingWebSocket(`${wsBase}?events&cid=${cid}`)
    };

    sockets.connected = Promise.allSettled([
        new Promise((resolve) => sockets.in.addEventListener('open', resolve)),
        new Promise((resolve) => sockets.out.addEventListener('open', resolve))
    ]);

    return sockets;
}