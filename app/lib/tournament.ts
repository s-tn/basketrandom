import prisma from "@/lib/prisma"

// ─── generateBracket ─────────────────────────────────────────────────────────

export async function generateBracket(tournamentId: string) {
  const tournament = await prisma.tournament.findUniqueOrThrow({
    where: { id: tournamentId },
    include: { participants: true },
  })

  if (!tournament || tournament.participants.length < 2) {
    throw new Error('Need at least 2 participants');
  }

  const participants = [...tournament.participants]

  // Fisher-Yates shuffle for random seeding
  for (let i = participants.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[participants[i], participants[j]] = [participants[j], participants[i]]
  }

  // Next power of 2 >= participant count
  const bracketSize = Math.pow(2, Math.ceil(Math.log2(participants.length)))
  const totalRounds = Math.log2(bracketSize)

  // Pad with nulls for byes
  const seeded: (typeof participants[number] | null)[] = [...participants]
  while (seeded.length < bracketSize) seeded.push(null)

  // Create round 0 matches
  const round0Matches: { player0Id: string | null; player1Id: string | null; isBye: boolean; byeWinnerId: string | null }[] = []

  for (let i = 0; i < bracketSize; i += 2) {
    const p0 = seeded[i]
    const p1 = seeded[i + 1]
    const isBye = p0 === null || p1 === null
    const byeWinnerId = isBye ? (p0?.id ?? p1?.id ?? null) : null
    round0Matches.push({
      player0Id: p0?.id ?? null,
      player1Id: p1?.id ?? null,
      isBye,
      byeWinnerId,
    })
  }

  // Create round 0 in DB
  const createdRound0: { id: string; matchIndex: number; winnerId: string | null; isBye: boolean }[] = []

  for (let i = 0; i < round0Matches.length; i++) {
    const m = round0Matches[i]
    const match = await prisma.tournamentMatch.create({
      data: {
        tournamentId,
        round: 0,
        matchIndex: i,
        player0Id: m.player0Id,
        player1Id: m.player1Id,
        winnerId: m.isBye ? m.byeWinnerId : null,
        status: m.isBye ? "completed" : "pending",
      },
    })
    createdRound0.push({ id: match.id, matchIndex: i, winnerId: m.isBye ? m.byeWinnerId : null, isBye: m.isBye })
  }

  // Create placeholder matches for subsequent rounds
  for (let round = 1; round < totalRounds; round++) {
    const matchCount = bracketSize / Math.pow(2, round + 1)
    for (let i = 0; i < matchCount; i++) {
      await prisma.tournamentMatch.create({
        data: {
          tournamentId,
          round,
          matchIndex: i,
          player0Id: null,
          player1Id: null,
          status: "pending",
        },
      })
    }
  }

  // Auto-advance bye winners to round 1
  for (const m of createdRound0) {
    if (m.isBye && m.winnerId) {
      await advanceWinner(tournamentId, 0, m.matchIndex, m.winnerId)
    }
  }

  // Mark tournament in progress
  await prisma.tournament.update({
    where: { id: tournamentId },
    data: { status: "in_progress" },
  })
}

// ─── advanceWinner ────────────────────────────────────────────────────────────

export async function advanceWinner(
  tournamentId: string,
  round: number,
  matchIndex: number,
  winnerId: string
) {
  const nextRound = round + 1
  const nextMatchIndex = Math.floor(matchIndex / 2)
  const isPlayer0 = matchIndex % 2 === 0

  const nextMatch = await prisma.tournamentMatch.findFirst({
    where: { tournamentId, round: nextRound, matchIndex: nextMatchIndex },
  })

  if (!nextMatch) {
    // No next match — tournament is complete
    await prisma.tournament.update({
      where: { id: tournamentId },
      data: { status: "completed" },
    })
    return
  }

  await prisma.tournamentMatch.update({
    where: { id: nextMatch.id },
    data: isPlayer0 ? { player0Id: winnerId } : { player1Id: winnerId },
  })
}

// ─── completeMatch ────────────────────────────────────────────────────────────

export async function completeMatch(roomId: string, winnerIndex: number) {
  const match = await prisma.tournamentMatch.findUnique({
    where: { roomId },
    include: { player0: true, player1: true },
  })

  if (!match) return; // Not a tournament match — normal room, skip

  const winnerId = winnerIndex === 0 ? match.player0Id : match.player1Id
  if (!winnerId) return; // Winner participant not found

  const loserId = winnerIndex === 0 ? match.player1Id : match.player0Id

  // Update match
  await prisma.tournamentMatch.update({
    where: { id: match.id },
    data: { winnerId, status: "completed" },
  })

  // Update winner stats
  await prisma.tournamentParticipant.update({
    where: { id: winnerId },
    data: { wins: { increment: 1 } },
  })

  // Update loser stats
  if (loserId) {
    await prisma.tournamentParticipant.update({
      where: { id: loserId },
      data: { losses: { increment: 1 }, eliminated: true },
    })
  }

  await advanceWinner(match.tournamentId, match.round, match.matchIndex, winnerId)
}

// ─── generateRoundRobin ───────────────────────────────────────────────────────

export async function generateRoundRobin(tournamentId: string) {
  const tournament = await prisma.tournament.findUniqueOrThrow({
    where: { id: tournamentId },
    include: { participants: true },
  })

  const players: (typeof tournament.participants[number] | null)[] = [...tournament.participants]

  // Circle method requires even count — add null placeholder if odd
  if (players.length % 2 !== 0) players.push(null)

  const n = players.length
  const rounds = n - 1
  const matchesPerRound = n / 2

  let matchIndex = 0

  for (let round = 0; round < rounds; round++) {
    for (let i = 0; i < matchesPerRound; i++) {
      const p0 = players[i]
      const p1 = players[n - 1 - i]

      // Skip bye matches (null placeholder)
      if (p0 === null || p1 === null) continue

      await prisma.tournamentMatch.create({
        data: {
          tournamentId,
          round,
          matchIndex: matchIndex++,
          player0Id: p0.id,
          player1Id: p1.id,
          status: "pending",
        },
      })
    }

    // Rotate: keep players[0] fixed, rotate the rest
    const last = players.pop()!
    players.splice(1, 0, last)
  }

  await prisma.tournament.update({
    where: { id: tournamentId },
    data: { status: "in_progress" },
  })
}

// ─── createMatchRoom ──────────────────────────────────────────────────────────

export async function createMatchRoom(matchId: string) {
  const match = await prisma.tournamentMatch.findUniqueOrThrow({
    where: { id: matchId },
    include: { player0: true, player1: true, tournament: true },
  })

  const roomId = Math.random().toString(36).slice(2, 10)

  const isPrivate = match.tournament.private || match.tournament.streamed

  const room = await prisma.room.create({
    data: {
      id: roomId,
      name: `Tournament Match — ${match.player0?.playerName ?? "TBD"} vs ${match.player1?.playerName ?? "TBD"}`,
      host: match.player0?.playerName ?? "TBD",
      tournament: true,
      private: isPrivate,
    },
  })

  await prisma.tournamentMatch.update({
    where: { id: matchId },
    data: { roomId, status: "live" },
  })

  return room
}
