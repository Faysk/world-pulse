import type { CountrySnapshot } from './countryTypes';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ParticipationClient, ParticipationRequestError, PENDING_NOTICE_KEY, SELECTION_NOTICE_KEY, type ActiveRanking, type LiveTag, type TimeBalance } from './participationClient';

export function participationError(error: unknown): string {
  const code=error instanceof Error ? error.message : '';
  const messages: Record<string,string>={
    participation_disabled:'A participação ainda não está disponível neste ambiente.',
    invalid_hashtag:'Use de 2 a 32 letras, números ou _ na hashtag.',
    operation_budget_exhausted:'A plataforma atingiu um limite temporário. Aguarde antes de tentar novamente.',
    rate_limited:'Muitos taps nesta sessão. Aguarde antes de sincronizar novamente.',
    session_rotated_pending:'A sessão mudou. A fila antiga foi isolada e não será atribuída à nova sessão.',
    session_binding_mismatch:'A sessão mudou. A fila antiga foi isolada e não será atribuída à nova sessão.',
    session_expired:'A sessão expirou. Reconecte para verificar sua fila.',
    queue_coordination_unavailable:'Este navegador não permite coordenar a fila entre abas. Use um navegador atualizado com conexão segura.',
    queue_storage_unavailable:'Não foi possível salvar a fila. Este tap ainda não está confirmado.',
    queue_full:'A fila local está cheia. Sincronize antes de adicionar mais taps.'
  };
  return messages[code] ?? 'Não foi possível sincronizar. Os taps pendentes continuam na fila para tentar novamente.';
}

export function useParticipation() {
  const [client]=useState(()=>new ParticipationClient());
  const [ready,setReady]=useState(false);
  const [selecting,setSelecting]=useState(false);
  const [syncing,setSyncing]=useState(false);
  const [error,setError]=useState('');
  const [selected,setSelected]=useState<LiveTag|null>(null);
  const [balances,setBalances]=useState<TimeBalance[]>([]);
  const [pending,setPending]=useState(0);
  const [quarantined,setQuarantined]=useState(false);
  const [ranking,setRanking]=useState<ActiveRanking|null>(null);
  const [rankingError,setRankingError]=useState(false);
  const [tick,setTick]=useState(0);
  const [countrySnapshot,setCountrySnapshot]=useState<CountrySnapshot|null>(null);
  const [countryError,setCountryError]=useState(false);
  const [countryPreference,setCountryPreference]=useState(client.countryPreference());
  const [consentBusy,setConsentBusy]=useState(false);
  const [shareCountry,setShareCountry]=useState(true);
  const [deliveryNotice,setDeliveryNotice]=useState('');
  const intents=useRef(new Map<string,number>());
  const participatedHere=useRef(false);
  const retryAt=useRef(0);
  const retryCount=useRef(0);
  useEffect(()=>{if(countryPreference.decided)setShareCountry(countryPreference.consent);},[countryPreference.decided,countryPreference.consent]);
  const countryRequest=useRef<Promise<void>|null>(null);
  const countryRevision=useRef(0);
  const sending=useRef(false);
  const rankingRequest=useRef<Promise<void>|null>(null);
  const mounted=useRef(false);

  const view=useCallback(()=>{
    if(!mounted.current)return;
    const preference=client.countryPreference();
    setCountryPreference(preference);
    if(!preference.available){countryRevision.current++;setCountrySnapshot(null);setCountryError(false);}
    setSelected(client.selectedTagDetails());setBalances(client.balances());
    setPending(client.pendingClicks());setQuarantined(client.isQuarantined());
  },[client]);
  const failure=useCallback((reason:unknown)=>{
    if(!mounted.current)return;
    view();setError(participationError(reason));
    if(client.isQuarantined())setReady(false);
  },[client,view]);
  const refreshRanking=useCallback(async(afterMutation=false):Promise<void>=>{
    if(rankingRequest.current){await rankingRequest.current;if(!afterMutation)return;}
    if(!mounted.current)return;
    const task=client.ranking().then(snapshot=>{
      if(mounted.current){setRanking(snapshot);setRankingError(false);}
    }).catch(()=>{if(mounted.current)setRankingError(true);});
    rankingRequest.current=task;
    try{await task;}finally{if(rankingRequest.current===task)rankingRequest.current=null;}
  },[client]);
  const refreshCountries=useCallback(async(afterMutation=false):Promise<void>=>{
    if(countryRequest.current){await countryRequest.current;if(!afterMutation)return;}
    if(!mounted.current||!client.countryPreference().available)return;
    const revision=countryRevision.current;
    const task=client.countries().then(snapshot=>{
      if(mounted.current&&client.countryPreference().available&&revision===countryRevision.current){setCountrySnapshot(snapshot);setCountryError(false);}
    }).catch(()=>{if(mounted.current&&revision===countryRevision.current){setCountryError(client.countryPreference().available);setCountrySnapshot(null);}});
    countryRequest.current=task;
    try{await task;}finally{if(countryRequest.current===task)countryRequest.current=null;}
  },[client]);
  const setGeoConsent=useCallback(async(allowed:boolean)=>{
    setShareCountry(allowed);
    if(consentBusy||!ready)return;
    setConsentBusy(true);
    try{await client.setGeoConsent(allowed);if(!mounted.current)return;countryRevision.current++;setCountrySnapshot(null);view();await refreshCountries(true);}
    catch(reason){failure(reason);if(mounted.current&&!client.isQuarantined())setError('Não foi possível confirmar sua escolha de país. Recarregue a página para conferir a preferência salva.');}
    finally{if(mounted.current)setConsentBusy(false);}
  },[client,consentBusy,ready,view,refreshCountries,failure]);
  const ensureCountryChoice=useCallback(async()=>{
    const preference=client.countryPreference();
    if(!preference.decided||preference.consent!==shareCountry){await client.setGeoConsent(shareCountry);view();}
  },[client,shareCountry,view]);
  useEffect(()=>{
    if(!ready||!countryPreference.available)return;
    void refreshCountries();
    const id=window.setInterval(()=>{if(!document.hidden)void refreshCountries();},5000);
    return()=>window.clearInterval(id);
  },[ready,countryPreference.available,refreshCountries]);
  const connect=useCallback(async()=>{
    try{await client.refreshSession();view();if(mounted.current){setReady(true);setError('');}}
    catch(reason){failure(reason);}
  },[client,view,failure]);
  useEffect(()=>{
    mounted.current=true;void connect();
    return()=>{mounted.current=false;};
  },[connect]);
  useEffect(()=>{
    if(!ready)return;
    void refreshRanking();
    const id=window.setInterval(()=>{if(!document.hidden)void refreshRanking();},5000);
    return()=>window.clearInterval(id);
  },[ready,refreshRanking]);
  useEffect(()=>{
    const id=window.setInterval(()=>{if(!document.hidden)setTick(n=>n+1);},250);
    return()=>window.clearInterval(id);
  },[]);

  const sync=useCallback(async()=>{
    if(!ready||sending.current||client.isQuarantined())return;
    sending.current=true;setSyncing(true);
    try{
      if(participatedHere.current)await ensureCountryChoice();
      await client.refreshPending();
      if(client.pendingClicks())await client.flush();
      retryAt.current=0;retryCount.current=0;view();setError('');setDeliveryNotice('');await refreshRanking(true);
    }catch(reason){
      if(client.isQuarantined())failure(reason);
      else{
        retryCount.current++;
        retryAt.current=performance.now()+(reason instanceof ParticipationRequestError?reason.retryAfterMs:Math.min(30000,2000*2**Math.min(retryCount.current,4)));
        view();setError('');setDeliveryNotice('Taps guardados neste navegador. A sincronização tenta novamente automaticamente.');
      }
    }
    finally{sending.current=false;if(mounted.current){view();setSyncing(false);}}
  },[client,ready,view,refreshRanking,failure,ensureCountryChoice]);
  useEffect(()=>{
    if(!ready)return;
    const id=window.setInterval(()=>{if(!document.hidden&&client.pendingClicks()>0&&performance.now()>=retryAt.current)void sync();},2000);
    return()=>window.clearInterval(id);
  },[client,ready,sync]);
  useEffect(()=>{
    const reconcile=()=>{if(!document.hidden){void connect();if(ready)void refreshRanking();}};
    const storage=(event:StorageEvent)=>{
      if(event.key===SELECTION_NOTICE_KEY)void connect();
      if(event.key===PENDING_NOTICE_KEY)void client.refreshPending().then(view).catch(failure);
    };
    window.addEventListener('storage',storage);window.addEventListener('focus',reconcile);
    document.addEventListener('visibilitychange',reconcile);
    return()=>{window.removeEventListener('storage',storage);window.removeEventListener('focus',reconcile);document.removeEventListener('visibilitychange',reconcile);};
  },[client,connect,view,failure,ready,refreshRanking]);

  const select=useCallback(async(name:string)=>{
    if(selecting||!ready)return;
    setSelecting(true);participatedHere.current=true;
    try{await ensureCountryChoice();await client.selectTag(name);view();setError('');await refreshRanking(true);}
    catch(reason){failure(reason);}
    finally{if(mounted.current)setSelecting(false);}
  },[client,selecting,ready,view,refreshRanking,failure,ensureCountryChoice]);
  const tap=useCallback(()=>{
    const tagId=client.selection();
    if(!ready||selecting||!tagId)return;
    participatedHere.current=true;
    intents.current.set(tagId,(intents.current.get(tagId)??0)+1);
    setTick(n=>n+1); // Immediate provisional feedback, before any lock or network.
    void client.creditClick().then(accepted=>{
      if(!accepted)throw new Error(client.isQuarantined()?'session_rotated_pending':'queue_full');
    }).catch(failure).finally(()=>{
      const count=(intents.current.get(tagId)??1)-1;
      if(count)intents.current.set(tagId,count);else intents.current.delete(tagId);
      view();if(mounted.current)setTick(n=>n+1);
    });
  },[client,ready,selecting,view,failure]);
  const discard=useCallback(async()=>{
    try{await client.discardOrphanedPending();await connect();}
    catch(reason){failure(reason);}
  },[client,connect,failure]);
  return {shareCountry,deliveryNotice,countrySnapshot,countryError,countryPreference,consentBusy,setGeoConsent,ready,selecting,syncing,error,selected,balances,pending:pending+[...intents.current.values()].reduce((a,b)=>a+b,0),quarantined,ranking,rankingError,tick,persistent:client.persistsPending(),balancesLimited:client.balancesLimited(),
    remaining:(tagId:string)=>client.remainingMilliseconds(tagId)+(client.pendingForTag(tagId)+(intents.current.get(tagId)??0))*1000,connect,select,tap,sync,discard};
}
