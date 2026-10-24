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

type FetchLike = typeof fetch;
type StoreLike = Pick<Storage, 'getItem' | 'setItem'>;
const STORAGE_KEY = 'world-pulse-pending-v1';
const QUARANTINE_KEY = 'world-pulse-pending-quarantined-v1';
export const SELECTION_NOTICE_KEY = 'world-pulse-selection-changed-v1';
const MAX_PENDING_CLICKS = 3000;

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

  constructor(
    fetcher: FetchLike = (input, init) => fetch(input, init),
    storage: StoreLike | null = typeof window === 'undefined' ? null : window.localStorage,
    makeId: () => string = () => crypto.randomUUID(),
    clock: () => number = () => performance.now()
  ) {
    this.fetcher = fetcher;
    this.storage = storage;
    this.makeId = makeId;
    this.clock = clock;
    this.pending = this.readPending();
    try { this.quarantined = this.storage?.getItem(QUARANTINE_KEY) === '1'; } catch { this.quarantined = false; }
    if (this.pending.length && !this.queueBinding) this.quarantinePending();
    // A restored request may have reached the server before its response was
    // lost. Its ID and fingerprint must never receive new taps.
    for (const batch of this.pending) this.sealed.add(batch.batchId);
  }

  private readPending(): PendingTapBatch[] {
    try {
      const raw = this.storage?.getItem(STORAGE_KEY);
      const value: unknown = raw ? JSON.parse(raw) : null;
      // A legacy array is deliberately unbound: keep it for the user to
      // explicitly discard rather than ever credit it to an unknown cookie.
      const envelope = value && typeof value === 'object' && !Array.isArray(value)
        ? value as { version?: number; binding?: unknown; batches?: unknown }
        : { version: 0, binding: null, batches: value };
      if (envelope.version === 2 && typeof envelope.binding === 'string' &&
        /^[0-9a-f]{64}$/.test(envelope.binding)) {
        this.queueBinding = envelope.binding;
      }
      if (!Array.isArray(envelope.batches)) return [];
      return envelope.batches.filter((v): v is PendingTapBatch =>
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
    try {
      this.storage?.setItem(STORAGE_KEY, JSON.stringify({
        version: 2, binding: this.queueBinding, batches: this.pending
      }));
    } catch { /* Storage may be unavailable in private mode. In-memory queue remains. */ }
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
  discardOrphanedPending(): void {
    if (!this.quarantined) return;
    this.pending = [];
    this.queueBinding = null;
    this.sealed.clear();
    this.persist();
    this.quarantined = false;
    try { this.storage?.setItem(QUARANTINE_KEY, '0'); } catch { /* best effort */ }
    this.sessionPromise = null;
  }

  isQuarantined(): boolean { return this.quarantined; }

  private signalSelectionChange(): void {
    try { this.storage?.setItem(SELECTION_NOTICE_KEY, this.makeId()); }
    catch { /* Another tab can still refresh on focus without storage. */ }
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
      if (response.status === 401 && code === 'session_expired') {
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

  async connect(): Promise<void> {
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
    return this.enqueueSelection(async () => {
      await this.loadSession();
      this.sessionPromise = Promise.resolve();
    });
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
      this.selectedTag = response.tag;
      this.signalSelectionChange();
      return response.tag;
    });
  }

  clearSelection(): Promise<void> {
    return this.enqueueSelection(async () => {
      await this.connect();
      await this.request('/api/select', { tagId: null });
      this.selectedTagId = null;
      this.selectedTag = null;
      this.signalSelectionChange();
    });
  }

  /** Call this method on a validated user click/tap, never on clock ticks. */
  creditClick(): boolean {
    if (!this.selectedTagId || this.quarantined) return false;
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
      await this.connect();
      while (this.pending.length) {
        const batch = { ...this.pending[0] };
        this.sealed.add(batch.batchId);
        const credited = await this.request<TimeBalance>('/api/taps', batch);
        this.receivedAt.set(credited.tagId, this.clock());
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
