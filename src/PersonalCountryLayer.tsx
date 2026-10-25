import {useEffect} from 'react';
import type {Map as MapInstance,GeoJSONSource} from 'maplibre-gl';
import type {FeatureCollection} from 'geojson';
import {countryGeometry} from './CountryLayer';
const EMPTY:FeatureCollection={type:'FeatureCollection',features:[]};

// Private browser-only feedback. Never inserted into public counts/snapshots.
export function PersonalCountryLayer({map,country,color,onError}:{map:MapInstance|null;country:string|null;color:string;onError:(message:string)=>void}){
  useEffect(()=>{
    if(!map)return;
    map.addSource('personal-country',{type:'geojson',data:EMPTY});
    // Below public areas, so a private preview cannot obscure their colors.
    const before=map.getLayer('live-country-fill')?'live-country-fill':undefined;
    map.addLayer({id:'personal-country-fill',type:'fill',source:'personal-country',paint:{'fill-color':color,'fill-opacity':.25,'fill-opacity-transition':{duration:350}}},before);
    map.addLayer({id:'personal-country-line',type:'line',source:'personal-country',paint:{'line-color':color,'line-width':2,'line-opacity':.85}},before);
    return()=>{
      if(!map.getStyle())return;
      for(const id of ['personal-country-line','personal-country-fill'])if(map.getLayer(id))map.removeLayer(id);
      if(map.getSource('personal-country'))map.removeSource('personal-country');
    };
  },[map]);
  useEffect(()=>{
    if(!map)return;
    let cancelled=false;
    const source=map.getSource('personal-country') as GeoJSONSource|undefined;
    if(!source)return;
    // Clear synchronously on withdrawal, zero balance or country change.
    source.setData(EMPTY);
    onError('');
    if(!country)return;
    map.setPaintProperty('personal-country-fill','fill-color',color);
    map.setPaintProperty('personal-country-line','line-color',color);
    void countryGeometry().then(collection=>{
      if(!cancelled)source.setData({type:'FeatureCollection',features:collection.features.filter(feature=>feature.properties?.countryCode===country)});
    }).catch(()=>{if(!cancelled)onError('Não foi possível desenhar sua prévia. Sua participação continua salva.');});
    return()=>{cancelled=true;};
  },[map,country,color,onError]);
  return null;
}
