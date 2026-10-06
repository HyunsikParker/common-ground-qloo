import { QlooProvider } from './domain/qloo-provider.js';
import { AppError } from './domain/errors.js';

export async function policyHash(key:string) {
  const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(key+'|operator|1000|1000|2026-11-17T04:45:00Z'));
  return [...new Uint8Array(bytes)].map(x=>x.toString(16).padStart(2,'0')).join('');
}

export function hostedProvider(db:D1Database,key:string) {
  if(!key||key.length<8)throw new AppError('access_pending','Qloo event access is not configured.',503);
  async function reserve(){
    const fingerprint=await policyHash(key), started=Date.now();
    for(;;){
      const now=Date.now();
      if(now>=Date.parse('2026-11-17T04:45:00Z'))throw new AppError('access_expired','The event-use window has ended.',503);
      const row=await db.prepare('SELECT policy_hash,used,last_attempt_at FROM qloo_allowance WHERE id=?').bind('event').first<any>();
      if(!row||row.policy_hash!==fingerprint)throw new AppError('access_pending','The persistent Qloo allowance is not provisioned.',503);
      if(row.used>=1000)throw new AppError('quota_exhausted','This demo’s operator request cap has been reached.',503);
      const wait=Math.max(0,row.last_attempt_at+1000-now);
      if(wait){if(now-started+wait>2500)throw new AppError('local_rate_limited','Pause briefly before another comparison.',429);await new Promise(r=>setTimeout(r,wait));continue;}
      const changed=await db.prepare('UPDATE qloo_allowance SET used=used+1,last_attempt_at=? WHERE id=? AND policy_hash=? AND used<1000 AND last_attempt_at<=? RETURNING used').bind(now,'event',fingerprint,now-1000).first();
      if(changed)return;
    }
  }
  async function query(path:string,params:Record<string,any>,take:number){
    const url=new URL(path,'https://hackathon.api.qloo.com');
    for(const [k,v]of Object.entries(params))url.searchParams.set(k,Array.isArray(v)?v.join(','):String(v));
    await reserve();
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),8000);
    try{
      const response=await fetch(url.toString(),{method:'GET',headers:{'X-Api-Key':key,accept:'application/json'},redirect:'manual',signal:controller.signal});
      if(response.status>=300&&response.status<400){await response.body?.cancel();throw new AppError('unexpected_provider_redirect','Qloo returned a redirect. No redirected request was sent.',502);}
      if([401,403].includes(response.status))throw new AppError('authentication_failed','Qloo event access could not be authenticated.',503);
      if(response.status===429)throw new AppError('provider_rate_limited','Qloo’s rate limit was reached. No retry was made.',429);
      if(!response.ok)throw new AppError('provider_unavailable','Qloo is unavailable. Your last completed comparison is kept.',502);
      const reader=response.body?.getReader();if(!reader)throw new AppError('invalid_provider_result','Qloo returned no response body.',502);
      const chunks:Uint8Array[]=[];let size=0;
      for(;;){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>1000000){await reader.cancel();throw new AppError('provider_response_too_large','The Qloo result exceeded this app’s size limit.',502);}chunks.push(value);}
      const all=new Uint8Array(size);let off=0;for(const x of chunks){all.set(x,off);off+=x.byteLength;}const body=new TextDecoder().decode(all);
      if(body.includes(key))throw new AppError('invalid_provider_result','Qloo returned an unsafe result.',502);
      let data:any;try{data=JSON.parse(body);}catch{throw new AppError('invalid_provider_result','Qloo returned invalid JSON.',502);}
      const rows=path==='/search'?data?.results:data?.results?.entities;
      if(!Array.isArray(rows)||rows.length>take||data.error||data.errors)throw new AppError('invalid_provider_result','Qloo returned an unsupported response.',502);
      return rows.map((row:any)=>({entity_id:row.entity_id,name:row.name,type:(typeof row.type==='string'&&row.type.startsWith('urn:entity:')?row.type:undefined)??(Array.isArray(row.types)?row.types.find((x:any)=>typeof x==='string'&&x.startsWith('urn:entity:')):undefined)??(path==='/v2/insights'&&row.type==='urn:entity'?'urn:entity:place':row.type),affinity:row.affinity??row.query?.affinity,properties:{release_year:row.properties?.release_year,description:row.properties?.short_description??row.properties?.description}}));
    }catch(e:any){if(e instanceof AppError)throw e;console.error(JSON.stringify({operation:path,kind:e?.name??'Error',reason:String(e?.message??'request failure').replaceAll(key,'[REDACTED]').slice(0,240)}));throw new AppError(controller.signal.aborted?'provider_timeout':'provider_unavailable','The Qloo request did not complete. No alternate endpoint or retry was used.',502);}
    finally{clearTimeout(timer);}
  }
  const client={searchEntities:async(input:any)=>({results:await query('/search',{query:input.query,types:input.types,take:4},4)})};
  const executor={execute:async(operation:string,input:any)=>{
    const take=operation==='recommend'?4:input.options.length;
    const params:any={'filter.type':'urn:entity:place','signal.interests.entities':input.signals,take};
    if(operation==='recommend'){params['filter.location.query']=input.filter_location;params['feature.explainability']=true;}
    else if(operation==='rank')params['filter.results.entities']=input.options;
    else throw new AppError('invalid_provider_input','Unsupported Qloo operation.');
    const rows=await query('/v2/insights',params,take);
    return{result:{schema_version:'1.0-preview.1',operation,status:rows.length?'ok':'empty',results:rows,result_count:rows.length}};
  }};
  return new QlooProvider({client,executor,area:'Manhattan, New York'});
}
