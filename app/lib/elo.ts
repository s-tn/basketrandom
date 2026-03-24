const K = 32; // K-factor

export function calculateElo(winnerElo: number, loserElo: number): { newWinner: number; newLoser: number } {
  const expectedWinner = 1 / (1 + Math.pow(10, (loserElo - winnerElo) / 400));
  const expectedLoser = 1 / (1 + Math.pow(10, (winnerElo - loserElo) / 400));

  const newWinner = Math.round(winnerElo + K * (1 - expectedWinner));
  const newLoser = Math.round(loserElo + K * (0 - expectedLoser));

  return { newWinner, newLoser: Math.max(newLoser, 100) }; // Floor at 100
}
