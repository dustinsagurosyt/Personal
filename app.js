import { STORAGE_KEY, MONTHS, dateKey, parseDate, monthDates, monthStats, currentStreak, pebbleBalance, PEBBLE_BONUS_INTERVAL, PEBBLE_STREAK_BONUS, normalizeState, recordFor, updateRecord, videoGoal, practiceGoal, complete, rewardProgress } from './model.mjs?v=43';
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
  const streak=currentStreak(state,today);
  $('monthTitle').textContent=MONTHS[viewMonth];$('currentStreak').textContent=streak;$('completedDays').textContent=stats.count;
  renderPebbleProgress(streak);
}

function renderPebbleProgress(streak){
  const pebbles=pebbleBalance(state,today);
  $('pebbleBalance').textContent=`${pebbles} ${pebbles===1?'pebble':'pebbles'}`;
  const progress=streak%PEBBLE_BONUS_INTERVAL;
  const remaining=PEBBLE_BONUS_INTERVAL-progress;
  $('pebbleBonus').textContent=`+${PEBBLE_STREAK_BONUS} pebbles`;
  $('pebbleCountdown').textContent=`${remaining} ${remaining===1?'day':'days'} left`;
  $('pebbleDots').setAttribute('aria-label',`${progress} of ${PEBBLE_BONUS_INTERVAL} days toward the next bonus`);
  $('pebbleDots').innerHTML='<span class="filled"></span>'.repeat(progress)+'<span></span>'.repeat(remaining);

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
  const record=currentRecord(),video=videoGoal(record),practice=practiceGoal(record,selected,state);
  $('gratitudeDone').checked=practice;
  const legacy=selected<state.gratitudeSince && typeof record.gratitudeDone!=='boolean' && typeof record.focus==='boolean';
  $('gratitudeLabel').textContent=legacy?'Previous focus session':'1-minute gratitude';
  $('openJournal').textContent=timer.date===selected&&timer.deadline?'Continue ↗':record.gratitudeText?.trim()?'Read ↗':'Write ↗';
  $('videoMark').classList.toggle('done',video);
  const raw=record.minutes;let message='',tone='';
  if(raw!==''&&raw!==undefined&&raw!==null){const n=Number(raw);if(!Number.isFinite(n)||n<0||n>1440){message='Enter minutes between 0 and 1440.';tone='error'}else if(n>=60){message='60 minutes or more today. Keep the record and begin again with one small step.';tone='error'}}
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
let gardenLeaves;
let pendingGrowth;

const pebblePanelOpen=()=>$('pebbleToggle').getAttribute('aria-expanded')==='true';

function setPebblePanel(open){
  $('pebblePanel').setAttribute('aria-hidden',String(!open));
  $('pebbleToggle').setAttribute('aria-expanded',String(open));
}

$('pebbleToggle').onclick=()=>setPebblePanel(!pebblePanelOpen());
window.addEventListener('scroll',()=>{
  if(pebblePanelOpen())setPebblePanel(false);
},{passive:true});
document.addEventListener('click',event=>{
  if(pebblePanelOpen()&&!$('pebbleToggle').contains(event.target)&&!$('pebblePanel').contains(event.target))setPebblePanel(false);
});
document.addEventListener('keydown',event=>{
  if(event.key==='Escape'&&pebblePanelOpen()){
    setPebblePanel(false);
    $('pebbleToggle').focus();
  }
});

const appTabs=['home','garden','shop'];

function showView(view){
  setPebblePanel(false);
  for(const tab of appTabs){
    const active=tab===view;
    $(tab+'View').hidden=!active;
    $(tab+'Tab').setAttribute('aria-pressed',String(active));
  }
  $('today').hidden=view!=='home';
  window.scrollTo(0,0);
  if(view==='garden')animateEarnedGrowth();
  if(view==='shop')closeShopCategory();
}
for(const tab of appTabs){
  $(tab+'Tab').onclick=()=>showView(tab);
}

const playingPlots=new WeakSet();

async function replayPlant(plot,scroll=false){
  if(!plot||!motionAllowed()||$('gardenView').hidden||playingPlots.has(plot))return;
  const image=plot.querySelector('img');
  const index=Number(plot.dataset.plot);
  const day=Number(plot.dataset.stage);
  const species=gardenSpecies[index%gardenSpecies.length];
  const isCurrent=()=>plot.isConnected&&!$('gardenView').hidden;
  playingPlots.add(plot);
  try {
    const {playGrowth}=await import('./plant-motion.mjs?v=27');
    if(isCurrent()){
      if(scroll)plot.scrollIntoView({block:'nearest',inline:'nearest'});
      await playGrowth(image,species.asset,day,isCurrent);
    }
  } catch {
    // The current stage remains visible if the animation cannot load.
  } finally {
    playingPlots.delete(plot);
  }
}

function animateEarnedGrowth(){
  if(pendingGrowth===undefined||$('gardenView').hidden)return;
  pendingGrowth=undefined;
  replayPlant(document.querySelector('#gardenPlots .garden-plot:last-child'),true);
}

$('gardenPlots').onclick=event=>{
  replayPlant(event.target.closest('.garden-plot'));
};

function drawPlots(leaves){
  if(gardenLeaves===leaves)return;
  if(gardenLeaves!==undefined)pendingGrowth=leaves>gardenLeaves?leaves:undefined;
  gardenLeaves=leaves;
  const count=Math.ceil(leaves/DAYS_PER_PLANT);
  const plots=[];
  for(let index=0;index<count;index++){
    const species=gardenSpecies[index%gardenSpecies.length];
    const growth=Math.min(DAYS_PER_PLANT,leaves-index*DAYS_PER_PLANT);
    const full=growth===DAYS_PER_PLANT;
    const label=full?`Day ${(index+1)*DAYS_PER_PLANT} · Fully grown`:`${growth}/${DAYS_PER_PLANT} days grown`;
    plots.push(`<button type="button" class="garden-plot" data-plot="${index}" data-stage="${growth}" aria-label="Replay ${species.name}, growth stage ${growth} of ${DAYS_PER_PLANT}" style="--plot-color:${species.color}"><img src="${species.asset}#day-${growth}" width="120" height="106" alt="" loading="lazy" decoding="async"><strong>${species.name}</strong><span class="garden-stage">${label}</span></button>`);
  }
  $('gardenPlots').innerHTML=plots.join('');
  $('nextPlot').hidden=leaves%DAYS_PER_PLANT!==0;
  $('nextPlotTitle').textContent=`Plot ${count+1}`;
  animateEarnedGrowth();
}

const shopMilestones = [
  {day:3, title:"Pot Studio"},
  {day:7, title:"Companion Shop"},
  {day:12, title:"Lighting & Ambience"},
  {day:16, title:"Paths & Layout"},
  {day:23, title:"Garden Themes"},
  {day:31, title:"Water Features"},
  {day:45, title:"Structures & Displays"}
];
const shopCatalogs = [
  [
    ["Pot Studio","3 pebbles","Terracotta, sage ceramic, and speckled stone pots."]
  ],
  [
    ["Ladybug","10 pebbles","Crawls between plants and opens its wings when tapped."],
    ["Bumblebee","15 pebbles","Visits flowers and loops when tapped. In a garden without blooms, it rests on a pot rim."],
    ["Pill Bug","20 pebbles","Explores the soil around pots and rolls into a ball when tapped."],
    ["Snail","25 pebbles","Leaves a faint trail as it explores, then peeks out of its shell when tapped."],
    ["Sparrow","30 pebbles","Hops between pot rims in the morning and tilts its head when tapped."],
    ["Garden Gecko","40 pebbles","Basks on a warm stone and scurries to a nearby pot when tapped."],
    ["Cottontail Rabbit","45 pebbles","Hops along the garden edge, sniffs plants, and twitches its ears when tapped."],
    ["Sleepy Cat","55 pebbles","Naps in a sunny spot beside a pot and stretches when tapped."]
  ],
  [
    ["Firefly Lantern","15 pebbles","Warm dusk lighting with drifting fireflies."],
    ["String Lights","Price TBD","Drape warm bulbs between pots or across a trellis."],
    ["Moon Lamps","Price TBD","Place small lamps that cast a cool glow."],
    ["Candle Path","Price TBD","Line the edge of your path with softly flickering candles."]
  ],
  [
    ["Stepping-Stone Path","6 pebbles","A customizable path between garden plots."]
  ],
  [
    ["Seasonal Skins","35 pebbles","Switch between spring blossoms, autumn leaves, and snow."],
    ["Rainy Morning","Price TBD","Soft rain and a misty garden palette."],
    ["Desert Garden","Price TBD","Warm sand tones and a dry garden backdrop."],
    ["Moonlit Garden","Price TBD","Cool nighttime colors and a soft moon glow."]
  ],
  [
    ["Garden Pond","20 pebbles","Lily pads and water that ripples when tapped."],
    ["Birdbath","Price TBD","Add a shallow basin with ripples when a bird lands."],
    ["Stone Fountain","Price TBD","Water trickles over stacked stones."],
    ["Mini Creek","Price TBD","A narrow stream winds between garden plots."]
  ],
  [
    ["Glass Greenhouse","50 pebbles","Display favorite mature plants and replay their growth."],
    ["Plant Shelf","Price TBD","Arrange favorite pots on a tiered shelf."],
    ["Climbing Trellis","Price TBD","Give vines a decorative frame."],
    ["Garden Arch","Price TBD","Frame the entrance with a flowering arch."]
  ]
];
let shopCompletedDays;
let openShopIndex;

function closeShopCategory(returnFocus=false){
  const previous=openShopIndex;
  openShopIndex=undefined;
  $('shopCategory').hidden=true;
  $('shopOverview').hidden=false;
  if(returnFocus&&previous!==undefined)$('shopSummary'+previous).focus();
}

function openShopCategory(index){
  const {title}=shopMilestones[index];
  openShopIndex=index;
  $('shopCategoryTitle').textContent=title;
  $('shopCatalog').innerHTML=shopCatalogs[index].map(([name,price,description])=>
    `<li><div><strong>${name}</strong><span>${price}</span></div><p>${description}</p></li>`
  ).join('');
  $('shopOverview').hidden=true;
  $('shopCategory').hidden=false;
  window.scrollTo(0,0);
  $('shopCategoryTitle').focus({preventScroll:true});
}

$('shopBack').onclick=()=>closeShopCategory(true);
shopMilestones.forEach(({day},index)=>{
  $('shopSummary'+index).onclick=event=>{
    if(shopCompletedDays<day)return;
    event.preventDefault();
    openShopCategory(index);
  };
});

function renderShop(completedDays){
  if(shopCompletedDays===completedDays)return;
  shopCompletedDays=completedDays;
  if(openShopIndex!==undefined&&completedDays<shopMilestones[openShopIndex].day)closeShopCategory();
  const next=shopMilestones.findIndex(({day})=>day>completedDays);
  const milestone=shopMilestones[next]??shopMilestones.at(-1);
  const progress=$('shopUnlockProgress');
  progress.max=milestone.day;
  progress.value=Math.min(completedDays,milestone.day);
  $('shopUnlockHeading').textContent=next<0?'Shop progress':'Next unlock';
  $('shopNextUnlock').textContent=next<0?'All categories unlocked':milestone.title;
  $('shopUnlockCount').textContent=next<0?`${completedDays} days`:`${completedDays} of ${milestone.day} days`;
  $('shopNextArt').innerHTML=$('shopArt'+(next<0?shopMilestones.length-1:next)).innerHTML;
  shopMilestones.forEach(({day},index)=>{
    const ready=completedDays>=day;
    $('shopRung'+index).className=ready?'ready':index===next?'next':'locked';
    $('shopRungStatus'+index).textContent=ready?'Unlocked':index===next?'Up next':`${day} days`;
  });
}

function renderRewards(){
  const {leaves}=rewardProgress(state,today);
  drawPlots(leaves);
  renderShop(leaves);
  $('gardenDays').textContent=`${leaves} completed ${leaves===1?'day':'days'}`;
  const grown=Math.floor(leaves/DAYS_PER_PLANT);
  $('gardenPlants').textContent=`${grown} ${grown===1?'plant':'plants'} grown`;
}

function refreshToday(){const latest=dateKey();if(latest!==today){const followedToday=selected===today;today=latest;if(followedToday){const d=parseDate(today);selected=today;viewYear=d.getFullYear();viewMonth=d.getMonth()}renderYears();renderTabs();renderProgress();renderDay()}renderTimer()}
document.addEventListener('visibilitychange',()=>{if(!document.hidden)refreshToday()});
window.addEventListener('storage',event=>{if(event.key===STORAGE_KEY&&event.newValue){try{state=normalizeState(JSON.parse(event.newValue),today);renderYears();renderProgress();renderDay();if($('journalDialog').open){$('gratitudeText').value=recordFor(state,journalDate).gratitudeText||'';journalSaveStatus()}}catch{}}});
setInterval(refreshToday,500);renderYears();renderTabs();renderProgress();renderDay();
