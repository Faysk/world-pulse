import { useEffect, useRef } from 'react';
import { Map, setWorkerUrl, type GeoJSONSource, type Map as MapInstance } from 'maplibre-gl';
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
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
      } else if (layer.type === 'circle') {
        map.setPaintProperty(layer.id, 'circle-color', '#78828c');
      }
    } catch {
      // Some vendor layers have incompatible dynamic style expressions.
    }
  }
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
          0, 0, 1, 0.18, 6, 0.42, 14, 0.7, 32, 1
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
        'heatmap-opacity': 0.84
      }
    });

    map.addLayer({
      id: 'pulse-sparks-' + tag.id,
      source: sourceId,
      type: 'circle',
      minzoom: 6,
      paint: {
        'circle-color': tag.color,
        'circle-radius': ['interpolate', ['linear'], ['zoom'], 6, 2, 9, 5, 13, 12],
        'circle-blur': 0.85,
        'circle-opacity': 0.35,
        'circle-stroke-width': 0
      }
    });
  }
}

export function WorldGlobe({
  scale, selected, cityLights, onReady, onZoom, onFps, onTap, onFailure
}: GlobeProps) {
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapInstance | null>(null);
  const callbacks = useRef({ onReady, onZoom, onFps, onTap, onFailure });
  callbacks.current = { onReady, onZoom, onFps, onTap, onFailure };

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
        antialias: true,
        attributionControl: true,
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
      installLights(map, scale);
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

    // MapLibre's map click event is distinct from drag/zoom gestures.
    // Only eligible short clicks may add a demo-second; never touchmove/pinch.
    map.on('click', () => callbacks.current.onTap());

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
    if (!map || !map.getLayer('pulse-heat-gta6')) return;
    for (const tag of TAGS) {
      const opacity = selected === null || selected === tag.id ? 0.88 : 0.19;
      map.setPaintProperty('pulse-heat-' + tag.id, 'heatmap-opacity', opacity);
      map.setPaintProperty('pulse-sparks-' + tag.id, 'circle-opacity', opacity * 0.42);
    }
  }, [selected]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.getLayer('neutral-glow')) return;
    map.setLayoutProperty('neutral-glow', 'visibility', cityLights ? 'visible' : 'none');
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
