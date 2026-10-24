/**
 * Steam live signal source for World Pulse.
 *
 * Uses Valve's public GetNumberOfCurrentPlayers endpoint. This is a curated
 * sample of Steam AppIDs, NOT the global Steam top list and NOT visitors to
 * World Pulse. Never place these counts in the participant globe heatmap.
 *
 * Docs: https://partner.steamgames.com/doc/webapi/ISteamUserStats
 */
export const TRACKED_GAMES = Object.freeze([
  { appid: 730, name: 'Counter-Strike 2' },
  { appid: 570, name: 'Dota 2' },
  { appid: 578080, name: 'PUBG: BATTLEGROUNDS' },
  { appid: 1172470, name: 'Apex Legends' },
  { appid: 252490, name: 'Rust' },
  { appid: 1091500, name: 'Cyberpunk 2077' },
  { appid: 1245620, name: 'ELDEN RING' },
  { appid: 1174180, name: 'Red Dead Redemption 2' },
  { appid: 1086940, name: "Baldur's Gate 3" },
  { appid: 413150, name: 'Stardew Valley' },
  { appid: 275850, name: "No Man's Sky" },
  { appid: 105600, name: 'Terraria' },
  { appid: 381210, name: 'Dead by Daylight' },
  { appid: 1623730, name: 'Palworld' },
  { appid: 553850, name: 'HELLDIVERS 2' },
  { appid: 292030, name: 'The Witcher 3: Wild Hunt' }
]);

const BASE = 'https://api.steampowered.com/ISteamUserStats/GetNumberOfCurrentPlayers/v1/';

export class SteamUnavailableError extends Error {
  constructor() {
    super('Nenhum dado Steam está disponível agora.');
    this.name = 'SteamUnavailableError';
  }
}

export function validateSteamCount(payload) {
  const response = payload?.response;
  if (!response || response.result !== 1 || !Number.isSafeInteger(response.player_count) || response.player_count < 0) {
    throw new SteamUnavailableError();
  }
  return response.player_count;
}

export async function fetchSteamGame(game, fetcher = fetch, timeoutMs = 4500) {
  const url = new URL(BASE);
  url.searchParams.set('appid', String(game.appid));
  const result = await fetcher(url.toString(), {
    method: 'GET',
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(timeoutMs)
  });
  if (!result.ok) throw new SteamUnavailableError();
  const count = validateSteamCount(await result.json());
  return {
    appid: game.appid,
    name: game.name,
    currentPlayers: count,
    storeUrl: 'https://store.steampowered.com/app/' + game.appid + '/'
  };
}

export async function getSteamSnapshot({
  fetcher = fetch,
  games = TRACKED_GAMES,
  timeoutMs = 4500,
  now = () => new Date()
} = {}) {
  // Every URL uses one of our fixed numeric IDs, never arbitrary user input.
  const observed = await Promise.all(games.map(game =>
    fetchSteamGame(game, fetcher, timeoutMs).catch(() => null)
  ));
  const valid = observed.filter(Boolean);
  if (valid.length === 0) throw new SteamUnavailableError();
  valid.sort((a, b) => b.currentPlayers - a.currentPlayers || a.name.localeCompare(b.name));
  return {
    source: 'Steam Web API',
    scope: 'curated_sample',
    capturedAt: now().toISOString(),
    monitoredGames: games.length,
    successfulGames: valid.length,
    games: valid
  };
}
