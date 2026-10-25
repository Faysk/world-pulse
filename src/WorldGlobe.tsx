import { useEffect, useRef } from 'react';
import { Map, setWorkerUrl, type GeoJSONSource, type ExpressionSpecification, type Map as MapInstance } from 'maplibre-gl';
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
import { heatVisibility } from './domain';
import { TapGestureGuard, type PointerInput } from './tapGesture';
import {
  TAGS, createCombinedPopulation, neutralLightPoints, tagCenter,
  type TagId, type PulseCollection
} from './demoData';

setWorkerUrl(workerUrl);

export type GlobeProps = {
  ariaLabel?: string;
  population?: PulseCollection;
  scale: number;
  selected: TagId | null;
  cityLights: boolean;
  onReady: (map: MapInstance) => void;
  onZoom: (zoom: number) => void;
  onFps: (fps: number) => void;
  onTap: () => void;
  onRegionPick?: (name:string) => void;
  onCountryPick?: (countryCode:string) => void;
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

/**
 * We render three heatmap passes for the DEMO only, but all high-zoom lights
 * are rendered in two shared data-driven layers. This avoids one expensive
 * GeoJSON source and multiple circles per hashtag as the tag count grows.
 */
const tagLayers = TAGS.map(tag => 'pulse-heat-' + tag.id);

type TagFocusExpression = ['case', ['==', ['get', 'tag'], TagId], 1, 0.15];

function brightnessExpression(selected: TagId | null): number | TagFocusExpression {
  return selected === null
    ? 1
    : ['case', ['==', ['get', 'tag'], selected], 1, 0.15];
}

function applyTagSelection(map: MapInstance, selected: TagId | null): void {
  if (!map.getLayer(tagLayers[0])) return;
  for (const tag of TAGS) {
    const focus = selected === null || selected === tag.id ? 1 : 0.16;
    map.setPaintProperty('pulse-heat-' + tag.id, 'heatmap-opacity', heatOpacity(focus));
  }
  const focus = brightnessExpression(selected);
  const sparse: ExpressionSpecification = ['*', ['case', ['<=', ['get', 'people'], 10], 0.8, 0], focus];
  map.setPaintProperty('pulse-sparse', 'circle-opacity', ['interpolate', ['linear'], ['zoom'], 0, sparse, 5, sparse, 7, 0]);
  // One shared layer for every hashtag: per-feature color and focus expression.
  map.setPaintProperty('pulse-halo', 'circle-opacity', [
    'interpolate', ['linear'], ['zoom'],
    5, 0, 7, ['*', 0.12, focus], 9, ['*', 0.36, focus], 13, ['*', 0.40, focus]
  ]);
  map.setPaintProperty('pulse-core', 'circle-opacity', [
    'interpolate', ['linear'], ['zoom'],
    5, 0, 7, ['*', 0.14, focus], 9, ['*', 0.64, focus], 13, ['*', 0.85, focus]
  ]);
}

function applyNeutralLights(map: MapInstance, enabled: boolean): void {
  if (!map.getLayer('neutral-glow')) return;
  map.setLayoutProperty('neutral-glow', 'visibility', enabled ? 'visible' : 'none');
}

function installLights(map: MapInstance, scale: number, population?: PulseCollection): void {
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

  map.addSource('pulse-population', {
    type: 'geojson',
    data: population ?? createCombinedPopulation(scale)
  });

  // Heatmap colour cannot be data-driven in MapLibre. Separate heatmap
  // passes are acceptable for 3 demonstration tags; scale test follows.
  for (const tag of TAGS) {
    map.addLayer({
      id: 'pulse-heat-' + tag.id,
      source: 'pulse-population',
      type: 'heatmap',
      filter: ['==', ['get', 'tag'], tag.id],
      paint: {
        'heatmap-weight': [
          'interpolate', ['linear'], ['get', 'people'],
          0, 0, 1, 0.2, 6, 0.47, 14, 0.72, 32, 0.98, 120, 1.2,
          1000, 1.4, 100000, 1.65, 1000000, 1.85, 1000000000, 2.2
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
  }

  // A sparse signal remains visible at world zoom without inflating its area.
  map.addLayer({ id: 'pulse-sparse', source: 'pulse-population', type: 'circle', maxzoom: 7,
    paint: { 'circle-color': ['get', 'color'], 'circle-radius': 2.5,
      'circle-opacity': ['case', ['<=', ['get', 'people'], 10], 0.8, 0], 'circle-blur': 0.2 } });

  // The blurred halo gives a subtle illuminated halo around each point.
  map.addLayer({
    id: 'pulse-halo',
    source: 'pulse-population',
    type: 'circle',
    minzoom: 5,
    paint: {
      'circle-color': ['get', 'color'],
      'circle-radius': ['interpolate', ['linear'], ['zoom'], 5, 3, 8, 7, 11, 14, 15, 23],
      'circle-blur': 0.95,
      'circle-opacity': ['interpolate', ['linear'], ['zoom'], 5, 0, 7, 0.12, 9, 0.36, 13, 0.40],
      'circle-opacity-transition': { duration: 550, delay: 0 }
    }
  });

  // Crisp light cores keep the close-up from becoming a field of blurry pixels.
  map.addLayer({
    id: 'pulse-core',
    source: 'pulse-population',
    type: 'circle',
    minzoom: 5,
    paint: {
      'circle-color': ['get', 'color'],
      'circle-radius': ['interpolate', ['linear'], ['zoom'], 5, 0.8, 7, 1.4, 10, 2.2, 14, 3.1],
      'circle-blur': 0.13,
      'circle-opacity': ['interpolate', ['linear'], ['zoom'], 5, 0, 7, 0.14, 9, 0.64, 13, 0.85],
      'circle-opacity-transition': { duration: 550, delay: 0 },
      'circle-stroke-width': 0
    }
  });

  // Single hit layer for every hashtag. The full heatmap gradient is not
  // pickable yet; these cells provide a reliably bounded interaction area.
  map.addLayer({
    id: 'pulse-hit',
    source: 'pulse-population',
    type: 'circle',
    paint: {
      'circle-radius': ['interpolate', ['linear'], ['zoom'], 0, 12, 5, 19, 9, 27, 14, 34],
      'circle-color': '#ffffff',
      'circle-opacity': 0.001,
      'circle-stroke-width': 0
    }
  });
}

export function WorldGlobe({
  scale, population, selected, cityLights, onReady, onZoom, onFps, onTap, onCountryPick, onRegionPick, onTagPick, onFailure, ariaLabel='Globo interativo de atividade simulada'
}: GlobeProps) {
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapInstance | null>(null);
  const callbacks = useRef({ onReady, onZoom, onFps, onTap, onCountryPick, onRegionPick, onTagPick, onFailure });
  callbacks.current = { onReady, onZoom, onFps, onTap, onCountryPick, onRegionPick, onTagPick, onFailure };
  const latestState = useRef({ scale, population, selected, cityLights });
  latestState.current = { scale, population, selected, cityLights };

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
    // Native pointer events are captured independently from MapLibre's click.
    // This prevents rotation, pinch and scroll from becoming fake +1 seconds.
    const gestureGuard = new TapGestureGuard();
    const canvas = map.getCanvas();
    let countryAtPointerDown:string|null=null;
    let regionAtPointerDown:string|null=null;
    const sample = (event: PointerEvent): PointerInput => ({
      id: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      at: performance.now(),
      pointerType: event.pointerType
    });
    const down = (event: PointerEvent) => {
      const input=sample(event);
      if (event.isPrimary === false) gestureGuard.invalidate();
      else{
        countryAtPointerDown=null;regionAtPointerDown=null;
        if(map.getLayer('regional-point-core')){
          const box=canvas.getBoundingClientRect();
          const name=map.queryRenderedFeatures([event.clientX-box.left,event.clientY-box.top],{layers:['regional-point-core']})[0]?.properties?.name;
          if(typeof name==='string')regionAtPointerDown=name;
        }
        if(callbacks.current.onCountryPick&&(map.getLayer('live-country-fill')||map.getLayer('personal-country-fill'))){
          const box=canvas.getBoundingClientRect();
          const country=map.queryRenderedFeatures([event.clientX-box.left,event.clientY-box.top],{layers:['live-country-fill','personal-country-fill'].filter(id=>Boolean(map.getLayer(id)))})[0]?.properties?.countryCode;
          if(typeof country==='string')countryAtPointerDown=country;
        }
      }
      gestureGuard.pointerDown(input);
    };
    const move = (event: PointerEvent) => gestureGuard.pointerMove(sample(event));
    const up = (event: PointerEvent) => gestureGuard.pointerUp(sample(event));
    const cancel = (event: PointerEvent) => gestureGuard.pointerCancel(event.pointerId);
    const wheel = () => gestureGuard.invalidate();
    canvas.addEventListener('pointerdown', down, { passive: true });
    window.addEventListener('pointermove', move, { passive: true });
    window.addEventListener('pointerup', up, { passive: true });
    window.addEventListener('pointercancel', cancel, { passive: true });
    canvas.addEventListener('wheel', wheel, { passive: true });
    let hasLoaded = false;
    let frames = 0;
    let periodStart = 0;
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
      installLights(map, latestState.current.scale, latestState.current.population);
      applyTagSelection(map, latestState.current.selected);
      applyNeutralLights(map, latestState.current.cityLights);
      callbacks.current.onReady(map);
      callbacks.current.onZoom(map.getZoom());
    });

    map.on('movestart', () => {
      gestureGuard.invalidate();
      frames = 0;
      periodStart = performance.now();
    });
    map.on('moveend', () => {
      callbacks.current.onZoom(map.getZoom());
      callbacks.current.onFps(0);
    });
    map.on('render', () => {
      // MapLibre only renders when needed, so counting idle frames / second
      // is NOT a meaningful performance metric. Sample active movement only.
      if (!map.isMoving() || !periodStart) return;
      frames++;
      const now = performance.now();
      if (now - periodStart > 850) {
        callbacks.current.onFps(Math.round(frames * 1000 / (now - periodStart)));
        frames = 0;
        periodStart = now;
      }
    });

    // Prefer selecting the underlying tag on the first hotspot tap.
    // A second tap on the SAME tag, or a tap on empty terrain, credits +1.
    // Native MapLibre 'click' ignores map drag/pinch gestures.
    map.on('click', (event) => {
      const original = event.originalEvent;
      if (!original || !gestureGuard.consumeClick(
        original.clientX, original.clientY, performance.now()
      )) return;
      const intendedRegion=regionAtPointerDown;regionAtPointerDown=null;
      if(intendedRegion){callbacks.current.onRegionPick?.(intendedRegion);return;}
      if(map.getLayer('regional-point-core')){
        const name=map.queryRenderedFeatures(event.point,{layers:['regional-point-core']})[0]?.properties?.name;
        if(typeof name==='string'){callbacks.current.onRegionPick?.(name);return;}
      }
      const intendedCountry=countryAtPointerDown;countryAtPointerDown=null;
      if(intendedCountry&&callbacks.current.onCountryPick){callbacks.current.onCountryPick(intendedCountry);return;}
      if(map.getLayer('live-country-fill')||map.getLayer('personal-country-fill')){
        const country=map.queryRenderedFeatures(event.point,{layers:['live-country-fill','personal-country-fill'].filter(id=>Boolean(map.getLayer(id)))})[0]?.properties?.countryCode;
        if(typeof country==='string'&&callbacks.current.onCountryPick){callbacks.current.onCountryPick(country);return;}
      }
      if (!map.getLayer('pulse-hit')) return;
      const hits = map.queryRenderedFeatures(event.point, {
        layers: ['pulse-hit']
      });
      const found = hits.map(hit => hit.properties?.tag).find(value =>
        TAGS.some(tag => tag.id === value)
      ) as TagId | undefined;
      if (found) callbacks.current.onTagPick(found);
      else callbacks.current.onTap();
    });

    // Coalesce mouse events so hit testing cannot run hundreds of times per
    // second on high-polling-rate mice. Skip GPU queries during camera moves.
    let hoverFrame: number | null = null;
    map.on('mousemove', (event) => {
      if (hoverFrame !== null) window.cancelAnimationFrame(hoverFrame);
      hoverFrame = window.requestAnimationFrame(() => {
        hoverFrame = null;
        if(map.getLayer('live-country-fill')||map.getLayer('personal-country-fill')){
        const country=map.queryRenderedFeatures(event.point,{layers:['live-country-fill','personal-country-fill'].filter(id=>Boolean(map.getLayer(id)))})[0]?.properties?.countryCode;
        if(typeof country==='string'&&callbacks.current.onCountryPick){map.getCanvas().style.cursor='pointer';return;}
      }
      if (!map.getLayer('pulse-hit')) return;
        if (map.isMoving()) {
          map.getCanvas().style.cursor = 'grabbing';
          return;
        }
        const hits = map.queryRenderedFeatures(event.point, { layers: ['pulse-hit'] });
        map.getCanvas().style.cursor = hits.length ? 'pointer' : 'grab';
      });
    });
    map.on('mouseout', () => {
      if (hoverFrame !== null) window.cancelAnimationFrame(hoverFrame);
      hoverFrame = null;
      map.getCanvas().style.cursor = '';
    });

    return () => {
      window.clearTimeout(watchdog);
      if (hoverFrame !== null) window.cancelAnimationFrame(hoverFrame);
      canvas.removeEventListener('pointerdown', down);
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', cancel);
      canvas.removeEventListener('wheel', wheel);
      gestureGuard.pointerCancel();
      map.remove();
      mapRef.current = null;
    };
    // One map, one WebGL context. Other props are managed by effects below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map?.getSource('pulse-population')) return;
    // Collapse quick slider updates into one GeoJSON worker upload per frame.
    const frame = window.requestAnimationFrame(() => {
      const source = map.getSource('pulse-population') as GeoJSONSource | undefined;
      if (source) source.setData(population ?? createCombinedPopulation(scale));
    });
    return () => window.cancelAnimationFrame(frame);
  }, [scale, population]);

  useEffect(() => {
    const map = mapRef.current;
    if (map) applyTagSelection(map, selected);
  }, [selected]);

  useEffect(() => {
    const map = mapRef.current;
    if (map) applyNeutralLights(map, cityLights);
  }, [cityLights]);

  return <div className="map-canvas" ref={container} aria-label={ariaLabel} />;
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
