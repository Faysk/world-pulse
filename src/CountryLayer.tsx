import type { FeatureCollection } from 'geojson';
import { useEffect, useRef } from 'react';
import type { Map as MapInstance, GeoJSONSource } from 'maplibre-gl';
import geometryUrl from './assets/countries-110m.geojson?url';
import type { CountrySnapshot } from './countryTypes';
import {composeCountries,countryPattern,type CountryComposition} from './countryComposition';
const EMPTY:FeatureCollection={type:'FeatureCollection',features:[]};
let geometry:Promise<FeatureCollection>|null=null;
export function countryGeometry(){
  if(!geometry)geometry=fetch(geometryUrl,{signal:AbortSignal.timeout(10000)}).then(response=>{
    if(!response.ok)throw new Error('geometry_unavailable');return response.json() as Promise<FeatureCollection>;
  }).catch(error=>{geometry=null;throw error;});
  return geometry;
}

// Stable native polygon resources; counts never allocate a point per participant.
export function CountryLayer({map,snapshot,tagId,mode='selected',onError}:{map:MapInstance|null;snapshot:CountrySnapshot|null;tagId:string|null;mode?:'all'|'selected';onError:(message:string)=>void}){
  const generation=useRef(0);
  const images=useRef(new Map<string,string>());
  const sourceSignature=useRef('');
  useEffect(()=>{
    if(!map)return;
    map.addSource('live-countries',{type:'geojson',data:EMPTY});
    map.addLayer({id:'live-country-fill',type:'fill',source:'live-countries',paint:{'fill-pattern':['get','pattern'],'fill-opacity':0.58}});
    map.addLayer({id:'live-country-line',type:'line',source:'live-countries',paint:{'line-color':['get','outlineColor'],'line-width':1.4}});
    return()=>{
      generation.current++;
      const imageIds=[...images.current.keys()];
      images.current.clear();sourceSignature.current='';
      if(!map.getStyle())return;
      for(const id of ['live-country-line','live-country-fill'])if(map.getLayer(id))map.removeLayer(id);
      if(map.getSource('live-countries'))map.removeSource('live-countries');
      for(const id of imageIds)if(map.hasImage(id))map.removeImage(id);
    };
  },[map]);
  useEffect(()=>{
    const version=++generation.current;
    if(!map)return;
    const source=map.getSource('live-countries') as GeoJSONSource|undefined;
    if(!source)return;
    let plans:CountryComposition[];
    try{plans=mode==='selected'&&!tagId?[]:composeCountries(snapshot,mode==='selected'?tagId:null);}
    catch{source.setData(EMPTY);sourceSignature.current='';onError('Leitura geográfica inválida. Nenhuma área foi inventada.');return;}
    if(!plans.length){source.setData(EMPTY);sourceSignature.current='';onError('');return;}
    const byCountry=new Map(plans.map(plan=>[plan.countryCode,plan]));
    void countryGeometry().then(collection=>{
      if(version!==generation.current)return;
      const features=collection.features.flatMap(feature=>{
        const code=feature.properties?.countryCode,plan=byCountry.get(code);
        if(!plan)return [];
        const pattern='live-country-pattern-'+code;
        if(images.current.get(pattern)!==plan.signature){
          const pixels=countryPattern(plan);
          if(map.hasImage(pattern))map.updateImage(pattern,pixels);else map.addImage(pattern,pixels);
          images.current.set(pattern,plan.signature);
        }
        return [{...feature,properties:{...feature.properties,countryCode:plan.countryCode,pattern,outlineColor:plan.outlineColor}}];
      });
      const signature=features.map(feature=>feature.properties.countryCode+feature.properties.outlineColor).join('|');
      if(sourceSignature.current!==signature){source.setData({type:'FeatureCollection',features});sourceSignature.current=signature;}
      onError('');
    }).catch(()=>{if(version===generation.current){source.setData(EMPTY);sourceSignature.current='';onError('Não foi possível desenhar os países. Consulte os totais na lista.');}});
    return()=>{generation.current++;};
  },[map,snapshot,tagId,mode,onError]);
  return null;
}
