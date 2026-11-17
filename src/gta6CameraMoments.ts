import { RELEASE_REGIONS, type ReleaseRegion } from './gta6LaunchSchedule.ts';

export type UnlockMoment = {
  at: number;
  regions: readonly ReleaseRegion[];
  featured: readonly ReleaseRegion[];
  codes: readonly string[];
  center: [number, number];
  zoom: number;
  title: string;
  verified: boolean;
};

/**
 * Map the commercial release clock into camera cues. Do NOT treat individual
 * civil-time zones inside one country as separate launch moments.
 */
export function buildUnlockMoments(regions: readonly ReleaseRegion[]): UnlockMoment[] {
  const grouped = new Map<number, ReleaseRegion[]>();
  for (const region of regions) {
    const at = Date.parse(region.unlockAt);
    if (!Number.isFinite(at)) continue;
    const existing = grouped.get(at) ?? [];
    existing.push(region);
    grouped.set(at, existing);
  }
  return [...grouped.entries()].sort(([a], [b]) => a - b).map(([at, all]) => {
    const ordered = [...all].sort((a, b) =>
      Number(b.verified) - Number(a.verified) || a.label.localeCompare(b.label, 'pt')
    );
    // A group at one UTC instant may span the entire world; a camera cannot
    // frame antipodal countries. Prefer confirmed stores and the densest
    // nearby geographic cluster, leaving the other countries illuminated on
    // the globe according to their own schedule.
    const verified = ordered.filter(region => region.verified);
    const pool = verified.length ? verified : ordered;
    const featured = chooseNearbyCluster(pool);
    const center = geographicCenter(featured.map(region => region.anchor));
    const zoom = featured.length > 2 ? 1.9 : featured.length === 2 ? 2.25 : 2.75;
    const title = featured.length === 1
      ? featured[0].label
      : featured.length === 2 ? featured.map(region => region.label).join(' + ')
      : featured[0].label + ' + ' + (featured.length - 1) + ' regiões';
    return {
      at, regions: ordered, featured,
      codes: featured.map(region => region.code),
      center, zoom, title, verified: verified.length > 0
    };
  });
}

function distance(a: [number, number], b: [number, number]): number {
  const deltaLongitude = ((((a[0] - b[0]) + 540) % 360) + 360) % 360 - 180;
  return Math.hypot(deltaLongitude * Math.cos((a[1] + b[1]) * Math.PI / 360), a[1] - b[1]);
}

function chooseNearbyCluster(regions: readonly ReleaseRegion[]): ReleaseRegion[] {
  if (regions.length <= 2) return [...regions];
  // Choose the largest close-together cluster, tiebreaking by stable ISO code.
  let best: ReleaseRegion[] = [regions[0]];
  for (const seed of regions) {
    const close = regions.filter(candidate => distance(seed.anchor, candidate.anchor) <= 24)
      .sort((a, b) => distance(seed.anchor, a.anchor) - distance(seed.anchor, b.anchor) || a.code.localeCompare(b.code))
      .slice(0, 5);
    if (close.length > best.length) best = close;
  }
  return best;
}

export function geographicCenter(coords: readonly [number, number][]): [number, number] {
  if (!coords.length) return [-23, 13];
  let x = 0, y = 0, z = 0;
  for (const [lon, lat] of coords) {
    const phi = lat * Math.PI / 180, lambda = lon * Math.PI / 180;
    x += Math.cos(phi) * Math.cos(lambda);
    y += Math.cos(phi) * Math.sin(lambda);
    z += Math.sin(phi);
  }
  const norm = Math.hypot(x, y);
  if (norm < 0.000001 && Math.abs(z) < 0.000001) return coords[0];
  return [Math.atan2(y, x) * 180 / Math.PI,
    Math.atan2(z, norm) * 180 / Math.PI];
}

export function crossedUnlockMoments(
  moments: readonly UnlockMoment[], previous: number, current: number
): UnlockMoment[] {
  if (!Number.isFinite(previous) || !Number.isFinite(current) || current <= previous) return [];
  return moments.filter(moment => moment.at > previous && moment.at <= current);
}

export const GTA6_UNLOCK_MOMENTS = buildUnlockMoments(RELEASE_REGIONS);
