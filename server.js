import { Server } from 'node:http';
import { parse } from 'node:url';
import next from 'next';
import { setHttpServer, setWebSocketServer } from 'next-ws/server';
import { WebSocketServer } from 'ws';

import './game/index.js'

const httpServer = new Server();
setHttpServer(httpServer);
const webSocketServer = new WebSocketServer({ noServer: true });
setWebSocketServer(webSocketServer);

const dev = process.env.NODE_ENV !== 'production';
const hostname = 'localhost';
const port = Number.parseInt(process.env.PORT ?? '9000');
const app = next({ dev, hostname, port, customServer: true });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  httpServer
    .on('request', async (req, res) => {
      const parsedUrl = parse(req.url, true);
      await handle(req, res, parsedUrl);
    }).on('upgrade', (req, socket, head) => {
        console.log(req.url);
        if (req.url === '/_next/webpack-hmr')
        socket.destroy();
    })
    .listen(port, () => {
      console.log(` ▲ Ready on http://${hostname}:${port}`);

      fetch('http://localhost:9000/api/lobby/something');
    });
});