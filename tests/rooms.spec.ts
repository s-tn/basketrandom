import { test, expect } from '@playwright/test';

test.describe('Room API', () => {
  test('can create a room via API', async ({ request }) => {
    const response = await request.post('/api/rooms', {
      data: {
        id: 'test-' + Date.now(),
        name: 'Test Room',
        host: 'Player1',
        scoreMax: 10,
        roundGoal: 3,
        tournament: false,
        tPassword: '',
      },
    });
    expect(response.ok()).toBeTruthy();
    const room = await response.json();
    expect(room.name).toBe('Test Room');
    expect(room.host).toBe('Player1');
  });

  test('can list rooms via API', async ({ request }) => {
    const response = await request.get('/api/rooms');
    expect(response.ok()).toBeTruthy();
    const rooms = await response.json();
    expect(Array.isArray(rooms)).toBeTruthy();
  });
});
