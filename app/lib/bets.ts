import prisma from "./prisma";

export async function resolveBets(roomId: string, winner: number) {
  const bets = await prisma.bet.findMany({
    where: { roomId, resolved: false },
  });

  if (bets.length === 0) return;

  // Calculate total pool and winner pool
  const totalPool = bets.reduce((sum, b) => sum + b.amount, 0);
  const winnerPool = bets.filter(b => b.predictedWinner === winner).reduce((sum, b) => sum + b.amount, 0);

  for (const bet of bets) {
    const won = bet.predictedWinner === winner;
    let payout = 0;

    if (won && winnerPool > 0) {
      // Proportional payout from total pool
      payout = Math.floor((bet.amount / winnerPool) * totalPool);
    }

    await prisma.bet.update({
      where: { id: bet.id },
      data: { resolved: true, won, payout },
    });

    if (payout > 0) {
      await prisma.wallet.upsert({
        where: { playerName: bet.playerName },
        create: { playerName: bet.playerName, balance: 1000 + payout },
        update: { balance: { increment: payout } },
      });
    }
  }
}
