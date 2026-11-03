self.addEventListener('install',()=>self.skipWaiting());
self.addEventListener('activate',event=>event.waitUntil(self.clients.claim()));
self.addEventListener('push',event=>{
 let message={title:'Attention Reset',body:'One small step. Open your daily tracker.',url:'/'};
 try{if(event.data)message={...message,...event.data.json()}}catch{}
 event.waitUntil(self.registration.showNotification(message.title,{body:message.body,tag:message.tag||'attention-reset',icon:'/icon-192.png',badge:'/icon-192.png',data:{url:message.url||'/'}}));
});
self.addEventListener('notificationclick',event=>{
 event.notification.close();
 const url=new URL(event.notification.data?.url||'/',self.location.origin);
 if(url.origin!==self.location.origin)return;
 event.waitUntil((async()=>{
  const windows=await self.clients.matchAll({type:'window',includeUncontrolled:true});
  for(const client of windows){if(new URL(client.url).origin===url.origin){await client.navigate(url.href);return client.focus()}}
  return self.clients.openWindow(url.href);
 })());
});
