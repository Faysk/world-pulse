import { getSteamSnapshot, SteamUnavailableError } from '../server/steam.mjs';

/**
 * GET /api/steam — Steam players online in a CURATED SAMPLE.
 * Edge caches for five minutes to avoid 16 outbound Steam calls per visitor.
 * Never exposes Steam API keys or changes World Pulse participation records.
 */
export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    res.setHeader('Cache-Control', 'no-store');
    return res.status(405).end(JSON.stringify({ error: 'method_not_allowed' }));
  }
  try {
    const snapshot = await getSteamSnapshot();
    res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600');
    return res.status(200).end(JSON.stringify(snapshot));
  } catch (error) {
    // No synthetic/previous count is ever fabricated on a Steam outage.
    if (!(error instanceof SteamUnavailableError)) {
      console.error('Steam feed failed:', error?.name || 'unknown');
    }
    res.setHeader('Cache-Control', 'no-store');
    return res.status(502).end(JSON.stringify({ error: 'steam_unavailable', message: 'A Steam está indisponível temporariamente.' }));
  }
}
