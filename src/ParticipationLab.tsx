import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { ParticipationClient, SELECTION_NOTICE_KEY, PENDING_NOTICE_KEY, type LiveTag, type TimeBalance, type ActiveRanking } from './participationClient';
import './participationLab.css';

const errorMessage = (error: unknown) => error instanceof Error && error.message === 'rate_limited'
  ? 'Limite temporário atingido. Aguarde antes de sincronizar novamente.'
  : error instanceof Error && error.message === 'participation_disabled'
    ? 'A API está desativada neste ambiente.'
    : error instanceof Error && error.message === 'session_rotated_pending'
      ? 'Esta sessão mudou ou expirou enquanto havia taps pendentes. Eles foram colocados em quarentena e NÃO serão enviados para a nova sessão.'
      : error instanceof Error && error.message === 'session_expired'
        ? 'A sessão expirou. Recarregue a conexão antes de continuar; nenhum tap pendente será transferido automaticamente.'
        : error instanceof Error && error.message === 'queue_coordination_unavailable'
          ? 'Este navegador não permite coordenar a fila entre abas. Use um navegador atualizado com conexão segura.'
          : error instanceof Error && error.message === 'queue_storage_unavailable'
            ? 'Não foi possível salvar a fila neste navegador. Este tap não está confirmado. Verifique o armazenamento antes de continuar.'
            : 'Não foi possível sincronizar. Os taps pendentes foram preservados para tentar novamente.';

function duration(ms: number): string {
  const seconds = Math.ceil(ms / 1000);
  return `${Math.floor(seconds / 3600)}h ${String(Math.floor(seconds / 60) % 60).padStart(2, '0')}m ${String(seconds % 60).padStart(2, '0')}s`;
}

/** Mounted only by an explicit development URL. Never mixes server balances
 * with the synthetic globe population or enables production participation. */
export default function ParticipationLab() {
  const [client] = useState(() => new ParticipationClient());
  const [name, setName] = useState('');
  const [active, setActive] = useState<LiveTag | null>(null);
  const [balances, setBalances] = useState<TimeBalance[]>([]);
  const [pending, setPending] = useState(0);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [ranking, setRanking] = useState<ActiveRanking | null>(null);
  const [rankingError, setRankingError] = useState(false);
  const [, tick] = useState(0);

  const refreshView = useCallback(() => {
    setBalances(client.balances());
    setPending(client.pendingClicks());
  }, [client]);

  useEffect(() => {
    let disposed = false;
    client.connect().then(() => {
      if (disposed) return;
      setActive(client.selectedTagDetails());
      refreshView(); setReady(true);
    }).catch(reason => {
      if (!disposed) {
        // A rotated session may be blocked with a preserved orphaned queue:
        // show its true size instead of incorrectly displaying 0 pending.
        refreshView();
        setReady(false);
        setError(errorMessage(reason));
      }
    });
    const timer = window.setInterval(() => tick(n => n + 1), 250);
    return () => { disposed = true; window.clearInterval(timer); };
  }, [client, refreshView]);

  // Same-origin tabs share a server cookie, so the server is the authority.
  // The storage event is only a notification: always re-read server selection.
  // A focus/visibility refresh covers missed events after sleeping or offline.
  useEffect(() => {
    if (!ready) return;
    let disposed = false;
    let refreshing = false;
    const reconcile = async () => {
      if (disposed || refreshing) return;
      refreshing = true;
      try {
        await client.refreshSession();
        if (!disposed) {
          setActive(client.selectedTagDetails());
          refreshView();
          setError('');
        }
      } catch (reason) {
        if (!disposed) setError(errorMessage(reason));
      } finally { refreshing = false; }
    };
    const onStorage = (event: StorageEvent) => {
      if (event.key === SELECTION_NOTICE_KEY) void reconcile();
      if (event.key === PENDING_NOTICE_KEY) {
        client.refreshPending().then(() => { if (!disposed) refreshView(); })
          .catch(reason => { if (!disposed) setError(errorMessage(reason)); });
      }
    };
    const onFocus = () => { if (!document.hidden) void reconcile(); };
    const onVisible = () => { if (!document.hidden) void reconcile(); };
    window.addEventListener('storage', onStorage);
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      disposed = true;
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [client, ready, refreshView]);

  useEffect(() => {
    if (!ready) return;
    let disposed = false;
    let running = false;
    const update = async () => {
      if (disposed || running || document.hidden) return;
      running = true;
      try {
        const snapshot = await client.ranking();
        if (!disposed) { setRanking(snapshot); setRankingError(false); }
      } catch { if (!disposed) setRankingError(true); }
      finally { running = false; }
    };
    void update();
    const interval = window.setInterval(() => void update(), 5000);
    document.addEventListener('visibilitychange', update);
    return () => { disposed = true; window.clearInterval(interval); document.removeEventListener('visibilitychange', update); };
  }, [client, ready]);

  const sync = useCallback(async () => {
    if (!ready || busy || !client.pendingClicks()) return;
    setBusy(true);
    try { await client.flush(); setError(''); }
    catch (reason) { setError(errorMessage(reason)); }
    finally { refreshView(); setBusy(false); }
  }, [client, ready, busy, refreshView]);

  // Batches reduce writes. After an error, preserve the queue and require a
  // deliberate retry rather than hammering an unavailable or rate-limited API.
  useEffect(() => {
    if (!ready || error) return;
    const timer = window.setInterval(() => { if (!document.hidden) void sync(); }, 2000);
    return () => window.clearInterval(timer);
  }, [sync, ready, error]);

  async function select(event: FormEvent) {
    event.preventDefault(); setBusy(true);
    try { setActive(await client.selectTag(name)); refreshView(); setError(''); }
    catch (reason) { setError(errorMessage(reason)); }
    finally { setBusy(false); }
  }

  return <section className="participation-lab glass" aria-label="Laboratório de participação isolada">
    <div className="eyebrow">AMBIENTE DE TESTE · PARTICIPAÇÃO</div>
    <h2>Seu tempo nas hashtags</h2>
    <p>Este laboratório usa o banco configurado para desenvolvimento. O globo atrás continua simulado e não recebe estes dados.</p>
    <div role="status" data-testid="participation-status">{ready ? 'Sessão conectada' : 'Conectando sessão…'}</div>
    <form onSubmit={select}>
      <label htmlFor="live-hashtag">Hashtag</label>
      <div className="participation-form">
        <input id="live-hashtag" value={name} onChange={e => setName(e.target.value)} maxLength={34} placeholder="#sua_hashtag" autoComplete="off" required />
        <button disabled={!ready || busy} type="submit">Selecionar hashtag</button>
      </div>
    </form>
    <div className="participation-selected" data-testid="participation-selected" style={{ color: active?.color }}>{active?.name ?? 'Escolha uma hashtag para contribuir'}</div>
    <div className="participation-actions">
      <button disabled={!ready || !active || busy} onClick={() => {
        client.creditClick().then(() => refreshView()).catch(reason => setError(errorMessage(reason)));
      }}>Adicionar 1 segundo</button>
      <button disabled={!ready || busy || pending === 0} onClick={() => void sync()}>Sincronizar agora</button>
    </div>
    <p><strong data-testid="participation-pending">{pending}</strong> taps aguardando confirmação. O saldo só é confirmado quando o servidor aceita o lote.</p>
    {error && <p role="alert">{error}</p>}
    {client.isQuarantined() && <div className="participation-quarantine">
      <p>Fila antiga isolada. Descartar esta fila significa perder os taps que não tenham sido reconhecidos na sessão anterior.</p>
      <button type="button" onClick={() => {
        setReady(false);
        client.discardOrphanedPending().then(() => client.connect()).then(() => {
          setActive(client.selectedTagDetails());
          refreshView();
          setReady(true);
          setError('');
        }).catch(reason => setError(errorMessage(reason)));
      }}>Descartar fila antiga e conectar nova sessão</button>
    </div>}
    <ul className="participation-balances">
      {balances.map(balance => <li key={balance.tagId} data-tag-name={balance.name} data-tag-id={balance.tagId}>
        <strong style={{ color: balance.color }}>{balance.name ?? 'Hashtag'}</strong>
        <span>Saldo: <b data-testid="live-remaining">{duration(client.remainingMilliseconds(balance.tagId))}</b></span>
        <span>Histórico: <b data-testid="live-history">{balance.creditedSeconds}</b> segundos creditados</span>
      </li>)}
    </ul>
    {!balances.length && ready && <p>Nenhum saldo confirmado. Selecione uma hashtag e contribua.</p>}
    <small>O saldo diminui inclusive com a página fechada. Trocar de hashtag preserva os outros saldos. Histórico não é saldo disponível.</small>
    <section aria-label="Ranking atual de teste">
      <h3>Top 10 atual</h3>
      <p>Uma participação por sessão e hashtag com saldo positivo. Atualização a cada 5 segundos, com a aba visível. Origem geográfica ainda indisponível.</p>
      {rankingError && <p role="status">Ranking indisponível. A última leitura, se exibida, pode estar desatualizada.</p>}
      {!ranking && !rankingError && <p>Carregando ranking…</p>}
      {ranking && <>
        <p>Leitura do servidor: <time dateTime={new Date(ranking.asOfMs).toISOString()}>{new Date(ranking.asOfMs).toLocaleTimeString('pt-BR')}</time></p>
        {ranking.ranking.length === 0 ? <p>Nenhuma hashtag registrada ainda.</p> : <ol className="participation-ranking">
          {ranking.ranking.map(tag => <li key={tag.id}>
            <strong style={{color:tag.color}}>{tag.name}</strong>
            <span>{Intl.NumberFormat('pt-BR').format(BigInt(tag.activeParticipants))} participações atuais</span>
            <small>{Intl.NumberFormat('pt-BR').format(BigInt(tag.historicalParticipants))} no histórico · {Intl.NumberFormat('pt-BR').format(BigInt(tag.creditedSeconds))} segundos históricos</small>
          </li>)}
        </ol>}
      </>}
    </section>
  </section>;
}
