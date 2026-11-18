/**
 * GTA VI regional release clock. No fictional unlocks in the public map.
 * Rockstar confirms the November 19 midnight-per-market release policy.
 * Supported PS Store markets from Rockstar's published preorder country list.
 * Exact PlayStation Store UTC overrides where independently confirmed.
 */
import countryData from './assets/gta6-world-timezones.json' with { type: 'json' };
import {
  PLAYSTATION_SUPPORTED_CODES, PLAYSTATION_SUPPORTED_SET, EXACT_STORE_UNLOCKS,
  MARKET_CLOCK_ZONE, SMALL_STORE_MARKETS
} from './gta6MarketSources.ts';

export type ReleaseWindow = {
  timeZone: string;
  unlockAt: string;
  anchor: [number, number];
  offsetMinutes: number;
};
export type ReleaseRegion = {
  code: string;
  label: string;
  timeZone: string;
  unlockAt: string;
  anchor: [number, number];
  color: string;
  /** True when an explicit timestamp was checked in the PlayStation Store. */
  verified: boolean;
  /** True for supported markets whose midnight is derived from Rockstar's public release rule. */
  reference: boolean;
  storeUrl?: string;
  windows: readonly ReleaseWindow[];
};

export const VERIFIED_COUNTRY_CODES = Object.keys(EXACT_STORE_UNLOCKS).sort();
export const UNCONFIRMED_COUNTRY_CODES = ['RU', 'KP'] as const;
export const SOURCE_URL =
  'https://support.rockstargames.com/articles/29jV3Cv2cCgvwM1XgtMO5o/grand-theft-auto-vi-regional-pre-load-and-release-times-on-playstation-5-and-xbox-series-x-or-s';

/** Calculate 2026-11-19T00:00 in a named market's principal time zone. */
export function midnightOnLaunchDate(timeZone: string): string {
  const target = Date.UTC(2026, 10, 19);
  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23'
  });
  let utc = target + 12 * 3_600_000;
  for (let iteration = 0; iteration < 3; iteration++) {
    const parts = Object.fromEntries(formatter.formatToParts(new Date(utc))
      .filter(part => part.type !== 'literal')
      .map(part => [part.type, Number(part.value)]));
    const localAsUtc = Date.UTC(parts.year, parts.month - 1, parts.day,
      parts.hour, parts.minute, parts.second);
    const correction = target - localAsUtc;
    utc += correction;
    if (correction === 0) break;
  }
  return new Date(utc).toISOString();
}

function regionForMarket(
  market: { code:string;label:string;anchor:readonly number[];color:string;windows?:readonly {timeZone:string}[] },
  fallbackZone?: string
): ReleaseRegion {
  const direct = EXACT_STORE_UNLOCKS[market.code];
  const timeZone = MARKET_CLOCK_ZONE[market.code] ?? fallbackZone ?? market.windows?.[0]?.timeZone ?? 'Etc/UTC';
  const unlockAt = direct?.unlockAt ?? midnightOnLaunchDate(timeZone);
  const anchor: [number,number] = [market.anchor[0],market.anchor[1]];
  const window: ReleaseWindow = {
    timeZone, unlockAt, anchor,
    offsetMinutes: (Date.UTC(2026,10,19) - Date.parse(unlockAt)) / 60_000
  };
  return {
    code:market.code, label:market.label,anchor,color:market.color,
    timeZone,unlockAt,reference:!direct,verified:Boolean(direct),
    storeUrl:direct?.url,windows:[window]
  };
}

const supportedAtlas = countryData.filter(region => PLAYSTATION_SUPPORTED_SET.has(region.code));
const atlasCodes = new Set(supportedAtlas.map(region => region.code));
const smallMarketRegions = SMALL_STORE_MARKETS
  .filter(market => !atlasCodes.has(market.code))
  .map(market => regionForMarket(market, market.timeZone));

/** Only markets officially announced for GTA VI PS Store preorders. */
export const RELEASE_REGIONS: readonly ReleaseRegion[] = [
  ...supportedAtlas.map(region => regionForMarket(region)),
  ...smallMarketRegions
];

export const RELEASE_WINDOWS = RELEASE_REGIONS.flatMap(region =>
  region.windows.map(window => ({ region, window }))
).sort((a,b) => Date.parse(a.window.unlockAt) - Date.parse(b.window.unlockAt) ||
  a.region.label.localeCompare(b.region.label,'pt'));

export const RELEASE_COUNTRIES = [...RELEASE_REGIONS].sort((a,b) =>
  Date.parse(a.unlockAt) - Date.parse(b.unlockAt) || a.label.localeCompare(b.label,'pt'));
export const missingSupportedCodes = PLAYSTATION_SUPPORTED_CODES.filter(
  code => !RELEASE_REGIONS.some(region => region.code === code)
);

export const firstUnlock = Date.parse(RELEASE_WINDOWS[0].window.unlockAt);
export const lastUnlock = Date.parse(RELEASE_WINDOWS[RELEASE_WINDOWS.length-1].window.unlockAt);
export const previewStart = firstUnlock - 18 * 60_000;
export const previewEnd = lastUnlock + 45 * 60_000;

export function isReleased(region: ReleaseRegion, now: number): boolean {
  return now >= Date.parse(region.unlockAt);
}
export function releasedWindows(region: ReleaseRegion, now: number): number {
  return isReleased(region, now) ? 1 : 0;
}

/** Eased radial spread, real time by default and speed-scaled for URL-only tests. */
export function revealProgress(window: ReleaseWindow, now: number, simulated = false, testSeconds = 45): number {
  const duration = simulated
    ? Math.min(previewEnd-lastUnlock,
        Math.max(1_000, ((previewEnd-previewStart)/(Math.max(1,testSeconds)*1000))*1_600))
    : 5_500;
  const progress = Math.max(0,Math.min(1,(now-Date.parse(window.unlockAt))/duration));
  return progress*progress*(3-2*progress);
}
export function nextUnlock(now: number): {region:ReleaseRegion;window:ReleaseWindow}|undefined {
  return RELEASE_WINDOWS.find(item => Date.parse(item.window.unlockAt) > now);
}
export function nextMarkets(now:number, count=3): ReleaseRegion[] {
  return RELEASE_COUNTRIES.filter(region => Date.parse(region.unlockAt) > now).slice(0,count);
}
export function lastReleasedMarkets(now:number, count=3): ReleaseRegion[] {
  return RELEASE_COUNTRIES.filter(region => Date.parse(region.unlockAt) <= now)
    .reverse().slice(0,count);
}

/**
 * A single chronological headline, followed by three DISTINCT upcoming markets.
 * At each unlock boundary, the headline advances automatically to the next.
 * When all markets have unlocked, headline is null (the event is complete).
 */
export function launchTimeline(now: number): {
  headline: ReleaseRegion | null;
  upcoming: ReleaseRegion[];
  recent: ReleaseRegion[];
} {
  const queue = nextMarkets(now, 4);
  return {
    headline: queue[0] ?? null,
    upcoming: queue.slice(1),
    recent: lastReleasedMarkets(now, 3)
  };
}
export function remainingText(ms: number): string {
  if (ms <= 0) return '00:00:00';
  const seconds = Math.ceil(ms/1000);
  const days = Math.floor(seconds/86400);
  const hours = Math.floor(seconds/3600)%24;
  const minutes = Math.floor(seconds/60)%60;
  const secs = seconds%60;
  return (days ? days+'d ' : '')+
    String(hours).padStart(2,'0')+':'+
    String(minutes).padStart(2,'0')+':'+
    String(secs).padStart(2,'0');
}
export function formatRelease(window:ReleaseWindow): string {
  return new Intl.DateTimeFormat('pt-PT',{
    timeZone:window.timeZone,day:'2-digit',month:'short',hour:'2-digit',
    minute:'2-digit',hourCycle:'h23'
  }).format(new Date(window.unlockAt));
}

/**
 * Locale-stable headline date.
 *
 * Intl.DateTimeFormat.format() may yield "19/11, 00:00" on some browsers
 * and "19 nov. 00:00" on others, even for the same pt-PT options.
 * Use formatToParts to keep the live event headline consistent worldwide.
 */
export function formatReleaseHeadline(window: ReleaseWindow): string {
  const formatter = new Intl.DateTimeFormat('pt-PT', {
    timeZone: window.timeZone, day: '2-digit', month: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
  });
  const parts = Object.fromEntries(formatter.formatToParts(new Date(window.unlockAt))
    .filter(part => part.type !== 'literal')
    .map(part => [part.type, part.value]));
  const monthNames = ['JAN','FEV','MAR','ABR','MAI','JUN','JUL','AGO','SET','OUT','NOV','DEZ'];
  const month = monthNames[Number(parts.month)-1] ?? parts.month ?? '';
  return `${parts.day} ${month} · ${parts.hour}:${parts.minute}`;
}
