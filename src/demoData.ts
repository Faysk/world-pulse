/**
 * World Pulse Visual POC — deterministic synthetic populations.
 * No person, position, hashtag or count here is a real user.
 * A tag's brightness is based on independent participant counts, NEVER clicks.
 */
export type TagId = 'gta6' | 'minecraft' | 'lofi';

export type Tag = {
  id: TagId;
  label: string;
  color: string;
  description: string;
};

export type Cluster = {
  name: string;
  lng: number;
  lat: number;
  people: number;
  spread: number;
};

export const TAGS: Tag[] = [
  { id: 'gta6', label: '#GTA6', color: '#ff8758', description: 'Entre pixels e caos.' },
  { id: 'minecraft', label: '#Minecraft', color: '#72e1a5', description: 'Milhões de mundos possíveis.' },
  { id: 'lofi', label: '#LoFi', color: '#ae9bff', description: 'Um universo mais lento.' }
];

const clusters: Record<TagId, Cluster[]> = {
  gta6: [
    { name: 'São Paulo', lng: -46.63, lat: -23.55, people: 280, spread: 2.1 },
    { name: 'Rio de Janeiro', lng: -43.2, lat: -22.91, people: 115, spread: 1.0 },
    { name: 'Porto', lng: -8.61, lat: 41.15, people: 80, spread: 0.8 },
    { name: 'Londres', lng: -0.13, lat: 51.51, people: 180, spread: 1.6 },
    { name: 'Los Angeles', lng: -118.24, lat: 34.05, people: 220, spread: 2.3 },
    { name: 'Tóquio', lng: 139.69, lat: 35.68, people: 165, spread: 1.2 },
    { name: 'Sydney', lng: 151.21, lat: -33.87, people: 74, spread: 1.4 }
  ],
  minecraft: [
    { name: 'São Paulo', lng: -46.63, lat: -23.55, people: 165, spread: 2.0 },
    { name: 'Lisboa', lng: -9.14, lat: 38.72, people: 112, spread: 1.0 },
    { name: 'Berlim', lng: 13.4, lat: 52.52, people: 155, spread: 1.2 },
    { name: 'Nova York', lng: -74.01, lat: 40.71, people: 140, spread: 1.4 },
    { name: 'Cidade do México', lng: -99.13, lat: 19.43, people: 190, spread: 1.8 },
    { name: 'Mumbai', lng: 72.88, lat: 19.07, people: 130, spread: 1.9 },
    { name: 'Tóquio', lng: 139.69, lat: 35.68, people: 120, spread: 1.1 }
  ],
  lofi: [
    { name: 'Porto', lng: -8.61, lat: 41.15, people: 95, spread: 0.8 },
    { name: 'Paris', lng: 2.35, lat: 48.86, people: 105, spread: 1.2 },
    { name: 'Seul', lng: 126.98, lat: 37.57, people: 210, spread: 1.4 },
    { name: 'Osaka', lng: 135.5, lat: 34.69, people: 100, spread: 1.2 },
    { name: 'Toronto', lng: -79.38, lat: 43.65, people: 105, spread: 1.3 },
    { name: 'São Paulo', lng: -46.63, lat: -23.55, people: 90, spread: 1.6 },
    { name: 'Bangkok', lng: 100.5, lat: 13.76, people: 75, spread: 1.5 }
  ]
};

/** Pure, deterministic pseudo-random function so sliders do not make points jump. */
function noise(a: number, b: number, c: number): number {
  const x = Math.sin(a * 83.219 + b * 127.131 + c * 31.517) * 43758.5453;
  return x - Math.floor(x);
}

type PulseFeature = {
  type: 'Feature';
  geometry: { type: 'Point'; coordinates: [number, number] };
  properties: { people: number; tag: TagId; city: string; color?: string };
};
export type PulseCollection = { type: 'FeatureCollection'; features: PulseFeature[] };

export function createPopulation(tagId: TagId, scale = 1): PulseCollection {
  const features: PulseFeature[] = [];
  clusters[tagId].forEach((city, cityIndex) => {
    const people = Math.round(city.people * Math.max(0, scale));
    if (!people) return;

    // With more people, more distinct subregions light up.
    // Importantly, one person clicking repeatedly does NOT change this input.
    const activeCells = Math.max(1, Math.min(36, Math.ceil(people / 12)));
    const base = Math.floor(people / activeCells);
    const remainder = people % activeCells;

    for (let cell = 0; cell < activeCells; cell++) {
      const radius = city.spread * Math.sqrt((cell + 0.15) / 36);
      const angle = cell * 2.399963229728653 + cityIndex * 1.5 + noise(cityIndex, cell, 9);
      const lat = Math.max(-85, Math.min(85, city.lat + Math.sin(angle) * radius));
      const lng = city.lng + Math.cos(angle) * radius / Math.max(0.3, Math.cos(city.lat * Math.PI / 180));
      const count = base + (cell < remainder ? 1 : 0);
      features.push({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [lng, lat] },
        properties: { people: count, tag: tagId, city: city.name }
      });
    }
  });
  return { type: 'FeatureCollection', features };
}

/**
 * All tags share one GeoJSON source for rendering crisp data-driven light points.
 * Only the aggregate heatmaps need separate render passes (one per tag).
 */
export function createCombinedPopulation(scale = 1): PulseCollection {
  return {
    type: 'FeatureCollection',
    features: TAGS.flatMap(tag => createPopulation(tag.id, scale).features.map(feature => ({
      ...feature,
      properties: { ...feature.properties, color: tag.color }
    })))
  };
}

export function peopleCount(tagId: TagId, scale: number): number {
  return clusters[tagId].reduce((sum, city) =>
    sum + Math.round(city.people * Math.max(0, scale)), 0);
}

export function neutralLightPoints(): PulseCollection {
  const features: PulseFeature[] = [];
  Object.values(clusters).flat().forEach((city, index) => {
    features.push({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [city.lng, city.lat] },
      properties: { people: 1, tag: 'lofi', city: city.name }
    });
    // Slightly diffused city lights, decor only — never real activity.
    for (let i = 0; i < 3; i++) {
      features.push({
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: [
            city.lng + (noise(index, i, 0) - 0.5) * city.spread,
            city.lat + (noise(index, i, 1) - 0.5) * city.spread
          ]
        },
        properties: { people: 1, tag: 'lofi', city: city.name }
      });
    }
  });
  return { type: 'FeatureCollection', features };
}

export function tagCenter(tagId: TagId): [number, number] {
  const point = clusters[tagId][0];
  return [point.lng, point.lat];
}

export const POPULATION_SCENARIOS = [0, 1, 10, 100, 1000, 10000, 100000, 1_000_000_000, 8_000_000_000, 1_000_000_000_000] as const;
export type ScenarioDistribution = 'distributed' | 'concentrated';
export const MAX_SCENARIO_CELLS = 21 * 36;

/** Exact represented totals with bounded geometry. These are synthetic city
 * regions, not a population census and never one rendered point per person. */
export function createScenarioPopulation(total: number, distribution: ScenarioDistribution = 'distributed'): PulseCollection {
  if (!Number.isSafeInteger(total) || total < 0 || total > 1_000_000_000_000) throw new RangeError('Unsupported scenario total');
  if (!['distributed', 'concentrated'].includes(distribution)) throw new RangeError('Unknown distribution');
  const regions = TAGS.flatMap(tag => clusters[tag.id].map(city => ({ tag, city })));
  const weight = regions.reduce((sum, item) => sum + item.city.people, 0);
  const allocation = regions.map((item, index) => ({ ...item, index,
    count: Math.floor(total * item.city.people / weight), remainder: total * item.city.people % weight,
  }));
  const remaining = total - allocation.reduce((sum, item) => sum + item.count, 0);
  [...allocation].sort((a, b) => b.remainder - a.remainder || a.index - b.index)
    .slice(0, remaining).forEach(item => item.count++);
  const features: PulseFeature[] = [];
  for (const { tag, city, count, index } of allocation) {
    if (!count) continue;
    const cells = Math.min(36, Math.ceil(count / 12));
    const base = Math.floor(count / cells), extra = count % cells;
    const center = distribution === 'concentrated' ? clusters.gta6[0] : city;
    const spread = distribution === 'concentrated' ? 0.35 : city.spread;
    for (let cell = 0; cell < cells; cell++) {
      const radius = spread * Math.sqrt((cell + 0.15) / 36);
      const angle = cell * 2.399963229728653 + index * 1.5;
      features.push({ type: 'Feature', geometry: { type: 'Point', coordinates: [
        center.lng + Math.cos(angle) * radius / Math.max(0.3, Math.cos(center.lat * Math.PI / 180)),
        Math.max(-85, Math.min(85, center.lat + Math.sin(angle) * radius)),
      ] }, properties: { people: base + (cell < extra ? 1 : 0), tag: tag.id,
        city: distribution === 'concentrated' ? 'Concentração sintética — São Paulo' : city.name, color: tag.color } });
    }
  }
  return { type: 'FeatureCollection', features };
}

export function scenarioDescription(total: number): string {
  if (total === 0) return 'Sem atividade: nenhuma mancha de participantes.';
  if (total === 1) return 'Um único sinal, pequeno e visível; nunca uma área inteira acesa.';
  if (total <= 100) return 'Poucos participantes: sinais separados e núcleos pequenos.';
  if (total <= 10000) return 'Concentrações regionais: observar união e separação das cores.';
  if (total <= 8_000_000_000) return 'Alta densidade agregada: brilho limitado para preservar mapa e cores.';
  return 'Estresse acima da escala humana: 1 trilhão representado por células, não pontos individuais.';
}
