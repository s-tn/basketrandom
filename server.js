import { Server } from 'node:http';
import { parse } from 'node:url';
import next from 'next';
import { setHttpServer, setWebSocketServer } from 'next-ws/server';
import { WebSocketServer } from 'ws';
import * as esbuild from 'esbuild';

import './game/headless.js';

esbuild.context({
  entryPoints: ['./public/client/main.js'],
  bundle: true,
  outfile: './public/game.bundle.js',
  minify: true,
  sourcemap: true
}).then((context) => {
  console.log('Bundling game...');
  return context.watch().then(() => {
    console.log('Game bundle ready.');
  });
});

//import './game/index.js'

const httpServer = new Server();
setHttpServer(httpServer);
const webSocketServer = new WebSocketServer({ noServer: true });
setWebSocketServer(webSocketServer);

const dev = process.env.NODE_ENV !== 'production';
const hostname = 'localhost';
const port = Number.parseInt(process.env.PORT ?? '9000');
const app = next({ dev, hostname, port, customServer: true });
const handle = app.getRequestHandler();

import { exec } from 'node:child_process';
exec('pkill -o chromium');

app.prepare().then(() => {
  httpServer
    .on('request', async (req, res) => {
      const parsedUrl = parse(req.url, true);
      res.setHeader('fly-region', process.env.FLY_REGION || 'offsite');
      await handle(req, res, parsedUrl);
    }).on('upgrade', (req, socket, head) => {
        console.log(req.url);
        if (req.url === '/_next/webpack-hmr')
        socket.destroy();
    })
    .listen(port, () => {
      console.log(` ▲ Ready on http://${hostname}:${port}`);

      /*setInterval(() => {
        fetch('http://localhost:9000/api/lobby/empty', {
          method: 'POST'
        });
      }, 10000);*/
    });
});