/**
 * World Pulse spatial aggregation spike (#32).
 *
 * Bounded, order-independent display cells. This is intentionally NOT wired
 * into the live globe yet: a geographic LOD must be visually inspected before
 * replacing the currently approved renderer.
 *
 * Inputs are already aggregated participants by coarse approximate location;
 * never feed raw user/IP coordinates into this module or publish per-user cells.
 */
import type { PulseCollection, TagId } from './demoData';

export type SpatialAggregationOptions = {
  zoom: number;
  maxCells?: number;
};

export type SpatialAggregate = {
  population: PulseCollection;
  /** Web Mercator level chosen to satisfy the hard cell budget. */
  cellZoom: number;
  totalPeople: number;
  sourceCells: number;
  outputCells: number;
  /** Number of display locations containing two or more hashtags. */
  sharedCells: number;
  coarsenedLevels: number;
};

export type SharedCell = {
  lng: number;
  lat: number;
  totalPeople: number;
  participants: Array<{ tag: TagId; color: string; people: number; share: number }>;
};

/** Exact Web Mercator domain; latitudes near poles are not valid tile coordinates. */
const MAX_MERCATOR_LAT = 85.0511287798066;
const MAX_CELL_ZOOM = 14;
const MIN_CELL_ZOOM = 0;
const DEFAULT_MAX_CELLS = 300;

const normalizeLon = (lng: number): number => ((lng + 180) % 360 + 360) % 360;
const mercatorY = (lat: number): number => {
  const clamped = Math.max(-MAX_MERCATOR_LAT, Math.min(MAX_MERCATOR_LAT, lat));
  const rad = clamped * Math.PI / 180;
  return (1 - Math.log(Math.tan(Math.PI / 4 + rad / 2)) / Math.PI) / 2;
};

function tileOf(lng: number, lat: number, z: number): [number, number] {
  const n = 2 ** z;
  const x = Math.min(n - 1, Math.max(0, Math.floor(normalizeLon(lng) / 360 * n)));
  const y = Math.min(n - 1, Math.max(0, Math.floor(mercatorY(lat) * n)));
  return [x, y];
}

function centerOf(x: number, y: number, z: number): [number, number] {
  const n = 2 ** z;
  return [
    360 * (x + 0.5) / n - 180,
    Math.atan(Math.sinh(Math.PI * (1 - 2 * (y + 0.5) / n))) * 180 / Math.PI
  ];
}

function validatePopulation(population: PulseCollection): void {
  if (!population || population.type !== 'FeatureCollection' || !Array.isArray(population.features)) {
    throw new RangeError('Invalid population feature collection');
  }
  for (const feature of population.features) {
    const c = feature?.geometry?.coordinates;
    const p = feature?.properties;
    if (!Array.isArray(c) || c.length !== 2 || !c.every(Number.isFinite) ||
      Math.abs(c[1]) > 90 || !Number.isSafeInteger(p?.people) || p.people < 0 ||
      typeof p.tag !== 'string' || p.tag.length === 0 ||
      typeof p.color !== 'string' || !/^#[0-9a-fA-F]{6}$/.test(p.color)) {
      throw new RangeError('Invalid aggregated population cell');
    }
  }
}

/**
 * Group source coordinates into canonical tile centers; never output weighted
 * centroids of sparse points, which would reveal more precise locations.
 * The output conserves the exact number of participants per hashtag.
 *
 * If the feature budget cannot be satisfied at zoom=0 (more distinct tags
 * than maxCells), it fails loudly instead of silently hiding participants.
 */
export function aggregateForZoom(
  population: PulseCollection,
  { zoom, maxCells = DEFAULT_MAX_CELLS }: SpatialAggregationOptions
): SpatialAggregate {
  validatePopulation(population);
  if (!Number.isFinite(zoom) || zoom < 0 || zoom > 24) throw new RangeError('Invalid map zoom');
  if (!Number.isSafeInteger(maxCells) || maxCells < 1 || maxCells > 50000) {
    throw new RangeError('Invalid cell budget');
  }
  const startingZoom = Math.min(MAX_CELL_ZOOM, Math.max(MIN_CELL_ZOOM, Math.floor(zoom) + 1));
  let z = startingZoom;
  let grouped: Map<string, { tag: TagId; color: string; x: number; y: number; people: number }>;

  for (;;) {
    grouped = new Map();
    for (const item of population.features) {
      const { tag, people } = item.properties;
      if (people === 0) continue;
      const [x, y] = tileOf(...item.geometry.coordinates, z);
      const key = `${tag}/${x}/${y}`;
      const stored = grouped.get(key);
      if (stored) {
        const total = stored.people + people;
        if (!Number.isSafeInteger(total)) throw new RangeError('Participant total overflow');
        stored.people = total;
      } else {
        const color = item.properties.color;
        if (!color || !/^#[0-9a-fA-F]{6}$/.test(color)) throw new RangeError('Invalid hashtag color');
        grouped.set(key, { tag, color, x, y, people });
      }
    }
    if (grouped.size <= maxCells) break;
    if (z === 0) throw new RangeError('Cell budget smaller than active hashtag count');
    z--;
  }

  const cells = [...grouped.values()].sort((a, b) =>
    a.x - b.x || a.y - b.y || a.tag.localeCompare(b.tag)
  );
  const locations = new Map<string, number>();
  let totalPeople = 0;
  const features: PulseCollection['features'] = cells.map((cell) => {
    const center = centerOf(cell.x, cell.y, z);
    const location = `${cell.x}/${cell.y}`;
    locations.set(location, (locations.get(location) ?? 0) + 1);
    totalPeople += cell.people;
    if (!Number.isSafeInteger(totalPeople)) throw new RangeError('Participant total overflow');
    return {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: center },
      properties: {
        people: cell.people, tag: cell.tag, color: cell.color,
        city: 'Célula regional sintética (não é uma pessoa)'
      }
    };
  });

  return {
    population: { type: 'FeatureCollection', features },
    cellZoom: z,
    totalPeople,
    sourceCells: population.features.length,
    outputCells: features.length,
    sharedCells: [...locations.values()].filter(count => count > 1).length,
    coarsenedLevels: startingZoom - z
  };
}

/**
 * A renderer-independent collision descriptor. This records every competing
 * color in a cell, not the last heatmap layer rendered on top. The resulting
 * shares are for FUTURE visual experiments; the approved renderer is unchanged.
 */
export function describeOverlaps(aggregate: SpatialAggregate): SharedCell[] {
  const grouped = new Map<string, SharedCell>();
  for (const feature of aggregate.population.features) {
    const [lng, lat] = feature.geometry.coordinates;
    const key = `${lng}/${lat}`;
    let cell = grouped.get(key);
    if (!cell) {
      cell = { lng, lat, totalPeople: 0, participants: [] };
      grouped.set(key, cell);
    }
    const people = feature.properties.people;
    cell.totalPeople += people;
    cell.participants.push({
      tag: feature.properties.tag,
      color: feature.properties.color ?? '',
      people,
      share: 0
    });
  }
  return [...grouped.values()].filter(cell => cell.participants.length > 1).map(cell => {
    cell.participants.sort((a, b) => a.tag.localeCompare(b.tag));
    for (const participant of cell.participants) {
      participant.share = participant.people / cell.totalPeople;
    }
    return cell;
  }).sort((a, b) => a.lng - b.lng || a.lat - b.lat);
}
