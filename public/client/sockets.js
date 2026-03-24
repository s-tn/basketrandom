import ReconnectingWebSocket from 'reconnecting-websocket';

export function getSockets(url, spectator = false) {
    const wsBase = `${location.protocol.replace('http', 'ws')}//${location.host}${url}`;

    if (spectator) {
        const inSock = new ReconnectingWebSocket(`${wsBase}?spectator`);
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
        in: new ReconnectingWebSocket(`${wsBase}?stream`),
        out: new ReconnectingWebSocket(`${wsBase}?events`)
    };

    sockets.connected = Promise.allSettled([
        new Promise((resolve) => sockets.in.addEventListener('open', resolve)),
        new Promise((resolve) => sockets.out.addEventListener('open', resolve))
    ]);

    return sockets;
}