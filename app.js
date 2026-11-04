import { STORAGE_KEY, MONTHS, dateKey, parseDate, monthDates, monthStats, normalizeState, recordFor, updateRecord, videoGoal, practiceGoal, complete, trackingStart } from './model.mjs?v=6';

const $=id=>document.getElementById(id);
const TIMER_KEY='attention-reset-gratitude-timer-v1';
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
let journalDate=today,dialogMode='gratitude';
let timer={date:today,mode:'gratitude',remaining:300,deadline:0,finished:false,started:false};
try {
  const saved=JSON.parse(localStorage.getItem(TIMER_KEY));
  if(saved && parseDate(saved.date) && saved.date<=today && ['gratitude','restart'].includes(saved.mode) && Number.isFinite(saved.remaining) && saved.remaining>=0 && saved.remaining<=(saved.mode==='restart'?120:300) && Number.isFinite(saved.deadline) && saved.deadline>=0)timer=saved;
} catch {}
const upcomingMonth=()=>{const d=parseDate(today);return new Date(d.getFullYear(),d.getMonth()+1,1,12)};
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
  for(let year=upcomingMonth().getFullYear();year>=firstYear();year--){const option=document.createElement('option');option.value=year;option.textContent=year;select.append(option)}
  select.value=viewYear;
}
function renderTabs(){
  const tabs=$('monthTabs');tabs.replaceChildren();
  const current=parseDate(today), viewing=new Date(viewYear,viewMonth,1,12);
  const anchor=dateKey(viewing)>today?current:viewing;
  for(let step=-2;step<=1;step++){
    const date=new Date(anchor.getFullYear(),anchor.getMonth()+step,1,12);
    const year=date.getFullYear(),index=date.getMonth(),name=MONTHS[index],active=year===viewYear&&index===viewMonth;
    const button=document.createElement('button');button.className='month-tab';button.id='month-tab-'+index;button.type='button';button.role='tab';button.textContent=name.slice(0,3);button.setAttribute('aria-label',name+' '+year);button.setAttribute('aria-selected',String(active));button.setAttribute('aria-controls','calendarPanel');button.tabIndex=active?0:-1;button.disabled=year<firstYear()||date>upcomingMonth();
    button.onclick=()=>showMonth(year,index);
    button.onkeydown=event=>{if(event.key==='ArrowRight'||event.key==='ArrowLeft'){event.preventDefault();moveMonth(event.key==='ArrowRight'?1:-1,true)}};
    tabs.append(button);
  }
  $('calendarPanel').setAttribute('aria-labelledby','month-tab-'+viewMonth);
  requestAnimationFrame(()=>{const active=$('month-tab-'+viewMonth);if(active){const offset=active.offsetLeft-tabs.offsetLeft-(tabs.clientWidth-active.clientWidth)/2;tabs.scrollTo({left:Math.max(0,offset),behavior:'auto'})}});
  $('previousMonth').disabled=viewYear===firstYear()&&viewMonth===0;
  const limit=upcomingMonth();
  $('nextMonth').disabled=viewYear===limit.getFullYear()&&viewMonth===limit.getMonth();
}
function renderProgress(){
  const stats=monthStats(state,viewYear,viewMonth,today);
  $('monthTitle').textContent=MONTHS[viewMonth];$('bestStreak').textContent=stats.best;$('completedDays').textContent=stats.count;$('completionRate').textContent=stats.total?stats.rate+'%':'—';

  const grid=$('calendar');grid.replaceChildren();grid.setAttribute('aria-label',MONTHS[viewMonth]+' '+viewYear);
  const dates=monthDates(viewYear,viewMonth),offset=parseDate(dates[0]).getDay();
  for(let i=0;i<offset;i++){const blank=document.createElement('span');blank.className='calendar-spacer';blank.setAttribute('aria-hidden','true');grid.append(blank)}
  for(const key of dates){
    const record=recordFor(state,key),done=complete(record,key,state),partial=!done&&(practiceGoal(record,key,state)||videoGoal(record));
    const button=document.createElement('button');button.type='button';button.textContent=Number(key.slice(8));button.className='calendar-day';
    if(key<today)button.classList.add('is-past');if(partial)button.classList.add('is-partial');if(done)button.classList.add('is-complete');if(key===today){button.classList.add('is-today');button.setAttribute('aria-current','date')}
    if(key===selected)button.classList.add('is-selected');
    button.disabled=key>today;button.setAttribute('aria-pressed',String(key===selected));
    const count=(practiceGoal(record,key,state)?1:0)+(videoGoal(record)?1:0);
    button.setAttribute('aria-label',`${longDate(key)}${key===today?', today':''}: ${count} of 2 goals${key>today?', upcoming':''}`);button.title=button.getAttribute('aria-label');button.dataset.date=key;button.onclick=()=>selectDay(key);
    button.onkeydown=event=>{const amount={ArrowLeft:-1,ArrowRight:1,ArrowUp:-7,ArrowDown:7}[event.key];if(!amount)return;event.preventDefault();const date=parseDate(key);date.setDate(date.getDate()+amount);const next=dateKey(date);if(next>today||date.getFullYear()<firstYear())return;selectDay(next);requestAnimationFrame(()=>document.querySelector(`[data-date="${next}"]`)?.focus())};grid.append(button);
  }
}
function renderDailyStatus(){
  const record=currentRecord(),video=videoGoal(record),practice=practiceGoal(record,selected,state),count=(practice?1:0)+(video?1:0);
  $('gratitudeDone').checked=practice;
  const legacy=selected<state.gratitudeSince && typeof record.gratitudeDone!=='boolean' && typeof record.focus==='boolean';
  $('gratitudeLabel').textContent=legacy?'Previous focus session':'5-minute gratitude';
  $('openJournal').textContent=timer.date===selected&&timer.deadline?'Continue ↗':record.gratitudeText?.trim()?'Read ↗':'Write ↗';
  $('dailyStatus').textContent=count===2?'Both goals met ✓':`${count} of 2`;$('dailyStatus').classList.toggle('done',count===2);$('videoMark').classList.toggle('done',video);
  const raw=record.minutes;let message='Enter your video minutes when you’re ready.',tone='';
  if(raw!==''&&raw!==undefined&&raw!==null){const n=Number(raw);if(!Number.isFinite(n)||n<0||n>1440){message='Enter minutes between 0 and 1440.';tone='error'}else if(n<60){message='Under 60 minutes. Your video goal is met.';tone='success'}else{message='60 minutes or more today. Keep the record and begin again with one small step.';tone='error'}}
  $('videoFeedback').textContent=message;$('videoFeedback').className='feedback'+(tone?' '+tone:'');
  $('restartFeedback').textContent=record.restarts?`${record.restarts} small restart${record.restarts===1?'':'s'} recorded for this day.`:'';
}
function renderDay(){
  const record=currentRecord();
  $('dayTitle').textContent=selected===today?'Today, '+parseDate(selected).toLocaleDateString(undefined,{month:'short',day:'numeric'}):parseDate(selected).toLocaleDateString(undefined,{weekday:'short',month:'short',day:'numeric'});

  $('gratitudeDone').checked=practiceGoal(record,selected,state);$('minutes').value=record.minutes??'';
  for(const id of ['gratitudeDone','minutes','openJournal','restart'])$(id).disabled=isFuture();$('futureMessage').hidden=!isFuture();
  renderDailyStatus();renderSave();renderTimer();
}
function selectDay(key){
  const date=parseDate(key);if(!date||key>today)return;selected=key;
  if(date.getMonth()!==viewMonth||date.getFullYear()!==viewYear){viewMonth=date.getMonth();viewYear=date.getFullYear();renderYears();renderTabs()}
  renderProgress();renderDay();
}
function showMonth(year,month){
  const target=new Date(year,month,1,12);year=target.getFullYear();month=target.getMonth();
  if(year<firstYear()||target>upcomingMonth())return;
  viewYear=year;viewMonth=month;
  const preferred=Number(selected.slice(8)),maxDay=year===Number(today.slice(0,4))&&month===Number(today.slice(5,7))-1?Number(today.slice(8)):new Date(year,month+1,0).getDate();
  selected=dateKey(new Date(year,month,Math.min(preferred,maxDay),12));renderYears();renderTabs();renderProgress();renderDay();
}
function moveMonth(amount,focusTab=false){showMonth(viewYear,viewMonth+amount);if(focusTab)requestAnimationFrame(()=>$('month-tab-'+viewMonth)?.focus())}
$('previousMonth').onclick=()=>moveMonth(-1);$('nextMonth').onclick=()=>moveMonth(1);$('year').onchange=()=>{const year=Number($('year').value),limit=upcomingMonth(),month=year===limit.getFullYear()?Math.min(viewMonth,limit.getMonth()):viewMonth;showMonth(year,month)};
$('today').onclick=()=>selectDay(today);
$('gratitudeDone').onchange=()=>{
  const record=currentRecord();
  if(selected<state.gratitudeSince && typeof record.gratitudeDone!=='boolean' && typeof record.focus==='boolean'){setRecord({focus:$('gratitudeDone').checked});return}
  if($('gratitudeDone').checked&&!record.gratitudeText?.trim()){$('gratitudeDone').checked=false;openJournal(selected,true);$('timerNote').textContent='Write a little gratitude before completing this goal.';return}
  setRecord({gratitudeDone:$('gratitudeDone').checked});
};
$('minutes').oninput=()=>setRecord({minutes:$('minutes').value});

for(const surface of [$('calendarPanel'),$('monthTabs')]){
let swipe=null;
surface.addEventListener('pointerdown',event=>{if(event.pointerType==='touch')swipe={x:event.clientX,y:event.clientY}});
surface.addEventListener('pointercancel',()=>{swipe=null});
surface.addEventListener('pointerup',event=>{if(!swipe)return;const dx=event.clientX-swipe.x,dy=event.clientY-swipe.y;swipe=null;if(Math.abs(dx)>=50&&Math.abs(dx)>Math.abs(dy)*1.5)moveMonth(dx<0?1:-1)});
}
function remainingSeconds(){return timer.deadline?Math.max(0,Math.ceil((timer.deadline-Date.now())/1000)):timer.remaining}
function aligned(){return timer.date===journalDate&&timer.mode===dialogMode}
function duration(){return dialogMode==='restart'?120:300}
function journalSaveStatus(){ $('journalSaved').textContent=storageError||'Saved on this device.';$('journalSaved').classList.toggle('error',!!storageError) }
function openJournal(key=selected,autostart=false,mode='gratitude'){
  journalDate=key;dialogMode=mode;
  $('journalDate').textContent=longDate(key);$('gratitudeText').value=recordFor(state,key).gratitudeText||'';
  $('sessionBadge').textContent=mode==='restart'?'Restart':'Gratitude';$('journalTitle').textContent=mode==='restart'?'One small beginning.':'What am I grateful for?';$('sessionIcon').textContent=mode==='restart'?'↻':'🌿';$('writingPanel').hidden=mode==='restart';
  $('finishJournal').setAttribute('aria-label',mode==='restart'?'Finish restart':'Save and complete gratitude entry');
  $('timerNote').textContent='';journalSaveStatus();
  if(!$('journalDialog').open)$('journalDialog').showModal();
  if(autostart&&!timer.deadline&&(!aligned()||(!timer.started&&!timer.finished))){timer={date:key,mode,remaining:mode==='restart'?120:300,deadline:0,finished:false,started:false};startOrPause()}
  renderTimer();
}
function renderTimer(){
  let seconds=remainingSeconds();
  if(timer.deadline&&seconds===0){timer.deadline=0;timer.remaining=0;timer.finished=true;saveTimer();if(aligned())$('timerNote').textContent=timer.mode==='gratitude'?'Five minutes are up. Tap the checkmark when your entry is ready.':'Two minutes done. You’ve made a start.'}
  if(!aligned())seconds=duration();
  $('clock').textContent=String(Math.floor(seconds/60)).padStart(2,'0')+':'+String(seconds%60).padStart(2,'0');
  $('clock').setAttribute('aria-label',(dialogMode==='restart'?'Restart':'Gratitude')+' timer');
  const running=aligned()&&!!timer.deadline,otherRunning=!aligned()&&!!timer.deadline;
  $('pauseIcon').textContent=running?'Ⅱ':'▶';$('startTimer').setAttribute('aria-label',running?'Pause timer':aligned()&&timer.started&&!timer.finished?'Resume timer':'Start timer');
  $('startTimer').disabled=otherRunning||journalDate>today;$('resetTimer').disabled=otherRunning;
  $('timerDuration').textContent=dialogMode==='restart'?'2 min':'5 min';
  $('timerFace').style.setProperty('--elapsed',Math.max(0,Math.min(1,1-seconds/duration()))*360+'deg');
  $('activeSession').hidden=!otherRunning;
  if(otherRunning)$('timerNote').textContent='Another timer is running for '+longDate(timer.date)+'. Your writing here will still save.';
}
function startOrPause(){
  if(!aligned()&&timer.deadline){renderTimer();return}
  if(aligned()&&timer.deadline){timer.remaining=remainingSeconds();timer.deadline=0;$('timerNote').textContent='Paused.'}
  else{
    if(!aligned()||timer.finished)timer={date:journalDate,mode:dialogMode,remaining:duration(),deadline:0,finished:false,started:false};
    if(timer.date>today)return;
    timer.deadline=Date.now()+timer.remaining*1000;timer.started=true;$('timerNote').textContent='';
  }
  saveTimer();renderTimer();renderDailyStatus();
}
$('openJournal').onclick=()=>openJournal(selected,selected===today&&!practiceGoal(currentRecord(),selected,state));
$('closeJournal').onclick=()=>$('journalDialog').close();
$('gratitudeText').oninput=()=>{
  const text=$('gratitudeText').value;
  setRecord({gratitudeText:text,...(!text.trim()?{gratitudeDone:false}:{})},journalDate);
  journalSaveStatus();
};
$('startTimer').onclick=startOrPause;
$('resetTimer').onclick=()=>{
  if(!aligned()&&timer.deadline)return;
  timer={date:journalDate,mode:dialogMode,remaining:duration(),deadline:0,finished:false,started:false};saveTimer();$('timerNote').textContent='Timer reset. Your writing is kept.';renderTimer();
};
$('activeSession').onclick=()=>openJournal(timer.date,false,timer.mode);
$('finishJournal').onclick=()=>{
  if(dialogMode==='gratitude'){
    const text=$('gratitudeText').value;
    if(!text.trim()){$('timerNote').textContent='Write something you’re grateful for before finishing.';$('gratitudeText').focus();return}
    setRecord({gratitudeText:text,gratitudeDone:true},journalDate);journalSaveStatus();
    if(storageError){$('timerNote').textContent='Your entry could not be saved. Copy your writing before leaving.';return}
  }
  if(aligned()){timer.remaining=0;timer.deadline=0;timer.finished=true;saveTimer()}
  $('journalDialog').close();renderProgress();renderDailyStatus();
};
$('restart').onclick=()=>{
  if(timer.deadline||(timer.mode==='gratitude'&&timer.started&&!timer.finished)){openJournal(timer.date,false,timer.mode);$('timerNote').textContent='Your current timer is still in progress. Reset or finish it before a two-minute restart.';return}
  setRecord({restarts:(currentRecord().restarts||0)+1});timer={date:selected,mode:'restart',remaining:120,deadline:0,finished:false,started:false};saveTimer();openJournal(selected,false,'restart');
};
$('export').onclick=()=>{
  let record=JSON.stringify(state,null,2);if(unreadable){try{record=localStorage.getItem(STORAGE_KEY)||record}catch{}}
  const url=URL.createObjectURL(new Blob([record],{type:'application/json'})),link=document.createElement('a');link.href=url;link.download='attention-reset-'+today+'.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
};
function refreshToday(){const latest=dateKey();if(latest!==today){const followedToday=selected===today;today=latest;if(followedToday){const d=parseDate(today);selected=today;viewYear=d.getFullYear();viewMonth=d.getMonth()}renderYears();renderTabs();renderProgress();renderDay()}renderTimer()}
document.addEventListener('visibilitychange',()=>{if(!document.hidden)refreshToday()});
window.addEventListener('storage',event=>{if(event.key===STORAGE_KEY&&event.newValue){try{state=normalizeState(JSON.parse(event.newValue),today);renderYears();renderProgress();renderDay();if($('journalDialog').open){$('gratitudeText').value=recordFor(state,journalDate).gratitudeText||'';journalSaveStatus()}}catch{}}});
setInterval(refreshToday,500);renderYears();renderTabs();renderProgress();renderDay();
