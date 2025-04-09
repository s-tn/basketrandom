import puppeteer from 'puppeteer';
import { platform } from 'os';

const __dirname = (import.meta.url ?
    import.meta.url.replace(/^file:\/\//, '') :
    __dirname || 
    (function() {
        try {
            return decodeURIComponent(process.execPath);
        } catch(e) {
            return '';
        }
    })()).replace('/game/run.js', '/game/');

let chromiumExec = '';

if (platform() === 'linux') {
    // chromiumExec = '/root/.cache/puppeteer/chrome-headless-shell/linux-134.0.6998.165';
}

console.log(__dirname + 'data');

const browserPromise = puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--single-process', '--no-zygote', '--disable-gl-drawing-for-tests'],
    executablePath: chromiumExec,
    userDataDir: __dirname + 'data'
});

const run = async () => {
    const browser = await browserPromise;
    const page = await browser.newPage({
        visualViewport: {
            innerWidth: 640,
            innerHeight: 360
        }
    });
    page.setViewport({ width: 640, height: 360 });
    await page.goto('http://localhost:9001/');

    return { browser, page };
}

export default run;