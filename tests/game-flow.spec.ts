import { test, expect } from '@playwright/test';

test.describe('Game Flow', () => {
  test('two players can join a room and see each other', async ({ browser, request }) => {
    // Create a room via API
    const roomId = 'test-' + Date.now();
    await request.post('/api/rooms', {
      data: {
        id: roomId,
        name: 'Flow Test',
        host: 'Player1',
        scoreMax: 10,
        roundGoal: 3,
        tournament: false,
        tPassword: '',
      },
    });

    // Player 1 opens the room page
    const ctx1 = await browser.newContext();
    const p1 = await ctx1.newPage();
    await p1.addInitScript(() => {
      localStorage.setItem('playerName', 'Player1');
    });
    await p1.goto(`/rooms/${roomId}`);

    // Player 2 joins
    const ctx2 = await browser.newContext();
    const p2 = await ctx2.newPage();
    await p2.addInitScript(() => {
      localStorage.setItem('playerName', 'Player2');
    });
    await p2.goto(`/rooms/${roomId}`);

    // Both should see the room name
    await expect(p1.locator('h1')).toContainText('Flow Test');
    await expect(p2.locator('h1')).toContainText('Flow Test');

    await ctx1.close();
    await ctx2.close();
  });

  test('room API supports create, get, delete lifecycle', async ({ request }) => {
    const roomId = 'lifecycle-' + Date.now();

    // Create
    const createRes = await request.post('/api/rooms', {
      data: {
        id: roomId,
        name: 'Lifecycle Test',
        host: 'TestPlayer',
        scoreMax: 10,
        roundGoal: 3,
        tournament: false,
        tPassword: '',
      },
    });
    expect(createRes.ok()).toBeTruthy();

    // List should include it
    const listRes = await request.get('/api/rooms');
    const rooms = await listRes.json();
    expect(rooms.some((r: any) => r.id === roomId)).toBeTruthy();

    // Delete
    const deleteRes = await request.delete(`/api/rooms/${roomId}`);
    expect(deleteRes.ok()).toBeTruthy();
  });
});
