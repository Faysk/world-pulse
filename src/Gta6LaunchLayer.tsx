import { useEffect, useRef, useState } from 'react';
import type { FeatureCollection, Geometry } from 'geojson';
import type { GeoJSONSource, Map as MapInstance } from 'maplibre-gl';
import { countryGeometry } from './CountryLayer';
import { clipCountryReveal, splitCountryByZones } from './gta6LaunchGeometry';
import {
  RELEASE_REGIONS, revealProgress, type ReleaseRegion, type ReleaseWindow
} from './gta6LaunchSchedule';

const EMPTY: FeatureCollection = { type: 'FeatureCollection', features: [] };
const REGION_BY_CODE = new Map(RELEASE_REGIONS.map(region => [region.code, region]));
const isUnlockedForRegion = (region: ReleaseRegion, now: number) => now >= Date.parse(region.unlockAt);

type Segment = {
  countryCode: string;
  region: ReleaseRegion;
  window: ReleaseWindow;
  geometry: Geometry;
};

type Props = {
  map: MapInstance | null;
  now: number;
  simulated: boolean;
  replaySeconds?: number;
  highlightedCodes: readonly string[];
  onPick: (region: ReleaseRegion) => void;
  onError: (error: string) => void;
};

export function Gta6LaunchLayer({ map, now, simulated, replaySeconds = 45, highlightedCodes, onPick, onError }: Props) {
  const [segments, setSegments] = useState<Segment[]>([]);
  const callback = useRef(onPick);
  const lastCompleted = useRef('');
  const lastSmallMarkets = useRef('');
  callback.current = onPick;

  useEffect(() => {
    if (!map) return;
    let mounted = true;
    const sources = ['gta6-launch-regions', 'gta6-launch-neutral', 'gta6-launch-small-market', 'gta6-launch-completed', 'gta6-launch-reveal', 'gta6-launch-spotlight'];
    for (const id of sources) map.addSource(id, { type: 'geojson', data: EMPTY });
    map.addLayer({
      id: 'gta6-launch-zone-hit', type: 'fill', source: 'gta6-launch-regions',
      paint: { 'fill-color': '#ffffff', 'fill-opacity': 0.001 }
    });
    map.addLayer({
      id: 'gta6-launch-neutral-fill', type: 'fill', source: 'gta6-launch-neutral',
      paint: {
        'fill-color': ['case', ['in', ['get', 'countryCode'], ['literal', ['RU', 'KP']]], '#342b44', '#556477'],
        'fill-opacity': ['case', ['in', ['get', 'countryCode'], ['literal', ['RU', 'KP']]], 0.25, 0.16]
      }
    });
    map.addLayer({
      id: 'gta6-launch-completed-fill', type: 'fill', source: 'gta6-launch-completed',
      paint: { 'fill-color': ['get', 'color'], 'fill-opacity': ['case', ['get', 'verified'], 0.86, 0.69] }
    });
    map.addLayer({
      id: 'gta6-launch-color', type: 'fill', source: 'gta6-launch-reveal',
      paint: { 'fill-color': ['get', 'color'], 'fill-opacity': ['case', ['get', 'verified'], 0.88, 0.76] }
    });
    map.addLayer({
      id: 'gta6-launch-aura', type: 'line', source: 'gta6-launch-reveal',
      paint: { 'line-color': ['get', 'color'], 'line-width': 5, 'line-opacity': 0.2 }
    });
    map.addLayer({
      id: 'gta6-launch-sheen', type: 'line', source: 'gta6-launch-reveal',
      paint: { 'line-color': '#fff2ea', 'line-width': 1.6, 'line-opacity': 0.73 }
    });
    map.addLayer({
      id: 'gta6-launch-small-market-glow', type: 'circle', source: 'gta6-launch-small-market',
      paint: { 'circle-color': ['get', 'color'], 'circle-radius': 10,
        'circle-opacity': 0.23, 'circle-blur': 0.9 }
    });
    map.addLayer({
      id: 'gta6-launch-small-market-dot', type: 'circle', source: 'gta6-launch-small-market',
      paint: { 'circle-color': ['get', 'color'], 'circle-radius': 3.6,
        'circle-opacity': 0.93, 'circle-stroke-color': '#ffebf0',
        'circle-stroke-width': 0.9, 'circle-stroke-opacity': 0.78 }
    });
    map.addLayer({
      id: 'gta6-launch-spotlight-halo', type: 'line', source: 'gta6-launch-spotlight',
      paint: { 'line-color': ['get', 'color'], 'line-width': 10, 'line-blur': 7, 'line-opacity': 0.65 }
    });
    map.addLayer({
      id: 'gta6-launch-spotlight-rim', type: 'line', source: 'gta6-launch-spotlight',
      paint: { 'line-color': '#ffeadd', 'line-width': 2.1, 'line-blur': 0.35, 'line-opacity': 0.85 }
    });

    const onClick = (event: { point: { x: number; y: number } }) => {
      const features = map.queryRenderedFeatures([event.point.x, event.point.y], { layers: ['gta6-launch-zone-hit'] });
      const code = String(features[0]?.properties?.countryCode ?? '');
      const region = REGION_BY_CODE.get(code);
      if (region) callback.current(region);
    };
    map.on('click', onClick);
    void countryGeometry().then(collection => {
      if (!mounted) return;
      const allPieces: Segment[] = [];
      const hitFeatures: FeatureCollection['features'] = [];
      for (const feature of collection.features) {
        const code = String(feature.properties?.countryCode ?? '');
        const region = REGION_BY_CODE.get(code);
        if (!region || !feature.geometry) continue;
        const pieces = splitCountryByZones(feature.geometry, region.windows);
        for (let index = 0; index < pieces.length; index++) {
          const geometry = pieces[index];
          if (!geometry) continue;
          allPieces.push({ countryCode: code, region, window: region.windows[index], geometry });
          hitFeatures.push({
            type: 'Feature', geometry, properties: { countryCode: code }
          });
        }
      }
      (map.getSource('gta6-launch-regions') as GeoJSONSource | undefined)?.setData({
        type: 'FeatureCollection', features: hitFeatures
      });
      (map.getSource('gta6-launch-neutral') as GeoJSONSource | undefined)?.setData({
        type: 'FeatureCollection',
        features: collection.features.map(feature => ({
          type: 'Feature',
          geometry: feature.geometry,
          properties: { countryCode: String(feature.properties?.countryCode ?? '') }
        }))
      });
      lastCompleted.current = '';
      lastSmallMarkets.current = '';
      setSegments(allPieces);
      onError('');
    }).catch(() => {
      if (mounted) onError('Não foi possível carregar os limites dos países.');
    });
    return () => {
      mounted = false;
      map.off('click', onClick);
      lastCompleted.current = '';
      lastSmallMarkets.current = '';
      setSegments([]);
      if (!map.getStyle()) return;
      for (const id of ['gta6-launch-spotlight-rim', 'gta6-launch-spotlight-halo', 'gta6-launch-sheen', 'gta6-launch-aura', 'gta6-launch-color', 'gta6-launch-small-market-glow', 'gta6-launch-small-market-dot', 'gta6-launch-completed-fill', 'gta6-launch-neutral-fill', 'gta6-launch-zone-hit']) {
        if (map.getLayer(id)) map.removeLayer(id);
      }
      for (const id of sources) if (map.getSource(id)) map.removeSource(id);
    };
  }, [map, onError]);

  useEffect(() => {
    if (!map || !segments.length) return;
    const completed: FeatureCollection['features'] = [];
    const moving: FeatureCollection['features'] = [];
    const completedKeys: string[] = [];
    for (const segment of segments) {
      const progress = revealProgress(segment.window, now, simulated, replaySeconds);
      if (progress <= 0) continue;
      const properties = { countryCode: segment.countryCode, color: segment.region.color, verified: segment.region.verified };
      if (progress >= 0.99999) {
        completedKeys.push(segment.countryCode + ':' + segment.window.unlockAt);
        completed.push({ type: 'Feature', geometry: segment.geometry, properties });
      } else {
        const geometry = clipCountryReveal(segment.geometry, segment.window.anchor, progress);
        if (geometry) moving.push({ type: 'Feature', geometry, properties });
      }
    }

    // The static source is only rebuilt at a release boundary, not on every
    // animation frame. Most territories stay GPU-resident between updates.
    const signature = completedKeys.join('|');
    if (signature !== lastCompleted.current) {
      (map.getSource('gta6-launch-completed') as GeoJSONSource | undefined)?.setData({
        type: 'FeatureCollection', features: completed
      });
      lastCompleted.current = signature;
    }
    (map.getSource('gta6-launch-reveal') as GeoJSONSource | undefined)?.setData({
      type: 'FeatureCollection', features: moving
    });
    const mini = RELEASE_REGIONS
      .filter(region => ['HK','SG','MT'].includes(region.code) &&
        isUnlockedForRegion(region, now))
      .map(region => ({
        type: 'Feature' as const,
        geometry: { type: 'Point' as const, coordinates: region.anchor },
        properties: { countryCode: region.code, color: region.color }
      }));
    const miniSignature = mini.map(feature => feature.properties.countryCode).join('|');
    if (miniSignature !== lastSmallMarkets.current) {
      (map.getSource('gta6-launch-small-market') as GeoJSONSource | undefined)?.setData({
        type: 'FeatureCollection', features: mini
      });
      lastSmallMarkets.current = miniSignature;
    }
  }, [map, segments, now, simulated, replaySeconds]);

  useEffect(() => {
    if (!map || !segments.length) return;
    const selected = new Set(highlightedCodes);
    const features: FeatureCollection['features'] = segments
      .filter(segment => selected.has(segment.countryCode))
      .map(segment => ({
        type: 'Feature', geometry: segment.geometry,
        properties: { color: segment.region.color, countryCode: segment.countryCode }
      }));
    (map.getSource('gta6-launch-spotlight') as GeoJSONSource | undefined)?.setData({
      type: 'FeatureCollection', features
    });
  }, [map, segments, highlightedCodes]);

  return null;
}
