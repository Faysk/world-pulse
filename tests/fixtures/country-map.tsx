import React,{useState} from 'react';
import {createRoot} from 'react-dom/client';
import {WorldGlobe} from '../../src/WorldGlobe';
import {CountryLayer} from '../../src/CountryLayer';
import 'maplibre-gl/dist/maplibre-gl.css';
import type {Map} from 'maplibre-gl';
const empty={type:'FeatureCollection' as const,features:[]};
function Fixture(){
  const [map,setMap]=useState<Map|null>(null),[taps,setTaps]=useState(0),[country,setCountry]=useState(''),[show,setShow]=useState(true),[mounted,setMounted]=useState(true),[error,setError]=useState('');
  (window as any).clearCountry=()=>setShow(false);
  const [revision,setRevision]=useState(0),[mode,setMode]=useState<'selected'|'all'>('selected');
  const snapshot=React.useMemo(()=>({type:'country_snapshot' as const,asOfMs:revision*5000,validUntilMs:revision*5000+5000,granularity:'country' as const,privacyThreshold:5 as const,tags:[{id:'test',name:'#fixture',color:'#ff7755',activeParticipants:'8000000000',countries:[{countryCode:'PT',activeParticipants:'8000000000'}]}]}),[revision]);
  const mixed={...snapshot,tags:[{...snapshot.tags[0],activeParticipants:'4000000000',countries:[{countryCode:'PT',activeParticipants:'4000000000'}]},{id:'other',name:'#other',color:'#33ccff',activeParticipants:'4000000000',countries:[{countryCode:'PT',activeParticipants:'4000000000'}]}]};
  return <><WorldGlobe population={empty} scale={0} selected={null} cityLights={false} onReady={instance=>{instance.jumpTo({center:[-8,39],zoom:4});(window as any).testMap=instance;setMap(instance);}} onZoom={()=>{}} onFps={()=>{}} onTap={()=>setTaps(v=>v+1)} onTagPick={()=>{}} onCountryPick={setCountry} onFailure={setError}/>
    {mounted&&<CountryLayer map={map} snapshot={show?(mode==='all'?mixed:snapshot):null} mode={mode} tagId="test" onError={setError}/>}
    <div style={{position:'fixed',top:0,left:0,background:'white',zIndex:10}}><output data-testid="taps">{taps}</output><output data-testid="picked">{country}</output><output data-testid="error">{error}</output><button onClick={()=>setMode('all')}>Overview</button><button onClick={()=>setMode('selected')}>Focus</button><button onClick={()=>setShow(false)}>Clear</button><button onClick={()=>setMounted(false)}>Unmount layer</button><button onClick={()=>setRevision(v=>v+1)}>Refresh</button></div></>;
}
createRoot(document.getElementById('root')!).render(<Fixture/>);
