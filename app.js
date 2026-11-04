import { STORAGE_KEY, MONTHS, dateKey, parseDate, monthDates, monthStats, normalizeState, recordFor, updateRecord, videoGoal, practiceGoal, complete, rewardProgress } from './model.mjs?v=14';
import { gardenSpecies } from './plants.mjs?v=18';

const $=id=>document.getElementById(id);
const GRATITUDE_SECONDS=60;
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
let journalDate=today;
let timer={date:today,mode:'gratitude',remaining:GRATITUDE_SECONDS,deadline:0,finished:false,started:false};
try {
  const saved=JSON.parse(localStorage.getItem(TIMER_KEY));
  if(saved && parseDate(saved.date) && saved.date<=today && saved.mode==='gratitude' && Number.isFinite(saved.remaining) && saved.remaining>=0 && saved.remaining<=300 && Number.isFinite(saved.deadline) && saved.deadline>=0){
    timer=saved;
    timer.remaining=Math.min(timer.remaining,GRATITUDE_SECONDS);
    if(timer.deadline)timer.deadline=Math.min(timer.deadline,Date.now()+GRATITUDE_SECONDS*1000);
  }
} catch {}
const upcomingMonth=()=>{const d=parseDate(today);return new Date(d.getFullYear(),d.getMonth()+1,1,12)};
const FIRST_YEAR=2025;
const longDate=key=>parseDate(key).toLocaleDateString(undefined,{month:'long',day:'numeric',year:'numeric'});
const isFuture=()=>selected>today;
function currentRecord(){return recordFor(state,selected)}
function saveState(){
  if(unreadable){storageError='Saving paused to protect an unreadable previous record. Download a backup before clearing browser data.';renderSave();return false}
  try{localStorage.setItem(STORAGE_KEY,JSON.stringify(state));storageError=''}
  catch{storageError='Changes could not be saved. Download your record before leaving this page.'}
  renderSave();return !storageError;
}
function renderSave(){
  const status=$('saved');
  status.textContent=storageError;
  status.hidden=!storageError;
  status.classList.toggle('error',!!storageError);
}
function saveTimer(){try{localStorage.setItem(TIMER_KEY,JSON.stringify(timer))}catch{$('timerNote').textContent='This timer cannot be saved across reloads on this browser.'}}
function setRecord(patch,key=selected){
  if(key>today)return;
  state=updateRecord(state,key,patch,today);
  saveState();renderProgress();renderDailyStatus();
}
function renderYears(){
  const select=$('year');select.replaceChildren();
  for(let year=upcomingMonth().getFullYear();year>=FIRST_YEAR;year--){const option=document.createElement('option');option.value=year;option.textContent=year;select.append(option)}
  select.value=viewYear;
}
const motionAllowed=()=>!matchMedia('(prefers-reduced-motion: reduce)').matches;
function renderTabs(animate=false){
  const tabs=$('monthTabs');
  const existing=new Map(Array.from(tabs.children,button=>[button.dataset.month,button]));
  const positions=new Map();
  if(animate&&motionAllowed()){
    for(const [key,button] of existing)positions.set(key,button.getBoundingClientRect().left);
  }
  const current=parseDate(today);
  const firstVisible=tabs.children[0]?.dataset.month;
  const previousStart=firstVisible?parseDate(firstVisible):current;
  const selectedMonth=viewYear*12+viewMonth;
  const previousMonth=previousStart.getFullYear()*12+previousStart.getMonth();
  const start=Math.min(selectedMonth,Math.max(FIRST_YEAR*12,previousMonth-(firstVisible?0:2),selectedMonth-3));
  const buttons=[];
  for(let step=0;step<4;step++){
    const date=new Date(Math.floor(start/12),start%12+step,1,12);
    const year=date.getFullYear(),index=date.getMonth(),name=MONTHS[index],active=year===viewYear&&index===viewMonth;
    const key=dateKey(date);
    const button=existing.get(key)||document.createElement('button');
    button.dataset.month=key;
    button.className='month-tab';button.id='month-tab-'+index;button.type='button';button.role='tab';button.textContent=name.slice(0,3);button.setAttribute('aria-label',name+' '+year);button.setAttribute('aria-selected',String(active));button.setAttribute('aria-controls','calendarPanel');button.tabIndex=active?0:-1;button.disabled=year<FIRST_YEAR||date>upcomingMonth();
    button.onclick=()=>showMonth(year,index);
    button.onkeydown=event=>{if(event.key==='ArrowRight'||event.key==='ArrowLeft'){event.preventDefault();moveMonth(event.key==='ArrowRight'?1:-1,true)}};
    buttons.push(button);
  }
  for(const button of existing.values()){
    if(!buttons.includes(button))tabs.removeChild(button);
  }
  buttons.forEach((button,index)=>{
    if(tabs.children[index]!==button)tabs.insertBefore(button,tabs.children[index]||null);
  });
  if(positions.size){
    for(const button of buttons)button.getAnimations?.().forEach(animation=>animation.cancel());
    const offsets=buttons.map(button=>{
      const previous=positions.get(button.dataset.month);
      return previous===undefined?undefined:previous-button.getBoundingClientRect().left;
    });
    const enteringOffset=offsets.find(offset=>offset!==undefined);
    buttons.forEach((button,index)=>{
      const offset=offsets[index]??enteringOffset;
      if(offset)button.animate?.([{transform:`translateX(${offset}px)`},{transform:'translateX(0)'}],{duration:180,easing:'ease-out'});
    });
  }
  $('calendarPanel').setAttribute('aria-labelledby','month-tab-'+viewMonth);
  $('previousMonth').disabled=viewYear===FIRST_YEAR&&viewMonth===0;
  const limit=upcomingMonth();
  $('nextMonth').disabled=viewYear===limit.getFullYear()&&viewMonth===limit.getMonth();
}
function renderProgress(){
  renderRewards();
  const stats=monthStats(state,viewYear,viewMonth,today);
  $('monthTitle').textContent=MONTHS[viewMonth];$('bestStreak').textContent=stats.best;$('completedDays').textContent=stats.count;$('completionRate').textContent=stats.total?stats.rate+'%':'—';

  const grid=$('calendar');grid.replaceChildren();grid.setAttribute('aria-label',MONTHS[viewMonth]+' '+viewYear);
  const dates=monthDates(viewYear,viewMonth),offset=parseDate(dates[0]).getDay();
  for(let i=0;i<offset;i++){const blank=document.createElement('span');blank.className='calendar-spacer';blank.setAttribute('aria-hidden','true');grid.append(blank)}
  for(const key of dates){
    const record=recordFor(state,key),done=complete(record,key,state),partial=!done&&(practiceGoal(record,key,state)||videoGoal(record));
    const button=document.createElement('button');button.type='button';button.textContent=Number(key.slice(8));button.className='calendar-day';
    if(key<today)button.classList.add('is-past');if(partial)button.classList.add('is-partial');if(done)button.classList.add('is-complete');if(key===today){button.classList.add('is-today');button.setAttribute('aria-current','date')}
    button.disabled=key>today;
    const isSelected=!button.disabled&&key===selected;
    if(isSelected)button.classList.add('is-selected');
    button.setAttribute('aria-pressed',String(isSelected));
    const count=(practiceGoal(record,key,state)?1:0)+(videoGoal(record)?1:0);
    button.setAttribute('aria-label',`${longDate(key)}${key===today?', today':''}: ${count} of 2 goals${key>today?', upcoming':''}`);button.title=button.getAttribute('aria-label');button.dataset.date=key;button.onclick=()=>selectDay(key);
    button.onkeydown=event=>{const amount={ArrowLeft:-1,ArrowRight:1,ArrowUp:-7,ArrowDown:7}[event.key];if(!amount)return;event.preventDefault();const date=parseDate(key);date.setDate(date.getDate()+amount);const next=dateKey(date);if(next>today||date.getFullYear()<FIRST_YEAR)return;selectDay(next);requestAnimationFrame(()=>document.querySelector(`[data-date="${next}"]`)?.focus())};grid.append(button);
  }
}
function renderDailyStatus(){
  const record=currentRecord(),video=videoGoal(record),practice=practiceGoal(record,selected,state),count=(practice?1:0)+(video?1:0);
  $('gratitudeDone').checked=practice;
  const legacy=selected<state.gratitudeSince && typeof record.gratitudeDone!=='boolean' && typeof record.focus==='boolean';
  $('gratitudeLabel').textContent=legacy?'Previous focus session':'1-minute gratitude';
  $('openJournal').textContent=timer.date===selected&&timer.deadline?'Continue ↗':record.gratitudeText?.trim()?'Read ↗':'Write ↗';
  $('dailyStatus').textContent=count===2?'Both goals met ✓':`${count} of 2`;$('dailyStatus').classList.toggle('done',count===2);$('videoMark').classList.toggle('done',video);
  const raw=record.minutes;let message='',tone='';
  if(raw!==''&&raw!==undefined&&raw!==null){const n=Number(raw);if(!Number.isFinite(n)||n<0||n>1440){message='Enter minutes between 0 and 1440.';tone='error'}else if(n<60){message='Under 60 minutes. Your video goal is met.';tone='success'}else{message='60 minutes or more today. Keep the record and begin again with one small step.';tone='error'}}
  $('videoFeedback').hidden=!message;
  $('videoFeedback').textContent=message;$('videoFeedback').className='feedback'+(tone?' '+tone:'');
}
function renderDay(){
  const record=currentRecord();
  $('dayTitle').textContent=isFuture()?`${MONTHS[viewMonth]} preview`:selected===today?'Today, '+parseDate(selected).toLocaleDateString(undefined,{month:'short',day:'numeric'}):parseDate(selected).toLocaleDateString(undefined,{weekday:'short',month:'short',day:'numeric'});

  $('gratitudeDone').checked=practiceGoal(record,selected,state);$('minutes').value=record.minutes??'';
  for(const id of ['gratitudeDone','minutes','openJournal'])$(id).disabled=isFuture();$('futureMessage').hidden=!isFuture();
  renderDailyStatus();renderSave();renderTimer();
}
function selectDay(key){
  const date=parseDate(key);if(!date||key>today)return;selected=key;
  const distance=(date.getFullYear()-viewYear)*12+date.getMonth()-viewMonth;
  if(distance){
    viewMonth=date.getMonth();
    viewYear=date.getFullYear();
    renderYears();
    renderTabs(Math.abs(distance)===1);
    renderProgress();
  }else{
    renderProgress();
  }
  renderDay();
}
function showMonth(year,month){
  const target=new Date(year,month,1,12);year=target.getFullYear();month=target.getMonth();
  if(year<FIRST_YEAR||target>upcomingMonth())return;
  const distance=(year-viewYear)*12+month-viewMonth;
  viewYear=year;viewMonth=month;
  const preferred=Number(selected.slice(8)),maxDay=year===Number(today.slice(0,4))&&month===Number(today.slice(5,7))-1?Number(today.slice(8)):new Date(year,month+1,0).getDate();
  selected=dateKey(new Date(year,month,Math.min(preferred,maxDay),12));
  renderYears();
  renderTabs(Math.abs(distance)===1);
  renderProgress();
  renderDay();
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
function aligned(){return timer.date===journalDate}
function journalSaveStatus(){
  const status=$('journalSaved');
  status.textContent=storageError;
  status.hidden=!storageError;
  status.classList.toggle('error',!!storageError);
}
function openJournal(key=selected,autostart=false){
  journalDate=key;
  $('journalDate').textContent=longDate(key);$('gratitudeText').value=recordFor(state,key).gratitudeText||'';
  $('timerNote').textContent='';journalSaveStatus();
  if(!$('journalDialog').open)$('journalDialog').showModal();
  if(autostart&&!timer.deadline&&(!aligned()||(!timer.started&&!timer.finished))){timer={date:key,mode:'gratitude',remaining:GRATITUDE_SECONDS,deadline:0,finished:false,started:false};startOrPause()}
  renderTimer();
}
function renderTimer(){
  let seconds=remainingSeconds();
  if(timer.deadline&&seconds===0){timer.deadline=0;timer.remaining=0;timer.finished=true;saveTimer();if(aligned())$('timerNote').textContent='One minute is up. Tap the checkmark when your entry is ready.'}
  if(!aligned())seconds=GRATITUDE_SECONDS;
  $('clock').textContent=String(Math.floor(seconds/60)).padStart(2,'0')+':'+String(seconds%60).padStart(2,'0');
  const running=aligned()&&!!timer.deadline,otherRunning=!aligned()&&!!timer.deadline;
  $('pauseIcon').textContent=running?'Ⅱ':'▶';$('startTimer').setAttribute('aria-label',running?'Pause timer':aligned()&&timer.started&&!timer.finished?'Resume timer':'Start timer');
  $('startTimer').disabled=otherRunning||journalDate>today;$('resetTimer').disabled=otherRunning;
  $('timerFace').style.setProperty('--elapsed',Math.max(0,Math.min(1,1-seconds/GRATITUDE_SECONDS))*360+'deg');
  $('activeSession').hidden=!otherRunning;
  if(otherRunning)$('timerNote').textContent='Another timer is running for '+longDate(timer.date)+'. Your writing here will still save.';
}
function startOrPause(){
  if(!aligned()&&timer.deadline){renderTimer();return}
  if(aligned()&&timer.deadline){timer.remaining=remainingSeconds();timer.deadline=0;$('timerNote').textContent='Paused.'}
  else{
    if(!aligned()||timer.finished)timer={date:journalDate,mode:'gratitude',remaining:GRATITUDE_SECONDS,deadline:0,finished:false,started:false};
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
  timer={date:journalDate,mode:'gratitude',remaining:GRATITUDE_SECONDS,deadline:0,finished:false,started:false};$('timerNote').textContent='';saveTimer();renderTimer();
};
$('activeSession').onclick=()=>openJournal(timer.date);
$('finishJournal').onclick=()=>{
  const text=$('gratitudeText').value;
  if(!text.trim()){$('timerNote').textContent='Write something you’re grateful for before finishing.';$('gratitudeText').focus();return}
  setRecord({gratitudeText:text,gratitudeDone:true},journalDate);journalSaveStatus();
  if(storageError){$('timerNote').textContent='Your entry could not be saved. Copy your writing before leaving.';return}
  if(aligned()){timer.remaining=0;timer.deadline=0;timer.finished=true;saveTimer()}
  $('journalDialog').close();renderProgress();renderDailyStatus();
};
$('export').onclick=()=>{
  let record=JSON.stringify(state,null,2);if(unreadable){try{record=localStorage.getItem(STORAGE_KEY)||record}catch{}}
  const url=URL.createObjectURL(new Blob([record],{type:'application/json'})),link=document.createElement('a');link.href=url;link.download='attention-reset-'+today+'.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
};

const DAYS_PER_PLANT=15;
let capsuleIndex;
let gardenLeaves;
let stoneCount;
const stoneShapes = [
  "M5 29C4 20 14 13 26 12C39 10 54 14 59 22C64 32 53 39 38 41C24 43 7 40 5 29Z",
  "M12 37C5 32 9 22 18 14C24 8 32 6 40 10C50 16 57 28 54 36C51 44 19 45 12 37Z",
  "M10 22C15 14 26 11 38 12C51 13 59 20 58 30C56 41 43 43 28 41C15 40 4 34 10 22Z",
  "M9 31C7 22 17 20 25 15C35 8 45 9 53 14C60 19 57 32 49 38C39 46 14 44 9 31Z",
  "M10 26C11 17 19 10 29 10C39 10 47 13 53 21C58 28 55 37 46 41C35 46 23 43 15 38C10 35 8 31 10 26Z",
  "M6 31C6 24 13 19 24 17C34 16 43 13 51 16C58 19 61 24 58 31C53 40 42 42 28 42C15 42 6 39 6 31Z"
];

function showView(garden){
  $('homeView').hidden=garden;
  $('gardenView').hidden=!garden;
  $('today').hidden=garden;
  $('homeTab').setAttribute('aria-pressed',String(!garden));
  $('gardenTab').setAttribute('aria-pressed',String(garden));
  window.scrollTo(0,0);
}
$('homeTab').onclick=()=>showView(false);
$('gardenTab').onclick=()=>showView(true);

function drawPlots(leaves){
  if(gardenLeaves===leaves)return;
  gardenLeaves=leaves;
  const count=Math.ceil(leaves/DAYS_PER_PLANT);
  const plots=[];
  for(let index=0;index<count;index++){
    const species=gardenSpecies[index%gardenSpecies.length];
    const growth=Math.min(DAYS_PER_PLANT,leaves-index*DAYS_PER_PLANT);
    const full=growth===DAYS_PER_PLANT;
    const label=full?`Day ${(index+1)*DAYS_PER_PLANT} · Fully grown`:`${growth}/${DAYS_PER_PLANT} days grown`;
    plots.push(`<article class="garden-plot" style="--plot-color:${species.color}"><img src="${species.asset}#day-${growth}" width="120" height="106" alt="" loading="lazy" decoding="async"><strong>${species.name}</strong><p>${label}</p></article>`);
  }
  $('gardenPlots').innerHTML=plots.join('');
  $('nextPlot').hidden=leaves%DAYS_PER_PLANT!==0;
  $('nextPlotTitle').textContent=`Plot ${count+1}`;
}

function renderRewards(){
  const {leaves,entries,capsules}=rewardProgress(state,today);
  drawPlots(leaves);
  $('gardenDays').textContent=`${leaves} completed ${leaves===1?'day':'days'}`;
  const grown=Math.floor(leaves/DAYS_PER_PLANT);
  $('gardenPlants').textContent=`${grown} ${grown===1?'plant':'plants'} grown`;
  const unlocked=capsules.length;
  const remainder=entries%5;
  $('capsuleProgress').textContent=unlocked?`${unlocked} unlocked · ${remainder}/5 entries to next`:`${entries}/5 entries to unlock a stone`;
  const stones=$('stones');
  if(stoneCount!==unlocked){
    stoneCount=unlocked;
    stones.replaceChildren();
    for(let index=0;index<unlocked;index++){
      const button=document.createElement('button');
      button.type='button';
      const shape=stoneShapes[index%stoneShapes.length];
      button.innerHTML=`<svg viewBox="0 0 64 50" aria-hidden="true"><path d="${shape}"/></svg><span>${index+1}</span>`;
      button.setAttribute('aria-label',`Gratitude stone ${index+1}`);
      button.setAttribute('aria-controls','capsuleReveal');
      button.onclick=()=>{
        capsuleIndex=index;
        renderRewards();
        $('closeCapsule').focus();
      };
      stones.append(button);
    }
  }
  if(capsuleIndex!==undefined&&capsuleIndex>=unlocked)capsuleIndex=undefined;
  Array.from(stones.children).forEach((button,index)=>button.setAttribute('aria-pressed',String(index===capsuleIndex)));
  $('capsuleReveal').hidden=capsuleIndex===undefined;
  if(capsuleIndex===undefined)return;
  const key=capsules[capsuleIndex];
  const line=recordFor(state,key).gratitudeText.split(/\r?\n/).find(text=>text.trim()).trim();
  $('capsuleDate').textContent=longDate(key);
  $('capsuleQuote').textContent=line.length>180?line.slice(0,177).trimEnd()+'…':line;
  $('capsulePosition').textContent=`Stone ${capsuleIndex+1} of ${unlocked}`;
  $('capsuleNavigation').hidden=unlocked<2;
  $('olderCapsule').disabled=capsuleIndex===0;
  $('newerCapsule').disabled=capsuleIndex===unlocked-1;
}
$('closeCapsule').onclick=()=>{
  const button=$('stones').children[capsuleIndex];
  capsuleIndex=undefined;
  $('capsuleQuote').textContent='';
  renderRewards();
  button?.focus();
};
$('olderCapsule').onclick=()=>{capsuleIndex--;renderRewards()};
$('newerCapsule').onclick=()=>{capsuleIndex++;renderRewards()};

function refreshToday(){const latest=dateKey();if(latest!==today){const followedToday=selected===today;today=latest;if(followedToday){const d=parseDate(today);selected=today;viewYear=d.getFullYear();viewMonth=d.getMonth()}renderYears();renderTabs();renderProgress();renderDay()}renderTimer()}
document.addEventListener('visibilitychange',()=>{if(!document.hidden)refreshToday()});
window.addEventListener('storage',event=>{if(event.key===STORAGE_KEY&&event.newValue){try{state=normalizeState(JSON.parse(event.newValue),today);renderYears();renderProgress();renderDay();if($('journalDialog').open){$('gratitudeText').value=recordFor(state,journalDate).gratitudeText||'';journalSaveStatus()}}catch{}}});
setInterval(refreshToday,500);renderYears();renderTabs();renderProgress();renderDay();
