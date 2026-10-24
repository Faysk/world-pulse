import type { FeatureCollection } from 'geojson';
import { useEffect, useRef } from 'react';
import type { Map as MapInstance, GeoJSONSource } from 'maplibre-gl';
import geometryUrl from './assets/countries-110m.geojson?url';
import type { CountrySnapshot } from './countryTypes';
const EMPTY:FeatureCollection={type:'FeatureCollection',features:[]};
let geometry:Promise<FeatureCollection>|null=null;
function countryGeometry(){
  if(!geometry)geometry=fetch(geometryUrl,{signal:AbortSignal.timeout(10000)}).then(response=>{
    if(!response.ok)throw new Error('geometry_unavailable');return response.json() as Promise<FeatureCollection>;
  }).catch(error=>{geometry=null;throw error;});
  return geometry;
}

// Stable native polygon resources; counts never allocate a point per participant.
export function CountryLayer({map,snapshot,tagId,onError}:{map:MapInstance|null;snapshot:CountrySnapshot|null;tagId:string|null;onError:(message:string)=>void}){
  const generation=useRef(0);
  useEffect(()=>{
    if(!map)return;
    map.addSource('live-countries',{type:'geojson',data:EMPTY});
    map.addLayer({id:'live-country-fill',type:'fill',source:'live-countries',paint:{'fill-color':'#ffffff','fill-opacity':0.36}});
    map.addLayer({id:'live-country-line',type:'line',source:'live-countries',paint:{'line-color':'#ffffff','line-width':1.4}});
    return()=>{
      generation.current++;
      if(!map.getStyle())return;
      for(const id of ['live-country-line','live-country-fill'])if(map.getLayer(id))map.removeLayer(id);
      if(map.getSource('live-countries'))map.removeSource('live-countries');
    };
  },[map]);
  useEffect(()=>{
    const version=++generation.current;
    if(!map)return;
    const source=map.getSource('live-countries') as GeoJSONSource|undefined;
    if(!source)return;
    const tag=snapshot?.tags.find(item=>item.id===tagId);
    const visible=new Set(tag?.countries.filter(c=>/^[A-Z]{2}$/.test(c.countryCode)&&c.countryCode!=='ZZ').map(c=>c.countryCode));
    if(!tag||!visible.size){source.setData(EMPTY);onError('');return;}
    void countryGeometry().then(collection=>{
      if(version!==generation.current)return;
      source.setData({type:'FeatureCollection',features:collection.features.filter(feature=>visible.has(feature.properties?.countryCode))});
      map.setPaintProperty('live-country-fill','fill-color',tag.color);
      map.setPaintProperty('live-country-line','line-color',tag.color);
      onError('');
    }).catch(()=>{if(version===generation.current){source.setData(EMPTY);onError('Não foi possível desenhar os países. Consulte os totais na lista.');}});
    return()=>{generation.current++;};
  },[map,snapshot,tagId,onError]);
  return null;
}
