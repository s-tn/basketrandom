import prisma from "./prisma";
import { calculateElo } from "./elo";

export async function updateRankedElo(winnerName: string, loserName: string) {
  const winner = await prisma.player.upsert({
    where: { name: winnerName },
    create: { name: winnerName },
    update: {},
  });
  const loser = await prisma.player.upsert({
    where: { name: loserName },
    create: { name: loserName },
    update: {},
  });

  const { newWinner, newLoser } = calculateElo(winner.elo, loser.elo);

  await prisma.player.update({
    where: { id: winner.id },
    data: { elo: newWinner, wins: { increment: 1 } },
  });
  await prisma.player.update({
    where: { id: loser.id },
    data: { elo: newLoser, losses: { increment: 1 } },
  });

  return { winnerElo: newWinner, loserElo: newLoser };
}
