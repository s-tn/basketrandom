import { test, expect } from '@playwright/test';

test.describe('Tournament API', () => {
  let tournamentId: string;

  test('can create a tournament', async ({ request }) => {
    const response = await request.post('/api/tournaments', {
      data: {
        name: 'Test Tournament',
        format: 'bracket',
        maxPlayers: 4,
        streamed: false,
        private: false,
        createdBy: 'TestHost',
      },
    });
    expect(response.ok()).toBeTruthy();
    const tournament = await response.json();
    expect(tournament.name).toBe('Test Tournament');
    expect(tournament.format).toBe('bracket');
    tournamentId = tournament.id;
  });

  test('can join a tournament', async ({ request }) => {
    // Create tournament first
    const createRes = await request.post('/api/tournaments', {
      data: {
        name: 'Join Test',
        format: 'bracket',
        maxPlayers: 8,
        createdBy: 'Host',
      },
    });
    const tournament = await createRes.json();

    // Join with 4 players
    for (const name of ['Player1', 'Player2', 'Player3', 'Player4']) {
      const joinRes = await request.post(`/api/tournaments/${tournament.id}`, {
        data: { action: 'join', playerName: name },
      });
      expect(joinRes.ok()).toBeTruthy();
    }

    // Verify participants
    const detailRes = await request.get(`/api/tournaments/${tournament.id}`);
    const detail = await detailRes.json();
    expect(detail.participants.length).toBe(4);
  });

  test('can start a bracket tournament and generate matches', async ({ request }) => {
    // Create and populate tournament
    const createRes = await request.post('/api/tournaments', {
      data: {
        name: 'Bracket Test',
        format: 'bracket',
        maxPlayers: 4,
        createdBy: 'Host',
      },
    });
    const tournament = await createRes.json();

    for (const name of ['A', 'B', 'C', 'D']) {
      await request.post(`/api/tournaments/${tournament.id}`, {
        data: { action: 'join', playerName: name },
      });
    }

    // Start tournament
    const startRes = await request.post(`/api/tournaments/${tournament.id}`, {
      data: { action: 'start' },
    });
    expect(startRes.ok()).toBeTruthy();

    // Verify matches generated
    const detail = await (await request.get(`/api/tournaments/${tournament.id}`)).json();
    expect(detail.status).toBe('in_progress');
    // 4 players = 2 round-1 matches + 1 final = 3 total matches
    expect(detail.matches.length).toBe(3);
    // Round 1 matches should have players assigned
    const round1 = detail.matches.filter((m: any) => m.round === 1);
    expect(round1.length).toBe(2);
    expect(round1[0].player0).not.toBeNull();
    expect(round1[0].player1).not.toBeNull();
  });

  test('can list tournaments', async ({ request }) => {
    const response = await request.get('/api/tournaments');
    expect(response.ok()).toBeTruthy();
    const tournaments = await response.json();
    expect(Array.isArray(tournaments)).toBeTruthy();
    expect(tournaments.length).toBeGreaterThan(0);
  });
});
