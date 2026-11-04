import { STORAGE_KEY, MONTHS, dateKey, parseDate, monthDates, monthStats, normalizeState, recordFor, updateRecord, videoGoal, practiceGoal, complete, trackingStart, rewardProgress } from './model.mjs?v=14';
import { gardenSpecies } from './plants.mjs?v=15';

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
  for(let year=upcomingMonth().getFullYear();year>=firstYear();year--){const option=document.createElement('option');option.value=year;option.textContent=year;select.append(option)}
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
  const current=parseDate(today), viewing=new Date(viewYear,viewMonth,1,12);
  const anchor=dateKey(viewing)>today?current:viewing;
  const buttons=[];
  for(let step=-2;step<=1;step++){
    const date=new Date(anchor.getFullYear(),anchor.getMonth()+step,1,12);
    const year=date.getFullYear(),index=date.getMonth(),name=MONTHS[index],active=year===viewYear&&index===viewMonth;
    const key=dateKey(date);
    const button=existing.get(key)||document.createElement('button');
    button.dataset.month=key;
    button.className='month-tab';button.id='month-tab-'+index;button.type='button';button.role='tab';button.textContent=name.slice(0,3);button.setAttribute('aria-label',name+' '+year);button.setAttribute('aria-selected',String(active));button.setAttribute('aria-controls','calendarPanel');button.tabIndex=active?0:-1;button.disabled=year<firstYear()||date>upcomingMonth();
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
  if(animate&&motionAllowed()){
    for(const button of buttons){
      button.getAnimations?.().forEach(animation=>animation.cancel());
      const previous=positions.get(button.dataset.month);
      if(previous===undefined){
        button.animate?.([{opacity:0},{opacity:1}],{duration:210,easing:'ease-out'});
      }else{
        const offset=previous-button.getBoundingClientRect().left;
        if(offset)button.animate?.([{transform:`translateX(${offset}px)`},{transform:'translateX(0)'}],{duration:240,easing:'cubic-bezier(.2,.7,.3,1)'});
      }
    }
  }
  $('calendarPanel').setAttribute('aria-labelledby','month-tab-'+viewMonth);
  $('previousMonth').disabled=viewYear===firstYear()&&viewMonth===0;
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
    button.onkeydown=event=>{const amount={ArrowLeft:-1,ArrowRight:1,ArrowUp:-7,ArrowDown:7}[event.key];if(!amount)return;event.preventDefault();const date=parseDate(key);date.setDate(date.getDate()+amount);const next=dateKey(date);if(next>today||date.getFullYear()<firstYear())return;selectDay(next);requestAnimationFrame(()=>document.querySelector(`[data-date="${next}"]`)?.focus())};grid.append(button);
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
  const direction=Math.sign((date.getFullYear()-viewYear)*12+date.getMonth()-viewMonth);
  if(direction){
    viewMonth=date.getMonth();
    viewYear=date.getFullYear();
    renderYears();
    renderTabs(true);
    animateMonthChange(direction,renderProgress);
  }else{
    renderProgress();
  }
  renderDay();
}
let calendarTransition;
function animateMonthChange(direction,update){
  calendarTransition?.();
  const panel=$('calendarPanel'),grid=$('calendar');
  if(!direction||!motionAllowed()||typeof grid.animate!=='function'){
    update();
    return;
  }
  const height=panel.getBoundingClientRect().height;
  const previous=grid.cloneNode(true);
  previous.removeAttribute('id');
  previous.setAttribute('aria-hidden','true');
  previous.inert=true;
  previous.classList.add('calendar-outgoing');
  previous.style.top=grid.offsetTop+'px';
  update();
  const nextHeight=panel.getBoundingClientRect().height;
  panel.append(previous);
  const options={duration:240,easing:'cubic-bezier(.2,.7,.3,1)'};
  const animations=[
    previous.animate([{transform:'translateX(0)',opacity:1},{transform:`translateX(${-direction*100}%)`,opacity:0}],options),
    grid.animate([{transform:`translateX(${direction*100}%)`,opacity:0},{transform:'translateX(0)',opacity:1}],options),
    panel.animate([{height:height+'px'},{height:nextHeight+'px'}],options)
  ];
  const cleanup=()=>{
    previous.remove();
    animations.forEach(animation=>animation.cancel());
    if(calendarTransition===cleanup)calendarTransition=undefined;
  };
  calendarTransition=cleanup;
  Promise.allSettled(animations.map(animation=>animation.finished)).then(()=>{
    if(calendarTransition===cleanup)cleanup();
  });
}
function showMonth(year,month){
  const target=new Date(year,month,1,12);year=target.getFullYear();month=target.getMonth();
  if(year<firstYear()||target>upcomingMonth())return;
  const direction=Math.sign((year-viewYear)*12+month-viewMonth);
  viewYear=year;viewMonth=month;
  const preferred=Number(selected.slice(8)),maxDay=year===Number(today.slice(0,4))&&month===Number(today.slice(5,7))-1?Number(today.slice(8)):new Date(year,month+1,0).getDate();
  selected=dateKey(new Date(year,month,Math.min(preferred,maxDay),12));
  renderYears();
  renderTabs(Boolean(direction));
  animateMonthChange(direction,renderProgress);
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
    const scale=.24+.76*growth/DAYS_PER_PLANT;
    const label=full?`Day ${(index+1)*DAYS_PER_PLANT} · Fully grown`:`${growth}/${DAYS_PER_PLANT} days grown`;
    plots.push(`<article class="garden-plot" style="--plot-color:${species.color}"><svg viewBox="0 0 120 106" aria-hidden="true"><g transform="translate(60 79) scale(${scale}) translate(-60 -79)">${species.foliage}</g>${species.pot}</svg><strong>${species.name}</strong><p>${label}</p></article>`);
  }
  $('gardenPlots').innerHTML=plots.join('');
  $('nextPlot').hidden=leaves%DAYS_PER_PLANT!==0;
  $('nextPlotTitle').textContent=`Plot ${count+1}`;
}

function renderRewards(){
  const {leaves,branches,entries,capsules}=rewardProgress(state,today);
  drawPlots(leaves);
  $('gardenDays').textContent=`${leaves} completed ${leaves===1?'day':'days'}`;
  const grown=Math.floor(leaves/DAYS_PER_PLANT);
  $('gardenPlants').textContent=`${grown} ${grown===1?'plant':'plants'} grown`;
  $('gardenCount').textContent=`${leaves} ${leaves===1?'leaf':'leaves'} · ${branches} ${branches===1?'branch':'branches'}`;
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
      button.textContent=index+1;
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
