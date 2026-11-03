import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const model=readFileSync(new URL('../model.mjs',import.meta.url),'utf8').replaceAll('export ','');
const app=readFileSync(new URL('../app.js',import.meta.url),'utf8').replace(/^import[^\n]+\n/,'');
function harness(initial={},timer,initialTime='2026-11-03T12:00:00'){
  const roots=new Map(),listeners={};let now=new Date(initialTime).getTime();
  class Element{
    constructor(id=''){this.id=id;this.children=[];this.attributes={};this.value='';this.checked=false;this.hidden=false;this.disabled=false;this.dataset={};this.className='';this.clientWidth=300;this.clientHeight=44;this.offsetLeft=0;this.offsetWidth=40;this.events={};this.classList={add:(...names)=>{const s=new Set(this.className.split(' ').filter(Boolean));names.forEach(n=>s.add(n));this.className=[...s].join(' ')},toggle:(n,on)=>{const s=new Set(this.className.split(' ').filter(Boolean));const yes=on===undefined?!s.has(n):on;if(yes)s.add(n);else s.delete(n);this.className=[...s].join(' ');return yes}}}
    append(el){this.children.push(el)}replaceChildren(){this.children=[]}setAttribute(k,v){this.attributes[k]=v}getAttribute(k){return this.attributes[k]}addEventListener(n,f){this.events[n]=f}scrollTo(){}scrollIntoView(){}focus(){}click(){this.onclick?.()}
  }
  for(const match of html.matchAll(/\bid="([^"]+)"/g))roots.set(match[1],new Element(match[1]));
  const find=(id)=>{if(roots.has(id))return roots.get(id);const visit=el=>{if(el.id===id)return el;for(const c of el.children){const r=visit(c);if(r)return r}};for(const root of roots.values()){const r=visit(root);if(r)return r}return null};
  const storage=new Map(Object.entries(initial));if(timer)storage.set('attention-reset-timer-v3',JSON.stringify(timer));
  const intervals=[];const NativeDate=Date;class Clock extends NativeDate{constructor(...args){super(...(args.length?args:[now]))}static now(){return now}}
  const context={Date:Clock,Intl,Map,Set,console,Blob,URL,localStorage:{getItem:k=>storage.get(k)??null,setItem:(k,v)=>storage.set(k,v)},document:{hidden:false,getElementById:find,createElement:()=>new Element,querySelector:()=>null,addEventListener:(n,f)=>listeners[n]=f},window:{addEventListener:(n,f)=>listeners[n]=f},requestAnimationFrame:f=>f(),setInterval:f=>intervals.push(f),setTimeout:()=>{},matchMedia:()=>({matches:true})};
  vm.createContext(context);vm.runInContext(model+'\n'+app,context);
  return {el:find,storage,run:code=>vm.runInContext(code,context),advance:ms=>{now+=ms;intervals.forEach(f=>f())}};
}
test('initial current-month tabs, history navigation, swipe, and legacy completion render',()=>{
  const h=harness({'attention-reset-v1':JSON.stringify({start:'2026-11-01',days:{'2026-11-02':{focus:true,minutes:'59',thoughts:'Legacy note'}}})});
  assert.equal(h.el('monthTitle').textContent,'November');assert.equal(h.el('monthTabs').children.length,12);assert.equal(h.el('completedDays').textContent,1);assert.equal(h.el('month-tab-11').disabled,true);
  h.el('calendarPanel').events.pointerdown({pointerType:'touch',clientX:10,clientY:20});h.el('calendarPanel').events.pointerup({clientX:120,clientY:22});assert.equal(h.el('monthTitle').textContent,'October');
  h.el('month-tab-10').onclick();assert.equal(h.el('monthTitle').textContent,'November');h.el('minutes').value='60';h.el('minutes').oninput();h.el('focus').checked=true;h.el('focus').onchange();assert.equal(h.el('dailyStatus').textContent,'1 of 2');
  h.el('minutes').value='59';h.el('minutes').oninput();assert.equal(h.el('dailyStatus').textContent,'Both goals met ✓');assert.equal(JSON.parse(h.storage.get('attention-reset-v1')).days['2026-11-02'].thoughts,'Legacy note');
});
test('focus timer survives reload, and completion stays attached to its original day',()=>{
  const h=harness();h.el('startTimer').onclick();h.advance(60000);assert.equal(h.el('clock').textContent,'19:00');
  const reloaded=harness(Object.fromEntries(h.storage),undefined,'2026-11-03T12:01:00');assert.equal(reloaded.el('clock').textContent,'19:00');
  h.el('previousMonth').onclick();assert.equal(h.el('monthTitle').textContent,'October');h.advance(19*60000);assert.equal(h.el('clock').textContent,'00:00');assert.equal(h.el('confirmFocus').hidden,false);h.el('confirmFocus').onclick();
  const saved=JSON.parse(h.storage.get('attention-reset-v1'));assert.equal(saved.days['2026-11-03'].focus,true);assert.equal(saved.days['2026-10-03'],undefined);
});
test('a two-minute restart never completes the 20-minute goal',()=>{
  const h=harness();h.el('restart').onclick();assert.equal(h.el('clock').textContent,'02:00');h.el('startTimer').onclick();h.advance(120000);assert.equal(h.el('confirmFocus').hidden,true);assert.equal(h.el('focus').checked,false);assert.equal(JSON.parse(h.storage.get('attention-reset-v1')).days['2026-11-03'].restarts,1);
});
test('an unreadable previous record is not overwritten',()=>{
  const h=harness({'attention-reset-v1':'{broken-json'});h.el('focus').checked=true;h.el('focus').onchange();assert.equal(h.storage.get('attention-reset-v1'),'{broken-json');assert.match(h.el('saved').textContent,/protect an unreadable previous record/);
});
