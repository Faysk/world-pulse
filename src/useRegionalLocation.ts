import {useCallback,useEffect,useRef,useState} from 'react';
import type {ParticipationClient} from './participationClient';
import type {RegionSnapshot} from './regionalTypes';
import {regionCell} from '../server/regionGrid.mjs';

export function useRegionalLocation(client:ParticipationClient,enabled:boolean){
  const [snapshot,setSnapshot]=useState<RegionSnapshot|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState('');
  const [,render]=useState(0);
  const [readError,setReadError]=useState(false);
  const allowed=useRef(enabled);allowed.current=enabled;
  const mounted=useRef(false),revision=useRef(0),request=useRef<Promise<void>|null>(null);
  const refresh=useCallback(async()=>{
    if(request.current)return request.current;
    if(!mounted.current||!allowed.current)return;
    const version=revision.current;
    const task=client.regions().then(value=>{if(mounted.current&&allowed.current&&version===revision.current){setSnapshot(value);setReadError(false);}})
      .catch(()=>{if(mounted.current&&allowed.current&&version===revision.current){setSnapshot(null);setReadError(true);}});
    request.current=task;try{await task;}finally{if(request.current===task)request.current=null;}
  },[client]);
  useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;revision.current++;};},[]);
  useEffect(()=>{
    revision.current++;setSnapshot(null);setReadError(false);
    if(!enabled)return;
    void refresh();const id=setInterval(()=>{if(!document.hidden)void refresh();},5000);
    return()=>{clearInterval(id);revision.current++;};
  },[enabled,refresh]);
  const save=useCallback(async(cell:string|null)=>{
    revision.current++;setSnapshot(null);
    await client.setRegionalCell(cell);
    if(mounted.current){render(n=>n+1);await refresh();}
  },[client,refresh]);
  const locate=useCallback(()=>{
    if(busy||!enabled)return;
    if(!navigator.geolocation){setError('Este navegador não oferece localização. Você pode participar sem ponto.');return;}
    setBusy(true);setError('');
    navigator.geolocation.getCurrentPosition(position=>{
      if(!mounted.current)return;
      // Raw coordinates are used only here and never stored, logged or sent.
      const cell=regionCell(position.coords.latitude,position.coords.longitude);
      void save(cell).catch(()=>{if(mounted.current)setError('Não foi possível salvar seu ponto. Tente novamente.');})
        .finally(()=>{if(mounted.current)setBusy(false);});
    },reason=>{
      if(mounted.current){setBusy(false);setError(reason.code===1?'Localização não autorizada. Sua participação continua sem ponto.':'Localização indisponível. Tente novamente; seus taps continuam funcionando.');}
    },{enableHighAccuracy:false,maximumAge:0,timeout:15000});
  },[busy,enabled,save]);
  const withdraw=useCallback(async()=>{
    if(busy)return;
    setBusy(true);setError('');
    try{await save(null);}catch{if(mounted.current)setError('Não foi possível confirmar a retirada. Recarregue para conferir.');}
    finally{if(mounted.current)setBusy(false);}
  },[busy,save]);
  return {snapshot,busy,error,readError,shared:client.regionalCell()!==null||client.countryPreference().consent,cell:client.regionalCell(),locate,withdraw,refresh};
}
