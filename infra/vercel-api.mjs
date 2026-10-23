export function vercelApi({ token, team, fetcher = fetch }) {
  return async (path, options = {}) => {
    const url = new URL(`https://api.vercel.com${path}`);
    url.searchParams.set('teamId', team);
    const response = await fetcher(url, { ...options,
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(30_000),
    });
    if (!response.ok) throw Object.assign(new Error('Vercel API request failed'), { providerStatus: response.status });
    // Promotion may succeed with HTTP 204 and no JSON representation.
    const body = await response.text();
    return body.trim() ? JSON.parse(body) : {};
  };
}
