export function setup(window) {
    return new Promise(resolve => {
        window.c3_runtimeInterface._localRuntime.SetTimeScale(10000000000);

        window.dispatchEvent(new PointerEvent('pointerdown', {clientX: window.innerWidth/2, clientY: window.innerHeight/2}));

        window.savedGlobalVars = {
            p1Score: 0,
            p2Score: 0,
            goal: 0
        };

        Object.defineProperties(window, {
            "ball": {
                get: () => window.c3_runtimeInterface._localRuntime._iRuntime.objects.balls.getAllInstances()[0],
            },
            "players": {
                get: () => [
                    window.c3_runtimeInterface._localRuntime._iRuntime.objects.body.getAllInstances()[0],
                    window.c3_runtimeInterface._localRuntime._iRuntime.objects.body2.getAllInstances()[0],
                    window.c3_runtimeInterface._localRuntime._iRuntime.objects.body3.getAllInstances()[0],
                    window.c3_runtimeInterface._localRuntime._iRuntime.objects.body4.getAllInstances()[0],
                ],
            },
            "heads": {
                get: () => [
                    window.c3_runtimeInterface._localRuntime._iRuntime.objects.head.getAllInstances()[0],
                    window.c3_runtimeInterface._localRuntime._iRuntime.objects.head2.getAllInstances()[0],
                    window.c3_runtimeInterface._localRuntime._iRuntime.objects.head3.getAllInstances()[0],
                    window.c3_runtimeInterface._localRuntime._iRuntime.objects.head4.getAllInstances()[0],
                ],
            },
            "arms": {
                get: () => [
                    window.c3_runtimeInterface._localRuntime._iRuntime.objects.arm.getAllInstances()[0],
                    window.c3_runtimeInterface._localRuntime._iRuntime.objects.arm2.getAllInstances()[0],
                    window.c3_runtimeInterface._localRuntime._iRuntime.objects.arm3.getAllInstances()[0],
                    window.c3_runtimeInterface._localRuntime._iRuntime.objects.arm4.getAllInstances()[0],
                ],
            },
            "globalVars": {
                get: () => window.c3_runtimeInterface._localRuntime._iRuntime.globalVars,
            }
        });

        ['keydown', 'keyup'].forEach(name => {
            window.document.addEventListener(name, (event) => {
                window.console.log(`Event: ${name}, Key: ${event.key}`);
                event.preventDefault();
                event.stopPropagation();
                event.stopImmediatePropagation();

                window.dispatchEvent(new CustomEvent('basket-key', { detail: {type: name, key: event.key} }));
            });
        });

        let startGame = false;

        window.AudioDOMHandler.prototype._Play = new Proxy(window.AudioDOMHandler.prototype._Play, {
            apply: (target, thisArg, argumentsList) => {
                console.log(argumentsList[0].originalUrl)

                window.parent.dispatchEvent(new CustomEvent('c3:sound', {
                    detail: {
                        sound: argumentsList[0].originalUrl
                    }
                }));

                if (argumentsList[0].originalUrl === "start") {
                    console.log(window);
                    setTimeout(async () => {
                        window.dispatchEvent(new PointerEvent('pointerup'));
                        await new Promise((resolve) => setTimeout(resolve, 100));
                        window.dispatchEvent(new PointerEvent('pointerdown', {clientX: 0.6 * window.innerWidth/*window.innerWidth * 0.6*/, clientY: window.innerHeight * 0.57}));
                        await new Promise((resolve) => setTimeout(resolve, 100));
                        window.dispatchEvent(new PointerEvent('pointerup'));
                    }, 1000);
                }
        
                if (argumentsList[0].originalUrl === "refsoc") {
                    if (!startGame) {
                        startGame = true;
                        setTimeout(async () => {
                            window.dispatchEvent(new PointerEvent('pointerdown', {clientX: 0.6 * window.innerWidth/*window.innerWidth * 0.6*/, clientY: window.innerHeight * 0.57}));
                            await new Promise((resolve) => setTimeout(resolve, 100));
                            window.dispatchEvent(new PointerEvent('pointerup'));
                            await new Promise((resolve) => setTimeout(resolve, 100));
                            window.dispatchEvent(new PointerEvent('pointerdown', {clientX: 0.4 * window.innerWidth/*window.innerWidth * 0.6*/, clientY: window.innerHeight * 0.57}));
                            await new Promise((resolve) => setTimeout(resolve, 100));
                            window.dispatchEvent(new PointerEvent('pointerup'));
                            await new Promise((resolve) => setTimeout(resolve, 100));
        
                            window.c3_runtimeInterface._localRuntime.SetSuspended(true);
        
                            resolve()
                        }, 250);
                    }
                }

                return false;

                // return target.apply(thisArg, argumentsList);
            }
        });
    });
}