/**
 * World Pulse GTA VI World Moment: an ILLUSTRATIVE geographic midnight wave.
 * GTA VI launch date is 19 November 2026 (Rockstar Games Support).
 * IANA tzdb zone.tab coordinates describe *civil time*, NOT game storefront
 * entitlements or commercial availability in any given territory.
 * Static data (172 regions / 211 civil-time windows) generated 2026-11-17
 * from https://raw.githubusercontent.com/eggert/tz/main/zone.tab,
 * clipped to the existing Natural Earth 110m atlas coverage.
 * Areas with several time zones use approximate longitudinal partitioning.
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
  windows: readonly ReleaseWindow[];
};

export const RELEASE_REGIONS: readonly ReleaseRegion[] = countryData.map(region => ({
  code: region.code,
  label: region.label,
  anchor: region.anchor as [number, number],
  color: region.color,
  timeZone: region.windows[0].timeZone,
  unlockAt: region.windows[0].unlockAt,
  reference: region.windows.length > 1,
  windows: region.windows.map(window => ({
    timeZone: window.timeZone,
    unlockAt: window.unlockAt,
    anchor: window.anchor as [number, number],
    offsetMinutes: window.offsetMinutes
  }))
}));

export const SOURCE_URL =
  'https://support.rockstargames.com/articles/29jV3Cv2cCgvwM1XgtMO5o/grand-theft-auto-vi-regional-pre-load-and-release-times-on-playstation-5-and-xbox-series-x-or-s';

export const RELEASE_WINDOWS = RELEASE_REGIONS.flatMap(region =>
  region.windows.map(window => ({ region, window }))
).sort((a, b) => Date.parse(a.window.unlockAt) - Date.parse(b.window.unlockAt));

export const firstUnlock = Date.parse(RELEASE_WINDOWS[0].window.unlockAt);
export const lastUnlock = Date.parse(RELEASE_WINDOWS[RELEASE_WINDOWS.length - 1].window.unlockAt);
export const previewStart = firstUnlock - 30 * 60_000;
export const previewEnd = lastUnlock + 80 * 60_000;

/** True only when ALL mapped time zones in a territory have reached midnight. */
export function isReleased(region: ReleaseRegion, now: number): boolean {
  return region.windows.every(window => now >= Date.parse(window.unlockAt));
}
export function releasedWindows(region: ReleaseRegion, now: number): number {
  return region.windows.filter(window => now >= Date.parse(window.unlockAt)).length;
}

export function revealProgress(window: ReleaseWindow, now: number, simulated: boolean): number {
  const duration = simulated ? 75 * 60_000 : 3_600;
  const linear = Math.max(0, Math.min(1, (now - Date.parse(window.unlockAt)) / duration));
  return 1 - Math.pow(1 - linear, 2);
}

/** The next *time zone window*, not merely the first time zone of each country. */
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
