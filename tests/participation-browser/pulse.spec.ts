import {test,expect} from '@playwright/test';
import pg from 'pg';
import {randomUUID} from 'node:crypto';

test('Combined HTTP snapshot reflects real credit, withdrawal and expiry without cached resurrection',async({request})=>{
  const db=new pg.Pool({connectionString:'postgresql://postgres:local-only@127.0.0.1:5432/world_pulse_ci',ssl:false});
  const name='pulse_'+randomUUID().slice(0,8),headers={Origin:'http://127.0.0.1:4174'};
  let tagId:string|undefined,visitorId:string|undefined;
  try{
    const session=await request.post('/api/session',{headers,data:{}});expect(session.status()).toBe(200);
    const binding=(await session.json()).sessionBinding;
    const bound={...headers,'X-WP-Session-Binding':binding};
    const tag=await request.post('/api/tags',{headers,data:{name}});expect(tag.status()).toBe(200);tagId=(await tag.json()).tag.id;
    expect((await request.post('/api/select',{headers,data:{tagId}})).status()).toBe(200);
    visitorId=(await db.query('SELECT id FROM world_pulse.visitors WHERE active_tag_id=$1',[tagId])).rows[0].id;
    expect((await request.post('/api/taps',{headers:bound,data:{tagId,batchId:randomUUID(),clicks:30}})).status()).toBe(200);
    const location=async(cell:string|null)=>expect((await request.post('/api/location',{headers:bound,data:{cell}})).status()).toBe(200);
    const pulse=async()=>{
      const response=await request.get('/api/pulse');expect(response.status()).toBe(200);expect(response.headers()['cache-control']).toBe('no-store');
      const value=await response.json();expect(value.type).toBe('pulse_snapshot_v1');expect(value.regions.type).toBe('region_compact_v1');expect(value.regions.validUntilMs-value.regions.asOfMs).toBe(5000);expect(value.ranking.type).toBe('active');
      expect(JSON.stringify(value)).not.toContain(visitorId!);expect(JSON.stringify(value)).not.toContain(binding);
      const index=value.regions.tags.findIndex((row:string[])=>row[0]===tagId);
      return value.regions.cells.filter((row:unknown[])=>row[1]===index);
    };
    await location('r2:10000:1');expect(await pulse()).toHaveLength(1);
    await location(null);expect(await pulse()).toHaveLength(0);
    expect((await db.query('SELECT seconds::text,expires_at>now() AS active FROM world_pulse.visitor_tags WHERE visitor_id=$1 AND tag_id=$2',[visitorId,tagId])).rows[0]).toEqual({seconds:'30',active:true});
    await location('r2:10000:1');expect(await pulse()).toHaveLength(1);
    await db.query("UPDATE world_pulse.visitor_tags SET expires_at=now()-interval '1 minute' WHERE visitor_id=$1 AND tag_id=$2",[visitorId,tagId]);
    // Expiry naturally changes the next five-second cache window; no manual invalidation.
    await expect.poll(async()=> (await pulse()).length,{timeout:10000}).toBe(0);
  }finally{
    if(visitorId)await db.query('DELETE FROM world_pulse.visitors WHERE id=$1',[visitorId]);
    if(tagId)await db.query('DELETE FROM world_pulse.tags WHERE id=$1',[tagId]);
    await db.end();
  }
});
