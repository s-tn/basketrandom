import prisma from "./prisma";

// Get or create the current season (7-day seasons)
export async function getCurrentSeason() {
  let active = await prisma.season.findFirst({ where: { active: true } });

  if (!active || new Date() > active.endDate) {
    // End current season and create new one
    if (active) {
      await endSeason(active.id);
    }

    const lastSeason = await prisma.season.findFirst({ orderBy: { number: "desc" } });
    const newNumber = (lastSeason?.number || 0) + 1;
    const start = new Date();
    const end = new Date(start.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 days

    active = await prisma.season.create({
      data: { number: newNumber, startDate: start, endDate: end, active: true },
    });
  }

  return active;
}

async function endSeason(seasonId: string) {
  // Award titles to top players
  const standings = await prisma.seasonStanding.findMany({
    where: { seasonId },
    orderBy: { wins: "desc" },
    take: 10,
  });

  const season = await prisma.season.findUnique({ where: { id: seasonId } });
  if (!season) return;

  const rewards = [
    { rank: 0, title: "Season Champion", badge: "👑" },
    { rank: 1, title: "Runner Up", badge: "🥈" },
    { rank: 2, title: "Third Place", badge: "🥉" },
  ];

  for (const reward of rewards) {
    if (standings[reward.rank]) {
      await prisma.seasonReward.create({
        data: {
          seasonNum: season.number,
          playerName: standings[reward.rank].playerName,
          title: reward.title,
          badge: reward.badge,
        },
      });
    }
  }

  // Top 10 get participation badge
  for (const standing of standings) {
    await prisma.seasonReward
      .create({
        data: {
          seasonNum: season.number,
          playerName: standing.playerName,
          title: "Top 10",
          badge: "⭐",
        },
      })
      .catch(() => {}); // Ignore duplicates
  }

  await prisma.season.update({ where: { id: seasonId }, data: { active: false } });
}

// Record a match result in the current season
export async function recordSeasonResult(
  winnerName: string,
  loserName: string,
  winnerGoals: number,
  loserGoals: number
) {
  const season = await getCurrentSeason();

  await prisma.seasonStanding.upsert({
    where: { seasonId_playerName: { seasonId: season.id, playerName: winnerName } },
    create: {
      seasonId: season.id,
      playerName: winnerName,
      wins: 1,
      goalsFor: winnerGoals,
      goalsAgainst: loserGoals,
    },
    update: {
      wins: { increment: 1 },
      goalsFor: { increment: winnerGoals },
      goalsAgainst: { increment: loserGoals },
    },
  });

  await prisma.seasonStanding.upsert({
    where: { seasonId_playerName: { seasonId: season.id, playerName: loserName } },
    create: {
      seasonId: season.id,
      playerName: loserName,
      losses: 1,
      goalsFor: loserGoals,
      goalsAgainst: winnerGoals,
    },
    update: {
      losses: { increment: 1 },
      goalsFor: { increment: loserGoals },
      goalsAgainst: { increment: winnerGoals },
    },
  });
}
