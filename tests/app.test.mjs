import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const model=readFileSync(new URL('../model.mjs',import.meta.url),'utf8').replaceAll('export ','');
const app=readFileSync(new URL('../app.js',import.meta.url),'utf8').replace(/^import[^\n]+\n/gm,'');
const plants=readFileSync(new URL('../plants.mjs',import.meta.url),'utf8').replace('export ','');
function harness(initial={},timer,initialTime='2026-11-03T12:00:00'){
  const roots=new Map(),listeners={};let now=new Date(initialTime).getTime();
  class Element{
    constructor(id=''){this.id=id;this.children=[];this.attributes={};this.value='';this.checked=false;this.hidden=false;this.disabled=false;this.dataset={};this.className='';this.clientWidth=300;this.clientHeight=44;this.offsetLeft=0;this.offsetWidth=40;this.events={};this.style={setProperty:()=>{}};this.open=false;this.classList={add:(...names)=>{const s=new Set(this.className.split(' ').filter(Boolean));names.forEach(n=>s.add(n));this.className=[...s].join(' ')},toggle:(n,on)=>{const s=new Set(this.className.split(' ').filter(Boolean));const yes=on===undefined?!s.has(n):on;if(yes)s.add(n);else s.delete(n);this.className=[...s].join(' ');return yes}}}
    showModal(){this.open=true}close(){this.open=false}append(el){this.children.push(el)} insertBefore(el,before){const index=this.children.indexOf(el);if(index>=0)this.children.splice(index,1);this.children.splice(before?this.children.indexOf(before):this.children.length,0,el)} removeChild(el){this.children.splice(this.children.indexOf(el),1)}replaceChildren(){this.children=[]}setAttribute(k,v){this.attributes[k]=v}getAttribute(k){return this.attributes[k]}addEventListener(n,f){this.events[n]=f}scrollTo(){}scrollIntoView(){}focus(){}click(){this.onclick?.()}
  }
  for(const match of html.matchAll(/\bid="([^"]+)"/g))roots.set(match[1],new Element(match[1]));
  roots.get('gardenView').hidden=true;
  roots.get('shopView').hidden=true;
  roots.get('pebblePanel').setAttribute('aria-hidden','true');
  const find=(id)=>{if(roots.has(id))return roots.get(id);const visit=el=>{if(el.id===id)return el;for(const c of el.children){const r=visit(c);if(r)return r}};for(const root of roots.values()){const r=visit(root);if(r)return r}return null};
  const storage=new Map(Object.entries(initial));if(timer)storage.set('attention-reset-gratitude-timer-v1',JSON.stringify(timer));
  const intervals=[];const NativeDate=Date;class Clock extends NativeDate{constructor(...args){super(...(args.length?args:[now]))}static now(){return now}}
  const context={Date:Clock,Intl,Map,Set,console,Blob,URL,localStorage:{getItem:k=>storage.get(k)??null,setItem:(k,v)=>storage.set(k,v)},document:{hidden:false,getElementById:find,createElement:()=>new Element,querySelector:()=>null,addEventListener:(n,f)=>listeners[n]=f},window:{scrollTo(){},addEventListener:(n,f)=>listeners[n]=f},requestAnimationFrame:f=>f(),setInterval:f=>intervals.push(f),setTimeout:()=>{},matchMedia:()=>({matches:true})};
  vm.createContext(context);vm.runInContext(model+'\n'+plants+'\n'+app,context);
  return {el:find,storage,scroll:()=>listeners.scroll(),run:code=>vm.runInContext(code,context),advance:ms=>{now+=ms;intervals.forEach(f=>f())}};
}
test('month tabs, Sunday-first alignment, swipe, and old history still work',()=>{
  const h=harness({'attention-reset-v1':JSON.stringify({start:'2026-11-01',days:{'2026-11-02':{focus:true,minutes:59,thoughts:'Legacy note'}}})});assert.equal(h.el('monthTitle').textContent,'November');assert.deepEqual(h.el('monthTabs').children.map(tab=>tab.textContent),['Sep','Oct','Nov','Dec']);assert.equal(h.el('calendar').children[0].dataset.date,'2026-11-01');assert.equal(h.el('completedDays').textContent,1);
  h.el('calendarPanel').events.pointerdown({pointerType:'touch',clientX:10,clientY:20});h.el('calendarPanel').events.pointerup({clientX:120,clientY:22});assert.equal(h.el('monthTitle').textContent,'October');h.el('today').onclick();assert.equal(h.el('gratitudeDone').checked,false);
});
test('one-minute journal saves writing, pauses, resumes, resets, and survives reload',()=>{
  const h=harness();h.el('openJournal').onclick();assert.equal(h.el('journalDialog').open,true);assert.equal(h.el('clock').textContent,'01:00');h.el('gratitudeText').value='I am grateful for my family.';h.el('gratitudeText').oninput();h.advance(15000);assert.equal(h.el('clock').textContent,'00:45');h.el('startTimer').onclick();h.advance(60000);assert.equal(h.el('clock').textContent,'00:45');
  const reload=harness(Object.fromEntries(h.storage),undefined,'2026-11-03T12:02:00');reload.el('openJournal').onclick();assert.equal(reload.el('gratitudeText').value,'I am grateful for my family.');assert.equal(reload.el('clock').textContent,'00:45');reload.el('startTimer').onclick();reload.advance(15000);assert.equal(reload.el('clock').textContent,'00:30');reload.el('resetTimer').onclick();assert.equal(reload.el('clock').textContent,'01:00');assert.equal(reload.el('gratitudeText').value,'I am grateful for my family.');
});
test('blank entries cannot complete a day; finishing real writing pairs with the video goal',()=>{
  const h=harness();h.el('openJournal').onclick();h.el('finishJournal').onclick();assert.equal(h.el('journalDialog').open,true);assert.equal(h.el('gratitudeDone').checked,false);h.el('gratitudeText').value='A kind conversation';h.el('gratitudeText').oninput();h.el('finishJournal').onclick();assert.equal(h.el('journalDialog').open,false);assert.equal(h.el('gratitudeDone').checked,true);h.el('minutes').value='60';h.el('minutes').oninput();assert(!h.el('videoMark').className.split(' ').includes('done'));h.el('minutes').value='59';h.el('minutes').oninput();assert(h.el('videoMark').className.split(' ').includes('done'));
});
test('expired timer does not mark an empty entry complete or attach it to the wrong day',()=>{
  const h=harness();h.el('openJournal').onclick();h.el('gratitudeText').value='A sunny walk';h.el('gratitudeText').oninput();h.el('closeJournal').onclick();h.el('previousMonth').onclick();h.advance(60000);assert.equal(h.el('gratitudeDone').checked,false);h.run("openJournal('2026-11-03',false)");assert.equal(h.el('clock').textContent,'00:00');h.el('finishJournal').onclick();const saved=JSON.parse(h.storage.get('attention-reset-v1'));assert.equal(saved.days['2026-11-03'].gratitudeDone,true);assert.equal(saved.days['2026-10-03'],undefined);
});
test('historical writing does not stop a different day’s timer or mix journal entries',()=>{
  const h=harness();h.el('openJournal').onclick();h.el('gratitudeText').value='Today’s gratitude';h.el('gratitudeText').oninput();h.el('closeJournal').onclick();h.el('previousMonth').onclick();h.el('openJournal').onclick();assert.equal(h.el('startTimer').disabled,true);h.el('gratitudeText').value='A memory from October';h.el('gratitudeText').oninput();h.el('finishJournal').onclick();const saved=JSON.parse(h.storage.get('attention-reset-v1'));assert.equal(saved.days['2026-10-03'].gratitudeText,'A memory from October');assert.equal(saved.days['2026-11-03'].gratitudeText,'Today’s gratitude');assert(JSON.parse(h.storage.get('attention-reset-gratitude-timer-v1')).deadline>0);
});
test('a saved timer from the removed restart feature does not load into gratitude',()=>{
  const h=harness({}, {date:'2026-11-03',mode:'restart',remaining:120,deadline:0,finished:false,started:true});
  h.el('openJournal').onclick();
  assert.equal(h.el('clock').textContent,'01:00');
  assert.equal(h.el('journalDialog').open,true);
});
test('unreadable previous records remain protected',()=>{
  const h=harness({'attention-reset-v1':'{broken-json'});h.el('openJournal').onclick();h.el('gratitudeText').value='A good day';h.el('gratitudeText').oninput();h.el('finishJournal').onclick();assert.equal(h.storage.get('attention-reset-v1'),'{broken-json');assert.equal(h.el('journalDialog').open,true);assert.match(h.el('saved').textContent,/protect an unreadable previous record/);
});

test('upcoming month is visible but read-only, and the strip crosses years',()=>{
  const h=harness({},undefined,'2026-12-03T12:00:00');
  assert.deepEqual(h.el('monthTabs').children.map(tab=>tab.textContent),['Oct','Nov','Dec','Jan']);
  h.el('monthTabs').events.pointerdown({pointerType:'touch',clientX:110,clientY:20});
  h.el('monthTabs').events.pointerup({clientX:10,clientY:21});
  assert.equal(h.el('monthTitle').textContent,'January');assert.equal(h.el('year').value,2027);
  assert.equal(h.el('openJournal').disabled,true);assert.equal(h.el('minutes').disabled,true);
  h.el('today').onclick();assert.equal(h.el('monthTitle').textContent,'December');
});

test('previewing December from November 2 does not select a disabled date',()=>{
  const h=harness({},undefined,'2026-11-02T12:00:00');
  h.el('nextMonth').onclick();
  const december2=h.el('calendar').children.find(day=>day.dataset.date==='2026-12-02');
  assert.equal(december2.disabled,true);
  assert.equal(december2.getAttribute('aria-pressed'),'false');
  assert(!december2.className.split(' ').includes('is-selected'));
  assert.equal(h.el('dayTitle').textContent,'December preview');
  h.el('previousMonth').onclick();
  const november2=h.el('calendar').children.find(day=>day.dataset.date==='2026-11-02');
  assert.equal(november2.getAttribute('aria-pressed'),'true');
});

test('90 completed days show all six species, and the next plot on the Garden tab',()=>{
  const days={};
  for(let offset=89;offset>=0;offset--){
    const date=new Date(2026,10,3-offset,12);
    const key=`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
    days[key]={gratitudeDone:true,gratitudeText:`Memory ${offset}`,minutes:20};
  }
  const h=harness({'attention-reset-v1':JSON.stringify({start:Object.keys(days)[0],days})});
  assert.equal(h.el('gardenView').hidden,true);
  h.el('gardenTab').onclick();
  assert.equal(h.el('gardenPlants').textContent,'6 plants grown');
  for(const plant of ['Fern','Succulent','Sunflower','Lavender','Monstera','Little tree'])assert(h.el('gardenPlots').innerHTML.includes(plant));
  assert.equal(h.el('nextPlotTitle').textContent,'Plot 7');
  h.el('homeTab').onclick();
  assert.equal(h.el('gardenView').hidden,true);
  assert.equal(h.el('homeView').hidden,false);
});

test('natural stages use completed days and unlock all 18 species in order',()=>{
  const h=harness();
  h.run('drawPlots(1)');
  assert.match(h.el('gardenPlots').innerHTML,/garden\/fern\.svg#day-1"/);
  h.run('drawPlots(4)');
  assert.match(h.el('gardenPlots').innerHTML,/garden\/fern\.svg#day-4"/);
  assert.match(h.el('gardenPlots').innerHTML,/<button[^>]+data-stage="4"[^>]+aria-label="Replay Fern, growth stage 4 of 15"/);
  h.run('drawPlots(91)');
  assert.match(h.el('gardenPlots').innerHTML,/garden\/little-tree\.svg#day-15"/);
  assert.match(h.el('gardenPlots').innerHTML,/garden\/tulip\.svg#day-1"/);
  h.run('drawPlots(270)');
  assert.equal((h.el('gardenPlots').innerHTML.match(/#day-15"/g)||[]).length,18);
  assert.match(h.el('gardenPlots').innerHTML,/garden\/pumpkin-vine\.svg#day-15"/);
  assert.equal(h.el('nextPlotTitle').textContent,'Plot 19');
  h.run('drawPlots(271)');
  assert.match(h.el('gardenPlots').innerHTML,/garden\/fern\.svg#day-1"/);
});

test('the selected month moves through the four visible slots before the strip shifts',()=>{
  const h=harness();
  const labels=()=>h.el('monthTabs').children.map(tab=>tab.textContent);
  const active=()=>h.el('monthTabs').children.findIndex(tab=>tab.getAttribute('aria-selected')==='true');
  assert.deepEqual(labels(),['Sep','Oct','Nov','Dec']);
  assert.equal(active(),2);
  h.el('nextMonth').onclick();
  assert.equal(active(),3);
  h.el('previousMonth').onclick();
  h.el('previousMonth').onclick();
  assert.equal(active(),1);
  assert.deepEqual(labels(),['Sep','Oct','Nov','Dec']);
  h.el('previousMonth').onclick();
  assert.equal(active(),0);
  h.el('previousMonth').onclick();
  assert.deepEqual(labels(),['Aug','Sep','Oct','Nov']);
  assert.equal(active(),0);
  h.el('nextMonth').onclick();
  assert.equal(active(),1);
});

test('the year picker and calendar navigation start in 2025',()=>{
  const h=harness({'attention-reset-v1':JSON.stringify({start:'2022-01-01',days:{}})});
  assert.deepEqual(h.el('year').children.map(option=>option.value),[2026,2025]);
  h.run('showMonth(2025,0)');
  assert.equal(h.el('previousMonth').disabled,true);
  assert.deepEqual(h.el('monthTabs').children.map(tab=>tab.textContent),['Jan','Feb','Mar','Apr']);
  h.el('previousMonth').onclick();
  assert.equal(h.el('monthTitle').textContent,'January');
  assert.equal(h.el('year').value,2025);
});

test('current streak spans months and carries through an unfinished today',()=>{
  const done={gratitudeDone:true,gratitudeText:'A small moment',minutes:20};
  const days={'2026-10-30':done,'2026-10-31':done,'2026-11-01':done};
  const stored={'attention-reset-v1':JSON.stringify({start:'2026-10-30',days})};
  const h=harness(stored,undefined,'2026-11-02T12:00:00');
  assert.equal(h.el('currentStreak').textContent,3);
  h.el('previousMonth').onclick();
  assert.equal(h.el('currentStreak').textContent,3);
  h.run("setRecord({gratitudeDone:true,gratitudeText:'Today',minutes:10},'2026-11-02')");
  assert.equal(h.el('currentStreak').textContent,4);
  const missed=harness(stored,undefined,'2026-11-03T12:00:00');
  assert.equal(missed.el('currentStreak').textContent,0);
});

test('earned growth queues only when the completed-day count increases',()=>{
  const h=harness();
  assert.equal(h.run('pendingGrowth'),undefined);
  h.run('drawPlots(4)');
  assert.equal(h.run('pendingGrowth'),4);
  h.run('drawPlots(4)');
  assert.equal(h.run('pendingGrowth'),4);
  h.el('gardenTab').onclick();
  assert.equal(h.run('pendingGrowth'),undefined);
  h.el('homeTab').onclick();
  h.run('drawPlots(5)');
  assert.equal(h.run('pendingGrowth'),5);
  h.run('drawPlots(4)');
  assert.equal(h.run('pendingGrowth'),undefined);
});

test('the shared pebble popover shows progress toward the next bonus',()=>{
  const done={gratitudeDone:true,gratitudeText:'A small moment',minutes:10};
  const days=Object.fromEntries(['2026-11-01','2026-11-02','2026-11-03'].map(key=>[key,done]));
  const h=harness({'attention-reset-v1':JSON.stringify({days})});
  assert.equal(h.el('pebblePanel').getAttribute('aria-hidden'),'true');
  h.el('pebbleToggle').onclick();
  assert.equal(h.el('pebblePanel').getAttribute('aria-hidden'),'false');
  assert.equal(h.el('pebbleToggle').getAttribute('aria-expanded'),'true');
  assert.equal(h.el('pebbleCountdown').textContent,'2 days left');
  assert.equal(h.el('pebbleDots').getAttribute('aria-label'),'3 of 5 days toward the next bonus');
  h.el('gardenTab').onclick();
  assert.equal(h.el('pebblePanel').getAttribute('aria-hidden'),'true');
  h.el('pebbleToggle').onclick();
  assert.equal(h.el('pebblePanel').getAttribute('aria-hidden'),'false');
  h.run('renderPebbleProgress(4)');
  assert.equal(h.el('pebbleCountdown').textContent,'1 day left');
  h.run('renderPebbleProgress(5)');
  assert.equal(h.el('pebbleCountdown').textContent,'5 days left');
  h.scroll();
  assert.equal(h.el('pebblePanel').getAttribute('aria-hidden'),'true');
  assert.equal(h.el('pebbleToggle').getAttribute('aria-expanded'),'false');
});

test('Shop uses the shared navigation and pebble balance',()=>{
  const h=harness();
  h.el('pebbleToggle').onclick();
  h.el('shopTab').onclick();
  assert.equal(h.el('shopView').hidden,false);
  assert.equal(h.el('shopTab').getAttribute('aria-pressed'),'true');
  assert.equal(h.el('homeView').hidden,true);
  assert.equal(h.el('gardenView').hidden,true);
  assert.equal(h.el('pebblePanel').getAttribute('aria-hidden'),'true');
  h.el('pebbleToggle').onclick();
  assert.equal(h.el('pebblePanel').getAttribute('aria-hidden'),'false');
  h.el('gardenTab').onclick();
  assert.equal(h.el('shopView').hidden,true);
  assert.equal(h.el('gardenView').hidden,false);
});
