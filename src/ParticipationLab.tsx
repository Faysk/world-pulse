import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { ParticipationClient, type LiveTag, type TimeBalance } from './participationClient';
import './participationLab.css';

const errorMessage = (error: unknown) => error instanceof Error && error.message === 'rate_limited'
  ? 'Limite temporário atingido. Aguarde antes de sincronizar novamente.'
  : error instanceof Error && error.message === 'participation_disabled'
    ? 'A API está desativada neste ambiente.'
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
  const [, tick] = useState(0);

  const refreshView = useCallback(() => {
    setBalances(client.balances());
    setPending(client.pendingClicks());
  }, [client]);

  useEffect(() => {
    let disposed = false;
    client.connect().then(() => {
      if (disposed) return;
      const selected = client.balances().find(b => b.tagId === client.selection());
      if (client.selection()) setActive({ id: client.selection()!, name: selected?.name ?? 'Hashtag selecionada', color: selected?.color ?? '#9edbda' });
      refreshView(); setReady(true);
    }).catch(reason => { if (!disposed) setError(errorMessage(reason)); });
    const timer = window.setInterval(() => tick(n => n + 1), 250);
    return () => { disposed = true; window.clearInterval(timer); };
  }, [client, refreshView]);

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
      <button disabled={!ready || !active || busy} onClick={() => { if (client.creditClick()) refreshView(); }}>Adicionar 1 segundo</button>
      <button disabled={!ready || busy || pending === 0} onClick={() => void sync()}>Sincronizar agora</button>
    </div>
    <p><strong data-testid="participation-pending">{pending}</strong> taps aguardando confirmação. O saldo só é confirmado quando o servidor aceita o lote.</p>
    {error && <p role="alert">{error}</p>}
    <ul className="participation-balances">
      {balances.map(balance => <li key={balance.tagId} data-tag-name={balance.name} data-tag-id={balance.tagId}>
        <strong style={{ color: balance.color }}>{balance.name ?? 'Hashtag'}</strong>
        <span>Saldo: <b data-testid="live-remaining">{duration(client.remainingMilliseconds(balance.tagId))}</b></span>
        <span>Histórico: <b data-testid="live-history">{balance.creditedSeconds}</b> segundos creditados</span>
      </li>)}
    </ul>
    {!balances.length && ready && <p>Nenhum saldo confirmado. Selecione uma hashtag e contribua.</p>}
    <small>O saldo diminui inclusive com a página fechada. Trocar de hashtag preserva os outros saldos. Histórico não é saldo disponível.</small>
  </section>;
}
