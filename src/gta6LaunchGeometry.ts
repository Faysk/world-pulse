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
