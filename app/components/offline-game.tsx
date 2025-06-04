"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { PingIndicator } from "@/components/ping-indicator"
import { Fullscreen } from "lucide-react"

export function OfflineGame() {
  const [isLoading, setIsLoading] = useState(true)
  const [message, setMessage] = useState("Starting game...")

  useEffect(() => {
    // Simulate game loading
    const timer = setTimeout(() => {
      setIsLoading(false)
    }, 1500)

    return () => clearTimeout(timer)
  }, [])

  useEffect(() => {
    const iframe = document.getElementById("game-frame") as HTMLIFrameElement;
    if (iframe) {
      const cw: any = iframe.contentWindow;

      cw.onload = () => {
        cw.console.log = new Proxy(cw.console.log, {
            apply: function(target, thisArg, argumentsList) {
                if (argumentsList[0] === 'start game called') {
                    setTimeout(() => start(), 500);
                }

                return Reflect.apply(target, thisArg, argumentsList);
            }
        });
    }

    const start = () => {
        cw.dispatchEvent(new PointerEvent('pointerdown', {clientX: cw.innerWidth/2, clientY: cw.innerHeight/2}));

        cw.AudioDOMHandler.prototype._Play = new Proxy(cw.AudioDOMHandler.prototype._Play, {
        apply: (target, thisArg, argumentsList) => {
            console.log(argumentsList[0].originalUrl)

            if (argumentsList[0].originalUrl === "file") {
                cw.globalVars.p1Score = 0;
                cw.globalVars.p2Score = 0;
            }

            if (argumentsList[0].originalUrl === "start") {
              setMessage("");

                setTimeout(() => {
                    cw.dispatchEvent(new PointerEvent('pointerup'));
                }, 2000);
            }

            return false;
        }});
    }
    }
  }, [isLoading])

  function cancer() {
    return `<style>

    @keyframes idk {
        0% {
            transform: rotate3d(1, 1, 1, 90deg);
}
        25% {
            transform: rotate3d(0, 0, 0, 0deg);
}
        40% {
            transform: rotate3d(-1, 1, 0, 80deg);
}
        70% {
            transform: rotate3d(1, 2, 1, 9deg);
}
        100% {
            transform: rotate3d(1, 1, 1, 90deg);
}
}
</style>`;
  }

  const toggleFullscreen = () => {
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      document.getElementById('gamecont')!.requestFullscreen();
    }
  }

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <div className="w-12 h-12 border-4 border-t-primary rounded-full animate-spin"></div>
          <p className="mt-4 text-lg">Loading Assets...</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      <Card className="overflow-hidden" id="gamecont">
        <CardHeader className="bg-muted py-4">
          <CardTitle className="flex items-center justify-between">
            <span>Game Started</span>
            <div onClick={toggleFullscreen} className={"border border-input cursor-pointer p-2 rounded-sm h-full transition duration-100 ease-in-out hover:bg-primary/50"}>
              <Fullscreen className="text-white" />
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0 relative">
          {
            message &&
            (<>
              <div className="absolute inset-0 bg-black opacity-85"></div>
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-12 h-12 border-4 border-t-primary rounded-full animate-spin"></div>
                <span className="absolute top-16 text-lg text-white">{message}</span>
              </div>
            </>)
          }
          {/* Game iframe */}
          <div className="flex items-center justify-center bg-black aspect-video">
            <iframe src="/play.html" className="w-full h-full" title="Game" id="game-frame"></iframe>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

