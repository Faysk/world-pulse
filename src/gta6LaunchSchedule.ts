/**
 * GTA VI World Moment / single release instant per digital storefront market.
 *
 * Verified release instants below are copied from the PlayStation Store's
 * country product pages, not derived from device geolocation.
 * Sources, as inspected 2026-11-17:
 * US: https://store.playstation.com/en-us/product/EP1004-PPSA01547_00-GTAVISTANDARD001/
 * CA: https://store.playstation.com/en-ca/product/EP1004-PPSA01547_00-GTAVISTANDARD001/
 * BR: https://store.playstation.com/pt-br/product/EP1004-PPSA01547_00-GTAVISTANDARD001
 * PT: https://store.playstation.com/pt-pt/product/EP1004-PPSA01547_00-GTAVISTANDARD001
 *
 * Other countries retain an IANA-based ILLUSTRATIVE local midnight, without
 * an assertion of game availability or a verified digital-store unlock.
 * Russia and North Korea are excluded because a local GTA VI digital launch was not verified;
 * the geography stays visible but uncolored.
 */
import countryData from './assets/gta6-world-timezones.json' with { type: 'json' };

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
  reference: boolean;
  verified: boolean;
  storeUrl?: string;
  windows: readonly ReleaseWindow[];
};

const VERIFIED_STORES: Record<string, { utc: string; timeZone: string; url: string }> = {
  BR: {
    utc: '2026-11-19T03:00:00Z',
    timeZone: 'America/Sao_Paulo',
    url: 'https://store.playstation.com/pt-br/product/EP1004-PPSA01547_00-GTAVISTANDARD001'
  },
  US: {
    utc: '2026-11-19T05:00:00Z',
    timeZone: 'America/New_York',
    url: 'https://store.playstation.com/en-us/product/EP1004-PPSA01547_00-GTAVISTANDARD001/'
  },
  CA: {
    utc: '2026-11-19T05:00:00Z',
    timeZone: 'America/Toronto',
    url: 'https://store.playstation.com/en-ca/product/EP1004-PPSA01547_00-GTAVISTANDARD001/'
  },
  PT: {
    utc: '2026-11-19T00:00:00Z',
    timeZone: 'Europe/Lisbon',
    url: 'https://store.playstation.com/pt-pt/product/EP1004-PPSA01547_00-GTAVISTANDARD001'
  }
};

/** Main store-region approximation for countries without a checked store. */
const REFERENCE_TIME_ZONES: Record<string, string> = {
  AU: 'Australia/Sydney', NZ: 'Pacific/Auckland',
  MX: 'America/Mexico_City', ES: 'Europe/Madrid',
  CL: 'America/Santiago', ID: 'Asia/Jakarta',
  CN: 'Asia/Shanghai', GL: 'America/Nuuk',
  KZ: 'Asia/Almaty', UA: 'Europe/Kyiv'
};
export const VERIFIED_COUNTRY_CODES = Object.keys(VERIFIED_STORES).sort();
export const UNCONFIRMED_COUNTRY_CODES = ['RU', 'KP'] as const;

/** Convert 19 Nov 2026 local midnight to UTC using runtime IANA rules. */
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

export const RELEASE_REGIONS: readonly ReleaseRegion[] = countryData
  .filter(region => !UNCONFIRMED_COUNTRY_CODES.some(code => code === region.code))
  .map(region => {
    const store = VERIFIED_STORES[region.code];
    const timeZone = store?.timeZone ??
      REFERENCE_TIME_ZONES[region.code] ?? region.windows[0].timeZone;
    const unlockAt = store?.utc ?? midnightOnLaunchDate(timeZone);
    const window: ReleaseWindow = {
      timeZone,
      unlockAt,
      anchor: region.anchor as [number, number],
      offsetMinutes: (Date.UTC(2026, 10, 19) - Date.parse(unlockAt)) / 60_000
    };
    return {
      code: region.code,
      label: region.label,
      anchor: region.anchor as [number, number],
      color: region.color,
      timeZone,
      unlockAt,
      reference: !store,
      verified: Boolean(store),
      storeUrl: store?.url,
      windows: [window]
    };
  });

export const SOURCE_URL =
  'https://support.rockstargames.com/articles/29jV3Cv2cCgvwM1XgtMO5o/grand-theft-auto-vi-regional-pre-load-and-release-times-on-playstation-5-and-xbox-series-x-or-s';

export const RELEASE_WINDOWS = RELEASE_REGIONS.flatMap(region =>
  region.windows.map(window => ({ region, window }))
).sort((a, b) => Date.parse(a.window.unlockAt) - Date.parse(b.window.unlockAt));

export const firstUnlock = Date.parse(RELEASE_WINDOWS[0].window.unlockAt);
export const lastUnlock = Date.parse(RELEASE_WINDOWS[RELEASE_WINDOWS.length - 1].window.unlockAt);
export const previewStart = firstUnlock - 30 * 60_000;
export const previewEnd = lastUnlock + 80 * 60_000;

export function isReleased(region: ReleaseRegion, now: number): boolean {
  return now >= Date.parse(region.unlockAt);
}
export function releasedWindows(region: ReleaseRegion, now: number): number {
  return isReleased(region, now) ? 1 : 0;
}
export function revealProgress(window: ReleaseWindow, now: number, simulated: boolean): number {
  const duration = simulated ? 75 * 60_000 : 3_600;
  const linear = Math.max(0, Math.min(1, (now - Date.parse(window.unlockAt)) / duration));
  return 1 - Math.pow(1 - linear, 2);
}
export function nextUnlock(now: number): { region: ReleaseRegion; window: ReleaseWindow } | undefined {
  return RELEASE_WINDOWS.find(item => Date.parse(item.window.unlockAt) > now);
}

export function remainingText(ms: number): string {
  if (ms <= 0) return '00:00:00';
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
export function formatRelease(window: ReleaseWindow): string {
  return new Intl.DateTimeFormat('pt-PT', {
    timeZone: window.timeZone, day: '2-digit', month: 'short',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
  }).format(new Date(window.unlockAt));
}
