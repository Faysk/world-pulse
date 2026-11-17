import { useCallback, useEffect, useRef, useState } from 'react';
import type { Map as MapInstance } from 'maplibre-gl';
import {
  GTA6_UNLOCK_MOMENTS, crossedUnlockMoments, type UnlockMoment
} from './gta6CameraMoments';

const IDLE_ROTATION_DEGREES_PER_SECOND = 0.34;
const MANUAL_PAUSE_MS = 30_000;
const RESTING_ZOOM = 1.65;

type Phase = 'idle' | 'spotlight' | 'returning';

type Director = {
  phase: Phase;
  lastClock: number | null;
  replayKey: string;
  pending: UnlockMoment | null;
  focusUntil: number;
  returnUntil: number;
  pausedUntil: number;
  userPaused: boolean;
  lastFrame: number;
  lastRotation: number;
};

const INITIAL_DIRECTOR = (): Director => ({
  phase: 'idle', lastClock: null, replayKey: '',
  pending: null, focusUntil: 0, returnUntil: 0,
  pausedUntil: 0, userPaused: false, lastFrame: 0, lastRotation: 0
});

export function useGta6CinematicCamera(
  map: MapInstance | null,
  clock: number,
  simulated: boolean,
  playbackRun: number,
  onMoment: (moment: UnlockMoment | null) => void
) {
  const [userPaused, setUserPaused] = useState(false);
  const director = useRef<Director>(INITIAL_DIRECTOR());
  const callback = useRef(onMoment);
  const reducedMotion = useRef(false);
  const mode = useRef({ simulated, playbackRun });
  callback.current = onMoment;
  mode.current = { simulated, playbackRun };

  const clearSpotlight = useCallback(() => callback.current(null), []);

  const beginSpotlight = useCallback((moment: UnlockMoment, now: number) => {
    if (!map || director.current.userPaused || reducedMotion.current || document.hidden) return;
    const state = director.current;
    state.phase = 'spotlight';
    state.focusUntil = now + (mode.current.simulated ? 1_400 : 5_600);
    state.lastRotation = now;
    callback.current(moment);
    // Use elapsed duration rather than speed to keep the tour predictable
    // in the accelerated 45-second replay, without teleporting the camera.
    map.flyTo({
      center: moment.center,
      zoom: moment.zoom,
      duration: mode.current.simulated ? 680 : 1_650,
      curve: 1.35,
      essential: false
    });
  }, [map]);

  const releaseCamera = useCallback(() => {
    const state = director.current;
    state.userPaused = false;
    state.pausedUntil = 0;
    state.pending = null;
    state.focusUntil = 0;
    state.lastRotation = 0;
    setUserPaused(false);
    clearSpotlight();
    if (!map || reducedMotion.current) {
      state.phase = 'idle';
      return;
    }
    state.phase = 'returning';
    state.returnUntil = performance.now() + 1_100;
    map.easeTo({ zoom: RESTING_ZOOM, duration: 900, essential: false });
  }, [map, clearSpotlight]);

  const pauseCamera = useCallback((seconds = MANUAL_PAUSE_MS) => {
    const state = director.current;
    state.userPaused = true;
    state.pausedUntil = performance.now() + seconds;
    state.pending = null;
    state.phase = 'idle';
    state.lastRotation = 0;
    setUserPaused(true);
    clearSpotlight();
    map?.stop();
  }, [map, clearSpotlight]);

  const focusManually = useCallback((center: [number, number], zoom = 3) => {
    pauseCamera();
    map?.flyTo({
      center, zoom: Math.max(zoom, 2.5), duration: 1_200,
      curve: 1.35, essential: false
    });
  }, [map, pauseCamera]);

  // Only events crossed since this viewer arrived can trigger a camera move.
  // Reloading after a release must not replay all previous releases at once.
  useEffect(() => {
    if (!map) return;
    const state = director.current;
    const key = (simulated ? 'replay:' : 'live:') + playbackRun;
    if (state.replayKey !== key) {
      state.replayKey = key;
      state.lastClock = clock;
      state.pending = null;
      state.phase = 'idle';
      state.focusUntil = 0;
      clearSpotlight();
      return;
    }
    const previous = state.lastClock;
    state.lastClock = clock;
    if (previous === null || clock <= previous) return;
    if (reducedMotion.current || state.userPaused || document.hidden) return;

    const crossed = crossedUnlockMoments(GTA6_UNLOCK_MOMENTS, previous, clock);
    if (!crossed.length) return;
    // A replay can cross multiple instants between two render frames. Always
    // prefer a verified-store event, otherwise the latest simultaneous group.
    const preferred = [...crossed].reverse().find(item => item.verified) ?? crossed[crossed.length - 1];
    if (state.phase === 'spotlight' && performance.now() < state.focusUntil) {
      if (!state.pending || preferred.verified || !state.pending.verified) {
        state.pending = preferred;
      }
      return;
    }
    beginSpotlight(preferred, performance.now());
  }, [map, clock, simulated, playbackRun, beginSpotlight, clearSpotlight]);

  useEffect(() => {
    if (!map) return;
    const state = director.current;
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onMotionChange = () => {
      reducedMotion.current = media.matches;
      if (media.matches) {
        state.phase = 'idle';
        state.pending = null;
        state.lastRotation = 0;
        map.stop();
        clearSpotlight();
      }
    };
    onMotionChange();
    media.addEventListener('change', onMotionChange);

    const canvas = map.getCanvas();
    const manualInteraction = () => pauseCamera();
    // Real pointer/wheel/key gestures stop the cinematic tour. MapLibre's own
    // programmatic move events are deliberately not treated as user gestures.
    canvas.addEventListener('pointerdown', manualInteraction, { passive: true });
    canvas.addEventListener('wheel', manualInteraction, { passive: true });
    const onKey = (event: KeyboardEvent) => {
      if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','+','-','=','PageUp','PageDown'].includes(event.key)) manualInteraction();
    };
    canvas.addEventListener('keydown', onKey);

    let frame = 0;
    const tick = (now: number) => {
      frame = window.requestAnimationFrame(tick);
      const state = director.current;
      if (!state.lastFrame) state.lastFrame = now;
      const elapsed = Math.min(0.15, (now - state.lastFrame) / 1000);
      state.lastFrame = now;

      if (document.hidden || reducedMotion.current) {
        state.lastRotation = 0;
        return;
      }
      if (state.userPaused) {
        if (now >= state.pausedUntil) {
          state.userPaused = false;
          state.pausedUntil = 0;
          setUserPaused(false);
          state.phase = 'returning';
          state.returnUntil = now + 1100;
          map.easeTo({ zoom: RESTING_ZOOM, duration: 900, essential: false });
        }
        return;
      }

      if (state.phase === 'spotlight' && now >= state.focusUntil) {
        clearSpotlight();
        const pending = state.pending;
        state.pending = null;
        if (pending) {
          beginSpotlight(pending, now);
          return;
        }
        state.phase = 'returning';
        state.returnUntil = now + (mode.current.simulated ? 750 : 1_450);
        map.easeTo({
          zoom: RESTING_ZOOM,
          duration: mode.current.simulated ? 620 : 1_250,
          essential: false
        });
        return;
      }
      if (state.phase === 'returning' && now >= state.returnUntil) {
        state.phase = 'idle';
        state.lastRotation = now;
      }

      if (state.phase !== 'idle' || map.isMoving()) return;
      // Throttle GPU camera writes: the RAF loop is cheap, but maps do not
      // need sixty source/camera mutations a second while drifting.
      if (now - state.lastRotation < 58) return;
      const seconds = Math.min(elapsed + (now - state.lastRotation) / 1000, 0.14);
      state.lastRotation = now;
      const center = map.getCenter();
      map.jumpTo({
        center: [center.lng + IDLE_ROTATION_DEGREES_PER_SECOND * seconds, center.lat],
        zoom: map.getZoom()
      });
    };
    frame = window.requestAnimationFrame(tick);
    return () => {
      window.cancelAnimationFrame(frame);
      media.removeEventListener('change', onMotionChange);
      canvas.removeEventListener('pointerdown', manualInteraction);
      canvas.removeEventListener('wheel', manualInteraction);
      canvas.removeEventListener('keydown', onKey);
      clearSpotlight();
      director.current = INITIAL_DIRECTOR();
    };
  }, [map, pauseCamera, clearSpotlight, beginSpotlight]);

  return { userPaused, pauseCamera, releaseCamera, focusManually };
}
