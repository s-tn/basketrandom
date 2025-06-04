import { Separator } from "@radix-ui/react-dropdown-menu";

export default function GameResult({
    completed = false,
    winner = null,
    score = [0, 0],
    players = ["Player 1", "Player 2"],
    key = 0
}) {
    const color = (completed && winner !== null) ? 
        (winner === 0 ? "bg-primary/80" : "bg-foreground/50") :
        "bg-secondary";
    
    const p1lost = completed && winner === 1 && score[0] < score[1];
    const p2lost = completed && winner === 0 && score[1] < score[0];

    return (
        <div key={key} className={"flex flex-col border-r border-r-input last:border-none flex-1" + (completed ? "" : " opacity-30")}>
            <div className="flex-1 text-white px-4 py-4 flex flex-row items-center justify-center">
                <div className="flex flex-row gap-2 items-center justify-center">
                    <span className={"text-xs font-light" + (p1lost ? " text-gray-200/75" : "")}>{players[0]}</span>
                    <span className={"text-md" + (p1lost ? " text-gray-200/75" : "")}>{score[0]}</span>
                </div>
                <Separator className="w-1 h-8 bg-white mx-2" orientation="vertical" />
                <div className="flex flex-row gap-2 items-center justify-center">
                    <span className={"text-md" + (p2lost ? " text-gray-200/75" : "")}>{score[1]}</span>
                    <span className={"text-xs font-light" + (p2lost ? " text-gray-200/75" : "")}>{players[1]}</span>
                </div>
            </div>
            <div className={color + " w-full h-4"}></div>
        </div>
    )
}