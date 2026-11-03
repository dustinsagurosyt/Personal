(()=>{
const status=document.getElementById('push-status'),enable=document.getElementById('push-enable'),test=document.getElementById('push-test'),off=document.getElementById('push-off');
let registration,config;
function enabledMessage(result){return `Notifications enabled. ${result.schedule||config.schedule} Seven-day reminder window: ${result.start} through ${result.end}.`}
const standalone=window.matchMedia('(display-mode: standalone)').matches||window.navigator.standalone===true;
const ios=/iPad|iPhone|iPod/.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
async function api(action,data){const res=await fetch('/api/reminders/'+action,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});let body;try{body=await res.json()}catch{throw Error('The server did not respond correctly. Please try again.')}if(!res.ok)throw Error(body.error||'Could not reach the reminder service. Try again.');return body}
function buttons(enabled){enable.hidden=enabled;test.hidden=!enabled;off.hidden=!enabled}
function keyBytes(s){return Uint8Array.from(atob(s.replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0))}
async function initialize(){
 if(ios&&!standalone){status.textContent='Open Attention Reset from its home-screen icon to enable iPhone notifications. If you have not added it yet: Safari → Share → Add to Home Screen → Open as Web App.';enable.disabled=true;return}
 if(!('serviceWorker' in navigator)||!('PushManager' in window)||!('Notification' in window)){status.textContent='Notifications need a supported browser. On iPhone, use iOS 16.4 or later and open this app from its home-screen icon.';enable.disabled=true;return}
 try{
 const result=await fetch('/api/reminders/config');if(!result.ok)throw Error('Reminders are being prepared. Reopen the app shortly.');config=await result.json();
 registration=await navigator.serviceWorker.register('/sw.js',{scope:'/'});await navigator.serviceWorker.ready;
 const sub=await registration.pushManager.getSubscription();
 if(sub&&Notification.permission==='granted'){
   const record=await api('subscribe',{subscription:sub.toJSON()});buttons(true);status.textContent=enabledMessage(record);
 }else if(Notification.permission==='denied'){enable.disabled=true;status.textContent='Notifications are off in iPhone settings. Go to Settings → Notifications → Attention Reset, allow notifications, then reopen the app.';}
 else{enable.disabled=false;status.textContent='Get two gentle app reminders each day for seven days: 9 am focus and 8:30 pm check-in, Pacific. Tap below and choose Allow.';}
 }catch(e){status.textContent=e.message;enable.disabled=true;}
}
enable.onclick=async()=>{
 // Ask before any awaited work: iPhone requires the original button gesture.
 const permissionPromise=Notification.requestPermission();enable.disabled=true;
 try{
 const permission=await permissionPromise;
 if(permission!=='granted'){status.textContent='Reminders are off. You can allow Attention Reset notifications in iPhone Settings when you’re ready.';return}
 let sub=await registration.pushManager.getSubscription();if(!sub)sub=await registration.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:keyBytes(config.publicKey)});
 const record=await api('subscribe',{subscription:sub.toJSON()});buttons(true);status.textContent=enabledMessage(record);
 try{await api('test',{subscription:sub.toJSON()});status.textContent='Test alert sent. '+enabledMessage(record)}catch(e){status.textContent=enabledMessage(record)+' Test alert: '+e.message}
 }catch(e){status.textContent=e.message+' Tap Enable notifications to retry.';buttons(false)}finally{enable.disabled=false}
};
test.onclick=async()=>{test.disabled=true;try{const sub=await registration.pushManager.getSubscription();if(!sub)throw Error('Enable notifications again first.');await api('test',{subscription:sub.toJSON()});status.textContent='Test alert sent. If you don’t see it, check Attention Reset in iPhone notification settings and your Focus mode.'}catch(e){status.textContent=e.message}finally{test.disabled=false}};
off.onclick=async()=>{off.disabled=true;try{const sub=await registration.pushManager.getSubscription();if(sub){await api('unsubscribe',{subscription:sub.toJSON()});await sub.unsubscribe()}buttons(false);enable.disabled=false;status.textContent='App reminders are off on this device. Your progress stays.'}catch(e){status.textContent=e.message}finally{off.disabled=false}};
initialize();
})();
