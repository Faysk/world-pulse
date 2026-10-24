import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import type { Map as MapInstance } from 'maplibre-gl';
import { TAGS, createCombinedPopulation, createScenarioPopulation, POPULATION_SCENARIOS,
  scenarioDescription, type ScenarioDistribution, type TagId } from './demoData';
import { WorldGlobe, flyToTag, resetGlobe } from './WorldGlobe';
import { EMPTY_SECONDS, creditTap, creditedTotal } from './domain';
import { SteamPanel } from './SteamPanel';

// Steam remains in the repository but is deliberately NOT part of the
// public World Pulse experience. The development-only preview is opt-in.
// Query parameters cannot re-enable it in production builds.
const STEAM_PANEL_ENABLED = import.meta.env.DEV &&
  new URLSearchParams(window.location.search).get('steamPreview') === '1';

const format = (n: number) => Intl.NumberFormat('pt-BR').format(n);
const compact = (n: number) => n >= 1_000_000 ? Intl.NumberFormat('pt-BR', { notation: 'compact', maximumFractionDigits: 2 }).format(n) : format(n);

export default function App() {
  const mapRef = useRef<MapInstance | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<TagId | null>(null);
  const [scale, setScale] = useState(1);
  const [scenario, setScenario] = useState<number | null>(null);
  const [distribution, setDistribution] = useState<ScenarioDistribution>('distributed');
  const [cityLights, setCityLights] = useState(true);
  const [animate, setAnimate] = useState(false);
  const [zoom, setZoom] = useState(1.65);
  const [fps, setFps] = useState(0);
  const [showHelp, setShowHelp] = useState(false);
  // The globe stays the primary surface on narrow screens.
  // Ranking and visual laboratory are opt-in overlays on mobile.
  const [rankingOpen, setRankingOpen] = useState(() => window.innerWidth > 620);
  const [labOpen, setLabOpen] = useState(() => window.innerWidth > 620);
  const [localSeconds, setLocalSeconds] = useState<Record<TagId, number>>(() => ({ ...EMPTY_SECONDS }));
  const [flash, setFlash] = useState(false);

  const population = useMemo(() => scenario === null ? createCombinedPopulation(scale)
    : createScenarioPopulation(scenario, distribution), [scale, scenario, distribution]);
  const populations = useMemo(
    () => TAGS.map(tag => ({ ...tag, people: population.features.reduce((sum, feature) =>
      sum + (feature.properties.tag === tag.id ? feature.properties.people : 0), 0) }))
      .sort((a, b) => b.people - a.people),
    [population]
  );
  const total = populations.reduce((sum, item) => sum + item.people, 0);

  const onTap = useCallback(() => {
    if (!selected) return;
    setLocalSeconds(value => creditTap(value, selected));
    setFlash(true);
  }, [selected]);

  const onTagPick = useCallback((tag: TagId) => {
    if (selected === tag) onTap();
    else setSelected(tag);
  }, [selected, onTap]);

  useEffect(() => {
    if (!flash) return;
    const timeout = window.setTimeout(() => setFlash(false), 320);
    return () => window.clearTimeout(timeout);
  }, [flash]);

  useEffect(() => {
    if (!animate) return;

    // Avoid waking the renderer and MapLibre workers for a hidden tab.
    // A returning visitor keeps the same visual intensity and can resume.
    let direction = 1;
    let interval: number | null = null;

    const step = () => setScale(current => {
      if (current >= 2.85) direction = -1;
      if (current <= 0.12) direction = 1;
      return Math.max(0, Math.min(3, Number((current + 0.08 * direction).toFixed(2))));
    });

    const stop = () => {
      if (interval !== null) window.clearInterval(interval);
      interval = null;
    };
    const syncVisibility = () => {
      if (document.hidden) {
        stop();
      } else if (interval === null) {
        interval = window.setInterval(step, 350);
      }
    };

    document.addEventListener('visibilitychange', syncVisibility);
    syncVisibility();
    return () => {
      document.removeEventListener('visibilitychange', syncVisibility);
      stop();
    };
  }, [animate]);

  function chooseTag(tag: TagId | null, focus = false) {
    setSelected(tag);
    if (tag && focus) {
      if (scenario !== null && distribution === 'concentrated') {
        const point = population.features.find(feature => feature.properties.tag === tag)?.geometry.coordinates;
        if (point) mapRef.current?.flyTo({ center: point as [number, number], zoom: 4.2, duration: 1600 });
      } else if (populations.some(item => item.id === tag && item.people > 0)) flyToTag(mapRef.current, tag);
    }
    if (window.innerWidth <= 620) setRankingOpen(false);
  }

  return (
    <div className="world-pulse">
      <WorldGlobe
        scale={scale}
        population={population}
        selected={selected}
        cityLights={cityLights}
        onReady={map => { mapRef.current = map; setReady(true); }}
        onZoom={setZoom}
        onFps={setFps}
        onTap={onTap}
        onTagPick={onTagPick}
        onFailure={setError}
      />

      <div className="vignette" aria-hidden="true" />
      <div className="noise-layer" aria-hidden="true" />

      <header className="top-header">
        <div className="brand">
          <div className="brand-mark"><span className="brand-orbit">◎</span></div>
          <div>
            <div className="brand-name">WORLD<span>PULSE</span><span className="brand-trademark">/ 001</span></div>
            <div className="brand-sub">LIVING EARTH EXPERIMENT</div>
          </div>
        </div>
        <div className="header-right">
          <div className="simulation-label"><span className="status-dot"/><span className="demo-long">DEMO COM DADOS SIMULADOS</span><span className="demo-short">DEMO</span></div>
          <button className="icon-button help-btn" aria-label="Sobre este experimento" onClick={() => setShowHelp(true)}>?</button>
        </div>
      </header>

      {STEAM_PANEL_ENABLED && <SteamPanel onOpen={() => setRankingOpen(false)} />}

      <aside className="left-rail glass">
        <div className="eyebrow">SIGNAL / 01</div>
        <div className="rail-title">Um planeta.<br/><em>Milhões de histórias.</em></div>
        <p className="rail-copy">A atividade coletiva ganha forma em luz. Cada cor é uma hashtag, cada região é uma concentração de pessoas.</p>
        <div className="rail-divider"/>
        <div className="stat-row">
          <span>Pessoas simuladas</span>
          <strong data-testid="poc-people-total" data-total={total} title={format(total)}>{compact(total)}</strong>
        </div>
        <div className="stat-row">
          <span>Hashtags de teste</span>
          <strong>{TAGS.length.toString().padStart(2, '0')}</strong>
        </div>
        <div className="stat-row">
          <span>Zoom do mapa</span>
          <strong>{zoom.toFixed(1)}×</strong>
        </div>
        <div className="rail-divider"/>
        <button className="text-action" onClick={() => resetGlobe(mapRef.current)}>↺ <span>Voltar à vista global</span></button>
      </aside>

      <button
        className="ranking-mobile-toggle glass"
        type="button"
        aria-label={rankingOpen ? 'Recolher ranking de hashtags' : 'Abrir ranking de hashtags'}
        aria-expanded={rankingOpen}
        aria-controls="hashtag-ranking"
        onClick={() => setRankingOpen(value => !value)}
      >◉ <span>TOP HASHTAGS</span> {rankingOpen ? '✕' : '⌄'}</button>

      <aside id="hashtag-ranking" className={'right-rail glass' + (rankingOpen ? '' : ' is-collapsed')}>
        <div className="panel-head">
          <div>
            <div className="eyebrow">GLOBAL ACTIVITY</div>
            <h2>Concentração de luz</h2>
          </div>
          <span className="mini-demo">TESTE</span>
        </div>
        <p className="panel-description">Pessoas distintas por hashtag. Clique para destacar e aproximar.</p>
        <button
          className={'all-filter ' + (selected === null ? 'is-active' : '')}
          onClick={() => chooseTag(null)}
        >◈ Todas as hashtags <span>↗</span></button>
        <div className="tag-ranking">
          {populations.map((item, index) => (
            <button
              key={item.id}
              className={'ranking-item ' + (selected === item.id ? 'is-active' : '')}
              onClick={() => chooseTag(item.id, true)}
              style={{ '--tag': item.color } as CSSProperties}
            >
              <span className="rank-number">0{index + 1}</span>
              <span className="rank-dot" aria-hidden="true" />
              <span className="rank-meta">
                <span className="rank-label">{item.label}</span>
                <span className="rank-bar"><i style={{ width: (populations[0]?.people ? item.people / populations[0].people * 100 : 0) + '%' }}/></span>
              </span>
              <span className="rank-count" title={format(item.people)}>{compact(item.people)}</span>
            </button>
          ))}
        </div>
        <div className="panel-divider"/>
        <div className="metric-note"><span className="note-spark">✦</span><span>A cor depende de <strong>pessoas</strong>, nunca da quantidade de cliques.</span></div>
      </aside>

      <div className="map-tip">✥ <span>ARRASTE PARA GIRAR</span><b>·</b><span>SCROLL PARA APROXIMAR</span></div>

      <button
        className="lab-mobile-toggle glass"
        type="button"
        aria-label={labOpen ? 'Recolher laboratório visual' : 'Abrir laboratório visual'}
        aria-expanded={labOpen}
        aria-controls="visual-lab"
        onClick={() => setLabOpen(value => !value)}
      ><span className="lab-toggle-icon">✧</span> VISUAL LAB {!labOpen && scenario !== null ? `· ${compact(scenario)}` : ''} {labOpen ? '✕' : '⌃'}</button>

      <section id="visual-lab" className={'dock glass' + (labOpen ? '' : ' is-collapsed')} aria-label="Laboratório de simulação">
        <div className="dock-left">
          <span className="eyebrow">CONTROL ROOM</span>
          <div className="dock-heading">Visual Lab <span className="line-accent">/ v0.1</span></div>
          <p>Altere a quantidade de pessoas e observe como a Terra muda.</p>
        </div>
        <div className="dock-controls">
          <div className="scenario-controls">
            <label htmlFor="population-scenario">Cenário de participantes</label>
            <select id="population-scenario" value={scenario === null ? '' : String(scenario)} onChange={event => {
              const value = event.target.value;
              setScenario(value === '' ? null : Number(value)); setAnimate(false);
              if (value !== '') setCityLights(false);
            }}>
              <option value="">Simulação livre</option>
              {POPULATION_SCENARIOS.map(value => <option value={value} key={value}>{format(value)}{value > 8_000_000_000 ? ' — estresse' : ''}</option>)}
            </select>
            {scenario !== null && <>
              <label htmlFor="scenario-distribution">Distribuição de teste</label>
              <select id="scenario-distribution" value={distribution} onChange={event => setDistribution(event.target.value as ScenarioDistribution)}>
                <option value="distributed">Regiões distribuídas</option><option value="concentrated">Mesma região</option>
              </select>
              <p className="scenario-description" data-testid="scenario-description">{scenarioDescription(scenario)}
                <span data-testid="scenario-cells"> {population.features.length} células · {format(total)} participantes simulados.</span>
              </p>
            </>}
          </div>
          <div className="field-head">
            <label htmlFor="population">Intensidade da simulação</label>
            <output>{Math.round(scale * 100)}%</output>
          </div>
          <div className="slider-line">
            <input
              id="population" aria-label="Quantidade simulada de pessoas"
              type="range" min="0" max="300" step="5" value={Math.round(scale * 100)}
              onChange={e => { setScenario(null); setScale(Number(e.target.value) / 100); }}
              style={{ '--progress': (scale / 3 * 100) + '%' } as CSSProperties}
            />
            <button className={'pulse-button ' + (animate ? 'active' : '')}
              onClick={() => { setScenario(null); setAnimate(value => !value); }}
              aria-label={animate ? 'Pausar simulação automática' : 'Animar crescimento das manchas'}>
              {animate ? 'Ⅱ' : '▶'} <span>{animate ? 'PAUSAR' : 'ANIMAR'}</span>
            </button>
          </div>
          <label className="light-toggle">
            <input type="checkbox" checked={cityLights} onChange={e => setCityLights(e.target.checked)} />
            <span className="switch-track"><span/></span>
            <span>Luzes urbanas de fundo</span>
          </label>
        </div>
        <div className="dock-contribution">
          <div className="eyebrow">INTERACTION TEST</div>
          <div className="dock-heading">{selected ? TAGS.find(t => t.id === selected)?.label : 'Escolha um #'}</div>
          <div className="contribution-count">
            <strong data-testid="seconds-current">{selected ? format(localSeconds[selected]) : '—'}</strong>
            <span>SEGUNDOS LOCAIS</span>
            {flash && <span className="plus-one">+1</span>}
          </div>
          <button className="tap-credit-button" type="button" disabled={!selected} aria-label="Somar 1 segundo à hashtag selecionada" onClick={onTap}>+1 SEGUNDO <span>↗</span></button>
          <p>Toque em uma luz para selecionar o #. Toque de novo para +1 segundo. O brilho só depende de pessoas.</p>
        </div>
      </section>

      <footer className="footer-hud">
        <div className="footer-status">
          <span className={'render-dot ' + (ready ? 'online' : '')}/>
          <span data-testid="planet-render-status">{error ? 'MAP ERROR' : ready ? 'RENDER ONLINE' : 'LOADING GEOSPATIAL DATA'}</span>
          <span className="footer-separator">/</span>
          <span>MAPLIBRE GL</span>
          <span className="footer-separator">/</span>
          <span>{fps ? fps + ' FPS*' : 'FPS —'}</span>
        </div>
        <a href="https://github.com/Faysk/world-pulse" rel="noreferrer" target="_blank">GITHUB ↗</a>
      </footer>

      {!ready && !error && (
        <div className="loading-overlay" role="status">
          <div className="loading-orbit">◉</div>
          <div className="loading-label">INICIALIZANDO PLANETA</div>
          <div className="loading-bar"><span/></div>
        </div>
      )}

      {error && (
        <div className="loading-overlay error-overlay" role="alert">
          <strong>Não foi possível iniciar o globo</strong>
          <p>{error}</p>
          <button onClick={() => window.location.reload()}>TENTAR NOVAMENTE ↗</button>
        </div>
      )}

      {showHelp && (
        <div className="dialog-backdrop" onClick={() => setShowHelp(false)}>
          <section role="dialog" aria-modal="true" aria-label="Sobre World Pulse" className="about-modal glass" onClick={e => e.stopPropagation()}>
            <button className="modal-close" aria-label="Fechar" onClick={() => setShowHelp(false)}>✕</button>
            <div className="eyebrow">WORLD PULSE — EXPERIMENT 001</div>
            <h2>O planeta é a interface.</h2>
            <p>Esta é uma <strong>prova visual</strong> do World Pulse, com todas as localizações, hashtags e contagens <strong>simuladas</strong>. Não há usuários reais, login, geolocalização automática ou backend conectado nesta versão.</p>
            <p>Use scroll/pinça para aproximar e arraste para girar. Toque numa luz para escolher sua hashtag; toque novamente para acumular +1 segundo <strong>apenas localmente</strong>, sem aumentar a mancha. Também pode escolher pelo ranking.</p>
            <p>Créditos locais acumulados nesta sessão: <strong>{format(creditedTotal(localSeconds))} segundos</strong>. Não são segundos cronológicos; 1 tap válido = +1 crédito.</p>
            <p>O indicador FPS* conta os frames renderizados enquanto o mapa está em movimento — não é benchmark definitivo.</p>
            <a href="https://github.com/Faysk/world-pulse/issues/10" target="_blank" rel="noreferrer">Ver pesquisa e próximos passos ↗</a>
          </section>
        </div>
      )}
    </div>
  );
}
