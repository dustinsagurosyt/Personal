import { STORAGE_KEY, MONTHS, dateKey, parseDate, monthDates, monthStats, normalizeState, recordFor, updateRecord, videoGoal, complete, trackingStart } from './model.mjs?v=3';

const $=id=>document.getElementById(id);
const TIMER_KEY='attention-reset-timer-v3';
let today=dateKey(),selected=today,viewYear=new Date().getFullYear(),viewMonth=new Date().getMonth();
let storageError='',unreadable=false,state;
try {
  const raw=localStorage.getItem(STORAGE_KEY);
  state=normalizeState(raw?JSON.parse(raw):null,today);
} catch {
  state=normalizeState(null,today);
  storageError='Your saved record could not be opened. Download a backup before clearing browser data.';
  unreadable=true;
}
let timer={date:today,mode:'focus',remaining:1200,deadline:0,finished:false};
try {
  const saved=JSON.parse(localStorage.getItem(TIMER_KEY));
  if(saved && parseDate(saved.date) && saved.date<=today && ['focus','restart'].includes(saved.mode) && Number.isFinite(saved.remaining) && saved.remaining>=0 && saved.remaining<=1200 && Number.isFinite(saved.deadline) && saved.deadline>=0)timer=saved;
} catch {}
const firstYear=()=>Math.max(1900,Math.min(Number(trackingStart(state,today).slice(0,4)),Number(today.slice(0,4))-4));
const longDate=key=>parseDate(key).toLocaleDateString(undefined,{month:'long',day:'numeric',year:'numeric'});
const isFuture=()=>selected>today;
function currentRecord(){return recordFor(state,selected)}
function saveState(){
  if(unreadable){storageError='Saving paused to protect an unreadable previous record. Download a backup before clearing browser data.';renderSave();return false}
  try{localStorage.setItem(STORAGE_KEY,JSON.stringify(state));storageError=''}
  catch{storageError='Changes could not be saved. Download your record before leaving this page.'}
  renderSave();return !storageError;
}
function renderSave(){ $('saved').textContent=storageError||'Saved automatically on this device.';$('saved').classList.toggle('error',!!storageError) }
function saveTimer(){try{localStorage.setItem(TIMER_KEY,JSON.stringify(timer))}catch{$('timerNote').textContent='This timer cannot be saved across reloads on this browser.'}}
function setRecord(patch,key=selected){
  if(key>today)return;
  state=updateRecord(state,key,patch,today);
  saveState();renderProgress();renderDailyStatus();
}
function renderYears(){
  const select=$('year');select.replaceChildren();
  for(let year=Number(today.slice(0,4));year>=firstYear();year--){const option=document.createElement('option');option.value=year;option.textContent=year;select.append(option)}
  select.value=viewYear;
}
function renderTabs(){
  const tabs=$('monthTabs');tabs.replaceChildren();
  MONTHS.forEach((name,index)=>{
    const button=document.createElement('button');button.className='month-tab';button.id='month-tab-'+index;button.type='button';button.role='tab';button.textContent=name.slice(0,3);button.setAttribute('aria-label',name+' '+viewYear);button.setAttribute('aria-selected',String(index===viewMonth));button.setAttribute('aria-controls','calendarPanel');button.tabIndex=index===viewMonth?0:-1;button.disabled=viewYear===Number(today.slice(0,4))&&index>Number(today.slice(5,7))-1;
    button.onclick=()=>showMonth(viewYear,index);
    button.onkeydown=event=>{if(event.key==='ArrowRight'||event.key==='ArrowLeft'){event.preventDefault();moveMonth(event.key==='ArrowRight'?1:-1,true)}};
    tabs.append(button);
  });
  $('calendarPanel').setAttribute('aria-labelledby','month-tab-'+viewMonth);
  requestAnimationFrame(()=>{const active=$('month-tab-'+viewMonth);if(active){const offset=active.offsetLeft-tabs.offsetLeft-(tabs.clientWidth-active.clientWidth)/2;tabs.scrollTo({left:Math.max(0,offset),behavior:'auto'})}});
  $('previousMonth').disabled=viewYear===firstYear()&&viewMonth===0;
  $('nextMonth').disabled=viewYear===Number(today.slice(0,4))&&viewMonth===Number(today.slice(5,7))-1;
}
function renderProgress(){
  const stats=monthStats(state,viewYear,viewMonth,today);
  $('monthTitle').textContent=MONTHS[viewMonth];$('bestStreak').textContent=stats.best;$('completedDays').textContent=stats.count;$('completionRate').textContent=stats.total?stats.rate+'%':'—';
  $('monthSummary').textContent=stats.total?`${stats.count} of ${stats.total} tracked days`:'No tracked days yet';
  const grid=$('calendar');grid.replaceChildren();grid.setAttribute('aria-label',MONTHS[viewMonth]+' '+viewYear);
  const dates=monthDates(viewYear,viewMonth),offset=(parseDate(dates[0]).getDay()+6)%7;
  for(let i=0;i<offset;i++){const blank=document.createElement('span');blank.className='calendar-spacer';blank.setAttribute('aria-hidden','true');grid.append(blank)}
  for(const key of dates){
    const record=recordFor(state,key),done=complete(record),partial=!done&&(record.focus===true||videoGoal(record));
    const button=document.createElement('button');button.type='button';button.textContent=Number(key.slice(8));button.className='calendar-day';
    if(key<today)button.classList.add('is-past');if(partial)button.classList.add('is-partial');if(done)button.classList.add('is-complete');if(key===today){button.classList.add('is-today');button.setAttribute('aria-current','date')}
    if(key===selected)button.classList.add('is-selected');
    button.disabled=key>today;button.setAttribute('aria-pressed',String(key===selected));
    const count=(record.focus===true?1:0)+(videoGoal(record)?1:0);
    button.setAttribute('aria-label',`${longDate(key)}${key===today?', today':''}: ${count} of 2 goals${key>today?', upcoming':''}`);button.title=button.getAttribute('aria-label');button.dataset.date=key;button.onclick=()=>selectDay(key);
    button.onkeydown=event=>{const amount={ArrowLeft:-1,ArrowRight:1,ArrowUp:-7,ArrowDown:7}[event.key];if(!amount)return;event.preventDefault();const date=parseDate(key);date.setDate(date.getDate()+amount);const next=dateKey(date);if(next>today||date.getFullYear()<firstYear())return;selectDay(next);requestAnimationFrame(()=>document.querySelector(`[data-date="${next}"]`)?.focus())};grid.append(button);
  }
}
function renderDailyStatus(){
  const record=currentRecord(),video=videoGoal(record),count=(record.focus===true?1:0)+(video?1:0);
  $('dailyStatus').textContent=count===2?'Both goals met ✓':`${count} of 2`;$('dailyStatus').classList.toggle('done',count===2);$('videoMark').classList.toggle('done',video);
  const raw=record.minutes;let message='Enter your video minutes when you’re ready.',tone='';
  if(raw!==''&&raw!==undefined&&raw!==null){const n=Number(raw);if(!Number.isFinite(n)||n<0||n>1440){message='Enter minutes between 0 and 1440.';tone='error'}else if(n<60){message='Under 60 minutes. Your video goal is met.';tone='success'}else{message='60 minutes or more today. Keep the record and begin again with one small step.';tone='error'}}
  $('videoFeedback').textContent=message;$('videoFeedback').className='feedback'+(tone?' '+tone:'');
  $('restartFeedback').textContent=record.restarts?`${record.restarts} small restart${record.restarts===1?'':'s'} recorded for this day.`:'';
}
function renderDay(){
  const record=currentRecord();
  $('dayTitle').textContent=selected===today?'Today, '+parseDate(selected).toLocaleDateString(undefined,{month:'short',day:'numeric'}):parseDate(selected).toLocaleDateString(undefined,{weekday:'short',month:'short',day:'numeric'});
  $('dayEyebrow').textContent=selected===today?'YOUR TWO-MINUTE CHECK-IN':'YOUR SAVED DAILY CHECK-IN';
  $('focus').checked=record.focus===true;$('minutes').value=record.minutes??'';$('task').value=record.task??'';
  for(const id of ['focus','minutes','task','restart'])$(id).disabled=isFuture();$('futureMessage').hidden=!isFuture();
  renderDailyStatus();renderSave();renderTimer();
}
function selectDay(key){
  const date=parseDate(key);if(!date||key>today)return;selected=key;
  if(date.getMonth()!==viewMonth||date.getFullYear()!==viewYear){viewMonth=date.getMonth();viewYear=date.getFullYear();renderYears();renderTabs()}
  renderProgress();renderDay();
}
function showMonth(year,month){
  const target=new Date(year,month,1,12);year=target.getFullYear();month=target.getMonth();
  if(year<firstYear()||dateKey(target)>today)return;
  viewYear=year;viewMonth=month;
  const preferred=Number(selected.slice(8)),maxDay=year===Number(today.slice(0,4))&&month===Number(today.slice(5,7))-1?Number(today.slice(8)):new Date(year,month+1,0).getDate();
  selected=dateKey(new Date(year,month,Math.min(preferred,maxDay),12));renderYears();renderTabs();renderProgress();renderDay();
}
function moveMonth(amount,focusTab=false){showMonth(viewYear,viewMonth+amount);if(focusTab)requestAnimationFrame(()=>$('month-tab-'+viewMonth)?.focus())}
$('previousMonth').onclick=()=>moveMonth(-1);$('nextMonth').onclick=()=>moveMonth(1);$('year').onchange=()=>{const year=Number($('year').value),month=year===Number(today.slice(0,4))?Math.min(viewMonth,Number(today.slice(5,7))-1):viewMonth;showMonth(year,month)};
$('today').onclick=()=>selectDay(today);
$('focus').onchange=()=>setRecord({focus:$('focus').checked});
$('minutes').oninput=()=>setRecord({minutes:$('minutes').value});
$('task').oninput=()=>setRecord({task:$('task').value});
let swipe=null;
$('calendarPanel').addEventListener('pointerdown',event=>{if(event.pointerType==='touch')swipe={x:event.clientX,y:event.clientY}});
$('calendarPanel').addEventListener('pointercancel',()=>{swipe=null});
$('calendarPanel').addEventListener('pointerup',event=>{if(!swipe)return;const dx=event.clientX-swipe.x,dy=event.clientY-swipe.y;swipe=null;if(Math.abs(dx)>=50&&Math.abs(dx)>Math.abs(dy)*1.5)moveMonth(dx<0?1:-1)});
function remainingSeconds(){return timer.deadline?Math.max(0,Math.ceil((timer.deadline-Date.now())/1000)):timer.remaining}
function renderTimer(){
  const seconds=remainingSeconds();
  if(timer.deadline&&seconds===0){timer.deadline=0;timer.remaining=0;timer.finished=true;saveTimer();$('timerNote').textContent=timer.mode==='focus'?'Time is up. Mark the session complete if you gave it 20 minutes of focus.':'Two minutes done. You’ve made a start. Continue when you can.'}
  $('clock').textContent=String(Math.floor(seconds/60)).padStart(2,'0')+':'+String(seconds%60).padStart(2,'0');
  $('startTimer').textContent=timer.deadline?'Pause':timer.finished?'Start 20 minutes':timer.remaining<(timer.mode==='restart'?120:1200)?'Resume':timer.mode==='restart'?'Start 2 minutes':'Start 20 minutes';
  $('startTimer').disabled=!timer.deadline&&isFuture();
  $('timerContext').textContent=timer.deadline||timer.finished||timer.remaining<(timer.mode==='restart'?120:1200)?`${timer.mode==='restart'?'Restart':'Focus session'} for ${longDate(timer.date)}${timer.date!==selected?' · viewing a different day':''}`:'A little room for one thing.';
  $('confirmFocus').hidden=!(timer.finished&&timer.mode==='focus'&&!recordFor(state,timer.date).focus);
}
$('startTimer').onclick=()=>{
  if(timer.deadline){timer.remaining=remainingSeconds();timer.deadline=0;$('timerNote').textContent='Paused. Resume whenever you’re ready.'}
  else{
    if(timer.finished){timer={date:selected,mode:'focus',remaining:1200,deadline:0,finished:false}}
    else if(timer.remaining===(timer.mode==='restart'?120:1200))timer.date=selected;
    if(timer.date>today)return;
    timer.deadline=Date.now()+timer.remaining*1000;$('timerNote').textContent='Timer running. Set your phone aside. It keeps time in the background and across reloads, without an alarm.';
  }
  saveTimer();renderTimer();
};
$('resetTimer').onclick=()=>{timer={date:selected,mode:'focus',remaining:1200,deadline:0,finished:false};saveTimer();$('timerNote').textContent='Choose one small task. The timer is silent.';renderTimer()};
$('confirmFocus').onclick=()=>{setRecord({focus:true},timer.date);if(selected===timer.date)$('focus').checked=true;$('timerNote').textContent='20-minute focus recorded for '+longDate(timer.date)+'.';renderTimer()};
$('restart').onclick=()=>{
  if(timer.deadline||(timer.mode==='focus'&&!timer.finished&&timer.remaining<1200)){$('timerNote').textContent='Your focus timer is still in progress. Reset it first if you want a two-minute restart instead.'}
  else{setRecord({restarts:(currentRecord().restarts||0)+1});timer={date:selected,mode:'restart',remaining:120,deadline:0,finished:false};saveTimer();$('timerNote').textContent='Pick one tiny action. Tap Start 2 minutes to begin.';renderTimer()}
  $('focusTools').open=true;$('focusTools').scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'center'});
};
$('export').onclick=()=>{
  let record=JSON.stringify(state,null,2);if(unreadable){try{record=localStorage.getItem(STORAGE_KEY)||record}catch{}}
  const url=URL.createObjectURL(new Blob([record],{type:'application/json'})),link=document.createElement('a');link.href=url;link.download='attention-reset-'+today+'.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
};
function refreshToday(){const latest=dateKey();if(latest!==today){const followedToday=selected===today;today=latest;if(followedToday){const d=parseDate(today);selected=today;viewYear=d.getFullYear();viewMonth=d.getMonth()}renderYears();renderTabs();renderProgress();renderDay()}renderTimer()}
document.addEventListener('visibilitychange',()=>{if(!document.hidden)refreshToday()});
window.addEventListener('storage',event=>{if(event.key===STORAGE_KEY&&event.newValue){try{state=normalizeState(JSON.parse(event.newValue),today);renderYears();renderProgress();renderDay()}catch{}}});
setInterval(refreshToday,500);renderYears();renderTabs();renderProgress();renderDay();
