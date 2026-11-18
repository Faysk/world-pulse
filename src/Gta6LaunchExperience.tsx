import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Map as MapInstance } from 'maplibre-gl';
import { WorldGlobe } from './WorldGlobe';
import { Gta6LaunchLayer } from './Gta6LaunchLayer';
import { useGta6CinematicCamera } from './useGta6CinematicCamera';
import type { UnlockMoment } from './gta6CameraMoments';
import type { PulseCollection } from './demoData';
import {
  RELEASE_REGIONS, VERIFIED_COUNTRY_CODES, SOURCE_URL, previewStart, previewEnd,
  isReleased, remainingText, formatRelease, nextMarkets, lastReleasedMarkets,
  type ReleaseRegion
} from './gta6LaunchSchedule.ts';
import { ROCKSTAR_MARKETS_URL } from './gta6MarketSources.ts';
import { gta6TestSeconds } from './gta6TestMode.ts';
import './gta6LaunchExperience.css';

const EMPTY: PulseCollection = { type:'FeatureCollection',features:[] };
const NO_HIGHLIGHTS: readonly string[] = [];
const BRAZIL = RELEASE_REGIONS.find(region => region.code === 'BR')!;
const TEST_SECONDS = gta6TestSeconds(window.location.search);

const formatPortugalTime = (date: number) => new Intl.DateTimeFormat('pt-PT',{
  timeZone:'Europe/Lisbon', day:'2-digit',month:'short',
  hour:'2-digit',minute:'2-digit',hourCycle:'h23'
}).format(new Date(date));

function splitTimer(ms:number): {days:string;clock:string} {
  const source=remainingText(ms);
  const match=source.match(/^(?:(\d+)d )?(\d{2}:\d{2}:\d{2})$/);
  return {days:match?.[1]??'',clock:match?.[2]??source};
}

export default function Gta6LaunchExperience() {
  const [map,setMap] = useState<MapInstance|null>(null);
  const [mapError,setMapError] = useState('');
  const [geometryError,setGeometryError] = useState('');
  const [clock,setClock] = useState(Date.now());
  const [preview,setPreview] = useState<number|null>(TEST_SECONDS === null ? null : previewStart);
  const [playing,setPlaying] = useState(false);
  const [playbackRun,setPlaybackRun] = useState(0);
  const startedTest = useRef(false);
  const [chosenCode,setChosenCode] = useState('BR');
  const [search,setSearch] = useState('');
  const [drawerOpen,setDrawerOpen] = useState(false);
  const [infoOpen,setInfoOpen] = useState(false);
  const [featuredMoment,setFeaturedMoment] = useState<UnlockMoment|null>(null);

  useEffect(() => {
    let timer=0;
    const update = () => {
      if (document.hidden) { timer=window.setTimeout(update,500); return; }
      const now=Date.now();
      setClock(previous=>{
        const revealing=RELEASE_REGIONS.some(region=>{
          const elapsed=now-Date.parse(region.unlockAt);
          return elapsed>=0 && elapsed<5_600;
        });
        return revealing || Math.floor(previous/1000)!==Math.floor(now/1000) ? now : previous;
      });
      const active=RELEASE_REGIONS.some(region=>{
        const elapsed=now-Date.parse(region.unlockAt);
        return elapsed>=0 && elapsed<5_600;
      });
      timer=window.setTimeout(update,active?40:220);
    };
    update();
    return () => window.clearTimeout(timer);
  },[]);

  // A URL replay can only start when the map is ready; otherwise the initial
  // country releases happen before the cinematic camera has a globe to move.
  useEffect(() => {
    if (!map || TEST_SECONDS===null || startedTest.current) return;
    startedTest.current=true;
    setPreview(previewStart);
    setPlaybackRun(value=>value+1);
    setPlaying(true);
  },[map]);

  useEffect(() => {
    if (!playing || TEST_SECONDS===null) return;
    const startedAt=performance.now();
    let frame=0;
    let lastTick=-Infinity;
    const tick=(now:number)=>{
      const elapsed=now-startedAt;
      if (now-lastTick>=50 || elapsed>=TEST_SECONDS*1000) {
        const fraction=Math.min(1,elapsed/(TEST_SECONDS*1000));
        setPreview(previewStart+(previewEnd-previewStart)*fraction);
        lastTick=now;
        if(fraction>=1){setPlaying(false);return;}
      }
      frame=window.requestAnimationFrame(tick);
    };
    frame=window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frame);
  },[playing,playbackRun]);

  useEffect(()=>{
    if (!infoOpen && !drawerOpen) return;
    const key=(event:KeyboardEvent)=>{
      if(event.key==='Escape'){setInfoOpen(false);setDrawerOpen(false);}
    };
    window.addEventListener('keydown',key);
    return ()=>window.removeEventListener('keydown',key);
  },[infoOpen,drawerOpen]);

  const time=preview??clock;
  const replayMode=TEST_SECONDS!==null;
  const {userPaused,pauseCamera,releaseCamera,focusManually} =
    useGta6CinematicCamera(map,time,replayMode,playbackRun,true,setFeaturedMoment);
  const selected=useMemo(()=>
    RELEASE_REGIONS.find(region=>region.code===chosenCode)??BRAZIL,[chosenCode]);
  const visibleRegions=useMemo(()=>{
    const needle=search.trim().toLocaleLowerCase('pt');
    return [...RELEASE_REGIONS].sort((a,b)=>Date.parse(a.unlockAt)-Date.parse(b.unlockAt) ||
      a.label.localeCompare(b.label,'pt')).filter(region=>!needle ||
      region.label.toLocaleLowerCase('pt').includes(needle) ||
      region.code.toLowerCase().includes(needle));
  },[search]);
  const brazilRemaining=Date.parse(BRAZIL.unlockAt)-time;
  const brasilTimer=splitTimer(brazilRemaining);
  const upcoming=nextMarkets(time,3);
  const released=lastReleasedMarkets(time,3);
  const completedCount=RELEASE_REGIONS.length-upcoming.length-
    RELEASE_REGIONS.filter(region=>Date.parse(region.unlockAt)>time).length+upcoming.length;
  // Keep the official source clock as the primary time regardless of location.
  const showCountry=useCallback((region:ReleaseRegion)=>{
    setChosenCode(region.code);
    setDrawerOpen(true);
  },[]);
  const focus=(region:ReleaseRegion)=>{
    setChosenCode(region.code);
    focusManually(region.anchor,3.15);
  };

  return (
    <main className="gta-launch" aria-label="World Pulse — GTA VI lançamento global">
      <WorldGlobe
        ariaLabel="Globo interativo do lançamento de GTA VI"
        scale={0} population={EMPTY} selected={null} cityLights={false}
        initialZoom={2.12} onReady={setMap} onZoom={()=>{}} onFps={()=>{}}
        onTap={()=>{}} onTagPick={()=>{}} onFailure={setMapError}
      />
      <Gta6LaunchLayer
        map={map} now={time} simulated={replayMode}
        replaySeconds={TEST_SECONDS??45}
        highlightedCodes={featuredMoment?.codes??NO_HIGHLIGHTS}
        onPick={showCountry} onError={setGeometryError}
      />
      <div className="gta-launch-vignette" aria-hidden="true"/>

      <header className="gta-launch-header">
        <a className="gta-launch-brand" href="/" aria-label="World Pulse início">
          <span className="gta-launch-orbit" aria-hidden="true">◎</span>
          <span>WORLD<span className="gta-launch-brand-accent">PULSE</span></span>
          <span className="gta-launch-event-name">GTA VI</span>
        </a>
        <div className="gta-launch-header-actions">
          <span className={'gta-launch-live' + (replayMode?' is-test':'')}>
            <i aria-hidden="true"/>{replayMode?'TESTE · '+TEST_SECONDS+'s':'AO VIVO'}
          </span>
          <button type="button" className="gta-launch-header-btn"
            aria-expanded={drawerOpen} onClick={()=>{setDrawerOpen(!drawerOpen);setInfoOpen(false);}}>
            Regiões
          </button>
          <button type="button" className="gta-launch-header-btn gta-launch-info-btn"
            aria-label="Informações e fontes" aria-expanded={infoOpen}
            onClick={()=>{setInfoOpen(!infoOpen);setDrawerOpen(false);}}>ⓘ</button>
        </div>
      </header>

      <section className="gta-launch-countdowns" aria-label="Contadores do lançamento">
        <div className="gta-launch-primary-label">
          <span className="gta-launch-primary-dot"/>PLAYSTATION STORE · BRASIL
        </div>
        <div className="gta-launch-br-title"><h1>Brasil</h1></div>
        <div className="gta-launch-big-time" role="timer"
          aria-label="Contagem regressiva do Brasil" aria-live="off">
          {brazilRemaining<=0?'LIBERADO':<>
            {brasilTimer.days && <span className="gta-launch-big-days">{brasilTimer.days}d</span>}
            <span className="gta-launch-big-clock">{brasilTimer.clock}</span>
          </>}
        </div>
        <p className="gta-launch-br-subtitle">
          {brazilRemaining<=0 ? 'Liberado na PlayStation Store brasileira'
            : '19 NOV · 00:00 (horário de Brasília)'}
        </p>

        <div className="gta-launch-market-divider"/>
        <section className="gta-launch-history-block" aria-label="Próximas liberações">
          <h2 className="gta-launch-secondary-title">
            <span className="gta-launch-section-dot next" aria-hidden="true"/>
            PRÓXIMAS LIBERAÇÕES
          </h2>
          <div className="gta-launch-next-markets">
            {upcoming.length ? upcoming.map(region=>(
              <button className="gta-launch-market" type="button" key={region.code}
                onClick={()=>{setDrawerOpen(true);focus(region);}}>
                <span className="gta-launch-market-name">{region.label}</span>
                <span className="gta-launch-market-time">
                  {remainingText(Date.parse(region.unlockAt)-time)}
                </span>
              </button>
            )):<p className="gta-launch-empty">Todas as liberações anunciadas foram alcançadas.</p>}
          </div>
        </section>

        <section className="gta-launch-history-block gta-launch-recent" aria-label="Últimos 3 liberados">
          <h2 className="gta-launch-secondary-title">
            <span className="gta-launch-section-dot released" aria-hidden="true"/>
            ÚLTIMOS 3 LIBERADOS
          </h2>
          <div className="gta-launch-next-markets">
            {released.length ? released.map(region=>(
              <button className="gta-launch-market" type="button" key={region.code}
                onClick={()=>{setDrawerOpen(true);focus(region);}}>
                <span className="gta-launch-market-name">{region.label}</span>
                <span className="gta-launch-market-time is-live">LIBERADO</span>
              </button>
            )):<p className="gta-launch-empty">Aguardando a primeira liberação.</p>}
          </div>
        </section>
        <p className="gta-launch-market-progress">{RELEASE_REGIONS.filter(region=>isReleased(region,time)).length}/{RELEASE_REGIONS.length} mercados alcançados</p>
      </section>

      {featuredMoment && <div className="gta-launch-cinema" aria-live="off">
        <span className="gta-launch-cinema-eyebrow">
          <span className="gta-launch-cinema-pulse" aria-hidden="true"/>
          {featuredMoment.verified?'PLAYSTATION STORE · LIBERAÇÃO':'JANELA REGIONAL · ROCKSTAR'}
        </span>
        <strong>{featuredMoment.title}</strong>
        <small>{featuredMoment.regions.length} {featuredMoment.regions.length===1?'mercado':'mercados'} nesta janela</small>
      </div>}

      <nav className="gta-launch-controls" aria-label="Controles da câmera">
        <button type="button" className="gta-launch-control"
          onClick={()=>userPaused?releaseCamera():pauseCamera(120_000)}>
          {userPaused?'↻ Retomar câmera':'Ⅱ Pausar câmera'}
        </button>
        {replayMode && <a className="gta-launch-control gta-launch-return" href="?moment=gta6">◷ Voltar ao vivo</a>}
        {replayMode && <span className="gta-launch-replay-label">
          {playing?'Teste em andamento':'Teste concluído'} · {formatPortugalTime(time)} (PT)
        </span>}
      </nav>

      {drawerOpen && <aside className="gta-launch-drawer" aria-label="Mercados do evento">
        <div className="gta-launch-drawer-header">
          <strong>Mercados participantes</strong>
          <button type="button" onClick={()=>setDrawerOpen(false)} aria-label="Fechar regiões">✕</button>
        </div>
        <div className="gta-launch-selected">
          <div className="gta-launch-eyebrow">
            {selected.verified?'HORÁRIO NA PLAYSTATION STORE':'HORÁRIO PELA REGRA DA ROCKSTAR'}
          </div>
          <h2>{selected.label}</h2>
          <strong className={isReleased(selected,time)?'released':''}>
            {isReleased(selected,time)?'LIBERADO':remainingText(Date.parse(selected.unlockAt)-time)}
          </strong>
          <small>{formatRelease(selected.windows[0])} · Hora local do mercado</small>
          <small>{selected.verified
            ? 'Horário conferido na página regional da PlayStation Store.'
            : 'Mercado anunciado pela Rockstar. Horário calculado pela regra oficial de meia-noite local.'}</small>
          <a href={selected.storeUrl??ROCKSTAR_MARKETS_URL} target="_blank" rel="noreferrer">
            {selected.storeUrl?'Ver na PlayStation Store ↗':'Conferir anúncio da Rockstar ↗'}
          </a>
        </div>
        <label className="gta-launch-search-label" htmlFor="gta-launch-filter">Buscar mercado</label>
        <input className="gta-launch-search" id="gta-launch-filter" type="search"
          value={search} onChange={event=>setSearch(event.target.value)}
          placeholder="Brasil, Japão, Nova Zelândia…" aria-label="Buscar mercado"/>
        <div className="gta-launch-regions" role="list" aria-label="Escolher mercado">
          {visibleRegions.map(region=>(
            <button key={region.code} type="button" role="listitem"
              className={'gta-launch-region'+(region.code===selected.code?' chosen':'')}
              onClick={()=>focus(region)}>
              <i style={{background:isReleased(region,time)?region.color:'#647286'}}/>
              <span>{region.label}</span>
              <b>{isReleased(region,time)?'LIBERADO':remainingText(Date.parse(region.unlockAt)-time)}</b>
            </button>
          ))}
        </div>
      </aside>}

      {infoOpen && <aside className="gta-launch-info-panel" role="dialog" aria-label="Informações e fontes">
        <div className="gta-launch-drawer-header">
          <strong>Sobre o lançamento</strong>
          <button type="button" onClick={()=>setInfoOpen(false)} aria-label="Fechar informações">✕</button>
        </div>
        <p>Este mapa usa os países anunciados para pré-venda na PlayStation Store e a regra de lançamento regional publicada pela Rockstar: 19 de novembro, à meia-noite local.</p>
        <p>{VERIFIED_COUNTRY_CODES.length} mercados possuem hora UTC consultada diretamente na loja. Nos outros, o horário é calculado pelo fuso principal do mercado e pode variar conforme a loja digital.</p>
        <p>Regiões não anunciadas, como Rússia e Coreia do Norte, permanecem neutras. Isso não comprova que jogar com conta estrangeira seja impossível. As cores não representam jogadores reais.</p>
        <div className="gta-launch-info-links">
          <a href={ROCKSTAR_MARKETS_URL} target="_blank" rel="noreferrer">Rockstar — mercados anunciados ↗</a>
          <a href={SOURCE_URL} target="_blank" rel="noreferrer">Rockstar — horários de lançamento ↗</a>
          {BRAZIL.storeUrl && <a href={BRAZIL.storeUrl} target="_blank" rel="noreferrer">PlayStation Store Brasil ↗</a>}
          <a href="/">Voltar ao World Pulse ↗</a>
        </div>
      </aside>}

      {(mapError||geometryError) && <div className="gta-launch-error" role="alert">{mapError||geometryError}</div>}
      {!map&&!mapError && <div className="gta-launch-loading" role="status">Conectando o planeta…</div>}
    </main>
  );
}
