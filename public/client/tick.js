export function tick(window, keys) {
    const gv = window.savedGlobalVars || {
        p1Score: 0,
        p2Score: 0,
        goal: 0
    };
    const ball = window.ball;

    try {
        window.c3_runtimeInterface._localRuntime._layoutManager._layoutsByName.get('game')._layersByName.get('ui')._instances[2]._sdkInst._SetText(String(gv.p2Score));
        window.c3_runtimeInterface._localRuntime._layoutManager._layoutsByName.get('game')._layersByName.get('ui')._instances[3]._sdkInst._SetText(String(gv.p1Score));
    } catch {}

    for (const player of window.players) {
        player.x = player.savedX;
        player.y = player.savedY;
        player.angle = player.savedAngle;
        if (Array.isArray(player.savedVelocity)) {
            player.savedX += (player.savedVelocity[0]) / 60;
            player.savedY += (player.savedVelocity[1]) / 60;
            if (player.savedVelocity[1] > 100) {
                player.savedVelocity[1] = 100;
            }
            if (player.y < 140 || player.savedVelocity[1] < 0) {
                player.savedVelocity[1] += 4;
            }
            if (player.savedVelocity[1] > 0 && player.y > 140) {
                player.savedVelocity[1] = 0;
            }
        }
        if (player.savedAngularVelocity) {
            player.savedAngle += (player.savedAngularVelocity) / 60;
        }

        //player.behaviors.Physics.setVelocity(0, 0);
        player.behaviors.Physics.angularVelocity = 0;
    }

    for (const head of window.heads) {
        head.x = head.savedX;
        head.y = head.savedY;
        //head.angle = head.savedAngle;

        if (Array.isArray(head.savedVelocity)) {
            head.savedX += (head.savedVelocity[0]) / 60;
            head.savedY += (head.savedVelocity[1]) / 60;
            if (head.savedVelocity[1] > 100) {
                head.savedVelocity[1] = 100;
            }
            if (head.savedVelocity[1] > 0 && head.y > 140) {
                head.savedVelocity[1] = 0;
            }
        }

        //head.behaviors.Physics.setVelocity(0, 0);
        //head.behaviors.Physics.angularVelocity = 0;
    }

    for (const arm of window.arms) {
        arm.x = arm.savedX;
        arm.y = arm.savedY;
        arm.angle = arm.savedAngle;

        const index = window.arms.indexOf(arm);

        switch(index) {
            case 0:
            case 1: {
                if (ball.savedInstVars && ball.savedInstVars['hold'] && [0, 2].includes(ball.savedInstVars['who'])) {
                    if (ball.savedInstVars['who'] === 0 && index === 0 || ball.savedInstVars['who'] === 2 && index === 1) {
                        if (keys.up && arm.angleDegrees < 178) {
                            arm.savedAngle += ((Math.PI * (190 / 180)) / 0.35) / 60;
                        }
                        if (!keys.up && arm.angleDegrees > 2 && arm.angleDegrees < 180) {
                            arm.savedAngle -= ((Math.PI * (190 / 180)) / 0.35) / 60;
                            if (arm.savedAngle < 0) {
                                arm.savedAngle = 0;
                            }
                        }
                    } else {
                        arm.savedAngle = 0;
                    }
                } else {
                    if (keys.up && arm.angleDegrees < 178) {
                        arm.savedAngle += ((Math.PI * (190 / 180)) / 0.35) / 60;
                    }
                    if (!keys.up && arm.angleDegrees > 2 && arm.angleDegrees < 180) {
                        arm.savedAngle -= ((Math.PI * (190 / 180)) / 0.35) / 60;
                        if (arm.savedAngle < 0) {
                            arm.savedAngle = 0;
                        }
                    }
                }

                break;
            };
            case 2:
            case 3: {
                if (ball.savedInstVars && ball.savedInstVars['hold'] && [3, 4].includes(ball.savedInstVars['who'])) {
                    if (ball.savedInstVars['who'] === 3 && index === 2 || ball.savedInstVars['who'] === 4 && index === 3) {
                        if (keys.w && arm.angleDegrees > 182) {
                            arm.savedAngle -= ((Math.PI * (190 / 180)) / 0.35) / 60;
                        }
                        if (!keys.w && arm.angleDegrees < 358 && arm.angleDegrees > 182) {
                            arm.savedAngle += ((Math.PI * (190 / 180)) / 0.35) / 60;
                            if (arm.savedAngle > Math.PI * 2) {
                                arm.savedAngle = Math.PI * 2;
                            }
                        }
                    } else {
                        arm.savedAngle = 0;
                    }
                } else {
                    if (keys.w && arm.angleDegrees > 182) {
                        arm.savedAngle -= ((Math.PI * (190 / 180)) / 0.35) / 60;
                    }
                    if (!keys.w && arm.angleDegrees < 358 && arm.angleDegrees > 182) {
                        arm.savedAngle += ((Math.PI * (190 / 180)) / 0.35) / 60;
                        if (arm.savedAngle > Math.PI * 2) {
                            arm.savedAngle = Math.PI * 2;
                        }
                    }
                }

                break;
            }
        }
    }

    ball.x = ball.savedX;
    ball.y = ball.savedY;

    if (Array.isArray(ball.savedVelocity) && !gv.goal) {
        ball.savedX += (ball.savedVelocity[0]) / 60;
        ball.savedY += (ball.savedVelocity[1]) / 60;
        if (ball.savedVelocity[1] > 100) {
            ball.savedVelocity[1] = 100;
        }
        if (ball.y < 136 || ball.savedVelocity[1] < 0) {
            ball.savedVelocity[1] += 4;
        }
        if (ball.savedVelocity[1] > 0 && ball.y > 136) {
            ball.savedVelocity[1] = 0;
        }
    }

    if (ball.savedInstVars) {
        for (let [key, value] of Object.entries(ball.savedInstVars)) {
            ball.instVars[key] = value;
        }
    }
    if (gv.goal) {
        //window.c3_runtimeInterface._localRuntime._layoutManager._layoutsByName.get('game')._layersByName.get('ui')._instances[4]._sdkInst._SetText(String(gv.goal));
    } else {
        //window.c3_runtimeInterface._localRuntime._layoutManager._layoutsByName.get('game')._layersByName.get('ui')._instances[4]._sdkInst._SetText('');
    }
}