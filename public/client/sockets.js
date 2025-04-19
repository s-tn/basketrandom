import ReconnectingWebSocket from 'reconnecting-websocket';

export function getSockets(url) {
    const sockets = {
        in: new ReconnectingWebSocket(`${location.protocol.replace('http', 'ws')}//${location.host}${url}?stream`),
        out: new ReconnectingWebSocket(`${location.protocol.replace('http', 'ws')}//${location.host}${url}?events`)
    };

    sockets.connected = Promise.allSettled([
        new Promise((resolve) => sockets.in.addEventListener('open', resolve)),
        new Promise((resolve) => sockets.out.addEventListener('open', resolve))
    ]);

    return sockets;
}