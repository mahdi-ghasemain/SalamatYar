import {createClient} from 'npm:@supabase/supabase-js@2';
const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, apikey, content-type, x-client-info'};
const reply=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers:{...cors,'Content-Type':'application/json'}});
Deno.serve(async req=>{
 if(req.method==='OPTIONS')return new Response(null,{headers:cors});
 if(req.method!=='POST')return reply({error:'METHOD'},405);
 try{
  const token=req.headers.get('Authorization')?.replace(/^Bearer /,'');if(!token)return reply({error:'AUTH'},401);
  const admin=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const {data:{user},error}=await admin.auth.getUser(token);if(error||!user)return reply({error:'AUTH'},401);
  const {data:allowed,error:limitError}=await admin.rpc('allow_nearby_request',{request_owner:user.id});if(limitError||!allowed)return reply({error:'RATE_LIMIT'},429);
  const {lat,lon}=await req.json();if(!Number.isFinite(lat)||!Number.isFinite(lon)||Math.abs(lat)>90||Math.abs(lon)>180)return reply({error:'COORDINATES'},400);
  const a=Number(lat.toFixed(3)),b=Number(lon.toFixed(3));const cell=`${a},${b}`;
  const {data:cached}=await admin.from('nearby_cache').select('data').eq('cell',cell).gt('expires_at',new Date().toISOString()).maybeSingle();
  if(cached)return reply(cached.data);
  const endpoint=Deno.env.get('OVERPASS_URL');if(!endpoint)return reply({error:'MAP_PROVIDER_NOT_CONFIGURED'},503);
  const query=`[out:json][timeout:15];(nwr[amenity~"^(hospital|clinic|pharmacy|doctors)$"](around:5000,${a},${b});nwr[healthcare="laboratory"](around:5000,${a},${b}););out center tags 100;`;
  const response=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({data:query}),signal:AbortSignal.timeout(20000)});
  if(!response.ok)return reply({error:'PROVIDER_UNAVAILABLE'},502);
  const result=await response.json();const payload={elements:(result.elements||[]).slice(0,100),fetchedAt:new Date().toISOString()};
  await admin.from('nearby_cache').upsert({cell,data:payload,expires_at:new Date(Date.now()+600000).toISOString()});
  return reply(payload);
 }catch{return reply({error:'NEARBY_UNAVAILABLE'},503);}
});
