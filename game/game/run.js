import puppeteer from 'puppeteer';
import { resolve } from 'path';

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

const browserPromise = puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--single-process', '--no-zygote', '--disable-gl-drawing-for-tests'],
    userDataDir: resolve(__dirname, '../../../../../', 'data')
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