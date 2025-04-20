export function anticheat(window) {
    const original = window.c3_runtimeInterface;

    Object.defineProperty(window, 'c3_runtimeInterface', {
        get: () => {
            const stack = new Error().stack;
            const stackLines = stack.split('\n');
            if (stackLines.filter(line => line.includes(`${location.origin}/game.bundle.js`)).length > 1) return original;
            stackLines.splice(0, 2);
            if (stackLines.filter(line => line.includes('c3runtime.js')).length > 5) return original;
            if (!stackLines.find(line => line.includes(`${location.origin}/game.bundle.js`))) {
                const error = new Error('Anticheat triggered: c3_runtimeInterface accessed outside of game context');
                error.stack = stack;
                throw error;
            }
            return original;
        }
    });
}