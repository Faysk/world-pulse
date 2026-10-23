/**
 * Independent domain rules for the visual POC.
 * No network, DOM, geolocation or persistent user identity here.
 *
 * Seconds are deliberately "credited seconds": +1 per eligible click/tap,
 * NOT elapsed wall-clock seconds.
 */
import type { TagId } from './demoData';

export type DemoSeconds = Record<TagId, number>;

export const EMPTY_SECONDS: Readonly<DemoSeconds> = Object.freeze({
  gta6: 0,
  minecraft: 0,
  lofi: 0
});

export function creditTap(seconds: DemoSeconds, active: TagId | null): DemoSeconds {
  if (!active) return seconds;
  return { ...seconds, [active]: seconds[active] + 1 };
}

export function creditedTotal(seconds: DemoSeconds): number {
  return Object.values(seconds).reduce((total, value) => total + value, 0);
}

/** Visual weight changes with DIFFERENT PARTICIPANTS, never taps. */
export function peopleDensityWeight(people: number): number {
  if (!Number.isFinite(people) || people <= 0) return 0;
  // Compress huge clusters while keeping small clusters visible.
  return Math.min(2.2, 0.19 + Math.log1p(people) / Math.log(200));
}

/** Add fade at street zoom so pixels resolve into crisp distinct light sources. */
export function heatVisibility(zoom: number): number {
  if (zoom <= 5) return 0.88;
  if (zoom >= 11.5) return 0;
  if (zoom <= 7) return 0.88 - (zoom - 5) * 0.04;
  return Math.max(0, 0.8 * (11.5 - zoom) / 4.5);
}

/** Only one active hashtag, but seconds stay attached to their original tag. */
export function chooseHashtag(current: TagId | null, next: TagId | null): TagId | null {
  return current === next ? current : next;
}
