/**
 * GTA VI release-window preview.
 * Source: Rockstar Games Support, checked 2026-11-17:
 * https://support.rockstargames.com/articles/29jV3Cv2cCgvwM1XgtMO5o/grand-theft-auto-vi-regional-pre-load-and-release-times-on-playstation-5-and-xbox-series-x-or-s
 *
 * Rockstar: midnight, 19 Nov 2026, local time in each store region.
 * Multizone countries below are MARKET REFERENCES, not verified state-level
 * entitlements. Their whole-country fills are a preview simplification.
 * Never represent this dataset as actual player activity.
 */

export type ReleaseRegion = {
  code: string;
  label: string;
  timeZone: string;
  unlockAt: string;
  anchor: [number, number];
  color: string;
  reference?: boolean;
};

export const RELEASE_REGIONS: readonly ReleaseRegion[] = [
  { code: 'NZ', label: 'Nova Zelândia', timeZone: 'Pacific/Auckland', unlockAt: '2026-11-18T11:00:00Z', anchor: [173, -41], color: '#fa7e9c' },
  { code: 'AU', label: 'Austrália · Sydney*', timeZone: 'Australia/Sydney', unlockAt: '2026-11-18T13:00:00Z', anchor: [134, -26], color: '#ffac77', reference: true },
  { code: 'JP', label: 'Japão', timeZone: 'Asia/Tokyo', unlockAt: '2026-11-18T15:00:00Z', anchor: [138, 37], color: '#fa7e9c' },
  { code: 'KR', label: 'Coreia do Sul', timeZone: 'Asia/Seoul', unlockAt: '2026-11-18T15:00:00Z', anchor: [128, 36], color: '#b77dfc' },
  { code: 'SG', label: 'Singapura', timeZone: 'Asia/Singapore', unlockAt: '2026-11-18T16:00:00Z', anchor: [103.8, 1.35], color: '#ffac77' },
  { code: 'PH', label: 'Filipinas', timeZone: 'Asia/Manila', unlockAt: '2026-11-18T16:00:00Z', anchor: [122, 12.8], color: '#a779f7' },
  { code: 'IN', label: 'Índia', timeZone: 'Asia/Kolkata', unlockAt: '2026-11-18T18:30:00Z', anchor: [78.9, 22], color: '#ffb96a' },
  { code: 'AE', label: 'Emirados Árabes Unidos', timeZone: 'Asia/Dubai', unlockAt: '2026-11-18T20:00:00Z', anchor: [54.3, 24.4], color: '#ffac77' },
  { code: 'TR', label: 'Turquia', timeZone: 'Europe/Istanbul', unlockAt: '2026-11-18T21:00:00Z', anchor: [35, 39], color: '#fa7e9c' },
  { code: 'ZA', label: 'África do Sul', timeZone: 'Africa/Johannesburg', unlockAt: '2026-11-18T22:00:00Z', anchor: [25, -29], color: '#aa80ff' },
  { code: 'GR', label: 'Grécia', timeZone: 'Europe/Athens', unlockAt: '2026-11-18T22:00:00Z', anchor: [23.9, 38.8], color: '#ffad7a' },
  { code: 'DE', label: 'Alemanha', timeZone: 'Europe/Berlin', unlockAt: '2026-11-18T23:00:00Z', anchor: [10.5, 51], color: '#fa7e9c' },
  { code: 'FR', label: 'França', timeZone: 'Europe/Paris', unlockAt: '2026-11-18T23:00:00Z', anchor: [2.5, 46.6], color: '#a77aff' },
  { code: 'ES', label: 'Espanha · continental*', timeZone: 'Europe/Madrid', unlockAt: '2026-11-18T23:00:00Z', anchor: [-4, 40], color: '#ffae75', reference: true },
  { code: 'IT', label: 'Itália', timeZone: 'Europe/Rome', unlockAt: '2026-11-18T23:00:00Z', anchor: [12.5, 42], color: '#fa7e9c' },
  { code: 'PT', label: 'Portugal · continental*', timeZone: 'Europe/Lisbon', unlockAt: '2026-11-19T00:00:00Z', anchor: [-8, 39.5], color: '#ffb06d', reference: true },
  { code: 'GB', label: 'Reino Unido', timeZone: 'Europe/London', unlockAt: '2026-11-19T00:00:00Z', anchor: [-2, 54], color: '#a87efa' },
  { code: 'BR', label: 'Brasil · Brasília*', timeZone: 'America/Sao_Paulo', unlockAt: '2026-11-19T03:00:00Z', anchor: [-51, -14], color: '#ffac77', reference: true },
  { code: 'AR', label: 'Argentina', timeZone: 'America/Argentina/Buenos_Aires', unlockAt: '2026-11-19T03:00:00Z', anchor: [-64, -36], color: '#ff7d9f' },
  { code: 'UY', label: 'Uruguai', timeZone: 'America/Montevideo', unlockAt: '2026-11-19T03:00:00Z', anchor: [-56, -33], color: '#b080ff' },
  { code: 'US', label: 'EUA · Nova Iorque*', timeZone: 'America/New_York', unlockAt: '2026-11-19T05:00:00Z', anchor: [-98, 39], color: '#a87efa', reference: true },
  { code: 'MX', label: 'México · Cidade do México*', timeZone: 'America/Mexico_City', unlockAt: '2026-11-19T06:00:00Z', anchor: [-102, 24], color: '#ffb66b', reference: true }
];

export const SOURCE_URL =
  'https://support.rockstargames.com/articles/29jV3Cv2cCgvwM1XgtMO5o/grand-theft-auto-vi-regional-pre-load-and-release-times-on-playstation-5-and-xbox-series-x-or-s';

export const firstUnlock = Math.min(...RELEASE_REGIONS.map(region => Date.parse(region.unlockAt)));
export const lastUnlock = Math.max(...RELEASE_REGIONS.map(region => Date.parse(region.unlockAt)));
export const previewStart = firstUnlock - 30 * 60_000;
export const previewEnd = lastUnlock + 80 * 60_000;

export function isReleased(region: ReleaseRegion, now: number): boolean {
  return now >= Date.parse(region.unlockAt);
}

export function revealProgress(region: ReleaseRegion, now: number, simulated: boolean): number {
  const duration = simulated ? 75 * 60_000 : 3_600;
  const linear = Math.max(0, Math.min(1, (now - Date.parse(region.unlockAt)) / duration));
  return 1 - Math.pow(1 - linear, 2); // ease out
}

export function nextUnlock(now: number): ReleaseRegion | undefined {
  return RELEASE_REGIONS.find(region => Date.parse(region.unlockAt) > now);
}

export function remainingText(ms: number): string {
  if (ms <= 0) return 'LIBERADO';
  const seconds = Math.ceil(ms / 1000);
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor(seconds / 3600) % 24;
  const minutes = Math.floor(seconds / 60) % 60;
  const secs = seconds % 60;
  return (days ? days + 'd ' : '') +
    String(hours).padStart(2, '0') + ':' +
    String(minutes).padStart(2, '0') + ':' +
    String(secs).padStart(2, '0');
}

export function formatRelease(region: ReleaseRegion): string {
  return new Intl.DateTimeFormat('pt-PT', {
    timeZone: region.timeZone, day: '2-digit', month: 'short',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
  }).format(new Date(region.unlockAt));
}
