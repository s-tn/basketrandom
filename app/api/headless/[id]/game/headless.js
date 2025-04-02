/* headless browser */

import http from 'http';
import nodeStatic from 'node-static';

const file = new nodeStatic.Server('./game/headless');

const server = http.createServer((req, res) => {
    req.addListener('end', () => {
        file.serve(req, res);
    }).resume();
});

server.listen(7600, () => {
    console.log('Headless client running at http://localhost:9001/');
});