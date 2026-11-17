import type { Geometry, Position } from 'geojson';

/**
 * Radial reveal clipped to existing Natural Earth region geometry.
 * The convex circle is approximated by 48 half-planes and clipped against
 * each country ring; MapLibre then paints the resulting geometry natively.
 * Used only for an ephemeral launch-event layer; never for personal location.
 */
const STEPS = 48;
type Point = [number, number];
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

function normalized(point: Position, anchor: Point): Point {
  const latitudeScale = Math.max(0.22, Math.cos(anchor[1] * Math.PI / 180));
  // Use the shortest longitude difference to avoid crossing the dateline.
  const deltaLon = ((point[0] - anchor[0] + 540) % 360) - 180;
  return [deltaLon * latitudeScale, point[1] - anchor[1]];
}

function denormalized(point: Point, anchor: Point): Point {
  const latitudeScale = Math.max(0.22, Math.cos(anchor[1] * Math.PI / 180));
  const longitude = anchor[0] + point[0] / latitudeScale;
  return [Number(longitude.toFixed(6)), Number((anchor[1] + point[1]).toFixed(6))];
}

function within(point: Point, a: Point, b: Point): boolean {
  return (b[0] - a[0]) * (point[1] - a[1]) -
    (b[1] - a[1]) * (point[0] - a[0]) >= -1e-10;
}

function intersection(p: Point, q: Point, a: Point, b: Point): Point {
  const dx = q[0] - p[0], dy = q[1] - p[1];
  const ux = b[0] - a[0], uy = b[1] - a[1];
  const denom = ux * dy - uy * dx;
  if (Math.abs(denom) < 1e-12) return q;
  const t = clamp((uy * (p[0] - a[0]) - ux * (p[1] - a[1])) / denom, 0, 1);
  return [p[0] + dx * t, p[1] + dy * t];
}

function clipRing(ring: Position[], clip: Point[], anchor: Point): Position[] {
  let output: Point[] = ring.slice(0, -1).map(position => normalized(position, anchor));
  for (let edge = 0; edge < clip.length && output.length; edge++) {
    const previous = output;
    output = [];
    const a = clip[edge], b = clip[(edge + 1) % clip.length];
    let p = previous[previous.length - 1];
    for (const q of previous) {
      const insideQ = within(q, a, b), insideP = within(p, a, b);
      if (insideQ !== insideP) output.push(intersection(p, q, a, b));
      if (insideQ) output.push(q);
      p = q;
    }
  }
  if (output.length < 3) return [];
  const result = output.map(point => denormalized(point, anchor));
  result.push(result[0]);
  return result;
}

function geometryRings(geometry: Geometry): Position[][] {
  if (geometry.type === 'Polygon') return geometry.coordinates;
  if (geometry.type === 'MultiPolygon') return geometry.coordinates.flat();
  return [];
}

export function clipCountryReveal(geometry: Geometry, anchor: Point, progress: number): Geometry | null {
  if (progress <= 0) return null;
  if (progress >= 0.99999) return geometry;
  const rings = geometryRings(geometry);
  if (!rings.length) return null;
  const maxDistance = Math.max(...rings.flatMap(ring => ring.map(point => {
    const [x, y] = normalized(point, anchor);
    return Math.hypot(x, y);
  })), 0.001);
  const radius = maxDistance * 1.01 * progress;
  const circle: Point[] = Array.from({ length: STEPS }, (_, i) => {
    const angle = i * Math.PI * 2 / STEPS;
    return [Math.cos(angle) * radius, Math.sin(angle) * radius];
  });
  const polygons = geometry.type === 'Polygon' ? [geometry.coordinates]
    : geometry.type === 'MultiPolygon' ? geometry.coordinates : [];
  const clipped = polygons.flatMap(poly => {
    const outer = clipRing(poly[0], circle, anchor);
    if (outer.length < 4) return [];
    // Islands are retained individually. Original holes are left unfilled only
    // when their interior remains fully inside the clipped exterior.
    // Avoid inserting partial holes, which can be invalid during a moving clip.
    return [[outer]];
  });
  if (!clipped.length) return null;
  return { type: 'MultiPolygon', coordinates: clipped };
}

/**
 * Approximate longitudinal bands within each source-country polygon.
 * For countries with multiple civil times this creates a contiguous, bounded
 * visualization rather than tinting the entire country at its first midnight.
 * This is NOT an administrative map or an official store-region boundary.
 */
function clipRingByLongitude(ring: Position[], minimum: number, maximum: number): Position[] {
  let points: Point[] = ring.slice(0, -1).map(p => [p[0], p[1]]);
  for (const boundary of [
    { x: minimum, lower: true },
    { x: maximum, lower: false }
  ]) {
    if (!points.length) break;
    const inside = (p: Point) => boundary.lower ? p[0] >= boundary.x - 1e-9 : p[0] <= boundary.x + 1e-9;
    const intercept = (a: Point, b: Point): Point => {
      const den = b[0] - a[0];
      const k = Math.abs(den) < 1e-12 ? 0 : clamp((boundary.x - a[0]) / den, 0, 1);
      return [boundary.x, a[1] + (b[1] - a[1]) * k];
    };
    const prior = points;
    points = [];
    let last = prior[prior.length - 1];
    for (const next of prior) {
      const wasInside = inside(last), isInside = inside(next);
      if (wasInside !== isInside) points.push(intercept(last, next));
      if (isInside) points.push(next);
      last = next;
    }
  }
  if (points.length < 3) return [];
  const first = points[0];
  const closed: Position[] = [...points.map(point => [
    Number(point[0].toFixed(6)), Number(point[1].toFixed(6))
  ]), [first[0], first[1]]];
  return closed;
}

function localLongitude(longitude: number, near: number): number {
  const difference = ((longitude - near + 540) % 360) - 180;
  return near + difference;
}

export function splitCountryByZones(
  geometry: Geometry, windows: readonly { anchor: [number, number] }[]
): (Geometry | null)[] {
  if (!windows.length) return [];
  if (windows.length === 1) return [geometry];
  if (geometry.type !== 'Polygon' && geometry.type !== 'MultiPolygon') {
    return windows.map(() => null);
  }

  const input = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates;
  const resulting: Position[][][][] = windows.map(() => []);

  // Each disconnected island/polygon has its own longitude reference to
  // avoid applying a zone on the other side of the antimeridian by accident.
  for (const polygon of input) {
    if (!polygon.length || !polygon[0].length) continue;
    const ring = polygon[0];
    const low = Math.min(...ring.map(point => point[0]));
    const high = Math.max(...ring.map(point => point[0]));
    const center = (low + high) / 2;
    const ordered = windows.map((window, index) => ({
      index, longitude: localLongitude(window.anchor[0], center)
    })).sort((a, b) => a.longitude - b.longitude);
    const boundaries = ordered.slice(1).map((item, i) =>
      (ordered[i].longitude + item.longitude) / 2
    );
    for (let i = 0; i < ordered.length; i++) {
      const minimum = i === 0 ? -Infinity : boundaries[i - 1];
      const maximum = i === ordered.length - 1 ? Infinity : boundaries[i];
      const exterior = clipRingByLongitude(ring, minimum, maximum);
      if (exterior.length < 4) continue;
      const holes = polygon.slice(1)
        .map(hole => clipRingByLongitude(hole, minimum, maximum))
        .filter(hole => hole.length >= 4);
      resulting[ordered[i].index].push([exterior, ...holes]);
    }
  }
  return resulting.map(polygons =>
    polygons.length ? { type: 'MultiPolygon', coordinates: polygons } as Geometry : null
  );
}
