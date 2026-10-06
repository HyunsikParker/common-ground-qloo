import {env} from 'cloudflare:workers';
import {GroupService} from '../../../lib/domain/service.js';
import {AppError,publicError} from '../../../lib/domain/errors.js';
import {hostedProvider,policyHash} from '../../../lib/qloo-http';

export const dynamic='force-dynamic';
const lifetime=20*60000;
function reply(value:any,status=200,cookie?:string){return Response.json(value,{status,headers:{'cache-control':'no-store','x-content-type-options':'nosniff',...(cookie?{'set-cookie':cookie}:{})}});}
function encode(s:any){return JSON.stringify({revision:s.revision,area:s.area,groups:s.groups,confirmed:[...s.confirmed],resolutions:[...s.resolutions],excluded:[...s.excluded],evidence:s.evidence});}
function hydrate(provider:any,text:string){const x=JSON.parse(text),s=new GroupService(provider);s.revision=x.revision;s.area=x.area;s.groups=x.groups;s.confirmed=new Map(x.confirmed);s.resolutions=new Map(x.resolutions);s.excluded=new Set(x.excluded);s.evidence=x.evidence;return s;}

async function handle(request:Request){
  const cfg=env as any,db:D1Database=cfg.DB,url=new URL(request.url),action=url.pathname.split('/').pop();
  let id:string|undefined,lock:string|undefined;
  try{
    if(!db)throw new AppError('access_pending','The persistent service is not configured.',503);
    if(request.headers.get('origin')&&request.headers.get('origin')!==url.origin)throw new AppError('origin_rejected','Open Common Ground directly to change a group.',403);
    if(cfg.QLOO_FEE_NOTICE==='true')throw new AppError('access_pending','Event access is paused pending a pricing review.',503);
    if(action==='bootstrap'){
      // Available only during the owner-private provisioning publication.
      // Remove this flag before changing the Site audience to public.
      if(cfg.ALLOWANCE_INITIALIZATION_ALLOWED!=='true'||request.method!=='POST')throw new AppError('not_found','This action is unavailable.',404);
      const body:any=await request.json();
      if(!Number.isSafeInteger(body.used)||body.used<0||body.used>=1000)throw new AppError('invalid_provider_input','Supply the existing measured request count.');
      const hash=await policyHash(cfg.QLOO_API_KEY);
      await db.prepare('INSERT OR IGNORE INTO qloo_allowance(id,policy_hash,used,last_attempt_at) VALUES(?,?,?,?)').bind('event',hash,body.used,Date.now()).run();
      const actual=await db.prepare('SELECT used,policy_hash FROM qloo_allowance WHERE id=?').bind('event').first<any>();
      if(actual?.policy_hash!==hash)throw new AppError('access_pending','Existing allowance differs. It was not reset.',503);
      return reply({initialized:true,used:actual.used,capBasis:'operator',maxRequests:1000,issuerQuota:null});
    }
    const provider=hostedProvider(db,cfg.QLOO_API_KEY),now=Date.now();
    await db.prepare('DELETE FROM group_sessions WHERE expires_at<? AND busy_until<?').bind(now,now).run();
    id=request.headers.get('cookie')?.match(/(?:^|;\s*)cg_session=([0-9a-f-]{36})(?:;|$)/)?.[1];
    let row=id?await db.prepare('SELECT * FROM group_sessions WHERE id=?').bind(id).first<any>():null;
    let cookie:string|undefined;
    if(!row){
      const count=await db.prepare('SELECT COUNT(*) AS n FROM group_sessions').first<any>();if(count.n>=100)throw new AppError('server_busy','The demo is busy. Try again later.',503);
      id=crypto.randomUUID();row={id,state:encode(new GroupService(provider)),expires_at:now+lifetime,window_at:now,request_count:0,busy_until:0};
      await db.prepare('INSERT INTO group_sessions(id,state,expires_at,window_at,request_count,busy_until) VALUES(?,?,?,?,?,?)').bind(id,row.state,row.expires_at,now,0,0).run();
      cookie=`cg_session=${id}; HttpOnly; SameSite=Strict; Path=/api; Max-Age=1200${url.protocol==='https:'?'; Secure':''}`;
    }
    if(request.method==='GET'&&action==='session')return reply(hydrate(provider,row.state).state(),200,cookie);
    if(request.method!=='POST')throw new AppError('method_not_allowed','Use a supported request method.',405);
    if(!request.headers.get('content-type')?.startsWith('application/json'))throw new AppError('content_type','Send JSON.',415);
    const raw=await request.text();if(new TextEncoder().encode(raw).length>12000)throw new AppError('request_too_large','This request is too large.',413);
    let input:any;try{input=JSON.parse(raw);}catch{throw new AppError('invalid_json','Send a JSON object.');}
    if(!input||Array.isArray(input)||typeof input!=='object')throw new AppError('invalid_json','Send a JSON object.');
    lock=crypto.randomUUID();
    const locked=await db.prepare('UPDATE group_sessions SET busy_until=?,lock_token=? WHERE id=? AND busy_until<=? RETURNING *').bind(now+180000,lock,id,now).first<any>();
    if(!locked)throw new AppError('server_busy','This group is already working. Pause before trying again.',409);
    let windowAt=locked.window_at,count=locked.request_count;if(now-windowAt>=60000){windowAt=now;count=0;}count++;
    await db.prepare('UPDATE group_sessions SET window_at=?,request_count=? WHERE id=? AND lock_token=?').bind(windowAt,count,id,lock).run();
    if(count>60)throw new AppError('rate_limited','Pause before another request.',429);
    const service=hydrate(provider,locked.state);
    if(input.revision!==service.revision)throw new AppError('stale_session','This group changed. Reload it before continuing.',409);
    let result:any;
    switch(action){
      case'resolve':result=await service.resolve(input.query);break;
      case'confirm':result=service.confirm(input.resolutionId,input.entityId);break;
      case'compare':result=await service.compare(input.groups,input.area);break;
      case'example':result=await service.publicExample();break;
      case'exclude':result=service.veto(input.id);break;
      case'restore':result=service.veto(input.id,true);break;
      case'reset':result=service.reset();break;
      default:throw new AppError('not_found','This action is unavailable.',404);
    }
    const saved=await db.prepare('UPDATE group_sessions SET state=?,expires_at=?,busy_until=0,lock_token=NULL WHERE id=? AND lock_token=? RETURNING id').bind(encode(service),Date.now()+lifetime,id,lock).first();
    if(!saved)throw new AppError('stale_session','This operation lost its session lock. Reload the group.',409);
    lock=undefined;return reply(result,200,cookie);
  }catch(e){const safe=publicError(e);return reply({error:safe.error},safe.status);}
  finally{if(lock&&id)await db.prepare('UPDATE group_sessions SET busy_until=0,lock_token=NULL WHERE id=? AND lock_token=?').bind(id,lock).run();}
}
export const GET=handle;
export const POST=handle;
