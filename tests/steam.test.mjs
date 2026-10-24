import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  TRACKED_GAMES, fetchSteamGame, getSteamSnapshot,
  validateSteamCount, SteamUnavailableError
} from '../server/steam.mjs';
import handler from '../api/steam.mjs';

function mockPlayerCount(map) {
  return async url => {
    const appid = Number(new URL(url).searchParams.get('appid'));
    if (!map.has(appid)) return new Response('failure', { status: 503 });
    const count = map.get(appid);
    return Response.json({ response: { result: 1, player_count: count } });
  };
}
function mockRes() {
  return {
    statusCode: 200, headers: {}, payload: null,
    setHeader(key, value) { this.headers[key] = value; return this; },
    status(code) { this.statusCode = code; return this; },
    end(payload) { this.payload = JSON.parse(payload); return this; }
  };
}

test('All Steam games have stable distinct valid AppIDs', () => {
  assert.ok(TRACKED_GAMES.length >= 10);
  assert.equal(new Set(TRACKED_GAMES.map(g => g.appid)).size, TRACKED_GAMES.length);
  assert.ok(TRACKED_GAMES.every(g => Number.isInteger(g.appid) && g.appid > 0 && g.name));
});

test('Steam only accepts successful, finite counts', () => {
  assert.equal(validateSteamCount({ response: { result: 1, player_count: 0 } }), 0);
  assert.equal(validateSteamCount({ response: { result: 1, player_count: 456 } }), 456);
  for (const value of [-1, 1.5, NaN, Infinity, undefined, '100']) {
    assert.throws(() => validateSteamCount({ response: { result: 1, player_count: value } }), SteamUnavailableError);
  }
  assert.throws(() => validateSteamCount({ response: { result: 0, player_count: 100 } }), SteamUnavailableError);
});

test('Snapshot ranks real API counts and labels coverage as a curated sample', async () => {
  const games = [
    { appid: 730, name: 'Counter-Strike 2' },
    { appid: 570, name: 'Dota 2' },
    { appid: 413150, name: 'Stardew Valley' }
  ];
  const snapshot = await getSteamSnapshot({
    games,
    fetcher: mockPlayerCount(new Map([[730, 300], [570, 200], [413150, 13]])),
    now: () => new Date('2026-10-24T00:00:00.000Z')
  });
  assert.equal(snapshot.scope, 'curated_sample');
  assert.equal(snapshot.source, 'Steam Web API');
  assert.equal(snapshot.capturedAt, '2026-10-24T00:00:00.000Z');
  assert.deepEqual(snapshot.games.map(g => g.appid), [730, 570, 413150]);
  assert.deepEqual(snapshot.games.map(g => g.currentPlayers), [300, 200, 13]);
  assert.equal(snapshot.monitoredGames, 3);
  assert.equal(snapshot.successfulGames, 3);
});

test('Failed games are omitted, never replaced by invented zeros', async () => {
  const snapshot = await getSteamSnapshot({
    games: [{ appid: 730, name: 'CS2' }, { appid: 570, name: 'Dota 2' }],
    fetcher: mockPlayerCount(new Map([[730, 777]]))
  });
  assert.equal(snapshot.successfulGames, 1);
  assert.equal(snapshot.games[0].currentPlayers, 777);
  assert.equal(snapshot.games.some(g => g.appid === 570), false);
});

test('If all Steam calls fail, fail explicitly instead of showing fake data', async () => {
  await assert.rejects(getSteamSnapshot({
    games: [{ appid: 730, name: 'CS2' }],
    fetcher: async () => new Response('offline', { status: 503 })
  }), SteamUnavailableError);
});

test('Steam requests query only predefined numeric AppIDs', async () => {
  const observed = [];
  const game = TRACKED_GAMES[0];
  const result = await fetchSteamGame(game, async url => {
    observed.push(new URL(url));
    return Response.json({ response: { result: 1, player_count: 1 } });
  });
  assert.equal(observed[0].origin, 'https://api.steampowered.com');
  assert.equal(observed[0].searchParams.get('appid'), String(game.appid));
  assert.equal(result.storeUrl, 'https://store.steampowered.com/app/' + game.appid + '/');
});

test('Steam API rejects write methods before any upstream network request', async () => {
  const response = mockRes();
  await handler({ method: 'POST' }, response);
  assert.equal(response.statusCode, 405);
  assert.equal(response.headers.Allow, 'GET');
  assert.equal(response.headers['Cache-Control'], 'no-store');
});
