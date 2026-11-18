/** Hidden test-only replay routing. Public experience is ALWAYS real-time. */
export function gta6TestSeconds(search: string): number | null {
  const query = search.startsWith('?') ? search.slice(1) : search;
  const params = new URLSearchParams(query);
  const explicit = params.get('simular');
  const compact = [...params.keys()].find(key => /^simular\d+$/.test(key));
  // Support the user's shorthand ?moment=gta6%simular45 as a legacy alias.
  const legacy = params.get('moment')?.match(/^gta6%simular(\d+)$/)?.[1];
  const raw = explicit ?? compact?.replace('simular','') ?? legacy;
  if (!raw || !/^\d{1,4}$/.test(raw)) return null;
  const n = Number(raw);
  return Number.isInteger(n) && n >= 1 && n <= 3600 ? n : null;
}

export function isGta6MomentUrl(search: string): boolean {
  const params = new URLSearchParams(search);
  const moment = params.get('moment');
  return moment === 'gta6' || /^gta6%simular\d+$/.test(moment ?? '');
}
