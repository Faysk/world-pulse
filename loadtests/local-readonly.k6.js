/**
 * Bounded GET-only probe for an isolated World Pulse API on loopback.
 * No remote hosts, redirects, spoofed locations, cookies or write endpoints.
 * Requires Grafana k6. Do not run against map.faysk.dev or any cloud preview.
 */
import http from 'k6/http';
import {check} from 'k6';
import {Rate} from 'k6/metrics';

const target=(__ENV.WP_LOCAL_ORIGIN||'http://127.0.0.1:4180').replace(/\/$/,'');
if(!/^http:\/\/(127\.0\.0\.1|localhost)(:\d{1,5})?$/.test(target)){
  throw new Error('Only HTTP loopback targets are permitted.');
}
const rps=Number(__ENV.WP_RPS||2);
const seconds=Number(__ENV.WP_SECONDS||30);
const vus=Number(__ENV.WP_VUS||5);
if(![rps,seconds,vus].every(Number.isInteger)||rps<1||rps>20||
  seconds<5||seconds>120||vus<1||vus>50){
  throw new Error('Limits: WP_RPS=1..20, WP_SECONDS=5..120, WP_VUS=1..50');
}
const errors=new Rate('wp_application_errors');
const endpoints=['/api/regions','/api/ranking','/api/pulse'];
const geos=['br-sao-paulo','us-east','us-west','pt-lisbon','eu-central','in-mumbai','jp-tokyo','au-sydney'];

export const options={
  discardResponseBodies:true,
  scenarios:{
    local_api:{
      executor:'constant-arrival-rate',
      rate:rps,timeUnit:'1s',duration:seconds+'s',
      preAllocatedVUs:vus,maxVUs:vus,gracefulStop:'3s'
    }
  },
  thresholds:{
    wp_application_errors:[{threshold:'rate<0.05',abortOnFail:true,delayAbortEval:'10s'}],
    http_req_duration:['p(95)<1500'],
    dropped_iterations:['count<1']
  }
};

export default function(){
  // geo_profile is only a metric label, NOT the physical origin of requests.
  const idx=(__ITER+__VU);
  const path=endpoints[idx%endpoints.length];
  const region=geos[idx%geos.length];
  const response=http.get(target+path,{
    redirects:0,timeout:'5s',
    headers:{Accept:'application/json'},
    tags:{geo_profile:region,endpoint:path}
  });
  errors.add(!check(response,{'HTTP 200':r=>r.status===200}));
}
