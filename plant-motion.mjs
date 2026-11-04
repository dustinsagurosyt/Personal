const number = /-?(?:\d*\.\d+|\d+)(?:e[-+]?\d+)?/gi;
const seed = '<ellipse cx="60" cy="78.4" rx="2.1" ry="1.5" fill="#9a7651"/>';
const svgNamespace = 'http://www.w3.org/2000/svg';

function describe(node){
  const tag=node.localName;
  const transform=node.getAttribute('transform')||'';
  const anchor=transform.match(/^translate\(([-.\d]+) ([-.\d]+)\)/);
  const d=node.getAttribute('d')||'';
  const start=d.match(/^M([-.\d]+) ([-.\d]+)/);
  const x=anchor?+anchor[1]:start?+start[1]:+(node.getAttribute('cx')||60);
  const y=anchor?+anchor[2]:start?+start[2]:+(node.getAttribute('cy')||79);
  const first=node.firstElementChild;
  const shape=(first?.getAttribute('d')||d).replace(number,'#');
  const angle=+(transform.match(/rotate\(([-.\d]+)\)/)?.[1]||0);
  const stem=tag==='path'&&node.getAttribute('fill')==='none';
  const leaf=tag==='g'&&first?.localName==='path'&&first.getAttribute('d')?.startsWith('M0 0');
  const succulent=tag==='g'&&!anchor&&transform.startsWith('translate(60 80)');
  const kind=stem?'stem':leaf?'leaf':succulent?'succulent':tag;
  return {node,x,y,angle,kind,shape};
}
function interpolate(from,to,node,updates){
  for(const attr of [...node.attributes]){
    const name=attr.name;
    const a=from.getAttribute(name), b=to.getAttribute(name);
    if(a===null||b===null||a===b)continue;
    if(/^(fill|stroke)$/.test(name)&&/^#[0-9a-f]{6}$/i.test(a)&&/^#[0-9a-f]{6}$/i.test(b)){
      const ca=a.slice(1).match(/../g).map(x=>parseInt(x,16));
      const cb=b.slice(1).match(/../g).map(x=>parseInt(x,16));
      updates.push(t=>node.setAttribute(name,'rgb('+ca.map((v,i)=>Math.round(v+(cb[i]-v)*t)).join(' ')+')'));
    }else if(/^(d|transform|cx|cy|rx|ry|r|stroke-width)$/.test(name)&&a.replace(number,'#')===b.replace(number,'#')){
      const aa=(a.match(number)||[]).map(Number), bb=(b.match(number)||[]).map(Number);
      updates.push(t=>{
        let i=0;
        node.setAttribute(name,b.replace(number,()=>{
          const j=i++;
          const value=(aa[j]+(bb[j]-aa[j])*t).toFixed(3);
          return name==='d'?' '+value+' ':value;
        }));
      });
    }
  }
  for(let i=0;i<node.children.length;i++){
    if(from.children[i]?.localName===to.children[i]?.localName&&from.children[i]?.localName===node.children[i].localName){
      interpolate(from.children[i],to.children[i],node.children[i],updates);
    }else if(!from.children[i]){
      const child=node.children[i];
      updates.push(t=>child.setAttribute('opacity',t));
    }
  }
}
function layer(markup){
  const group=document.createElementNS('http://www.w3.org/2000/svg','g');
  group.innerHTML=markup;
  return group;
}
function prepare(growth,before,after){
  const old=Array.from(layer(before).children,describe);
  const next=layer(after);
  const available=new Set(old);
  const motions=[...next.children].map(node=>{
    const target=describe(node);
    const ranked=Array.from(available).filter(item=>item.kind===target.kind&&item.shape===target.shape).map(item=>{
      const distance=Math.hypot(item.x-target.x,item.y-target.y);
      const angle=Math.abs(((item.angle-target.angle+540)%360)-180);
      return {item,distance,cost:distance+angle*.12};
    }).sort((a,b)=>a.cost-b.cost);
    const best=ranked[0];
    if(best&&(best.distance<=(target.kind==='stem'?2:12))&&best.cost<26){
      available.delete(best.item);
      const updates=[];
      interpolate(best.item.node,node,node,updates);
      return t=>updates.forEach(update=>update(t));
    }
    const wrap=layer('');
    node.replaceWith(wrap);
    wrap.append(node);
    if(target.kind==='stem'){
      node.setAttribute('pathLength','1');
      node.setAttribute('stroke-dasharray','1');
      return t=>node.setAttribute('stroke-dashoffset',1-t);
    }
    return t=>{
      const delay=Math.min(.25,Math.max(0,(79-target.y)*.0035));
      const u=Math.max(0,Math.min(1,(t-delay)/(1-delay)));
      wrap.setAttribute('opacity',Math.min(1,u*2.5));
      wrap.setAttribute('transform','translate('+target.x+' '+target.y+') scale('+(.16+.84*u)+') translate('+(-target.x)+' '+(-target.y)+')');
    };
  });
  const departing=layer('');
  available.forEach(({node})=>departing.append(node));
  growth.replaceChildren(departing,next);
  return t=>{
    departing.setAttribute('opacity',Math.max(0,1-t*2.2));
    motions.forEach(move=>move(t));
  };
}

function readStage(document, day) {
  const frame=document.getElementById('day-'+day)?.nextElementSibling;
  if(frame?.localName!=='g')throw new Error('Missing plant growth stage');
  const parts=[...frame.children];
  const potIndex=parts.findIndex(part=>part.localName==='ellipse'&&part.getAttribute('cy')==='102');
  if(potIndex<0)throw new Error('Missing plant pot');
  return {
    foliage:parts.slice(0,potIndex).map(part=>part.outerHTML).join(''),
    pot:parts.slice(potIndex).map(part=>part.outerHTML).join('')
  };
}

export async function playGrowth(image, asset, day, isCurrent) {
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  if(reduced.matches)return;
  const response=await fetch(asset);
  if(!response.ok)throw new Error('Unable to load plant art');
  const source=new DOMParser().parseFromString(await response.text(),'image/svg+xml');
  if(!isCurrent()||reduced.matches)return;
  const after=readStage(source,day);
  const before=day===1?seed:readStage(source,day-1).foliage;
  const svg=document.createElementNS(svgNamespace,'svg');
  svg.setAttribute('viewBox','0 0 120 106');
  svg.setAttribute('aria-hidden','true');
  const growth=layer('');
  const draw=prepare(growth,before,after.foliage);
  svg.append(growth,layer(after.pot));
  draw(0);
  image.before(svg);
  image.hidden=true;
  try {
    await new Promise(resolve=>{
      let start;
      function frame(now){
        if(!isCurrent()||reduced.matches){resolve();return;}
        start??=now;
        const progress=Math.min((now-start)/(day===15?1100:850),1);
        draw(progress*progress*(3-2*progress));
        if(progress<1)requestAnimationFrame(frame);
        else resolve();
      }
      requestAnimationFrame(frame);
    });
  } finally {
    image.hidden=false;
    svg.remove();
  }
}
