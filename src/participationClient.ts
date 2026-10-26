/**
 * Real-participation transport mounted only through explicit experience gates.
 * The browser never receives database credentials or direct visitor IDs.
 */
import type { CountrySnapshot } from './countryTypes';
import type {RegionSnapshot} from './regionalTypes';
import {regionCenter} from '../server/regionGrid.mjs';
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
const memorySenders = new WeakMap<StoreLike, Promise<unknown>>();
const SENDER_LOCK='world-pulse-pending-sender-v1';
export class ParticipationRequestError extends Error {retryAfterMs:number;constructor(code:string,retryAfterMs:number){super(code);this.retryAfterMs=retryAfterMs;}}
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
  private readonly uncertainProjection=new Set<string>();
  private latestBalances: TimeBalance[] = [];
  private creditsHasMore=false;
  private readonly receivedAt = new Map<string, number>();
  private readonly clock: () => number;
  private sessionPromise: Promise<void> | null = null;
  private sending: Promise<void> | null = null;
  private selectionQueue: Promise<unknown> = Promise.resolve();
  private memoryWriter: Promise<unknown> = Promise.resolve();
  private memorySender:Promise<unknown>=Promise.resolve();
  private geoDecided=false;
  private geoConsent=false;
  private regionCell:string|null=null;
  private geoCountry='ZZ';
  private geographyAvailable=false;

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
      ).slice(0, MAX_PENDING_CLICKS);
      // Legacy queues have no durable submitted marker: freeze them all.
      const frozen = envelope.version === 3 && Array.isArray(envelope.sealed)
        ? new Set(envelope.sealed) : new Set(batches.map(b => b.batchId));
      this.sealed.clear();
      const retained=new Set(batches.map(b=>b.batchId));
      for(const id of this.uncertainProjection)if(!retained.has(id))this.uncertainProjection.delete(id);
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

  private withSender<T>(task:()=>Promise<T>):Promise<T>{
    if(typeof navigator!=='undefined'&&navigator.locks)return navigator.locks.request(SENDER_LOCK,{signal:AbortSignal.timeout(30000)},task).then(value=>value);
    if(this.storage&&typeof window!=='undefined')return Promise.reject(new Error('queue_coordination_unavailable'));
    const next=(this.storage?memorySenders.get(this.storage)??Promise.resolve():this.memorySender).then(task,task);
    if(this.storage)memorySenders.set(this.storage,next.catch(()=>undefined));else this.memorySender=next.catch(()=>undefined);
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
      this.sealed.clear();this.uncertainProjection.clear();
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

  private async request<T>(path: string, body?: unknown, binding=this.queueBinding): Promise<T> {
    const response = await this.fetcher(path, {
      method: body === undefined ? 'GET' : 'POST',
      headers: body === undefined ? {} : {
        'Content-Type': 'application/json',
        ...(['/api/taps','/api/location'].includes(path) ? { 'X-WP-Session-Binding': binding ?? '' } : {})
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
        if (this.pending.length&&path!=='/api/taps') this.quarantinePending();
      }
      const wait=Number(response.headers.get('Retry-After'));
      throw new ParticipationRequestError(code,Number.isFinite(wait)&&wait>0?Math.min(wait*1000,300000):3000);
    }
    return payload as T;
  }

  private async loadSession(geoConsent?:boolean): Promise<void> {
    if (this.quarantined) throw new Error('session_rotated_pending');
    const session = await this.request<{
      anonymous: true; sessionFresh: boolean; sessionBinding: string;
      activeTagId: string | null; activeTag: LiveTag | null; credits: TimeBalance[];creditsHasMore?:boolean;
      geoConsent?:boolean;geoConsentDecided?:boolean;geoCountry?:string;geographyAvailable?:boolean;regionCell?:string|null;
    }>('/api/session', geoConsent===undefined?{}:{geoConsent});
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
    if(typeof session.geoConsentDecided==='boolean')this.geoDecided=session.geoConsentDecided;
    else if(geoConsent!==undefined||session.geoConsent===true)this.geoDecided=true;
    this.geoConsent=session.geoConsent===true;
    this.regionCell=typeof session.regionCell==='string'?session.regionCell:null;
    this.geoCountry=typeof session.geoCountry==='string'&&/^[A-Z]{2}$/.test(session.geoCountry)?session.geoCountry:'ZZ';
    this.geographyAvailable=session.geographyAvailable===true;
    if (!this.pending.length) this.persist();
    this.selectedTagId = session.activeTagId;
    this.selectedTag = session.activeTag;
    // A sealed POST may already be committed although its response was lost.
    // Keep the old per-tag view until its stable batch ID is acknowledged;
    // otherwise a fresh session snapshot plus the same pending taps doubles it.
    const frozenTags=new Set(this.pending.filter(b=>this.sealed.has(b.batchId)).map(b=>b.tagId));
    this.latestBalances=session.credits.map(balance=>{
      const previous=this.latestBalances.find(row=>row.tagId===balance.tagId);
      if(frozenTags.has(balance.tagId)&&previous)return previous;
      if(frozenTags.has(balance.tagId))for(const b of this.pending)if(b.tagId===balance.tagId&&this.sealed.has(b.batchId))this.uncertainProjection.add(b.batchId);
      this.receivedAt.set(balance.tagId,this.clock());return balance;
    });
    this.creditsHasMore=session.creditsHasMore===true;

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

  countryPreference(){return {consent:this.geoConsent,decided:this.geoDecided,country:this.geoCountry,available:this.geographyAvailable};}
  regionalCell(){return this.regionCell;}
  setRegionalCell(cell:string|null):Promise<void>{
    return this.enqueueSelection(()=>this.withWriter(async()=>{
      const result=await this.request<{regionCell:string|null;geoConsent?:boolean;geoCountry?:string}>('/api/location',{cell});
      if(result.regionCell!==cell)throw new Error('invalid_region_choice');
      this.regionCell=result.regionCell;this.geoConsent=result.geoConsent??cell!==null;this.geoDecided=true;
      this.geoCountry=typeof result.geoCountry==='string'&&/^[A-Z]{2}$/.test(result.geoCountry)?result.geoCountry:'ZZ';this.signalSelectionChange();
    }));
  }
  async regions():Promise<RegionSnapshot>{
    const value=await this.request<RegionSnapshot>('/api/regions');
    if(!value||value.type!=='region_snapshot'||!Number.isFinite(value.asOfMs)||value.validUntilMs!==value.asOfMs+5000||!Array.isArray(value.cells)||value.cells.length>2000||value.cells.some(row=>{
      try{regionCenter(row.cell);}catch{return true;}
      return !/^[0-9a-f-]{36}$/i.test(row.tagId)||typeof row.name!=='string'||!/^#[\p{L}\p{N}_]{2,32}$/u.test(row.name)||!/^#[0-9a-f]{6}$/i.test(row.color)||typeof row.participants!=='string'||!/^\d{1,64}$/.test(row.participants)||BigInt(row.participants)<1n;
    }))throw new Error('invalid_region_snapshot');
    if(new Set(value.cells.map(row=>row.cell+row.tagId)).size!==value.cells.length)throw new Error('invalid_region_snapshot');
    return value;
  }
  setGeoConsent(allowed:boolean):Promise<void>{
    return this.enqueueSelection(()=>this.withWriter(async()=>{
      await this.loadSession(allowed);this.sessionPromise=Promise.resolve();this.signalSelectionChange();
    }));
  }
  async countries():Promise<CountrySnapshot>{
    const snapshot=await this.request<CountrySnapshot>('/api/countries');
    const decimal=(value:unknown)=>typeof value==='string'&&/^\d{1,64}$/.test(value);
    if(!snapshot||snapshot.type!=='country_snapshot'||snapshot.granularity!=='country'||snapshot.privacyThreshold!==5||
      !Number.isFinite(snapshot.asOfMs)||snapshot.asOfMs<0||snapshot.asOfMs>8.64e15||snapshot.validUntilMs!==snapshot.asOfMs+5000||
      !Array.isArray(snapshot.tags)||snapshot.tags.length>5000||snapshot.tags.some(tag=>
        !tag||typeof tag.id!=='string'||!/^[0-9a-f-]{36}$/i.test(tag.id)||typeof tag.name!=='string'||tag.name.length>33||!tag.name.startsWith('#')||
        !/^#[0-9a-f]{6}$/i.test(tag.color)||!decimal(tag.activeParticipants)||!Array.isArray(tag.countries)||tag.countries.length>251||
        tag.countries.some(row=>!row||!(/^[A-Z]{2}$/.test(row.countryCode)||row.countryCode==='OTHER')||!decimal(row.activeParticipants)||
          (row.countryCode!=='ZZ'&&row.countryCode!=='OTHER'&&BigInt(row.activeParticipants)<5n))))throw new Error('invalid_country_snapshot');
    if(new Set(snapshot.tags.map(tag=>tag.id)).size!==snapshot.tags.length||snapshot.tags.some(tag=>new Set(tag.countries.map(row=>row.countryCode)).size!==tag.countries.length))throw new Error('invalid_country_snapshot');
    return snapshot;
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
      const selection=await this.request<{credits?:TimeBalance[];creditsHasMore?:boolean}>('/api/select', { tagId: response.tag.id });
      this.selectedTagId = response.tag.id;
      this.selectedTag = response.tag;
      if(Array.isArray(selection.credits)){
        this.latestBalances=selection.credits;this.creditsHasMore=selection.creditsHasMore===true;
        for(const balance of selection.credits)this.receivedAt.set(balance.tagId,this.clock());
      }else await this.loadSession();
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
    const clickedTagId = this.selectedTagId,clickedBinding=this.queueBinding;
    return this.withWriter(() => {
      if (!clickedTagId || !this.queueBinding || this.quarantined) return false;
      if(clickedBinding!==this.queueBinding)throw new Error('session_rotated_pending');
      const queued = this.pending.reduce((sum, b) => sum + b.clicks, 0);
      if (queued >= MAX_PENDING_CLICKS) return false;

      // A submitted batch is frozen until acknowledged; never mutate its
      // fingerprint while a request may be in flight.
      const previous=this.pending.map(batch=>({...batch}));
      const last = this.pending[this.pending.length - 1];
      if (last && !this.sealed.has(last.batchId) && last.tagId === clickedTagId && last.clicks < 30) {
        last.clicks++;
      } else {
        this.pending.push({
          tagId: clickedTagId, batchId: this.makeId(), clicks: 1
        });
      }
      try{this.persist();}catch(error){this.pending=previous;throw error;}
      return true;
    });
  }

  pendingClicks(): number {
    return this.pending.reduce((sum, b) => sum + b.clicks, 0);
  }

  pendingForTag(tagId:string):number{return this.quarantined?0:this.pending.filter(b=>b.tagId===tagId&&!this.uncertainProjection.has(b.batchId)).reduce((n,b)=>n+b.clicks,0);}

  persistsPending(): boolean { return this.storage !== null; }
  balancesLimited():boolean{return this.creditsHasMore;}

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
      await this.withWriter(async()=>{
        await this.connectUnlocked();
        if(this.pending.length)await this.loadSession();
      });
      let sent=0;const yieldAt=this.clock()+5000;
      while(sent<3&&(sent===0||this.clock()<yieldAt)){
        const submission=await this.withWriter(()=>{
          if(this.quarantined)throw new Error('session_rotated_pending');
          if(!this.pending.length)return null;
          const batch={...this.pending[0]},binding=this.queueBinding;
          this.sealed.add(batch.batchId);this.persist();
          return {batch,binding};
        });
        if(!submission)break;sent++;
        // The sender lock serializes POSTs; the queue lock is free for taps.
        let credited:TimeBalance;
        try{credited=await this.request<TimeBalance>('/api/taps',submission.batch,submission.binding);}
        catch(error){
          if(error instanceof Error&&['session_expired','session_binding_mismatch'].includes(error.message))await this.withWriter(()=>{
            if(this.queueBinding===submission.binding&&this.pending.length)this.quarantinePending();
          });
          throw error;
        }
        const acknowledged=await this.withWriter(()=>{
          if(this.quarantined||this.queueBinding!==submission.binding)return false;
          const index=this.pending.findIndex(b=>b.batchId===submission.batch.batchId);
          if(index<0)return false; // An explicit discard must not resurrect an old queue.
          this.receivedAt.set(credited.tagId,this.clock());
          this.latestBalances=[...this.latestBalances.filter(b=>b.tagId!==credited.tagId),credited];
          this.pending.splice(index,1);this.sealed.delete(submission.batch.batchId);this.uncertainProjection.delete(submission.batch.batchId);this.persist();return true;
        });
        if(!acknowledged)return;
      }
    };
    this.sending=this.withSender(task).finally(()=>{this.sending=null;});
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
