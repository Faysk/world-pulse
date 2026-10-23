import { useEffect, useRef } from 'react';
import { Map, setWorkerUrl, type GeoJSONSource, type Map as MapInstance } from 'maplibre-gl';
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
import { heatVisibility } from './domain';
import {
  TAGS, createPopulation, neutralLightPoints, tagCenter,
  type TagId
} from './demoData';

setWorkerUrl(workerUrl);

export type GlobeProps = {
  scale: number;
  selected: TagId | null;
  cityLights: boolean;
  onReady: (map: MapInstance) => void;
  onZoom: (zoom: number) => void;
  onFps: (fps: number) => void;
  onTap: () => void;
  onTagPick: (tag: TagId) => void;
  onFailure: (message: string) => void;
};

const rgb = (hex: string, alpha: number): string => {
  const h = hex.replace('#', '');
  return 'rgba(' + parseInt(h.slice(0, 2), 16) + ',' +
    parseInt(h.slice(2, 4), 16) + ',' +
    parseInt(h.slice(4, 6), 16) + ',' + alpha + ')';
};

function nightStyle(map: MapInstance): void {
  const layers = map.getStyle()?.layers ?? [];
  for (const layer of layers) {
    const id = layer.id.toLowerCase();
    try {
      if (layer.type === 'background') {
        map.setPaintProperty(layer.id, 'background-color', '#0b1119');
      } else if (layer.type === 'fill') {
        const fill = id.includes('water') ? '#101b28'
          : /park|wood|forest|grass|vegetation/.test(id) ? '#293b3c'
          : id.includes('building') ? '#414a54'
          : id.includes('land') ? '#2c343e'
          : '#333b46';
        map.setPaintProperty(layer.id, 'fill-color', fill);
      } else if (layer.type === 'line') {
        const line = /road|highway|transport/.test(id) ? '#66717e'
          : id.includes('water') ? '#31404e'
          : '#586372';
        map.setPaintProperty(layer.id, 'line-color', line);
      } else if (layer.type === 'symbol') {
        // Keep geographic names readable but quiet at planetary zoom.
        map.setPaintProperty(layer.id, 'text-color', '#acbac8');
        map.setPaintProperty(layer.id, 'text-halo-color', '#111820');
        map.setPaintProperty(layer.id, 'text-halo-width', 0.85);
        map.setPaintProperty(layer.id, 'text-opacity', [
          'interpolate', ['linear'], ['zoom'],
          0, 0.14, 3, 0.4, 5, 0.7, 9, 0.78
        ]);
      } else if (layer.type === 'circle') {
        map.setPaintProperty(layer.id, 'circle-color', '#78828c');
      }
    } catch {
      // Some vendor layers have incompatible dynamic style expressions.
    }
  }
}

type HeatOpacityStops = [
  'interpolate', ['linear'], ['zoom'],
  number, number, number, number, number,
  number, number, number, number, number
];

function heatOpacity(focus: number): HeatOpacityStops {
  return [
    'interpolate', ['linear'], ['zoom'],
    0, heatVisibility(0) * focus,
    5, heatVisibility(5) * focus,
    7, heatVisibility(7) * focus,
    9, heatVisibility(9) * focus,
    11.5, 0
  ];
}

function applyTagSelection(map: MapInstance, selected: TagId | null): void {
  if (!map.getLayer('pulse-heat-gta6')) return;
  for (const tag of TAGS) {
    const focus = selected === null || selected === tag.id ? 1 : 0.17;
    map.setPaintProperty('pulse-heat-' + tag.id, 'heatmap-opacity', heatOpacity(focus));
    map.setPaintProperty('pulse-sparks-' + tag.id, 'circle-opacity', [
      'interpolate', ['linear'], ['zoom'],
      5, 0,
      7, 0.12 * focus,
      9, 0.47 * focus,
      13, 0.58 * focus
    ]);
  }
}

function applyNeutralLights(map: MapInstance, enabled: boolean): void {
  if (!map.getLayer('neutral-glow')) return;
  map.setLayoutProperty('neutral-glow', 'visibility', enabled ? 'visible' : 'none');
}

function installLights(map: MapInstance, scale: number): void {
  map.addSource('neutral-cities', { type: 'geojson', data: neutralLightPoints() });
  map.addLayer({
    id: 'neutral-glow',
    source: 'neutral-cities',
    type: 'circle',
    paint: {
      'circle-color': '#afc6db',
      'circle-radius': ['interpolate', ['linear'], ['zoom'], 0, 2, 5, 8, 11, 22],
      'circle-opacity': 0.1,
      'circle-blur': 0.95
    }
  });

  for (const tag of TAGS) {
    const sourceId = 'pulse-source-' + tag.id;
    map.addSource(sourceId, {
      type: 'geojson',
      data: createPopulation(tag.id, scale)
    });
    map.addLayer({
      id: 'pulse-heat-' + tag.id,
      source: sourceId,
      type: 'heatmap',
      paint: {
        'heatmap-weight': [
          'interpolate', ['linear'], ['get', 'people'],
          0, 0, 1, 0.2, 6, 0.47, 14, 0.72, 32, 0.98, 120, 1.55, 1000, 2.2
        ],
        'heatmap-intensity': ['interpolate', ['linear'], ['zoom'], 0, 1.35, 5, 1.7, 10, 2.2],
        'heatmap-radius': ['interpolate', ['linear'], ['zoom'], 0, 10, 3, 19, 6, 30, 10, 52, 14, 80],
        'heatmap-color': [
          'interpolate', ['linear'], ['heatmap-density'],
          0, rgb(tag.color, 0),
          0.1, rgb(tag.color, 0.12),
          0.25, rgb(tag.color, 0.3),
          0.5, rgb(tag.color, 0.68),
          0.75, rgb(tag.color, 0.86),
          1, rgb(tag.color, 1)
        ],
        'heatmap-opacity': heatOpacity(1),
        'heatmap-opacity-transition': { duration: 620, delay: 0 }
      }
    });

    map.addLayer({
      id: 'pulse-sparks-' + tag.id,
      source: sourceId,
      type: 'circle',
      minzoom: 5,
      paint: {
        'circle-color': tag.color,
        'circle-radius': ['interpolate', ['linear'], ['zoom'], 5, 2, 8, 5, 11, 10, 15, 16],
        'circle-blur': 0.9,
        'circle-opacity': ['interpolate', ['linear'], ['zoom'], 5, 0, 7, 0.12, 9, 0.47, 13, 0.58],
        'circle-opacity-transition': { duration: 620, delay: 0 },
        'circle-stroke-width': 0
      }
    });

    // Separate transparent hit region: light fields are GPU aggregates and are
    // not themselves a reliable clickable GeoJSON layer.
    map.addLayer({
      id: 'pulse-hit-' + tag.id,
      source: sourceId,
      type: 'circle',
      paint: {
        'circle-radius': ['interpolate', ['linear'], ['zoom'], 0, 12, 5, 19, 9, 27, 14, 34],
        'circle-color': tag.color,
        'circle-opacity': 0.001,
        'circle-stroke-width': 0
      }
    });
  }
}

export function WorldGlobe({
  scale, selected, cityLights, onReady, onZoom, onFps, onTap, onTagPick, onFailure
}: GlobeProps) {
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapInstance | null>(null);
  const callbacks = useRef({ onReady, onZoom, onFps, onTap, onTagPick, onFailure });
  callbacks.current = { onReady, onZoom, onFps, onTap, onTagPick, onFailure };
  const latestState = useRef({ scale, selected, cityLights });
  latestState.current = { scale, selected, cityLights };

  // Create the GPU-backed map only once. React state must not recreate the renderer.
  useEffect(() => {
    if (!container.current || mapRef.current) return;

    let map: MapInstance;
    try {
      map = new Map({
        container: container.current,
        style: 'https://tiles.openfreemap.org/styles/dark',
        center: [-23, 13],
        zoom: 1.65,
        minZoom: 0.8,
        maxZoom: 15,
        pitch: 0,
        canvasContextAttributes: { antialias: true },
        dragRotate: true,
        touchZoomRotate: true,
        fadeDuration: 350
      });
    } catch (error) {
      callbacks.current.onFailure(error instanceof Error ? error.message : 'WebGL indisponível.');
      return;
    }

    mapRef.current = map;
    let hasLoaded = false;
    let frames = 0;
    let periodStart = performance.now();
    const watchdog = window.setTimeout(() => {
      if (!hasLoaded) callbacks.current.onFailure(
        'O mapa não carregou. Verifique sua ligação e o acesso aos tiles cartográficos.'
      );
    }, 18000);

    map.on('style.load', () => {
      map.setProjection({ type: 'globe' });
      nightStyle(map);
    });

    map.on('load', () => {
      hasLoaded = true;
      window.clearTimeout(watchdog);
      installLights(map, latestState.current.scale);
      applyTagSelection(map, latestState.current.selected);
      applyNeutralLights(map, latestState.current.cityLights);
      callbacks.current.onReady(map);
      callbacks.current.onZoom(map.getZoom());
    });

    map.on('moveend', () => callbacks.current.onZoom(map.getZoom()));
    map.on('render', () => {
      frames++;
      const now = performance.now();
      if (now - periodStart > 1000) {
        callbacks.current.onFps(Math.round(frames * 1000 / (now - periodStart)));
        frames = 0;
        periodStart = now;
      }
    });

    // Prefer selecting the underlying tag on the first hotspot tap.
    // A second tap on the SAME tag, or a tap on empty terrain, credits +1.
    // Native MapLibre 'click' ignores map drag/pinch gestures.
    map.on('click', (event) => {
      if (!map.getLayer('pulse-hit-gta6')) return;
      const hits = map.queryRenderedFeatures(event.point, {
        layers: TAGS.map(tag => 'pulse-hit-' + tag.id)
      });
      const found = hits.map(hit => hit.properties?.tag).find(value =>
        TAGS.some(tag => tag.id === value)
      ) as TagId | undefined;
      if (found) callbacks.current.onTagPick(found);
      else callbacks.current.onTap();
    });

    // Indicate that the luminous regions can be selected.
    map.on('mousemove', (event) => {
      if (!map.getLayer('pulse-hit-gta6')) return;
      const hits = map.queryRenderedFeatures(event.point, {
        layers: TAGS.map(tag => 'pulse-hit-' + tag.id)
      });
      map.getCanvas().style.cursor = hits.length ? 'pointer' : 'grab';
    });

    return () => {
      window.clearTimeout(watchdog);
      map.remove();
      mapRef.current = null;
    };
    // One map, one WebGL context. Other props are managed by effects below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.getSource('pulse-source-gta6')) return;
    for (const tag of TAGS) {
      (map.getSource('pulse-source-' + tag.id) as GeoJSONSource).setData(
        createPopulation(tag.id, scale)
      );
    }
  }, [scale]);

  useEffect(() => {
    const map = mapRef.current;
    if (map) applyTagSelection(map, selected);
  }, [selected]);

  useEffect(() => {
    const map = mapRef.current;
    if (map) applyNeutralLights(map, cityLights);
  }, [cityLights]);

  return <div className="map-canvas" ref={container} aria-label="Globo interativo de atividade simulada" />;
}

export function flyToTag(map: MapInstance | null, tag: TagId): void {
  if (!map) return;
  map.flyTo({
    center: tagCenter(tag),
    zoom: Math.max(3.6, map.getZoom()),
    speed: 0.65,
    curve: 1.4,
    essential: true
  });
}

export function resetGlobe(map: MapInstance | null): void {
  map?.flyTo({
    center: [-23, 13],
    zoom: 1.65,
    pitch: 0,
    bearing: 0,
    speed: 0.6,
    essential: true
  });
}
