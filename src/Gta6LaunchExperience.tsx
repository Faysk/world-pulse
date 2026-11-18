import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Map as MapInstance } from 'maplibre-gl';
import { WorldGlobe } from './WorldGlobe';
import { Gta6LaunchLayer } from './Gta6LaunchLayer';
import { useGta6CinematicCamera } from './useGta6CinematicCamera';
import type { UnlockMoment } from './gta6CameraMoments';
import type { PulseCollection } from './demoData';
import {
  RELEASE_REGIONS, SOURCE_URL, previewStart, previewEnd,
  isReleased, remainingText, formatRelease, type ReleaseRegion
} from './gta6LaunchSchedule';
import './gta6LaunchExperience.css';

const EMPTY: PulseCollection = { type: 'FeatureCollection', features: [] };
const NO_HIGHLIGHTS: readonly string[] = [];
const PLAYBACK_DURATION = 45_000;
const OFFICIAL_REGIONS = RELEASE_REGIONS.filter(region => region.verified);
const BRAZIL = OFFICIAL_REGIONS.find(region => region.code === 'BR')!;
const OTHER_MARKETS = OFFICIAL_REGIONS.filter(region => region.code !== 'BR')
  .sort((a, b) => Date.parse(a.unlockAt) - Date.parse(b.unlockAt) ||
    a.label.localeCompare(b.label, 'pt'));
const OFFICIAL_PREVIEW_START = Math.min(...OFFICIAL_REGIONS.map(r => Date.parse(r.unlockAt))) - 20 * 60_000;
const OFFICIAL_PREVIEW_END = Math.max(...OFFICIAL_REGIONS.map(r => Date.parse(r.unlockAt))) + 80 * 60_000;

const formatReference = (date: number) => new Intl.DateTimeFormat('pt-PT', {
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
  const [playbackRange, setPlaybackRange] = useState({ start: OFFICIAL_PREVIEW_START, end: OFFICIAL_PREVIEW_END });
  // Keep the global color-wave visible on arrival; unverified regions are explicitly illustrative.
  const [showSimulation, setShowSimulation] = useState(true);
  const [chosenCode, setChosenCode] = useState('BR');
  const [search, setSearch] = useState('');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);
  const [featuredMoment, setFeaturedMoment] = useState<UnlockMoment | null>(null);

  useEffect(() => {
    const interval = window.setInterval(() => {
      if (document.hidden) return;
      const now = Date.now();
      setClock(previous => {
        const regions = showSimulation ? RELEASE_REGIONS : OFFICIAL_REGIONS;
        const revealing = regions.some(region => {
          const elapsed = now - Date.parse(region.unlockAt);
          return elapsed >= 0 && elapsed < 3600;
        });
        return revealing || Math.floor(previous / 1000) !== Math.floor(now / 1000) ? now : previous;
      });
    }, 100);
    return () => window.clearInterval(interval);
  }, [showSimulation]);

  useEffect(() => {
    if (!playing) return;
    const started = performance.now();
    const advance = () => {
      const fraction = Math.min(1, (performance.now() - started) / PLAYBACK_DURATION);
      setPreview(playbackRange.start + (playbackRange.end - playbackRange.start) * fraction);
      if (fraction >= 1) setPlaying(false);
    };
    advance();
    const interval = window.setInterval(advance, 100);
    return () => window.clearInterval(interval);
  }, [playing, playbackRun, playbackRange]);

  useEffect(() => {
    if (!infoOpen && !drawerOpen) return;
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setInfoOpen(false);
        setDrawerOpen(false);
      }
    };
    window.addEventListener('keydown', onEscape);
    return () => window.removeEventListener('keydown', onEscape);
  }, [infoOpen, drawerOpen]);

  const time = preview ?? clock;
  const isReplay = preview !== null;
  const { userPaused, pauseCamera, releaseCamera, focusManually } =
    useGta6CinematicCamera(map, time, isReplay, playbackRun, showSimulation, setFeaturedMoment);

  const selected = useMemo(() => RELEASE_REGIONS.find(r => r.code === chosenCode) ?? BRAZIL, [chosenCode]);
  const visibleRegions = useMemo(() => {
    const pool = showSimulation ? RELEASE_REGIONS : OFFICIAL_REGIONS;
    const needle = search.trim().toLocaleLowerCase('pt');
    return pool.filter(region => !needle ||
      region.label.toLocaleLowerCase('pt').includes(needle) ||
      region.code.toLowerCase().includes(needle));
  }, [search, showSimulation]);

  const selectedRemaining = Date.parse(selected.unlockAt) - time;
  const brazilRemaining = Date.parse(BRAZIL.unlockAt) - time;
  const knownCompleted = OFFICIAL_REGIONS.filter(region => isReleased(region, time)).length;
  const showCountry = useCallback((region: ReleaseRegion) => {
    setChosenCode(region.code);
    setDrawerOpen(true);
  }, []);
  const focus = (region: ReleaseRegion) => {
    setChosenCode(region.code);
    focusManually(region.anchor, 3.1);
  };
  const resetToLive = () => {
    releaseCamera();
    setPlaying(false);
    setPreview(null);
    setClock(Date.now());
  };
  const setMode = (enableSimulation: boolean) => {
    if (enableSimulation === showSimulation) return;
    resetToLive();
    setShowSimulation(enableSimulation);
    setSearch('');
    setChosenCode('BR');
  };
  const startPlayback = () => {
    releaseCamera();
    const range = showSimulation
      ? { start: previewStart, end: previewEnd }
      : { start: OFFICIAL_PREVIEW_START, end: OFFICIAL_PREVIEW_END };
    setPlaybackRange(range);
    setPreview(range.start);
    setPlaying(true);
    setPlaybackRun(run => run + 1);
  };

  return (
    <main className="gta-launch" aria-label="World Pulse — GTA VI global launch">
      <WorldGlobe
        ariaLabel="Globo interativo do lançamento de GTA VI"
        scale={0} population={EMPTY} selected={null} cityLights={false}
        initialZoom={2.12}
        onReady={setMap} onZoom={() => {}} onFps={() => {}}
        onTap={() => {}} onTagPick={() => {}} onFailure={setMapError}
      />
      <Gta6LaunchLayer
        map={map} now={time} simulated={isReplay} showSimulation={showSimulation}
        highlightedCodes={featuredMoment?.codes ?? NO_HIGHLIGHTS}
        onPick={showCountry} onError={setGeometryError}
      />
      <div className="gta-launch-vignette" aria-hidden="true" />

      <header className="gta-launch-header">
        <a className="gta-launch-brand" href="/" aria-label="World Pulse — início">
          <span className="gta-launch-orbit" aria-hidden="true">◎</span>
          <span>WORLD<span className="gta-launch-brand-accent">PULSE</span></span>
          <span className="gta-launch-event-name">GTA VI</span>
        </a>
        <div className="gta-launch-header-actions">
          <button type="button" className="gta-launch-header-btn gta-launch-mode-btn"
            aria-pressed={showSimulation} onClick={() => setMode(!showSimulation)}>
            {showSimulation ? '◉ Onda mundial' : '◯ Só confirmados'}
          </button>
          <button type="button" className="gta-launch-header-btn"
            aria-expanded={drawerOpen} onClick={() => { setDrawerOpen(!drawerOpen); setInfoOpen(false); }}>
            Regiões
          </button>
          <button type="button" className="gta-launch-header-btn gta-launch-info-btn"
            aria-label="Informações e fontes" aria-expanded={infoOpen}
            onClick={() => { setInfoOpen(!infoOpen); setDrawerOpen(false); }}>ⓘ</button>
        </div>
      </header>

      <section className="gta-launch-countdowns" aria-label="Contadores do lançamento">
        <div className="gta-launch-primary-label"><span className="gta-launch-primary-dot" /> PLAYSTATION STORE · BRASIL</div>
        <div className="gta-launch-br-title"><span aria-hidden="true">🇧🇷</span><h1>Brasil</h1></div>
        <div className="gta-launch-big-time" role="timer" aria-label="Contagem regressiva do Brasil" aria-live="off">
          {brazilRemaining <= 0 ? 'LIBERADO' : remainingText(brazilRemaining)}
        </div>
        <p className="gta-launch-br-subtitle">
          {brazilRemaining <= 0 ? 'Disponível na conta brasileira' : '19 NOV · 00:00 (horário de Brasília)'}
        </p>
        <div className="gta-launch-market-divider" />
        <div className="gta-launch-secondary-title">OUTROS MERCADOS CONFIRMADOS</div>
        <div className="gta-launch-next-markets">
          {OTHER_MARKETS.map(region => (
            <button className="gta-launch-market" type="button" key={region.code}
              onClick={() => { setDrawerOpen(true); focus(region); }}>
              <span className="gta-launch-market-name">{region.label}</span>
              <span className={'gta-launch-market-time' + (isReleased(region, time) ? ' is-live' : '')}>
                {isReleased(region, time) ? 'LIBERADO' : remainingText(Date.parse(region.unlockAt) - time)}
              </span>
            </button>
          ))}
        </div>
        <div className="gta-launch-mode-footnote">
          {showSimulation ? 'Onda mundial ilustrativa · 4 mercados com horário verificado'
            : `${knownCompleted}/${OFFICIAL_REGIONS.length} mercados verificados · demais territórios neutros`}
        </div>
      </section>

      {featuredMoment && <div className="gta-launch-cinema" aria-live="off">
        <span className="gta-launch-cinema-eyebrow">
          <span className="gta-launch-cinema-pulse" aria-hidden="true" />
          {featuredMoment.verified ? 'LIBERAÇÃO CONFIRMADA' : 'SIMULAÇÃO DE VIRADA LOCAL'}
        </span>
        <strong>{featuredMoment.title}</strong>
        <small>{featuredMoment.regions.length} {featuredMoment.regions.length === 1 ? 'território' : 'territórios'} nesta janela</small>
      </div>}

      <nav className="gta-launch-controls" aria-label="Controles do evento">
        <button type="button" className="gta-launch-play" onClick={startPlayback}>
          {playing ? '↻ Reiniciar onda' : '▶ Ver onda em 45s'}
        </button>
        {isReplay && <button type="button" className="gta-launch-control" onClick={resetToLive}>◷ Tempo real</button>}
        <button type="button" className="gta-launch-control"
          onClick={() => userPaused ? releaseCamera() : pauseCamera(120_000)}>
          {userPaused ? '↻ Retomar câmera' : 'Ⅱ Pausar câmera'}
        </button>
        {isReplay && <span className="gta-launch-replay-label">Replay · {formatReference(time)} (PT)</span>}
      </nav>

      {drawerOpen && <aside className="gta-launch-drawer" aria-label="Regiões do evento">
        <div className="gta-launch-drawer-header">
          <strong>Regiões</strong>
          <button type="button" onClick={() => setDrawerOpen(false)} aria-label="Fechar regiões">✕</button>
        </div>
        <div className="gta-launch-selected">
          <div className="gta-launch-eyebrow">{selected.verified ? 'HORÁRIO VERIFICADO' : 'SEM CONFIRMAÇÃO DE LOJA'}</div>
          <h2>{selected.label}</h2>
          <strong className={isReleased(selected, time) ? 'released' : ''}>
            {selected.verified
              ? (isReleased(selected, time) ? 'LIBERADO' : remainingText(selectedRemaining))
              : (showSimulation
                  ? (isReleased(selected, time) ? 'VIRADA SIMULADA' : remainingText(selectedRemaining))
                  : 'NÃO VERIFICADO')}
          </strong>
          <small>{selected.verified
            ? `PlayStation Store · ${formatRelease(selected.windows[0])}`
            : 'Não confirma que o jogo esteja à venda neste território.'}</small>
          {selected.storeUrl && <a href={selected.storeUrl} rel="noreferrer" target="_blank">
            Ver horário na PlayStation Store ↗
          </a>}
        </div>
        <label className="gta-launch-search-label" htmlFor="gta-launch-filter">Buscar território</label>
        <input className="gta-launch-search" id="gta-launch-filter" type="search"
          value={search} onChange={event => setSearch(event.target.value)}
          placeholder="Brasil, Japão, Canadá…" aria-label="Buscar território" />
        <div className="gta-launch-regions" role="list" aria-label="Escolher uma região">
          {visibleRegions.map(region => (
            <button key={region.code} type="button" role="listitem"
              className={'gta-launch-region' + (region.code === selected.code ? ' chosen' : '')}
              onClick={() => focus(region)}>
              <i style={{ background: region.verified && isReleased(region, time) ? region.color : '#647286' }} />
              <span>{region.label}</span>
              <b>{region.verified
                ? (isReleased(region, time) ? 'LIBERADO' : remainingText(Date.parse(region.unlockAt) - time))
                : 'SIMULAÇÃO'}</b>
            </button>
          ))}
        </div>
      </aside>}

      {infoOpen && <aside className="gta-launch-info-panel" role="dialog" aria-label="Informações e fontes">
        <div className="gta-launch-drawer-header">
          <strong>Sobre este mapa</strong>
          <button type="button" onClick={() => setInfoOpen(false)} aria-label="Fechar informações">✕</button>
        </div>
        <p>Rosa e laranja indicam horários de desbloqueio verificados na PlayStation Store. Áreas cinza não possuem horário de loja confirmado nesta visualização.</p>
        <p>A Rússia permanece neutra. Isso não significa que pessoas nesses territórios não possam jogar com contas de outros mercados.</p>
        <p>A <b>Onda mundial</b> é exibida por padrão: mostra horários verificados nas lojas e uma simulação ilustrativa da meia-noite nos demais territórios. Use <b>Só confirmados</b> para ocultar a simulação. Cores não representam jogadores reais.</p>
        <div className="gta-launch-info-links">
          <a href={SOURCE_URL} target="_blank" rel="noreferrer">Rockstar Games — lançamento ↗</a>
          {BRAZIL.storeUrl && <a href={BRAZIL.storeUrl} target="_blank" rel="noreferrer">PlayStation Store Brasil ↗</a>}
          <a href="/">Voltar ao World Pulse ↗</a>
        </div>
      </aside>}

      {(mapError || geometryError) && <div className="gta-launch-error" role="alert">{mapError || geometryError}</div>}
      {!map && !mapError && <div className="gta-launch-loading" role="status">Conectando o planeta…</div>}
    </main>
  );
}
