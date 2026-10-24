import type { CountrySnapshot } from './countryTypes';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ParticipationClient, PENDING_NOTICE_KEY, SELECTION_NOTICE_KEY, type ActiveRanking, type LiveTag, type TimeBalance } from './participationClient';

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
  const countryRequest=useRef<Promise<void>|null>(null);
  const sending=useRef(false);
  const rankingRequest=useRef<Promise<void>|null>(null);
  const mounted=useRef(false);

  const view=useCallback(()=>{
    if(!mounted.current)return;
    setCountryPreference(client.countryPreference());
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
    const task=client.countries().then(snapshot=>{
      if(mounted.current){setCountrySnapshot(snapshot);setCountryError(false);}
    }).catch(()=>{if(mounted.current){setCountryError(true);setCountrySnapshot(null);}});
    countryRequest.current=task;
    try{await task;}finally{if(countryRequest.current===task)countryRequest.current=null;}
  },[client]);
  const setGeoConsent=useCallback(async(allowed:boolean)=>{
    if(consentBusy||!ready)return;
    setConsentBusy(true);
    try{await client.setGeoConsent(allowed);view();await refreshCountries(true);}
    catch(reason){failure(reason);}
    finally{if(mounted.current)setConsentBusy(false);}
  },[client,consentBusy,ready,view,refreshCountries,failure]);
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
      await client.refreshPending();
      if(client.pendingClicks())await client.flush();
      view();setError('');await refreshRanking(true);
    }catch(reason){failure(reason);}
    finally{sending.current=false;if(mounted.current){view();setSyncing(false);}}
  },[client,ready,view,refreshRanking,failure]);
  useEffect(()=>{
    if(!ready||error)return;
    const id=window.setInterval(()=>{if(!document.hidden&&client.pendingClicks()>0)void sync();},2000);
    return()=>window.clearInterval(id);
  },[client,ready,error,sync]);
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
    setSelecting(true);
    try{await client.selectTag(name);view();setError('');await refreshRanking(true);}
    catch(reason){failure(reason);}
    finally{if(mounted.current)setSelecting(false);}
  },[client,selecting,ready,view,refreshRanking,failure]);
  const tap=useCallback(async()=>{
    if(!ready||selecting||!client.selection())return;
    try{if(!await client.creditClick())throw new Error(client.isQuarantined()?'session_rotated_pending':'queue_full');view();}
    catch(reason){failure(reason);}
  },[client,ready,selecting,view,failure]);
  const discard=useCallback(async()=>{
    try{await client.discardOrphanedPending();await connect();}
    catch(reason){failure(reason);}
  },[client,connect,failure]);
  return {countrySnapshot,countryError,countryPreference,consentBusy,setGeoConsent,ready,selecting,syncing,error,selected,balances,pending,quarantined,ranking,rankingError,tick,persistent:client.persistsPending(),balancesLimited:client.balancesLimited(),
    remaining:(tagId:string)=>client.remainingMilliseconds(tagId),connect,select,tap,sync,discard};
}
