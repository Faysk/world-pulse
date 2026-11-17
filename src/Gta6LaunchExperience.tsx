import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Map as MapInstance } from 'maplibre-gl';
import { WorldGlobe } from './WorldGlobe';
import { Gta6LaunchLayer } from './Gta6LaunchLayer';
import type { PulseCollection } from './demoData';
import {
  RELEASE_REGIONS, SOURCE_URL, firstUnlock, lastUnlock, previewStart, previewEnd,
  isReleased, nextUnlock, remainingText, formatRelease, type ReleaseRegion
} from './gta6LaunchSchedule';
import './gta6LaunchExperience.css';

const EMPTY: PulseCollection = { type: 'FeatureCollection', features: [] };
const PLAYBACK_DURATION = 45_000;
const fmtTime = (date: number) => new Intl.DateTimeFormat('pt-PT', {
  timeZone: 'Europe/Lisbon', day: '2-digit', month: 'short',
  hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
}).format(new Date(date));

export default function Gta6LaunchExperience() {
  const [map, setMap] = useState<MapInstance | null>(null);
  const [mapError, setMapError] = useState('');
  const [geometryError, setGeometryError] = useState('');
  const [clock, setClock] = useState(Date.now());
  const [preview, setPreview] = useState<number | null>(null);
  const [playing, setPlaying] = useState(false);
  const [playbackRun, setPlaybackRun] = useState(0);
  const [chosenCode, setChosenCode] = useState('PT');

  useEffect(() => {
    // Count down once per second, but render the release wave smoothly at 10 Hz
    // for the first 3.6 seconds following each reference-market unlock.
    const interval = window.setInterval(() => {
      if (document.hidden) return;
      const now = Date.now();
      setClock(previous => {
        const revealing = RELEASE_REGIONS.some(region => {
          const elapsed = now - Date.parse(region.unlockAt);
          return elapsed >= 0 && elapsed < 3600;
        });
        return revealing || Math.floor(previous / 1000) !== Math.floor(now / 1000) ? now : previous;
      });
    }, 100);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!playing) return;
    const startedAt = performance.now();
    const tick = () => {
      const fraction = Math.min(1, (performance.now() - startedAt) / PLAYBACK_DURATION);
      setPreview(previewStart + (previewEnd - previewStart) * fraction);
      if (fraction === 1) setPlaying(false);
    };
    tick();
    const interval = window.setInterval(tick, 100);
    return () => window.clearInterval(interval);
  }, [playing, playbackRun]);

  const time = preview ?? clock;
  const simulated = preview !== null;
  const selected = useMemo(() => RELEASE_REGIONS.find(r => r.code === chosenCode) ?? RELEASE_REGIONS[0], [chosenCode]);
  const unlocked = RELEASE_REGIONS.filter(region => isReleased(region, time)).length;
  const next = nextUnlock(time);
  const percent = Math.round(unlocked / RELEASE_REGIONS.length * 100);
  const pick = useCallback((region: ReleaseRegion) => {
    setChosenCode(region.code);
  }, []);
  const startPlayback = () => {
    setPreview(previewStart);
    setPlaying(true);
    setPlaybackRun(value => value + 1);
  };
  const backToLive = () => {
    setPlaying(false);
    setPreview(null);
    setClock(Date.now());
  };
  const focus = (region: ReleaseRegion) => {
    setChosenCode(region.code);
    map?.flyTo({
      center: region.anchor, zoom: Math.max(map.getZoom(), 3.2),
      speed: 0.8, curve: 1.4, essential: true
    });
  };
  return (
    <main className="gta-launch" aria-label="World Pulse — GTA VI global launch">
      <WorldGlobe
        ariaLabel="Globo com a onda do lançamento de GTA VI"
        scale={0} population={EMPTY} selected={null} cityLights={false}
        onReady={setMap} onZoom={() => {}} onFps={() => {}}
        onTap={() => {}} onTagPick={() => {}} onFailure={setMapError}
      />
      <Gta6LaunchLayer map={map} now={time} simulated={simulated} onPick={pick} onError={setGeometryError}/>
      <div className="gta-launch-vignette" aria-hidden="true"/>
      <header className="gta-launch-header">
        <div className="gta-launch-brand">
          <span className="gta-launch-orbit">◎</span>
          <span>WORLD<span className="gta-launch-brand-accent">PULSE</span></span>
        </div>
        <span className="gta-launch-chip">{simulated ? 'DEMONSTRAÇÃO DA ONDA' : 'CALENDÁRIO REGIONAL'}</span>
      </header>

      <section className="gta-launch-hero" aria-label="Resumo do lançamento">
        <div className="gta-launch-eyebrow">WORLD MOMENT / 001</div>
        <h1>O mundo inteiro.<br/><em>Uma nova Vice City.</em></h1>
        <p>Acompanha a onda do lançamento de GTA VI. Cada região acende quando chega a sua janela de desbloqueio.</p>
        <div className="gta-launch-kpis">
          <div><strong>{unlocked}<small> / {RELEASE_REGIONS.length}</small></strong><span>mercados acompanhados</span></div>
          <div><strong>{next ? remainingText(Date.parse(next.unlockAt) - time) : '00:00:00'}</strong><span>{next ? 'até a próxima liberação' : 'onda concluída'}</span></div>
        </div>
        <div className="gta-launch-progress" role="progressbar" aria-label="Mercados desbloqueados na prévia"
          aria-valuenow={unlocked} aria-valuemin={0} aria-valuemax={RELEASE_REGIONS.length}>
          <div style={{ width: percent + '%' }}/>
        </div>
        <div className="gta-launch-next">
          {next ? <>PRÓXIMA JANELA <strong>{next.label}</strong></> : <strong>Todas as janelas mapeadas foram alcançadas</strong>}
        </div>
        <div className="gta-launch-actions">
          <button type="button" className="gta-launch-play" onClick={startPlayback}>
            {playing ? '↻ Reiniciar onda' : '▶ Ver onda em 45 segundos'}
          </button>
          <button type="button" className="gta-launch-reset" onClick={backToLive} disabled={!simulated}>◷ Tempo real</button>
        </div>
        <div className="gta-launch-time">{simulated ? 'Prévia acelerada · ' : 'Relógio em Portugal · '}{fmtTime(time)}</div>
      </section>

      <aside className="gta-launch-panel" aria-label="Janelas regionais">
        <div className="gta-launch-panel-head">
          <span>REGIÕES</span><span>{RELEASE_REGIONS.length} mercados de referência</span>
        </div>
        <div className="gta-launch-selected">
          <div className="gta-launch-eyebrow">REGIÃO SELECIONADA</div>
          <h2>{selected.label}</h2>
          <strong className={isReleased(selected, time) ? 'released' : ''}>
            {isReleased(selected, time) ? 'DESBLOQUEADO' : remainingText(Date.parse(selected.unlockAt) - time)}
          </strong>
          <small>Liberação local: {formatRelease(selected)}</small>
          <small>{selected.reference ? '* Fuso de referência do mercado; pode não cobrir todas as zonas do país.' : 'Janela de fuso local indicada para este mercado.'}</small>
        </div>
        <div className="gta-launch-regions" role="list" aria-label="Escolher uma região">
          {RELEASE_REGIONS.map(region => (
            <button key={region.code} role="listitem" type="button"
              className={'gta-launch-region' + (region.code === selected.code ? ' chosen' : '')}
              onClick={() => focus(region)}>
              <i style={{ background: isReleased(region, time) ? region.color : '#536073' }}/>
              <span>{region.label}</span>
              <b>{isReleased(region, time) ? 'LIBERADO' : remainingText(Date.parse(region.unlockAt) - time)}</b>
            </button>
          ))}
        </div>
      </aside>
      <footer className="gta-launch-footer">
        <span>VISUALIZAÇÃO DO CALENDÁRIO · NÃO REPRESENTA JOGADORES OU VOTOS REAIS</span>
        <span>Países com vários fusos são ilustrativos (*) e podem libertar em momentos diferentes. Não é mapa oficial de lojas; áreas não mapeadas ficam neutras.</span>
        <a href={SOURCE_URL} rel="noreferrer" target="_blank">Fonte: Rockstar Games Support ↗</a>
        <a href="/" aria-label="Voltar ao World Pulse">Voltar ao World Pulse ↗</a>
      </footer>
      {(mapError || geometryError) && <div className="gta-launch-error" role="alert">
        {mapError || geometryError}
      </div>}
      {!map && !mapError && <div className="gta-launch-loading" role="status">Conectando o planeta…</div>}
    </main>
  );
}
