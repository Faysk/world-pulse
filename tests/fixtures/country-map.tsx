import React,{useState} from 'react';
import {createRoot} from 'react-dom/client';
import {WorldGlobe} from '../../src/WorldGlobe';
import {CountryLayer} from '../../src/CountryLayer';
import 'maplibre-gl/dist/maplibre-gl.css';
import type {Map} from 'maplibre-gl';
const empty={type:'FeatureCollection' as const,features:[]};
function Fixture(){
  const [map,setMap]=useState<Map|null>(null),[taps,setTaps]=useState(0),[country,setCountry]=useState(''),[show,setShow]=useState(true),[error,setError]=useState('');
  const snapshot=React.useMemo(()=>({type:'country_snapshot' as const,asOfMs:0,validUntilMs:5000,granularity:'country' as const,privacyThreshold:5 as const,tags:[{id:'test',name:'#fixture',color:'#ff7755',activeParticipants:'8000000000',countries:[{countryCode:'PT',activeParticipants:'8000000000'}]}]}),[]);
  return <><WorldGlobe population={empty} scale={0} selected={null} cityLights={false} onReady={instance=>{instance.jumpTo({center:[-8,39],zoom:4});(window as any).testMap=instance;setMap(instance);}} onZoom={()=>{}} onFps={()=>{}} onTap={()=>setTaps(v=>v+1)} onTagPick={()=>{}} onCountryPick={setCountry} onFailure={setError}/>
    <CountryLayer map={map} snapshot={show?snapshot:null} tagId="test" onError={setError}/>
    <div style={{position:'fixed',top:0,left:0,background:'white',zIndex:10}}><output data-testid="taps">{taps}</output><output data-testid="picked">{country}</output><output data-testid="error">{error}</output><button onClick={()=>setShow(false)}>Clear</button></div></>;
}
createRoot(document.getElementById('root')!).render(<Fixture/>);
