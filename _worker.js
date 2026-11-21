const SITES=[['warlike-hub','Hub'],['warlike-server','Server'],['warlike-mail','Mail'],['warlike-engine','Engine'],['warlike-studio','Studio'],['warlike-library','Library'],['warlike-asset-stores','Asset Stores'],['warlike-node','Node'],['warlike-monteur','Monteur'],['warlike-modeliser','Modeliser'],['warlike-misc','MISC'],['warlike-ebook','Ebook'],['warlike-browser','Browser'],['warlike-radio','Radio'],['warlike-chat','Chat'],['warlike-online','Online'],['warlike-android-hub','Android Hub'],['warlike-pdf','PDF'],['warlike-crypte','Crypte'],['warlike-networks','Networks'],['warlike-telecom','Telecom']];
const ALLOWED=new Set(SITES.map(([id])=>id));
const COOKIE='__Host-warlike_tower';
const account='73c964bff8e0a8220d28a9f3d6abe50d';
const server='https://warlike-server.pages.dev';
const json=(body,status=200,headers={})=>Response.json(body,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff',...headers}});
function cookie(req){const found=(req.headers.get('cookie')||'').split(';').map(x=>x.trim()).filter(x=>x.startsWith(COOKIE+'='));if(found.length!==1)return null;const token=found[0].slice(COOKIE.length+1);return /^[A-Za-z0-9_-]{43}$/.test(token)?token:null;}
function checkOrigin(req){return new URL(req.url).protocol==='https:'&&req.headers.get('origin')===new URL(req.url).origin&&req.headers.get('sec-fetch-site')!=='cross-site';}
async function readJson(req){if(req.headers.get('content-type')?.split(';')[0]!=='application/json')throw Error('type');const length=req.headers.get('content-length');if(length!==null&&(!/^\d+$/.test(length)||Number(length)>2048))throw Error('size');if(req.headers.has('content-encoding')&&req.headers.get('content-encoding')!=='identity')throw Error('encoding');const reader=req.body?.getReader();if(!reader)throw Error('body');let total=0,chunks=[];while(true){const {done,value}=await reader.read();if(done)break;total+=value.length;if(total>2048){await reader.cancel();throw Error('size')}chunks.push(value)}const bytes=new Uint8Array(total);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length}const data=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));if(data===null||typeof data!=='object'||Array.isArray(data))throw Error('shape');return data}
async function upstream(req,env,path,{method='GET',token,body}={}){if(!env.WARLIKE_SERVER)throw Error('Service non configuré');const headers={Origin:server};const ip=req.headers.get('cf-connecting-ip');if(ip)headers['CF-Connecting-IP']=ip;if(token)headers.Cookie='__Host-warlike_session='+token;if(body)headers['Content-Type']='application/json';return env.WARLIKE_SERVER.fetch(new Request(server+path,{method,headers,body,redirect:'manual',signal:AbortSignal.timeout(12000)}));}
async function principal(req,env){const token=cookie(req);if(!token)return null;try{const r=await upstream(req,env,'/api/warlike-auth/session',{token});if(!r.ok)return null;const x=await r.json();return !x.mustChange&&x.user?.role==='owner'?x.user:null;}catch{return null;}}
async function cf(env,path,method='GET'){if(!env.CLOUDFLARE_API_TOKEN)return null;const r=await fetch('https://api.cloudflare.com/client/v4/accounts/'+account+path,{method,headers:{Authorization:'Bearer '+env.CLOUDFLARE_API_TOKEN},redirect:'manual',signal:AbortSignal.timeout(12000)});let data;try{data=await r.json()}catch{return {success:false,status:r.status}}return {success:r.ok&&data.success===true,status:r.status,result:data.result};}
async function handler(req,env){const url=new URL(req.url),path=url.pathname;
 if(!path.startsWith('/api/')){const response=await env.ASSETS.fetch(req);const headers=new Headers(response.headers);headers.set('X-Content-Type-Options','nosniff');headers.set('Referrer-Policy','no-referrer');headers.set('Content-Security-Policy',"default-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; connect-src 'self'; style-src 'self'; script-src 'self'");return new Response(response.body,{status:response.status,headers});}
 if(path==='/api/login'&&req.method==='POST'){
  if(!checkOrigin(req))return json({error:'Origine refusée.'},403);
  if(req.headers.get('content-type')?.split(';')[0]!=='application/json')return json({error:'Requête invalide.'},400);
  let data;try{data=await readJson(req)}catch{return json({error:'Requête invalide.'},400)}
  if(typeof data.login!=='string'||data.login.length>254||typeof data.password!=='string'||data.password.length>256)return json({error:'Identifiants invalides.'},400);
  let r;try{r=await upstream(req,env,'/api/warlike-auth/login',{method:'POST',body:JSON.stringify({login:data.login,password:data.password})})}catch{return json({error:'Le serveur de comptes WarLike n’est pas disponible sur Cloudflare.'},503)}
  if(!r.ok){if(r.status===429)return json({error:'Trop de tentatives. Réessaie plus tard.'},429);if(r.status===401||r.status===403)return json({error:'Identifiants incorrects ou accès refusé.'},401);return json({error:'La connexion WarLike Server sur Cloudflare n’est pas encore disponible. Ton mot de passe ne peut pas être vérifié.'},503);}
  let d;try{d=await r.json()}catch{return json({error:'Le serveur de comptes WarLike n’est pas disponible sur Cloudflare.'},503)}const match=/^__Host-warlike_session=([A-Za-z0-9_-]{43});/.exec(r.headers.get('set-cookie')||'');if(!match)return json({error:'Session non reconnue.'},502);
  if(d.mustChange){await upstream(req,env,'/api/warlike-auth/logout',{method:'POST',token:match[1]}).catch(()=>{});return json({error:'Modifie d’abord tes identifiants temporaires dans WarLike Server.'},403)}
  let user;try{const x=await upstream(req,env,'/api/warlike-auth/session',{token:match[1]});user=x.ok?(await x.json()).user:null}catch{return json({error:'Serveur WarLike indisponible.'},503)}
  if(user?.role!=='owner'){await upstream(req,env,'/api/warlike-auth/logout',{method:'POST',token:match[1]}).catch(()=>{});return json({error:'Tower est réservé au propriétaire.'},403)}
  return json({ok:true},200,{'Set-Cookie':`${COOKIE}=${match[1]}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=28800`});
 }
 if(path==='/api/logout'&&req.method==='POST') {if(!checkOrigin(req))return json({error:'Origine refusée.'},403);const t=cookie(req);if(t)await upstream(req,env,'/api/warlike-auth/logout',{method:'POST',token:t}).catch(()=>{});return json({ok:true},200,{'Set-Cookie':`${COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`});}
 if(!await principal(req,env))return json({error:'Connexion administrateur requise.'},401);
 if(path==='/api/registration-activate'&&req.method==='POST'){
 if(!checkOrigin(req))return json({error:'Origine refusée.'},403);
 let d;try{d=await readJson(req)}catch{return json({error:'Requête invalide.'},400)}
 if(typeof d.id!=='string'||!/^[0-9a-f-]{36}$/.test(d.id)||typeof d.login!=='string'||typeof d.password!=='string')return json({error:'Identifiants invalides.'},400);
 const response=await upstream(req,env,'/api/warlike-auth/registration-activate',{method:'POST',token:cookie(req),body:JSON.stringify({id:d.id,login:d.login,password:d.password})});
 if(!response.ok)return json({error:'Activation impossible. Vérifiez la demande et les identifiants.'},response.status);
 return json({ok:true},201);
 }
 if(path==='/api/registration-decision'&&req.method==='POST'){
 if(!checkOrigin(req))return json({error:'Origine refusée.'},403);
 let d;try{d=await readJson(req)}catch{return json({error:'Requête invalide.'},400)}
 if(typeof d.id!=='string'||!/^[0-9a-f-]{36}$/.test(d.id)||!['accepted','refused'].includes(d.decision))return json({error:'Décision invalide.'},400);
 const response=await upstream(req,env,'/api/warlike-auth/registration-decision',{method:'POST',token:cookie(req),body:JSON.stringify({id:d.id,decision:d.decision})});
 return json(await response.json(),response.status);
 }
 if(path==='/api/registration-requests'&&req.method==='GET'){
  const response=await upstream(req,env,'/api/warlike-auth/registration-list',{method:'POST',token:cookie(req),body:'{}'});
  if(!response.ok)return json({error:'Liste des inscriptions indisponible.'},response.status===401||response.status===403?403:503);
  const data=await response.json();
  if(!Array.isArray(data.requests))return json({error:'Réponse Server invalide.'},502);
  return json({requests:data.requests.slice(0,100).map(x=>({id:x.id,name:x.name,email:x.email,created_at:x.created_at,status:x.status??null,decided_at:x.decided_at??null}))});
 }
 if(path.startsWith('/api/networks/')){
 const action=path.slice('/api/networks/'.length);if(!((['registry','communications','security-summary'].includes(action)&&req.method==='GET')||(['allocate','revoke','admin-end-call'].includes(action)&&req.method==='POST')))return json({error:'Route inconnue.'},404);
 if(!env.NETWORKS)return json({error:'Binding Networks non configuré.'},503);
 let body;if(req.method==='POST'){if(!checkOrigin(req))return json({error:'Origine refusée.'},403);try{const d=await readJson(req);const key=action==='allocate'?'user_id':action==='admin-end-call'?'id':'number';if(typeof d[key]!=='string'||!d[key]||d[key].length>254)return json({error:'Valeur invalide.'},400);body=JSON.stringify({[key]:d[key]});}catch{return json({error:'Requête invalide.'},400);}}
 const origin='https://warlike-networks.pages.dev';const response=await env.NETWORKS.fetch(new Request(origin+'/api/'+action,{method:req.method,headers:{origin,cookie:'__Host-warlike_networks='+cookie(req),'content-type':'application/json'},body,redirect:'manual'}));return json(await response.json(),response.status);
 }
 if(path==='/api/projects'&&req.method==='GET'){
  if(!env.CLOUDFLARE_API_TOKEN)return json({connected:false,projects:SITES.map(([id,name])=>({id,name,status:'non_connecte',url:`https://${id}.pages.dev`}))});
  const projects=await Promise.all(SITES.map(async([id,name])=>{try{const d=await cf(env,`/pages/projects/${id}`);if(!d?.success)return {id,name,status:'inconnu',url:`https://${id}.pages.dev`};let x=d.result,l=x.latest_deployment;return {id,name,url:`https://${x.subdomain}`,status:l?.latest_stage?.status||'inconnu',deployment:l?.id||null,updated:l?.created_on||null,branch:l?.deployment_trigger?.metadata?.branch||null};}catch{return {id,name,status:'inconnu',url:`https://${id}.pages.dev`}}}));
  return json({connected:projects.some(p=>p.status!=='inconnu'),projects});
 }
 if(path==='/api/retry'&&req.method==='POST'){
  if(!checkOrigin(req))return json({error:'Origine refusée.'},403);let data;try{data=await readJson(req)}catch{return json({error:'Requête invalide.'},400)}
  if(!ALLOWED.has(data.id)||typeof data.deployment!=='string')return json({error:'Projet invalide.'},400);
  if(!env.CLOUDFLARE_API_TOKEN)return json({error:'Connexion Cloudflare non configurée.'},503);
  const p=await cf(env,`/pages/projects/${data.id}`),latest=p?.result?.latest_deployment;
  if(!p?.success||!latest||latest.id!==data.deployment||latest.latest_stage?.status!=='failure')return json({error:'Le dernier déploiement n’est plus en échec. Actualise la liste.'},409);
  const r=await cf(env,`/pages/projects/${data.id}/deployments/${latest.id}/retry`,'POST');return r?.success?json({ok:true}):json({error:'Cloudflare a refusé la relance.'},502);
 }
 return json({error:'Route inconnue.'},404);
}
export default {async fetch(req,env){try{return await handler(req,env)}catch{return json({error:'Service temporairement indisponible.'},503)}}};
