export function enumerate(iterable) {
    let i = 0;
    let e = [];
    for (let item of iterable) {
        e.push([i, item]);
        i++;
    }
    return e;
}

export async function ping(ws) {
    return new Promise((resolve, reject) => {
        const start = Date.now();
        ws.send('ping');
        ws.onmessage = (event) => {
            if (event.data === 'pong') {
                resolve(Date.now() - start);
            }
        }
    });
}