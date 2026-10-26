import {useMemo,useState} from 'react';
import {createRoot} from 'react-dom/client';
import type {Map} from 'maplibre-gl';
import {WorldGlobe} from '../../src/WorldGlobe';
import {RegionalPointLayer} from '../../src/RegionalPointLayer';
import {regionCell,regionCenter} from '../../server/regionGrid.mjs';
import 'maplibre-gl/dist/maplibre-gl.css';
const cell=regionCell(38.72,-9.14),tagId='11111111-1111-4111-8111-111111111111';
function Fixture(){
  const [map,setMap]=useState<Map|null>(null),[count,setCount]=useState('1'),[show,setShow]=useState(true),[mounted,setMounted]=useState(true),[picked,setPicked]=useState(''),[taps,setTaps]=useState(0);
  const row={cell,tagId,name:'#fixture',color:'#b17bff',participants:count};
  const snapshot=useMemo(()=>({type:'region_snapshot' as const,asOfMs:0,validUntilMs:5000,cells:show?[row]:[]}),[count,show]);
  const own=useMemo(()=>show?[{...row,participants:'1'}]:[],[show]);
  return <><WorldGlobe scale={0} population={{type:'FeatureCollection',features:[]}} selected={null} cityLights={false} onReady={m=>{m.jumpTo({center:regionCenter(cell),zoom:5});(window as any).testMap=m;setMap(m);}} onZoom={()=>{}} onFps={()=>{}} onTap={()=>setTaps(n=>n+1)} onRegionPick={setPicked} onTagPick={()=>{}} onFailure={()=>{}}/>
    {mounted&&<RegionalPointLayer map={map} snapshot={snapshot} own={own} tagId={null}/>}
    <div style={{position:'fixed',top:0,left:0,zIndex:10,background:'white'}}><output data-testid="picked">{picked}</output><output data-testid="taps">{taps}</output><button onClick={()=>setCount('8000000000')}>Many</button><button onClick={()=>setShow(false)}>Clear</button><button onClick={()=>setMounted(false)}>Unmount</button></div></>;
}
createRoot(document.getElementById('root')!).render(<Fixture/>);
