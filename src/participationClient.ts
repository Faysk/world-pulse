/**
 * Future real-participation transport. Not mounted in the visual POC yet.
 * The browser never receives database credentials or direct visitor IDs.
 */
export type LiveTag = { id: string; name: string; color: string };
export type PendingTapBatch = { batchId: string; tagId: string; clicks: number };
export type TimeBalance = { tagId: string; creditedSeconds: string;
  expiresAtMs: number; serverNowMs: number; remainingMs: number };
export type ApiRanking = {
  type: 'historical';
  ranking: Array<{
    id: string; name: string; color: string;
    historicalParticipants: string; creditedSeconds: string;
  }>;
};

type FetchLike = typeof fetch;
type StoreLike = Pick<Storage, 'getItem' | 'setItem'>;
const STORAGE_KEY = 'world-pulse-pending-v1';
const MAX_PENDING_CLICKS = 3000;

export class ParticipationClient {
  private readonly fetcher: FetchLike;
  private readonly storage: StoreLike | null;
  private readonly makeId: () => string;
  private selectedTagId: string | null = null;
  private pending: PendingTapBatch[] = [];
  private readonly sealed = new Set<string>();
  private latestBalances: TimeBalance[] = [];
  private sessionPromise: Promise<void> | null = null;
  private sending: Promise<void> | null = null;
  private selectionQueue: Promise<unknown> = Promise.resolve();

  constructor(
    fetcher: FetchLike = fetch,
    storage: StoreLike | null = typeof window === 'undefined' ? null : window.localStorage,
    makeId: () => string = () => crypto.randomUUID()
  ) {
    this.fetcher = fetcher;
    this.storage = storage;
    this.makeId = makeId;
    this.pending = this.readPending();
    // A restored request may have reached the server before its response was
    // lost. Its ID and fingerprint must never receive new taps.
    for (const batch of this.pending) this.sealed.add(batch.batchId);
  }

  private readPending(): PendingTapBatch[] {
    try {
      const raw = this.storage?.getItem(STORAGE_KEY);
      const value: unknown = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(value)) return [];
      return value.filter((v): v is PendingTapBatch =>
        Boolean(v && typeof v === 'object' &&
          typeof v.batchId === 'string' && /^[0-9a-f-]{36}$/i.test(v.batchId) &&
          typeof v.tagId === 'string' && /^[0-9a-f-]{36}$/i.test(v.tagId) &&
          Number.isSafeInteger(v.clicks) && v.clicks >= 1 && v.clicks <= 30)
      ).slice(0, 2000);
    } catch {
      return [];
    }
  }

  private persist() {
    try { this.storage?.setItem(STORAGE_KEY, JSON.stringify(this.pending)); }
    catch { /* Storage may be unavailable in private mode. In-memory queue remains. */ }
  }

  private async request<T>(path: string, body?: unknown): Promise<T> {
    const response = await this.fetcher(path, {
      method: body === undefined ? 'GET' : 'POST',
      headers: body === undefined ? {} : { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      ...(body === undefined ? {} : { body: JSON.stringify(body) })
    });
    const payload: unknown = await response.json();
    if (!response.ok) {
      const code = (payload && typeof payload === 'object' && 'error' in payload) ?
        String(payload.error) : 'network_error';
      throw new Error(code);
    }
    return payload as T;
  }

  async connect(): Promise<void> {
    if (!this.sessionPromise) {
      this.sessionPromise = this.request<{ anonymous: true; activeTagId: string | null; credits: TimeBalance[] }>('/api/session', {})
        .then(session => {
          this.selectedTagId = session.activeTagId;
          this.latestBalances = session.credits;
        })
        .catch(error => { this.sessionPromise = null; throw error; });
    }
    await this.sessionPromise;
  }

  private enqueueSelection<T>(task: () => Promise<T>): Promise<T> {
    const next = this.selectionQueue.then(task, task);
    // Never poison the future selection queue after a transient network error.
    this.selectionQueue = next.then(() => undefined, () => undefined);
    return next;
  }

  selectTag(name: string): Promise<LiveTag> {
    return this.enqueueSelection(async () => {
      await this.connect();
      const response = await this.request<{ tag: LiveTag }>('/api/tags', { name });
      await this.request('/api/select', { tagId: response.tag.id });
      this.selectedTagId = response.tag.id;
      return response.tag;
    });
  }

  clearSelection(): Promise<void> {
    return this.enqueueSelection(async () => {
      await this.connect();
      await this.request('/api/select', { tagId: null });
      this.selectedTagId = null;
    });
  }

  /** Call this method on a validated user click/tap, never on clock ticks. */
  creditClick(): boolean {
    if (!this.selectedTagId) return false;
    const queued = this.pending.reduce((sum, b) => sum + b.clicks, 0);
    if (queued >= MAX_PENDING_CLICKS) return false;

    // A submitted batch is frozen until acknowledged; never mutate its
    // fingerprint while a request may be in flight.
    const last = this.sending ? null : this.pending[this.pending.length - 1];
    if (last && !this.sealed.has(last.batchId) && last.tagId === this.selectedTagId && last.clicks < 30) {
      last.clicks++;
    } else {
      this.pending.push({
        tagId: this.selectedTagId, batchId: this.makeId(), clicks: 1
      });
    }
    this.persist();
    return true;
  }

  pendingClicks(): number {
    return this.pending.reduce((sum, b) => sum + b.clicks, 0);
  }

  /** Server snapshots, including expired history. Rendering a countdown must
   * use the elapsed time since receipt, not assume the browser clock is correct. */
  balances(): TimeBalance[] {
    return this.latestBalances.map(balance => ({ ...balance }));
  }

  /** Retries keep the same batch IDs and do not manufacture new credits. */
  async flush(): Promise<void> {
    if (this.sending) return this.sending;
    const task = async () => {
      await this.connect();
      while (this.pending.length) {
        const batch = { ...this.pending[0] };
        this.sealed.add(batch.batchId);
        const credited = await this.request<TimeBalance>('/api/taps', batch);
        this.latestBalances = [...this.latestBalances.filter(b => b.tagId !== credited.tagId), credited];
        this.pending.shift();
        this.sealed.delete(batch.batchId);
        this.persist();
      }
    };
    this.sending = task().finally(() => { this.sending = null; });
    return this.sending;
  }

  ranking(): Promise<ApiRanking> {
    return this.request<ApiRanking>('/api/ranking');
  }
}
