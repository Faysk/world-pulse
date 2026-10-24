import { useCallback, useEffect, useState } from 'react';

type SteamGame = {
  appid: number;
  name: string;
  currentPlayers: number;
  storeUrl: string;
};
type SteamSnapshot = {
  source: 'Steam Web API';
  scope: 'curated_sample';
  capturedAt: string;
  monitoredGames: number;
  successfulGames: number;
  games: SteamGame[];
};

const number = new Intl.NumberFormat('pt-BR');

export function SteamPanel({ onOpen }: { onOpen?: () => void }) {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<SteamSnapshot | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [refreshCounter, setRefreshCounter] = useState(0);

  const toggle = useCallback(() => {
    if (!open) onOpen?.();
    setOpen(value => !value);
  }, [open, onOpen]);

  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    setLoading(true);
    setError(false);
    fetch('/api/steam', {
      credentials: 'same-origin',
      signal: controller.signal
    }).then(async response => {
      if (!response.ok) throw new Error('steam_unavailable');
      const payload = await response.json() as SteamSnapshot;
      if (payload.source !== 'Steam Web API' || payload.scope !== 'curated_sample' ||
        !Array.isArray(payload.games) || !Number.isSafeInteger(payload.monitoredGames) ||
        typeof payload.capturedAt !== 'string') {
        throw new Error('steam_invalid_response');
      }
      setData(payload);
    }).catch(() => {
      if (!controller.signal.aborted) {
        setError(true);
        setData(null);
      }
    }).finally(() => {
      if (!controller.signal.aborted) setLoading(false);
    });
    return () => controller.abort();
  }, [open, refreshCounter]);

  const checkedAt = data && !Number.isNaN(Date.parse(data.capturedAt))
    ? new Date(data.capturedAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    : '—';

  return (
    <div className="steam-signal">
      <button
        className={'steam-trigger glass' + (open ? ' is-active' : '')}
        type="button"
        aria-controls="steam-signal-panel"
        aria-expanded={open}
        aria-label={open ? 'Fechar dados de jogos Steam' : 'Abrir dados de jogos Steam'}
        onClick={toggle}
      >
        <span className="steam-trigger-led" />
        <span>STEAM <b>LIVE</b></span>
        <span className="steam-trigger-arrow">{open ? '✕' : '↗'}</span>
      </button>

      {open && (
        <section
          className="steam-signal-panel glass"
          id="steam-signal-panel"
          aria-label="Atividade externa de jogos Steam"
          data-testid="steam-panel"
        >
          <div className="steam-signal-heading">
            <div>
              <div className="eyebrow">EXTERNAL SIGNAL / STEAM</div>
              <h2>Jogando agora<span className="steam-signal-heading-dot">●</span></h2>
            </div>
            <button
              className="steam-signal-refresh"
              type="button"
              onClick={() => setRefreshCounter(value => value + 1)}
              disabled={loading}
              aria-label="Atualizar dados Steam"
            >↻</button>
          </div>

          <p className="steam-signal-sub">
            Contagem de jogadores simultâneos na Steam. <strong>Não são participantes do World Pulse.</strong>
          </p>

          {loading && !data && <div className="steam-signal-state" role="status">Consultando a Steam…</div>}
          {error && (
            <div className="steam-signal-state steam-signal-error" role="alert">
              Dados indisponíveis. Nenhuma contagem foi estimada.
            </div>
          )}

          {data && !error && (
            <>
              <div className="steam-signal-meta">
                <span><i className="steam-signal-live-dot" /> AMOSTRA MONITORADA</span>
                <span>Atualizado {checkedAt}</span>
              </div>
              <div className="steam-game-list">
                {data.games.map((game, index) => (
                  <a
                    key={game.appid}
                    className="steam-game"
                    href={game.storeUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={game.name + ', ' + number.format(game.currentPlayers) + ' jogadores na Steam'}
                  >
                    <span className="steam-game-rank">{String(index + 1).padStart(2, '0')}</span>
                    <span className="steam-game-name">{game.name}</span>
                    <span className="steam-game-count">{number.format(game.currentPlayers)}</span>
                    <span className="steam-game-arrow">↗</span>
                  </a>
                ))}
              </div>
              <div className="steam-signal-coverage">
                {data.successfulGames} de {data.monitoredGames} jogos consultados com sucesso
              </div>
            </>
          )}

          <div className="steam-signal-foot">
            <span>Dados: <a href="https://store.steampowered.com/charts/" target="_blank" rel="noopener noreferrer">Steam ↗</a></span>
            <span>Sem geolocalização</span>
          </div>
        </section>
      )}
    </div>
  );
}
