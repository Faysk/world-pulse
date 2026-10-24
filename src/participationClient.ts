/**
 * Future real-participation transport. Not mounted in the visual POC yet.
 * The browser never receives database credentials or direct visitor IDs.
 */
export type LiveTag = { id: string; name: string; color: string };
export type PendingTapBatch = { batchId: string; tagId: string; clicks: number };
export type TimeBalance = { tagId: string; creditedSeconds: string;
  expiresAtMs: number; serverNowMs: number; remainingMs: number; name?: string; color?: string };
export type ApiRanking = {
  type: 'historical';
  ranking: Array<{
    id: string; name: string; color: string;
    historicalParticipants: string; creditedSeconds: string;
  }>;
};
export type ActiveRanking = {
  type: 'active'; asOfMs: number;
  metric: 'distinct_anonymous_sessions_with_positive_balance';
  geography: 'unavailable';
  ranking: Array<LiveTag & { activeParticipants: string; historicalParticipants: string; creditedSeconds: string }>;
};

type FetchLike = typeof fetch;
type StoreLike = Pick<Storage, 'getItem' | 'setItem'>;
const STORAGE_KEY = 'world-pulse-pending-v1';
export const PENDING_NOTICE_KEY = STORAGE_KEY;
const QUARANTINE_KEY = 'world-pulse-pending-quarantined-v1';
export const SELECTION_NOTICE_KEY = 'world-pulse-selection-changed-v1';
const MAX_PENDING_CLICKS = 3000;
const QUEUE_LOCK = 'world-pulse-pending-writer-v1';
const memoryWriters = new WeakMap<StoreLike, Promise<unknown>>();
function defaultStorage(): StoreLike | null {
  try { return typeof window === 'undefined' ? null : window.localStorage; }
  catch { return null; }
}

export class ParticipationClient {
  private readonly fetcher: FetchLike;
  private readonly storage: StoreLike | null;
  private readonly makeId: () => string;
  private selectedTagId: string | null = null;
  private selectedTag: LiveTag | null = null;
  private quarantined = false;
  private pending: PendingTapBatch[] = [];
  private queueBinding: string | null = null;
  private readonly sealed = new Set<string>();
  private latestBalances: TimeBalance[] = [];
  private readonly receivedAt = new Map<string, number>();
  private readonly clock: () => number;
  private sessionPromise: Promise<void> | null = null;
  private sending: Promise<void> | null = null;
  private selectionQueue: Promise<unknown> = Promise.resolve();
  private memoryWriter: Promise<unknown> = Promise.resolve();

  constructor(
    fetcher: FetchLike = (input, init) => fetch(input, init),
    storage: StoreLike | null = defaultStorage(),
    makeId: () => string = () => crypto.randomUUID(),
    clock: () => number = () => performance.now()
  ) {
    this.fetcher = fetcher;
    this.storage = storage;
    this.makeId = makeId;
    this.clock = clock;
    this.pending = this.readPending();
    try { this.quarantined = this.storage?.getItem(QUARANTINE_KEY) === '1'; } catch { this.quarantined = false; }
    if (this.pending.length && !this.queueBinding) this.quarantined = true;
  }

  private readPending(): PendingTapBatch[] {
    try {
      const raw = this.storage?.getItem(STORAGE_KEY);
      const value: unknown = raw ? JSON.parse(raw) : null;
      // A legacy array is deliberately unbound: keep it for the user to
      // explicitly discard rather than ever credit it to an unknown cookie.
      const envelope = value && typeof value === 'object' && !Array.isArray(value)
        ? value as { version?: number; binding?: unknown; batches?: unknown; sealed?: unknown }
        : { version: 0, binding: null, batches: value };
      if ((envelope.version === 2 || envelope.version === 3) && typeof envelope.binding === 'string' &&
        /^[0-9a-f]{64}$/.test(envelope.binding)) {
        this.queueBinding = envelope.binding;
      }
      if (!Array.isArray(envelope.batches)) return [];
      const batches = envelope.batches.filter((v): v is PendingTapBatch =>
        Boolean(v && typeof v === 'object' &&
          typeof v.batchId === 'string' && /^[0-9a-f-]{36}$/i.test(v.batchId) &&
          typeof v.tagId === 'string' && /^[0-9a-f-]{36}$/i.test(v.tagId) &&
          Number.isSafeInteger(v.clicks) && v.clicks >= 1 && v.clicks <= 30)
      ).slice(0, 2000);
      // Legacy queues have no durable submitted marker: freeze them all.
      const frozen = envelope.version === 3 && Array.isArray(envelope.sealed)
        ? new Set(envelope.sealed) : new Set(batches.map(b => b.batchId));
      this.sealed.clear();
      for (const batch of batches) if (frozen.has(batch.batchId)) this.sealed.add(batch.batchId);
      return batches;
    } catch {
      return [];
    }
  }

  private persist() {
    try {
      this.storage?.setItem(STORAGE_KEY, JSON.stringify({
        version: 3, binding: this.queueBinding, batches: this.pending, sealed: [...this.sealed]
      }));
    } catch { throw new Error('queue_storage_unavailable'); }
  }

  private withWriter<T>(task: () => Promise<T> | T): Promise<T> {
    const run = async () => {
      if (this.storage) {
        this.queueBinding = null;
        this.pending = this.readPending();
        this.quarantined = this.storage.getItem(QUARANTINE_KEY) === '1' ||
          (this.pending.length > 0 && !this.queueBinding);
      }
      return task();
    };
    if (typeof navigator !== 'undefined' && navigator.locks) {
      return navigator.locks.request(QUEUE_LOCK, { signal: AbortSignal.timeout(30_000) }, run).then(value => value);
    }
    if (!this.storage) {
      const next = this.memoryWriter.then(run, run);
      this.memoryWriter = next.catch(() => undefined);
      return next;
    }
    // This in-process mutex is for Node tests / non-browser callers only.
    // Never pretend it coordinates real browser tabs without Web Locks.
    if (typeof window !== 'undefined') return Promise.reject(new Error('queue_coordination_unavailable'));
    const next = (memoryWriters.get(this.storage) ?? Promise.resolve()).then(run, run);
    memoryWriters.set(this.storage, next.catch(() => undefined));
    return next;
  }

  private quarantinePending(): void {
    this.quarantined = true;
    try { this.storage?.setItem(QUARANTINE_KEY, '1'); }
    catch { /* Still blocked in this tab when local storage is unavailable. */ }
  }

  /**
   * Old pending taps cannot be assigned to a NEW anonymous visitor.
   * User must explicitly choose to abandon this orphaned queue; automatic
   * recovery or silently moving old credits to a new cookie is forbidden.
   */
  discardOrphanedPending(): Promise<void> {
    return this.withWriter(() => {
      if (!this.quarantined) return;
      this.pending = [];
      this.queueBinding = null;
      this.sealed.clear();
      this.persist();
      this.quarantined = false;
      try { this.storage?.setItem(QUARANTINE_KEY, '0'); } catch { /* best effort */ }
      this.sessionPromise = null;
    });
  }

  isQuarantined(): boolean { return this.quarantined; }
  refreshPending(): Promise<void> { return this.withWriter(() => undefined); }

  private signalSelectionChange(): void {
    try { this.storage?.setItem(SELECTION_NOTICE_KEY, this.makeId()); }
    catch { /* Another tab can still refresh on focus without storage. */ }
  }

  private async request<T>(path: string, body?: unknown): Promise<T> {
    const response = await this.fetcher(path, {
      method: body === undefined ? 'GET' : 'POST',
      headers: body === undefined ? {} : {
        'Content-Type': 'application/json',
        ...(path === '/api/taps' ? { 'X-WP-Session-Binding': this.queueBinding ?? '' } : {})
      },
      credentials: 'same-origin',
      signal: AbortSignal.timeout(10_000),
      ...(body === undefined ? {} : { body: JSON.stringify(body) })
    });
    const payload: unknown = await response.json();
    if (!response.ok) {
      const code = (payload && typeof payload === 'object' && 'error' in payload) ?
        String(payload.error) : 'network_error';
      if ((response.status === 401 && code === 'session_expired') ||
        (response.status === 409 && code === 'session_binding_mismatch')) {
        this.sessionPromise = null;
        if (this.pending.length) this.quarantinePending();
      }
      throw new Error(code);
    }
    return payload as T;
  }

  private async loadSession(): Promise<void> {
    if (this.quarantined) throw new Error('session_rotated_pending');
    const session = await this.request<{
      anonymous: true; sessionFresh: boolean; sessionBinding: string;
      activeTagId: string | null; activeTag: LiveTag | null; credits: TimeBalance[];
    }>('/api/session', {});
    if (typeof session.sessionBinding !== 'string' ||
      !/^[0-9a-f]{64}$/.test(session.sessionBinding)) {
      throw new Error('invalid_session_binding');
    }
    // The binding is attached to the pending queue itself. A different tab
    // may have quietly created a new cookie, causing sessionFresh=false
    // here despite a queue still belonging to an older session.
    if (this.pending.length && (session.sessionFresh ||
      this.queueBinding !== session.sessionBinding)) {
      this.quarantinePending();
      throw new Error('session_rotated_pending');
    }
    this.queueBinding = session.sessionBinding;
    if (!this.pending.length) this.persist();
    this.selectedTagId = session.activeTagId;
    this.selectedTag = session.activeTag;
    this.latestBalances = session.credits;
    for (const balance of session.credits) this.receivedAt.set(balance.tagId, this.clock());
  }

  connect(): Promise<void> { return this.withWriter(() => this.connectUnlocked()); }

  private async connectUnlocked(): Promise<void> {
    if (this.quarantined) throw new Error('session_rotated_pending');
    if (!this.sessionPromise) {
      this.sessionPromise = this.loadSession()
        .catch(error => { this.sessionPromise = null; throw error; });
    }
    await this.sessionPromise;
  }

  /** Reconcile selection against the authoritative server after another tab
   * switches hashtags. Never infer the current choice from a storage event. */
  refreshSession(): Promise<void> {
    return this.enqueueSelection(() => this.withWriter(async () => {
      await this.loadSession();
      this.sessionPromise = Promise.resolve();
    }));
  }

  private enqueueSelection<T>(task: () => Promise<T>): Promise<T> {
    const next = this.selectionQueue.then(task, task);
    // Never poison the future selection queue after a transient network error.
    this.selectionQueue = next.then(() => undefined, () => undefined);
    return next;
  }

  selectTag(name: string): Promise<LiveTag> {
    return this.enqueueSelection(() => this.withWriter(async () => {
      await this.connectUnlocked();
      const response = await this.request<{ tag: LiveTag }>('/api/tags', { name });
      await this.request('/api/select', { tagId: response.tag.id });
      this.selectedTagId = response.tag.id;
      this.selectedTag = response.tag;
      this.signalSelectionChange();
      return response.tag;
    }));
  }

  clearSelection(): Promise<void> {
    return this.enqueueSelection(() => this.withWriter(async () => {
      await this.connectUnlocked();
      await this.request('/api/select', { tagId: null });
      this.selectedTagId = null;
      this.selectedTag = null;
      this.signalSelectionChange();
    }));
  }

  /** Call this method on a validated user click/tap, never on clock ticks. */
  creditClick(): Promise<boolean> {
    // Capture the hashtag at the gesture, before waiting for another tab.
    const clickedTagId = this.selectedTagId;
    return this.withWriter(() => {
      if (!clickedTagId || !this.queueBinding || this.quarantined) return false;
      const queued = this.pending.reduce((sum, b) => sum + b.clicks, 0);
      if (queued >= MAX_PENDING_CLICKS) return false;

      // A submitted batch is frozen until acknowledged; never mutate its
      // fingerprint while a request may be in flight.
      const last = this.pending[this.pending.length - 1];
      if (last && !this.sealed.has(last.batchId) && last.tagId === clickedTagId && last.clicks < 30) {
        last.clicks++;
      } else {
        this.pending.push({
          tagId: clickedTagId, batchId: this.makeId(), clicks: 1
        });
      }
      this.persist();
      return true;
    });
  }

  pendingClicks(): number {
    return this.pending.reduce((sum, b) => sum + b.clicks, 0);
  }

  /** Server snapshots, including expired history. Rendering a countdown must
   * use the elapsed time since receipt, not assume the browser clock is correct. */
  balances(): TimeBalance[] {
    return this.latestBalances.map(balance => ({ ...balance }));
  }

  selection(): string | null { return this.selectedTagId; }
  selectedTagDetails(): LiveTag | null { return this.selectedTag ? { ...this.selectedTag } : null; }

  remainingMilliseconds(tagId: string): number {
    const balance = this.latestBalances.find(item => item.tagId === tagId);
    if (!balance) return 0;
    const elapsed = Math.max(0, this.clock() - (this.receivedAt.get(tagId) ?? this.clock()));
    return Math.max(0, balance.remainingMs - elapsed);
  }

  /** Retries keep the same batch IDs and do not manufacture new credits. */
  async flush(): Promise<void> {
    if (this.quarantined) throw new Error('session_rotated_pending');
    if (this.sending) return this.sending;
    const task = async () => {
      await this.connectUnlocked();
      // Cached connect() alone is not safe across cookie rotations in other
      // tabs. Refresh the binding BEFORE any queued batch is transmitted.
      if (this.pending.length) await this.loadSession();
      // Yield after three batches so another tab can add taps or change
      // selection. Each fetch also has a bounded timeout.
      let sent = 0;
      const yieldAt = this.clock() + 5000;
      while (this.pending.length && sent < 3 && (sent === 0 || this.clock() < yieldAt)) {
        sent++;
        const batch = { ...this.pending[0] };
        this.sealed.add(batch.batchId);
        this.persist(); // Durable BEFORE fetch, including if this tab crashes.
        const credited = await this.request<TimeBalance>('/api/taps', batch);
        this.receivedAt.set(credited.tagId, this.clock());
        this.latestBalances = [...this.latestBalances.filter(b => b.tagId !== credited.tagId), credited];
        this.pending.shift();
        this.sealed.delete(batch.batchId);
        this.persist();
      }
    };
    this.sending = this.withWriter(task).finally(() => { this.sending = null; });
    return this.sending;
  }

  async ranking(): Promise<ActiveRanking> {
    const snapshot=await this.request<ActiveRanking>('/api/ranking');
    const decimal=(value:unknown)=>typeof value==='string'&&/^\d{1,64}$/.test(value);
    if(!snapshot||snapshot.type!=='active'||snapshot.metric!=='distinct_anonymous_sessions_with_positive_balance'||
      snapshot.geography!=='unavailable'||!Number.isFinite(snapshot.asOfMs)||snapshot.asOfMs<0||snapshot.asOfMs>8.64e15||
      !Array.isArray(snapshot.ranking)||snapshot.ranking.length>10||snapshot.ranking.some(tag=>
        !tag||typeof tag.id!=='string'||!/^[0-9a-f-]{36}$/i.test(tag.id)||
        typeof tag.name!=='string'||!tag.name.startsWith('#')||tag.name.length>33||
        typeof tag.color!=='string'||!/^#[0-9a-f]{6}$/i.test(tag.color)||
        !decimal(tag.activeParticipants)||!decimal(tag.historicalParticipants)||!decimal(tag.creditedSeconds))) {
      throw new Error('invalid_ranking_snapshot');
    }
    return snapshot;
  }

  historicalRanking(): Promise<ApiRanking> {
    return this.request<ApiRanking>('/api/history');
  }
}
