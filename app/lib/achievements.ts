import prisma from "./prisma";

export interface AchievementDef {
  id: string;
  name: string;
  description: string;
  icon: string;
}

export const ACHIEVEMENTS: AchievementDef[] = [
  { id: 'first_win', name: 'First Victory', description: 'Win your first match', icon: '🏆' },
  { id: 'ten_wins', name: 'Veteran', description: 'Win 10 matches', icon: '⭐' },
  { id: 'fifty_wins', name: 'Legend', description: 'Win 50 matches', icon: '👑' },
  { id: 'hundred_goals', name: 'Sharpshooter', description: 'Score 100 total goals', icon: '🎯' },
  { id: 'five_hundred_goals', name: 'Goal Machine', description: 'Score 500 total goals', icon: '🔥' },
  { id: 'perfect_game', name: 'Perfect Game', description: 'Win a round without opponent scoring', icon: '💎' },
  { id: 'comeback', name: 'Comeback King', description: 'Win a series after being down 0-2', icon: '🔄' },
  { id: 'tournament_win', name: 'Champion', description: 'Win a tournament', icon: '🏅' },
  { id: 'ten_streak', name: 'On Fire', description: 'Win 10 matches in a row', icon: '🔥' },
  { id: 'play_2v2', name: 'Team Player', description: 'Play a 2v2 match', icon: '🤝' },
  { id: 'first_clip', name: 'Highlight Reel', description: 'Save your first clip', icon: '🎬' },
  { id: 'ranked_1200', name: 'Rising Star', description: 'Reach 1200 ELO', icon: '📈' },
  { id: 'ranked_1500', name: 'Elite', description: 'Reach 1500 ELO', icon: '🌟' },
];

export async function unlockAchievement(playerName: string, achieveId: string): Promise<boolean> {
  const def = ACHIEVEMENTS.find(a => a.id === achieveId);
  if (!def) return false;

  try {
    await prisma.achievement.create({
      data: { playerName, achieveId },
    });
    return true; // Newly unlocked
  } catch {
    return false; // Already unlocked (unique constraint)
  }
}

export async function getPlayerAchievements(playerName: string) {
  const unlocked = await prisma.achievement.findMany({
    where: { playerName },
    orderBy: { unlockedAt: 'desc' },
  });

  return ACHIEVEMENTS.map(def => ({
    ...def,
    unlocked: unlocked.some(u => u.achieveId === def.id),
    unlockedAt: unlocked.find(u => u.achieveId === def.id)?.unlockedAt || null,
  }));
}

// Check achievements after a match
export async function checkMatchAchievements(playerName: string, stats: {
  won: boolean;
  goalsScored: number;
  opponentGoals: number;
  totalWins: number;
  totalGoals: number;
  seriesScore: [number, number]; // [myWins, opponentWins] before this win
  is2v2: boolean;
}) {
  const unlocked: string[] = [];

  if (stats.won && stats.totalWins >= 1) {
    if (await unlockAchievement(playerName, 'first_win')) unlocked.push('first_win');
  }
  if (stats.won && stats.totalWins >= 10) {
    if (await unlockAchievement(playerName, 'ten_wins')) unlocked.push('ten_wins');
  }
  if (stats.won && stats.totalWins >= 50) {
    if (await unlockAchievement(playerName, 'fifty_wins')) unlocked.push('fifty_wins');
  }
  if (stats.totalGoals >= 100) {
    if (await unlockAchievement(playerName, 'hundred_goals')) unlocked.push('hundred_goals');
  }
  if (stats.totalGoals >= 500) {
    if (await unlockAchievement(playerName, 'five_hundred_goals')) unlocked.push('five_hundred_goals');
  }
  if (stats.won && stats.opponentGoals === 0) {
    if (await unlockAchievement(playerName, 'perfect_game')) unlocked.push('perfect_game');
  }
  if (stats.won && stats.seriesScore[0] === 0 && stats.seriesScore[1] >= 2) {
    if (await unlockAchievement(playerName, 'comeback')) unlocked.push('comeback');
  }
  if (stats.is2v2) {
    if (await unlockAchievement(playerName, 'play_2v2')) unlocked.push('play_2v2');
  }

  return unlocked;
}
