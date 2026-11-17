import { useEffect, useRef, useState } from 'react';
import type { FeatureCollection } from 'geojson';
import type { GeoJSONSource, Map as MapInstance } from 'maplibre-gl';
import { countryGeometry } from './CountryLayer';
import { clipCountryReveal } from './gta6LaunchGeometry';
import { RELEASE_REGIONS, revealProgress, type ReleaseRegion } from './gta6LaunchSchedule';

const EMPTY: FeatureCollection = { type: 'FeatureCollection', features: [] };
const REGION_BY_CODE = new Map(RELEASE_REGIONS.map(region => [region.code, region]));

type Props = {
  map: MapInstance | null;
  now: number;
  simulated: boolean;
  onPick: (region: ReleaseRegion) => void;
  onError: (error: string) => void;
};

export function Gta6LaunchLayer({ map, now, simulated, onPick, onError }: Props) {
  const [geometry, setGeometry] = useState<FeatureCollection | null>(null);
  const callback = useRef(onPick);
  callback.current = onPick;

  useEffect(() => {
    if (!map) return;
    let mounted = true;
    map.addSource('gta6-launch-regions', { type: 'geojson', data: EMPTY });
    map.addSource('gta6-launch-reveal', { type: 'geojson', data: EMPTY });
    map.addLayer({
      id: 'gta6-launch-zone-hit', type: 'fill', source: 'gta6-launch-regions',
      paint: { 'fill-color': '#ffffff', 'fill-opacity': 0.001 }
    });
    map.addLayer({
      id: 'gta6-launch-color', type: 'fill', source: 'gta6-launch-reveal',
      paint: { 'fill-color': ['get', 'color'], 'fill-opacity': 0.72 }
    });
    map.addLayer({
      id: 'gta6-launch-aura', type: 'line', source: 'gta6-launch-reveal',
      paint: { 'line-color': ['get', 'color'], 'line-width': 5, 'line-opacity': 0.19 }
    });
    map.addLayer({
      id: 'gta6-launch-sheen', type: 'line', source: 'gta6-launch-reveal',
      paint: { 'line-color': ['get', 'color'], 'line-width': 1.25, 'line-opacity': 0.66 }
    });

    const onClick = (event: { point: { x: number; y: number } }) => {
      const feature = map.queryRenderedFeatures(event.point, { layers: ['gta6-launch-zone-hit'] })[0];
      const region = REGION_BY_CODE.get(String(feature?.properties?.countryCode ?? ''));
      if (region) callback.current(region);
    };
    map.on('click', onClick);

    void countryGeometry().then(collection => {
      if (!mounted) return;
      const features = collection.features.filter(feature =>
        REGION_BY_CODE.has(String(feature.properties?.countryCode ?? ''))
      );
      const selected: FeatureCollection = { type: 'FeatureCollection', features };
      (map.getSource('gta6-launch-regions') as GeoJSONSource | undefined)?.setData(selected);
      setGeometry(selected);
      onError('');
    }).catch(() => {
      if (mounted) onError('Não foi possível carregar os limites dos países.');
    });

    return () => {
      mounted = false;
      map.off('click', onClick);
      setGeometry(null);
      if (!map.getStyle()) return;
      for (const id of ['gta6-launch-sheen', 'gta6-launch-aura', 'gta6-launch-color', 'gta6-launch-zone-hit']) {
        if (map.getLayer(id)) map.removeLayer(id);
      }
      for (const id of ['gta6-launch-reveal', 'gta6-launch-regions']) {
        if (map.getSource(id)) map.removeSource(id);
      }
    };
  }, [map, onError]);

  useEffect(() => {
    if (!map || !geometry || !map.getSource('gta6-launch-reveal')) return;
    const features: FeatureCollection['features'] = [];
    for (const feature of geometry.features) {
      const region = REGION_BY_CODE.get(String(feature.properties?.countryCode ?? ''));
      if (!region || !feature.geometry) continue;
      const progress = revealProgress(region, now, simulated);
      if (progress <= 0) continue;
      const revealed = clipCountryReveal(feature.geometry, region.anchor, progress);
      if (!revealed) continue;
      features.push({
        type: 'Feature',
        geometry: revealed,
        properties: { countryCode: region.code, color: region.color, name: region.label }
      });
    }
    (map.getSource('gta6-launch-reveal') as GeoJSONSource).setData({
      type: 'FeatureCollection', features
    });
  }, [map, geometry, now, simulated]);

  return null;
}
