import { buildPushPayload } from '@block65/webcrypto-web-push';
const json=(body,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store'}});
const digest=async value=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value))),v=>v.toString(16).padStart(2,'0')).join('');
export function validSubscription(s){
  try{const u=new URL(s.endpoint);return u.protocol==='https:'&&!u.port&&!u.username&&!u.password&&
    (u.hostname.endsWith('.push.apple.com')||u.hostname==='fcm.googleapis.com'||u.hostname==='updates.push.services.mozilla.com')&&
    /^[A-Za-z0-9_-]{87}=?$/.test(s.keys?.p256dh||'')&&/^[A-Za-z0-9_-]{22}={0,2}$/.test(s.keys?.auth||'');
  }catch{return false}
}
export function localTime(time,timezone='America/Los_Angeles'){
  const p=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:timezone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date(time)).map(p=>[p.type,p.value]));
  return {date:`${p.year}-${p.month}-${p.day}`,time:`${p.hour}:${p.minute}`};
}
const addDays=(date,n)=>{const d=new Date(date+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10)};
const ready=env=>env.REMINDERS&&env.VAPID_PUBLIC_KEY&&env.VAPID_PRIVATE_KEY;
function scheduleLabel(env){return `${env.FOCUS_TIME||'09:00'} focus + ${env.CHECKIN_TIME||'20:30'} check-in (${env.TIMEZONE||'America/Los_Angeles'}). November 6 and 9 focus: 09:05.`}
export async function sendPush(env,subscription,message){
  const payload=await buildPushPayload({data:JSON.stringify(message),options:{ttl:1800}},subscription,{subject:env.VAPID_SUBJECT,publicKey:env.VAPID_PUBLIC_KEY,privateKey:env.VAPID_PRIVATE_KEY});
  const res=await fetch(subscription.endpoint,{...payload,redirect:'error'});
  return {accepted:res.ok,expired:res.status===404||res.status===410,status:res.status};
}
export async function api(request,env){
  if(!ready(env))return json({error:'Reminders need the one-time server setup. See README.md.'},503);
  const action=new URL(request.url).pathname.split('/').pop();
  if(request.method==='GET'&&action==='config')return json({publicKey:env.VAPID_PUBLIC_KEY,schedule:scheduleLabel(env)});
  if(request.method!=='POST'||!['subscribe','unsubscribe','test'].includes(action))return json({error:'Not found'},404);
  if(request.headers.get('Origin')!==new URL(request.url).origin)return json({error:'Please use the app to change reminders.'},403);
  if(!(request.headers.get('Content-Type')||'').includes('application/json'))return json({error:'JSON required'},415);
  let body;try{const text=await request.text();if(text.length>12000)return json({error:'Request too large'},413);body=JSON.parse(text)}catch{return json({error:'Invalid request'},400)}
  const subscription=body.subscription;
  if(!validSubscription(subscription))return json({error:'This device did not provide a valid notification address.'},400);
  // Subscription endpoint + its browser-generated keys identify a device.
  // No public route can list devices or trigger everyone's scheduled reminders.
  const id=await digest(subscription.endpoint),key='device:'+id;
  const existing=await env.REMINDERS.get(key,'json');
  if(existing&&(existing.subscription.keys.auth!==subscription.keys.auth||existing.subscription.keys.p256dh!==subscription.keys.p256dh))return json({error:'Device keys do not match'},403);
  if(action==='unsubscribe'){await env.REMINDERS.delete(key);return json({enabled:false})}
  if(action==='subscribe'){
    const start=existing?.start||localTime(Date.now(),env.TIMEZONE).date;
    const end=existing?.end||addDays(start,6);
    // Do not refresh an existing record on every app launch. This preserves
    // the seven-day window, delivery receipts, and the free KV write quota.
    if(!existing)await env.REMINDERS.put(key,JSON.stringify({subscription,start,end,sent:{}}));
    return json({enabled:true,start,end,schedule:scheduleLabel(env)});
  }
  if(!existing)return json({error:'Enable notifications first. If you just enabled them, wait about a minute and try again.'},409);
  if(existing.lastTest&&Date.now()-existing.lastTest<60000)return json({error:'Wait a minute before sending another test alert.'},429);
  try{
    const result=await sendPush(env,subscription,{title:'Attention Reset',body:'Your app notifications are ready. One small step at a time.',tag:'attention-reset-test',url:'/'});
    if(result.expired){await env.REMINDERS.delete(key);return json({error:'This device subscription expired. Turn reminders off and on again.'},410)}
    if(!result.accepted)return json({error:'The push service did not accept the test. Try again later.'},502);
    await env.REMINDERS.put(key,JSON.stringify({...existing,lastTest:Date.now()}));
    return json({accepted:true});
  }catch{return json({error:'Could not send the test alert. Try again later.'},502)}
}
export async function dispatch(env,scheduledTime=Date.now()){
  if(!ready(env))return {skipped:'not configured'};
  // Cron schedules use UTC. Convert before selecting the local reminder so
  // Pacific daylight-saving changes are handled without changing cron rules.
  const current=localTime(scheduledTime,env.TIMEZONE);let overrides={};try{overrides=JSON.parse(env.FOCUS_OVERRIDES||'{}')}catch{}
  const kind=current.time===(overrides[current.date]||env.FOCUS_TIME||'09:00')?'focus':current.time===(env.CHECKIN_TIME||'20:30')?'checkin':null;
  if(!kind||Date.now()-scheduledTime>30*60*1000)return {skipped:'nothing due'};
  let cursor,accepted=0,failed=0,expired=0;
  do{
    const page=await env.REMINDERS.list({prefix:'device:',limit:100,cursor});
    for(const item of page.keys){
      const record=await env.REMINDERS.get(item.name,'json');if(!record||current.date<record.start||current.date>record.end)continue;
      const receipt=current.date+':'+kind;if(record.sent?.[receipt])continue;
      const message=kind==='focus'?{title:'A little room for focus',body:'Park your phone. Choose one task. Give it 20 minutes.',url:'/'}:{title:'A gentle 2-minute check-in',body:'Log your video minutes, save a thought, and choose one next step. Every return counts.',url:'/#check-in'};
      try{
        const result=await sendPush(env,record.subscription,{...message,tag:receipt});
        if(result.accepted){accepted++;await env.REMINDERS.put(item.name,JSON.stringify({...record,sent:{...record.sent,[receipt]:true}}))}
        else if(result.expired){expired++;await env.REMINDERS.delete(item.name)}else failed++;
      }catch{failed++}
    }
    cursor=page.list_complete?undefined:page.cursor;
  }while(cursor);
  return {kind,date:current.date,accepted,failed,expired};
}
export default {
  async fetch(request,env){
    if(new URL(request.url).pathname.startsWith('/api/'))return api(request,env);
    return env.ASSETS.fetch(request);
  },
  async scheduled(event,env){const result=await dispatch(env,event.scheduledTime);if(result.failed)console.error('Reminder delivery failures:',result.failed)},
};
