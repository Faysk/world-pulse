import type { FeatureCollection } from 'geojson';
import { useEffect, useRef } from 'react';
import type { Map as MapInstance, GeoJSONSource } from 'maplibre-gl';
import geometryUrl from './assets/countries-110m.geojson?url';
import type { CountrySnapshot } from './countryTypes';

// One native polygon source, never a point or a layer per participant.
// Show one explicitly selected hashtag: overlapping countries cannot hide rivals.
export function CountryLayer({map,snapshot,tagId,onError}:{map:MapInstance|null;snapshot:CountrySnapshot|null;tagId:string|null;onError:(message:string)=>void}){
  const generation=useRef(0);
  useEffect(()=>{
    const version=++generation.current;
    if(!map)return;
    const abort=new AbortController();
    const remove=()=>{
      if(!map.getStyle())return;
      for(const id of ['live-country-line','live-country-fill'])if(map.getLayer(id))map.removeLayer(id);
      if(map.getSource('live-countries'))map.removeSource('live-countries');
    };
    const tag=snapshot?.tags.find(item=>item.id===tagId);
    const visible=new Set(tag?.countries.filter(c=>/^[A-Z]{2}$/.test(c.countryCode)&&c.countryCode!=='ZZ').map(c=>c.countryCode));
    if(!tag||!visible.size){remove();return;}
    void fetch(geometryUrl,{signal:abort.signal}).then(response=>{
      if(!response.ok)throw new Error('geometry_unavailable');return response.json();
    }).then((collection:FeatureCollection)=>{
      if(abort.signal.aborted||version!==generation.current)return;
      collection.features=collection.features.filter(feature=>visible.has(feature.properties?.countryCode));
      const existing=map.getSource('live-countries') as GeoJSONSource|undefined;
      if(existing)existing.setData(collection);
      else{
        map.addSource('live-countries',{type:'geojson',data:collection});
        map.addLayer({id:'live-country-fill',type:'fill',source:'live-countries',paint:{'fill-color':tag.color,'fill-opacity':0.36}});
        map.addLayer({id:'live-country-line',type:'line',source:'live-countries',paint:{'line-color':tag.color,'line-width':1.4}});
      }
      map.setPaintProperty('live-country-fill','fill-color',tag.color);
      map.setPaintProperty('live-country-line','line-color',tag.color);
      onError('');
    }).catch(()=>{if(!abort.signal.aborted){remove();onError('Não foi possível desenhar os países. Consulte os totais na lista.');}});
    return()=>{abort.abort();remove();};
  },[map,snapshot,tagId,onError]);
  return null;
}
