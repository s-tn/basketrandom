import puppeteer from 'puppeteer';
import { platform } from 'os';

const run = async () => {
    let chromiumExec = '';

    if (platform() === 'linux') {
        chromiumExec = '/root/.cache/puppeteer/chrome/linux-134.0.6998.165/chrome-linux64/chrome';
    }

    const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--single-process', '--no-zygote'],
        //executablePath: chromiumExec
    });
    const page = await browser.newPage({
        visualViewport: {
            innerWidth: 640,
            innerHeight: 360
        }
    });
    page.setViewport({ width: 640, height: 360 });
    await page.goto('http://localhost:7600/');

    return { browser, page };
}

export default run;