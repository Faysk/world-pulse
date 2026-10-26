import {useEffect} from 'react';
import type {FeatureCollection} from 'geojson';
import type {Map as MapInstance,GeoJSONSource} from 'maplibre-gl';
import type {RegionSnapshot,RegionRow} from './regionalTypes';
import {regionCenter} from '../server/regionGrid.mjs';
const EMPTY:FeatureCollection={type:'FeatureCollection',features:[]};

export function RegionalPointLayer({map,snapshot,own,tagId}:{map:MapInstance|null;snapshot:RegionSnapshot|null;own:RegionRow[];tagId:string|null}){
  useEffect(()=>{
    if(!map)return;
    map.addSource('regional-points',{type:'geojson',data:EMPTY});
    map.addLayer({id:'regional-point-halo',type:'circle',source:'regional-points',paint:{'circle-color':['get','color'],'circle-radius':['get','halo'],'circle-blur':.8,'circle-opacity':.4}});
    map.addLayer({id:'regional-point-core',type:'circle',source:'regional-points',paint:{'circle-color':['get','color'],'circle-radius':['get','radius'],'circle-stroke-color':'#e6f3f4','circle-stroke-width':.7,'circle-opacity':.9}});
    return()=>{
      if(!map.getStyle())return;
      for(const id of ['regional-point-core','regional-point-halo'])if(map.getLayer(id))map.removeLayer(id);
      if(map.getSource('regional-points'))map.removeSource('regional-points');
    };
  },[map]);
  useEffect(()=>{
    if(!map)return;
    // Own provisional point replaces, never adds to, an already counted public cell.
    const rows=new Map((snapshot?.cells??[]).filter(row=>!tagId||row.tagId===tagId).map(row=>[row.cell+row.tagId,row]));
    for(const row of own)if((!tagId||row.tagId===tagId)&&!rows.has(row.cell+row.tagId))rows.set(row.cell+row.tagId,row);
    const features=[...rows.values()].map(row=>{
      const size=Math.min(12,Math.log10(Number(BigInt(row.participants)>1000000000000n?1000000000000n:BigInt(row.participants))));
      return {type:'Feature' as const,geometry:{type:'Point' as const,coordinates:regionCenter(row.cell)},properties:{...row,radius:3.5+size,halo:12+size*5}};
    });
    (map.getSource('regional-points') as GeoJSONSource|undefined)?.setData({type:'FeatureCollection',features});
  },[map,snapshot,own,tagId]);
  return null;
}
