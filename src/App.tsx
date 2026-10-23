import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import type { Map as MapInstance } from 'maplibre-gl';
import { TAGS, peopleCount, type TagId } from './demoData';
import { WorldGlobe, flyToTag, resetGlobe } from './WorldGlobe';

const format = (n: number) => Intl.NumberFormat('pt-BR').format(n);

export default function App() {
  const mapRef = useRef<MapInstance | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<TagId | null>(null);
  const [scale, setScale] = useState(1);
  const [cityLights, setCityLights] = useState(true);
  const [animate, setAnimate] = useState(false);
  const [zoom, setZoom] = useState(1.65);
  const [fps, setFps] = useState(0);
  const [showHelp, setShowHelp] = useState(false);
  const [localSeconds, setLocalSeconds] = useState<Record<TagId, number>>({
    gta6: 0, minecraft: 0, lofi: 0
  });
  const [flash, setFlash] = useState(false);

  const populations = useMemo(
    () => TAGS.map(tag => ({ ...tag, people: peopleCount(tag.id, scale) }))
      .sort((a, b) => b.people - a.people),
    [scale]
  );
  const total = populations.reduce((sum, item) => sum + item.people, 0);

  const onTap = useCallback(() => {
    if (!selected) return;
    setLocalSeconds(value => ({
      ...value,
      [selected]: value[selected] + 1
    }));
    setFlash(true);
  }, [selected]);

  useEffect(() => {
    if (!flash) return;
    const timeout = window.setTimeout(() => setFlash(false), 320);
    return () => window.clearTimeout(timeout);
  }, [flash]);

  useEffect(() => {
    if (!animate) return;
    const interval = window.setInterval(() => {
      setScale(current => current >= 2.8 ? 0.1 : Math.min(2.8, current + 0.12));
    }, 850);
    return () => window.clearInterval(interval);
  }, [animate]);

  function chooseTag(tag: TagId | null, focus = false) {
    setSelected(tag);
    if (tag && focus) flyToTag(mapRef.current, tag);
  }

  return (
    <div className="world-pulse">
      <WorldGlobe
        scale={scale}
        selected={selected}
        cityLights={cityLights}
        onReady={map => { mapRef.current = map; setReady(true); }}
        onZoom={setZoom}
        onFps={setFps}
        onTap={onTap}
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
          <div className="simulation-label"><span className="status-dot"/> DEMO COM DADOS SIMULADOS</div>
          <button className="icon-button help-btn" aria-label="Sobre este experimento" onClick={() => setShowHelp(true)}>?</button>
        </div>
      </header>

      <aside className="left-rail glass">
        <div className="eyebrow">SIGNAL / 01</div>
        <div className="rail-title">Um planeta.<br/><em>Milhões de histórias.</em></div>
        <p className="rail-copy">A atividade coletiva ganha forma em luz. Cada cor é uma hashtag, cada região é uma concentração de pessoas.</p>
        <div className="rail-divider"/>
        <div className="stat-row">
          <span>Pessoas simuladas</span>
          <strong>{format(total)}</strong>
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

      <aside className="right-rail glass">
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
              <span className="rank-count">{format(item.people)}</span>
            </button>
          ))}
        </div>
        <div className="panel-divider"/>
        <div className="metric-note"><span className="note-spark">✦</span><span>A cor depende de <strong>pessoas</strong>, nunca da quantidade de cliques.</span></div>
      </aside>

      <div className="map-tip">✥ <span>ARRASTE PARA GIRAR</span><b>·</b><span>SCROLL PARA APROXIMAR</span></div>

      <section className="dock glass" aria-label="Laboratório de simulação">
        <div className="dock-left">
          <span className="eyebrow">CONTROL ROOM</span>
          <div className="dock-heading">Visual Lab <span className="line-accent">/ v0.1</span></div>
          <p>Altere a quantidade de pessoas e observe como a Terra muda.</p>
        </div>
        <div className="dock-controls">
          <div className="field-head">
            <label htmlFor="population">Intensidade da simulação</label>
            <output>{Math.round(scale * 100)}%</output>
          </div>
          <div className="slider-line">
            <input
              id="population" aria-label="Quantidade simulada de pessoas"
              type="range" min="0" max="300" step="5" value={Math.round(scale * 100)}
              onChange={e => setScale(Number(e.target.value) / 100)}
              style={{ '--progress': (scale / 3 * 100) + '%' } as CSSProperties}
            />
            <button className={'pulse-button ' + (animate ? 'active' : '')}
              onClick={() => setAnimate(value => !value)}
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
            <strong>{selected ? format(localSeconds[selected]) : '—'}</strong>
            <span>SEGUNDOS LOCAIS</span>
            {flash && <span className="plus-one">+1</span>}
          </div>
          <p>Clique no globo com uma hashtag selecionada para testar +1 segundo. Não altera o brilho.</p>
        </div>
      </section>

      <footer className="footer-hud">
        <div className="footer-status">
          <span className={'render-dot ' + (ready ? 'online' : '')}/>
          {error ? 'MAP ERROR' : ready ? 'RENDER ONLINE' : 'LOADING GEOSPATIAL DATA'}
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
            <p>Use o scroll/pinça para aproximar, arraste para girar, ajuste a população de teste e escolha uma hashtag à direita. Clique curto no globo para somar +1 segundo <strong>apenas localmente</strong>; o gesto não altera a mancha.</p>
            <p>O indicador FPS* conta os frames renderizados enquanto o mapa está em movimento — não é benchmark definitivo.</p>
            <a href="https://github.com/Faysk/world-pulse/issues/10" target="_blank" rel="noreferrer">Ver pesquisa e próximos passos ↗</a>
          </section>
        </div>
      )}
    </div>
  );
}
