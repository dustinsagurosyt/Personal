import { STORAGE_KEY, MONTHS, dateKey, parseDate, monthDates, monthStats, currentStreak, pebbleBalance, PEBBLE_BONUS_INTERVAL, PEBBLE_STREAK_BONUS, normalizeState, recordFor, updateRecord, videoGoal, practiceGoal, complete, rewardProgress, DAYS_PER_PLANT, POT_PRICES, ownsPot, equipPot, COMPANION_PRICES, COMPANION_FAVORITES, companionHomes, companionUnlockDays, ownsCompanion, buyCompanion } from './model.mjs?v=55';
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
  document.dispatchEvent(new Event('app-progress'));
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
const pendingPotArt=new WeakMap();

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
      await pendingPotArt.get(image);
      if(isCurrent())await playGrowth(image,image.getAttribute('src').split('#')[0],day,isCurrent);
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
  replayPlant(document.querySelector('#gardenPlots .garden-plant-card:last-child .garden-plot'),true);
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
    plots.push(`<div class="garden-plant-card" style="--plot-color:${species.color}"><button type="button" class="garden-plot" data-plot="${index}" data-stage="${growth}" aria-label="Replay ${species.name}, growth stage ${growth} of ${DAYS_PER_PLANT}" style="--plot-color:${species.color}"><img src="${species.asset}#day-${growth}" width="120" height="106" alt="" loading="lazy" decoding="async"><strong>${species.name}</strong><span class="garden-stage">${label}</span></button><div class="plant-companion"></div></div>`);
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
  if(returnFocus&&previous!==undefined){
    playShopOpening($('shopOverview'),true);
    $('shopSummary'+previous).focus();
  }
}

function openShopCategory(index){
  const {title}=shopMilestones[index];
  openShopIndex=index;
  $('shopCategoryTitle').textContent=title;
  $('pot-studio-gallery').hidden=index!==0;
  $('companion-lookbook').hidden=index!==1;
  $('shopCatalog').hidden=index<2;
  $('shopCatalog').innerHTML=(index<2?[]:shopCatalogs[index]).map(([name,price,description])=>
    `<li><div><strong>${name}</strong><span>${price}</span></div><p>${description}</p></li>`
  ).join('');
  $('shopOverview').hidden=true;
  $('shopCategory').hidden=false;
  playShopOpening($('shopCategory'));
  window.scrollTo(0,0);
  $('shopCategoryTitle').focus({preventScroll:true});
}

function initPotStudio(){
 const root=$('pot-studio-gallery');
 const options=[...root.querySelectorAll('[data-pot]')];
 const selection=root.querySelector('.pot-selection');
 for(const option of options){
   option.style.setProperty('--tile',option.querySelector('.pot-art').style.getPropertyValue('--tile'));
 }
 const initial=options.map(option=>option.querySelector('.pot-art svg').cloneNode(true));
 for(const option of options)option.onclick=()=>{
   const activate=option.getAttribute('aria-pressed')!=='true';
   options.forEach((button,i)=>{
     const selected=activate&&button===option;
     button.setAttribute('aria-pressed',String(selected));
     button.querySelector('.pot-art').replaceChildren(selected?button.querySelector('template').content.cloneNode(true):initial[i].cloneNode(true));
   });
   selection.hidden=!activate;
   selection.textContent=activate?option.dataset.name+' · '+option.dataset.desc:'';
 };
}
function initCompanionShop(){
 const root=$('companion-lookbook');
 const picker=root.querySelector('select');
 const groups=[...root.querySelectorAll('[data-pet-group]')];
 const detail=root.querySelector('.large-look');
 const buttons=[...root.querySelectorAll('[data-look]')];
 const clear=()=>{detail.hidden=true;buttons.forEach(button=>button.setAttribute('aria-pressed','false'));};
 picker.onchange=()=>{clear();groups.forEach(group=>group.hidden=group.dataset.petGroup!==picker.value);};
 for(const button of buttons)button.onclick=()=>{
  const show=button.getAttribute('aria-pressed')!=='true';
  clear();
  if(!show)return;
  button.setAttribute('aria-pressed','true');
  detail.style.setProperty('--tile',button.style.getPropertyValue('--tile'));
  detail.querySelector('.large-art').replaceChildren(button.querySelector('svg').cloneNode(true));
  detail.querySelector('strong').textContent=button.dataset.look;
  detail.hidden=false;
 };
}
initPotStudioSheet();
initCompanionShop();

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



async function runShopTransaction(update){
  try{
    const transact=()=>{
      if(unreadable)return 'error';
      const raw=localStorage.getItem(STORAGE_KEY);
      const saved=raw?normalizeState(JSON.parse(raw),today):state;
      const result=update(saved);
      if(!result.state)return result.status;
      const previous=state;
      state=result.state;
      if(saveState())return result.status;
      state=previous;
      return 'error';
    };
    return navigator.locks
      ?await navigator.locks.request(STORAGE_KEY+'-shop-purchase',transact)
      :transact();
  }catch{return 'error';}
}
function setupShopSheet(sheet){
  let motion,closing=false,restoreFocus;
  const canAnimate=()=>motionAllowed()&&sheet.animate;
  function open(opener){
    if(sheet.open)return;
    restoreFocus=opener;
    sheet.showModal();
    if(canAnimate())motion=sheet.animate(
      [{transform:'translateY(100%)'},{transform:'translateY(0)'}],
      {duration:360,easing:'cubic-bezier(.22,1,.36,1)'});
  }
  function close(){
    if(!sheet.open||closing)return;
    const finish=()=>{
      sheet.close();
      sheet.classList.remove('is-closing');
      closing=false;
      restoreFocus?.()?.focus({preventScroll:true});
    };
    if(!canAnimate()){finish();return;}
    closing=true;
    const from=getComputedStyle(sheet).transform;
    motion?.cancel();
    sheet.classList.add('is-closing');
    const exit=motion=sheet.animate([{transform:from},{transform:'translateY(100%)'}],
      {duration:240,easing:'cubic-bezier(.4,0,1,1)',fill:'forwards'});
    exit.finished.then(()=>{finish();exit.cancel();},finish);
  }
  function outside(event){
    if(event.target!==sheet)return false;
    const bounds=sheet.getBoundingClientRect();
    return event.clientX<bounds.left||event.clientX>=bounds.right||
      event.clientY<bounds.top||event.clientY>=bounds.bottom;
  }
  let backdropPressed=false;
  sheet.querySelector('.companion-sheet-close').onclick=close;
  sheet.oncancel=event=>{event.preventDefault();close();};
  sheet.addEventListener('pointerdown',event=>{backdropPressed=outside(event);});
  sheet.addEventListener('pointercancel',()=>{backdropPressed=false;});
  sheet.addEventListener('click',event=>{
    if(backdropPressed&&outside(event))close();
    backdropPressed=false;
  });
  return {open,close,isClosing:()=>closing};
}
function initPotStudioSheet(){
  const root=$('pot-studio-gallery');
  const sheet=document.createElement('dialog');
  sheet.className='companion-detail-sheet';
  sheet.setAttribute('aria-labelledby','pot-sheet-title');
  sheet.innerHTML='<div class="companion-sheet-top"><span>Pot details</span><button type="button" class="companion-sheet-close" autofocus>Close ×</button></div><div class="compare-feature"><span class="pot-sheet-art"></span><span class="companion-price-badge"></span></div><div class="companion-checkout"><div class="companion-checkout-row"><h2 id="pot-sheet-title"></h2><button type="button" class="companion-buy"></button></div><div class="pot-plant-tiles" role="group" aria-label="Garden plants"></div><p role="status"></p></div>';
  root.append(sheet);
  const details=setupShopSheet(sheet);
  const options=[...root.querySelectorAll('[data-pot]')];
  const grid=root.querySelector('.pot-grid');
  grid.append(...[...options].sort((a,b)=>POT_PRICES[a.dataset.pot]-POT_PRICES[b.dataset.pot]));
  const tiles=sheet.querySelector('.pot-plant-tiles');
  const preview=sheet.querySelector('.pot-sheet-art');
  const buy=sheet.querySelector('.companion-buy');
  const status=sheet.querySelector('[role="status"]');
  const variants=new Map();
  let selected=0,selectedPlot=null,busy=false,notice='';
  const equippedPlot=pot=>Object.keys(state.equippedPots||{}).find(plot=>state.equippedPots[plot]===pot);
  const plantName=plot=>gardenSpecies[Number(plot)%gardenSpecies.length]?.name;
  const potLabel=pot=>pot===0?'Default':ownsPot(state,pot)?'Owned':POT_PRICES[pot]+' pebbles';
  function updatePotCards(){
    for(const option of options){
      const pot=Number(option.dataset.pot);
      const home=pot>0&&plantName(equippedPlot(pot));
      option.querySelector('.pot-label span').textContent=home?'On '+home:potLabel(pot);
    }
  }
  function updateSheet(){
    const plots=[...$('gardenPlots').querySelectorAll('.garden-plot')];
    const target=plots.find(plot=>plot.dataset.plot===selectedPlot)||plots[0];
    selectedPlot=target?.dataset.plot??null;
    tiles.replaceChildren(...plots.map(plot=>{
      const item=document.createElement('button');
      const name=plot.querySelector('strong').textContent;
      const thumbnail=document.createElement('img');
      thumbnail.src=plot.querySelector('img').getAttribute('src');
      thumbnail.alt='';
      thumbnail.loading='lazy';
      item.type='button';
      item.className='pot-plant-tile';
      item.dataset.plot=plot.dataset.plot;
      item.setAttribute('aria-pressed',String(plot===target));
      item.disabled=busy;
      item.append(thumbnail,name);
      return item;
    }));
    if(target){
      const name=target.querySelector('strong').textContent;
      const image=document.createElement('img');
      const suffix='#day-'+target.dataset.stage;
      image.src=gardenSpecies[Number(selectedPlot)%gardenSpecies.length].asset+suffix;
      Promise.resolve(plantAssetWithPot(Number(selectedPlot),selected)).then(asset=>{
        if(image.parentElement===preview)image.src=asset+suffix;
      });
      image.alt=name+' in the '+options[selected].dataset.name+' pot';
      preview.replaceChildren(image);
    }else{
      preview.replaceChildren(options[selected].querySelector('.pot-art svg').cloneNode(true));
    }
    const owned=ownsPot(state,selected);
    const home=selected>0&&plantName(equippedPlot(selected));
    sheet.querySelector('.companion-price-badge').textContent=potLabel(selected);
    const equipped=target&&state.equippedPots?.[selectedPlot]===selected;
    const shortfall=owned?0:Math.max(0,POT_PRICES[selected]-pebbleBalance(state,today));
    buy.disabled=busy||!plots.length||equipped||shortfall>0;
    buy.textContent=busy?'Saving…':equipped?'Equipped':home?'Move':owned?'Equip':'Buy';
    status.textContent=notice||(!plots.length?'Grow a plant to equip a pot.':shortfall?'You need '+shortfall+(shortfall===1?' more pebble.':' more pebbles.'):'');
  }
  tiles.onclick=event=>{
    const tile=event.target.closest('.pot-plant-tile');
    if(!tile||busy)return;
    selectedPlot=tile.dataset.plot;
    notice='';
    updateSheet();
    [...tiles.children].find(button=>button.dataset.plot===selectedPlot)?.focus({preventScroll:true});
  };
  buy.onclick=async()=>{
    if(busy||details.isClosing()||buy.disabled)return;
    const plot=Number(selectedPlot);
    const pot=selected;
    busy=true;
    updateSheet();
    const result=await runShopTransaction(saved=>equipPot(saved,pot,plot,today,
      Math.ceil(rewardProgress(saved,today).leaves/DAYS_PER_PLANT)));
    busy=false;
    notice=result==='error'?'Could not save the pot. Your wallet was not charged.'
      :result==='insufficient'?'Your wallet does not have enough pebbles.'
      :result==='unavailable'?'That plant is not available.':'';
    renderProgress();
  };
  function plantAssetWithPot(index,pot){
      const base=gardenSpecies[index%gardenSpecies.length].asset;
      if(Number.isInteger(pot)&&options[pot]){
        const key=(index%gardenSpecies.length)+':'+pot;
        if(!variants.has(key)){
          const variant=fetch(base).then(response=>{
            if(!response.ok)throw new Error('Plant art unavailable');
            return response.text();
          }).then(source=>{
          const svg=new DOMParser().parseFromString(source,'image/svg+xml');
          const potArt=options[pot].querySelector('.pot-art svg');
          for(const frame of svg.documentElement.children){
            const parts=[...frame.children];
            const start=parts.findIndex(part=>part.localName==='ellipse'&&part.getAttribute('cy')==='102');
            if(start<0)continue;
            parts.slice(start).forEach(part=>part.remove());
            frame.append(...[...potArt.children].map(part=>svg.importNode(part,true)));
          }
          return 'data:image/svg+xml,'+encodeURIComponent(new XMLSerializer().serializeToString(svg));
          }).catch(()=>{
            variants.delete(key);
            return base;
          });
          variants.set(key,variant);
        }
        return variants.get(key);
      }
      return base;
  }
  function applyGardenPots(){
    for(const plot of $('gardenPlots').querySelectorAll('.garden-plot')){
      const index=Number(plot.dataset.plot);
      const pot=state.equippedPots?.[index];
      const image=plot.querySelector('img');
      const asset=plantAssetWithPot(index,ownsPot(state,pot)?pot:undefined);
      const apply=source=>{
        const src=source+'#day-'+plot.dataset.stage;
        if(image.getAttribute('src')!==src)image.setAttribute('src',src);
      };
      if(typeof asset==='string')apply(asset);
      else pendingPotArt.set(image,asset.then(source=>{
        if(plot.isConnected&&state.equippedPots?.[index]===pot)apply(source);
      }));
    }
  }
  for(const option of options){
    const art=option.querySelector('.pot-art');
    const pot=Number(option.dataset.pot);
    const shadow=art.querySelector('ellipse[cy="102"]');
    if(shadow){
      const width=[20,20,20,20,20,20,17,14,12,20,20,20,20,20,12][pot];
      shadow.setAttribute('rx',width);
      shadow.setAttribute('ry','2.35');
      shadow.setAttribute('transform','translate(0 -2.4)');
    }
    const tile=art.style.getPropertyValue('--tile');
    option.style.setProperty('--tile',tile);
    option.removeAttribute('aria-pressed');
    option.setAttribute('aria-haspopup','dialog');
    option.onclick=()=>{
      if(sheet.open)return;
      selected=Number(option.dataset.pot);
      selectedPlot=equippedPlot(selected)??selectedPlot;
      notice='';
      sheet.querySelector('.compare-feature').style.setProperty('--tile',tile);
      sheet.querySelector('#pot-sheet-title').textContent=option.dataset.name;
      updateSheet();
      details.open(()=>option);
    };
  }
  document.addEventListener('app-progress',()=>{
    applyGardenPots();
    updatePotCards();
    if(sheet.open&&openShopIndex!==0)details.close();
    else if(sheet.open)updateSheet();
  });
}
function playShopOpening(panel,back=false){
  if(!motionAllowed()||!panel.animate)return;
  const direction=back?-1:1;
  panel.animate([
    {opacity:.55,transform:'translateY('+(12*direction)+'px) scale(.975)'},
    {opacity:1,transform:'translateY('+(-direction)+'px) scale(1.002)',offset:.8},
    {opacity:1,transform:'translateY(0) scale(1)'}
  ],{duration:300,easing:'cubic-bezier(.22,.68,.31,1)'});
}

function companionReaction(svg,species,roll){
  const original=svg.innerHTML;
  const ns='http://www.w3.org/2000/svg';
  const group=nodes=>{
    if(!nodes.length)return null;
    const wrapper=document.createElementNS(ns,'g');
    nodes[0].before(wrapper);
    wrapper.append(...nodes);
    return wrapper;
  };
  const paths=(...prefixes)=>[...svg.querySelectorAll('path')].filter(node=>prefixes.some(prefix=>node.getAttribute('d').startsWith(prefix)));
  const transform=(node,value)=>node?.setAttribute('transform',value);
  const ease=x=>{const v=Math.max(0,Math.min(1,x));return v*v*(3-2*v);};
  const pulse=(t,a,b,c,d)=>ease((t-a)/(b-a))*(1-ease((t-c)/(d-c)));
  let duration=950,draw;

  if(species===2){
    const shell=paths('M18 35')[0];
    const seams=paths('M22 38')[0];
    const shadow=svg.firstElementChild;
    const centerX=34,centerY=27,ballRadius=16;
    const shellLength=shell.getTotalLength();
    const outline=Array.from({length:64},(_,i)=>{
      const {x,y}=shell.getPointAtLength(shellLength*i/64);
      const angle=Math.atan2(y-centerY,x-centerX);
      return [x,y,centerX+ballRadius*Math.cos(angle),centerY+ballRadius*Math.sin(angle)];
    });
    const rest=group([...svg.children].slice(4));
    const ribs=document.createElementNS(ns,'path');
    ribs.setAttribute('fill','none');
    ribs.setAttribute('stroke',seams.getAttribute('stroke')||'#b9c4b4');
    ribs.setAttribute('stroke-width','1.2');
    ribs.setAttribute('stroke-linecap','round');
    ribs.setAttribute('opacity','0');
    seams.after(ribs);
    duration=1720;
    draw=t=>{
      const close=ease((t-.05)/.29);
      const open=ease((t-.69)/.31);
      const bend=close*(1-open);
      const tuck=ease(t/.19)*(1-ease((t-.82)/.18));
      const travel=roll?.(ease((t-.34)/.35))||0;
      const spin=travel/ballRadius;
      if(t>0&&t<1){
        shell.setAttribute('d',outline.map(([x,y,bx,by],i)=>(i?'L':'M')+
          (x+(bx-x)*bend).toFixed(2)+' '+(y+(by-y)*bend).toFixed(2)).join('')+'Z');
      }
      shadow.setAttribute('rx',15-5*bend);
      shadow.setAttribute('ry',2.4-.6*bend);
      shadow.setAttribute('opacity',.82+.18*bend);
      rest?.setAttribute('opacity',1-tuck);
      rest?.setAttribute('transform','translate(0 '+(-4*tuck)+')');
      seams.setAttribute('opacity',1-ease(bend/.64));
      ribs.setAttribute('opacity',ease((bend-.31)/.57));
      ribs.setAttribute('d',Array.from({length:6},(_,i)=>{
        const angle=i*Math.PI/3+spin;
        const c=Math.cos(angle),n=Math.sin(angle);
        return 'M'+(centerX+14*c)+' '+(centerY+14*n)+'Q'+(centerX+10*c+3*n)+' '+
          (centerY+10*n-3*c)+' '+(centerX+6*c)+' '+(centerY+6*n);
      }).join(''));
    };
  }else if(species===0){
    const beetle=svg.querySelector('g[transform]');
    const cover=paths('M23 32')[0];
    const color=cover?.getAttribute('fill')||'#c66352';
    const originalMark=cover?.nextElementSibling?.nextElementSibling;
    const split=document.createElementNS(ns,'g');
    split.innerHTML='<path d="M35 20q-13-1-13 12 0 8 13 8Z" fill="'+color+'"/><path d="M35 20q13-1 13 12 0 8-13 8Z" fill="'+color+'"/>';
    const underside=document.createElementNS(ns,'ellipse');
    underside.setAttribute('cx','35');underside.setAttribute('cy','29');underside.setAttribute('rx','7');underside.setAttribute('ry','11');underside.setAttribute('fill','#d9cdb0');
    cover?.before(underside,split);
    duration=1050;
    draw=t=>{
      const f=pulse(t,.06,.38,.68,.98);
      underside.setAttribute('opacity',f);
      split.setAttribute('opacity',Math.min(1,f*5));
      if(cover)cover.style.opacity=String(1-Math.min(1,f*5));
      if(originalMark)originalMark.style.opacity=String(1-Math.min(1,f*5));
      transform(split.firstElementChild,'rotate('+48*f+' 35 20)');
      transform(split.lastElementChild,'rotate('+(-48*f)+' 35 20)');
      if(beetle)beetle.style.transformOrigin='35px 30px';
    };
  }else if(species===1){
    const body=group([...svg.children].slice(3));
    const wings=paths('M33 26','M35 26');
    const feet=svg.querySelector('.garden-bee-feet');
    duration=1080;
    draw=t=>{
      const angle=t*Math.PI*2, radius=7*Math.sin(Math.PI*t);
      transform(body,'translate('+Math.sin(angle)*radius+' '+(-Math.sin(Math.PI*t)*11)+') rotate('+Math.sin(angle)*18+' 34 29)');
      const flight=Math.sin(Math.PI*t);
      svg.parentElement.groundShadow?.style.setProperty('--reaction-contact',1-flight);
      setBeeFlight(wings,feet,t*1.08,flight,1-flight);
    };
  }else if(species===3){
    const shell=paths('M20 37','M24 32');
    const feelers=group([...paths('m51 27'),...svg.querySelectorAll('circle[cx="49"],circle[cx="60"]')]);
    const foot=paths('M13 39')[0];
    const shellFront=document.createElementNS(ns,'path');
    shellFront.setAttribute('d','M41 35q6-2 7-8-1 10-6 12Z');shellFront.setAttribute('fill','#9a765d');
    shell.at(-1)?.after(shellFront);
    duration=1250;
    draw=t=>{
      const f=pulse(t,.04,.33,.57,.91);
      transform(feelers,'translate('+(-11*f)+' '+(5*f)+') scale(1 '+(1-.08*f)+')');
      feelers?.setAttribute('opacity',1-f*.93);
      if(foot)foot.setAttribute('d','M13 39H41Q'+(43-5*f)+' '+(26+8*f)+' '+(52-8*f)+' '+(26+8*f)+'q6 0 6 8-1 9-14 9H13Z');
      shellFront.setAttribute('opacity',f);
    };
  }else if(species===4){
    const head=group([...svg.querySelectorAll('circle[cx="43"],circle[cx="46"]'),...paths('m49 19')]);
    const wing=paths('M23 27')[0];
    duration=900;
    draw=t=>{
      const f=pulse(t,.05,.24,.54,.9);
      transform(head,'rotate('+(-17*f)+' 40 27)');
      transform(wing,'rotate('+(-Math.abs(Math.sin(t*26))*14*f)+' 30 29)');
    };
  }else if(species===5){
    const tail=paths('M34 33')[0];
    const legs=paths('m30 29')[0];
    const button=svg.parentElement;
    const card=button.closest('.garden-plant-card');
    const bounds=card.getBoundingClientRect();
    const plant=card.querySelector('img').getBoundingClientRect();
    const gecko=svg.getBoundingClientRect();
    const origin=button.companionPosition;
    const potX=plant.left+plant.width/2;
    const startX=gecko.left+gecko.width/2;
    const startY=gecko.top+gecko.height/2;
    const side=startX<potX?-1:1;
    // Tuck into the near edge of the pot, leaving a head or tail outside its silhouette.
    const edge=potX+side*plant.width*17/120;
    const inset=gecko.width*.08;
    const margin=gecko.width*.4+2;
    const targetX=Math.max(bounds.left+margin,Math.min(bounds.right-margin,edge-side*inset));
    const targetY=plant.top+plant.height*89/106;
    const dx=targetX-startX;
    const dy=targetY-startY;
    duration=1850;
    draw=t=>{
      const f=pulse(t,.04,.32,.69,.96);
      const stepping=(t>.04&&t<.32)||(t>.69&&t<.96);
      const stride=stepping?Math.sin(f*Math.max(12,Math.hypot(dx,dy)*.75)):0;
      button.style.translate=(origin.x+dx*f)+'px '+(origin.y+dy*f)+'px';
      placeCompanionShadow(button,origin.x+dx*f,origin.y+dy*f);
      setCompanionDepth(button,origin.behind||(t>.05&&t<.95));
      transform(tail,'rotate('+(-10*stride)+' 34 33)');
      if(legs)legs.setAttribute('d',geckoStandingLegs(stride));
    };
  }else if(species===6){
    const ears=paths('M42 25','m42 12');
    const [outline,inner]=ears;
    const ear=outline?.getAttribute('fill')||'#b8a089';
    const edge=outline?.getAttribute('stroke')||'#a18a74';
    const pink=inner?.getAttribute('stroke')||'#d8b2a7';
    const front=group(ears);
    const rear=document.createElementNS(ns,'g');
    front?.before(rear);
    if(front){
      front.innerHTML='<path d="M42 25q-7-14-2-19 5 0 7 17" fill="'+ear+'" stroke="'+edge+'"/><path d="m42 12 3 10" stroke="'+pink+'" stroke-width="1.5" stroke-linecap="round"/>';
      rear.innerHTML='<path d="M47 25q-1-16 5-17 4 3 0 17" fill="'+ear+'" stroke="'+edge+'"/><path d="m52 12-2 10" stroke="'+pink+'" stroke-width="1.5" stroke-linecap="round"/>';
    }
    duration=880;
    draw=t=>{
      const f=pulse(t,.04,.2,.65,.92);
      transform(front,'rotate('+(Math.sin(t*29)*11*f)+' 46 25)');
      transform(rear,'rotate('+(Math.sin(t*29-1)*5*f)+' 51 25)');
    };
  }else{
    const face=group([...paths('m34 30','M36 24','M39 30','M45 40')]);
    const body=paths('M16 35')[0],tail=paths('M28 38')[0];
    duration=1350;
    draw=t=>{
      const f=pulse(t,.03,.41,.63,.98);
      transform(face,'translate('+(6*f)+' '+(-2*f)+') rotate('+(-4*f)+' 45 35)');
      transform(body,'translate('+(-3*f)+' '+(3*f)+') scale('+(1+.13*f)+' '+(1-.07*f)+')');
      transform(tail,'rotate('+(-24*f)+' 26 38)');
    };
  }
  return new Promise(resolve=>{
    let start;
    function tick(now){
      if(!svg.isConnected){resolve();return;}
      start??=now;
      const t=Math.min((now-start)/duration,1);
      draw(t);
      if(t<1)requestAnimationFrame(tick);
      else{svg.innerHTML=original;resolve();}
    }
    requestAnimationFrame(tick);
  });
}


function geckoStandingLegs(stride=0){
  return 'm30 29q-4 1 '+(-3-stride*2)+' 6l-2 1m6-2q-1 3 '+(-1+stride*2)+' 5h-2'+
    'm12-12q1 2 '+(2+stride*2)+' 5h2m-3 1q1 2 '+(2-stride*2)+' 5h2';
}

// Landmarks are in the plant art's 120 × 106 coordinate space.
function hasCompanionPerch(index,plot){
  const favoritePlot={0:'12',1:'2',4:'5'}[index];
  return plot.dataset.plot===favoritePlot&&Number(plot.dataset.stage)===DAYS_PER_PLANT;
}
const gardenWalks=[
  // Across, lift, bank, facing, time, landing lane, behind plant.
  // Ladybug: dip around the far side of the pot, then climb back to the leaf.
  [[0,0,0,0,0],[0,0,0,0,.1],[.04,-9,-6,0,.2],[.6,-8,8,0,.34,19],[.95,-5,10,0,.45,45],[.96,-2,0,0,.55,48,true],[.53,-2,-7,0,.67,48,true],[.13,-2,-7,0,.77,48,true],[-.28,-8,-5,0,.83,25],[-.18,-8,3,0,.89,0],[0,-3,0,0,.93],[0,0,0,0,.96],[0,0,0,0,1]],
  // Bee: two continuous lobes with one pass in front and one behind.
  [[0,0,0,0,0],[.43,-13,-8,0,.14],[.97,-2,10,0,.29],[.7,13,8,0,.42,0,true],[.33,6,-5,0,.52,0,true],[-.24,17,-9,0,.66,0,true],[-.36,3,5,0,.78],[.08,-10,8,0,.9],[0,0,0,0,1]],
  // Pill bug: cross in front, then take a back lane through the pot's silhouette.
  [[0,0,0,0,0],[.44,0,0,0,.19],[.44,0,0,0,.28],[.98,0,0,0,.45],[1,0,0,180,.56,-17],[.8,0,0,180,.61,-17,true],[.43,0,0,180,.73,-17,true],[.2,0,0,180,.85,-17,true],[0,0,0,180,.94,-9],[0,0,0,0,1]],
  // Snail: a wide turn beyond the pot before gliding across its back lane.
  [[0,0,0,0,0],[.25,0,0,0,.16,4],[.25,0,0,0,.24,4],[.76,0,0,0,.43,4],[.98,0,0,0,.53,0],[1,0,0,180,.62,-9,true],[.75,0,0,180,.69,-9,true],[.57,0,0,180,.75,-9,true],[.34,0,0,180,.81,-9,true],[.14,0,0,180,.87,-9,true],[-.07,0,0,180,.94,-5],[0,0,0,0,1]],
  // Sparrow: two hops, a perch, then one longer flight behind the leaves.
  [[0,0,0,0,0],[.25,-14,-5,0,.12],[.43,0,0,0,.24,-7],[.43,0,0,0,.35,-7],[.68,-13,-5,0,.45,-7],[.94,0,0,0,.56,-3],[.96,0,0,180,.7,-8],[.52,-19,3,180,.8,-8,true],[.13,-9,3,180,.9,-4,true],[0,0,0,0,1]],
  // Gecko: quick dash behind the pot, wait in cover, then emerge.
  [[0,0,0,0,0],[.09,0,0,0,.15],[.48,0,0,0,.25,-16,true],[.48,0,0,0,.49,-16,true],[.94,0,0,0,.61,-16,true],[.96,0,0,180,.71,1],[.39,0,0,180,.84,3],[.04,0,0,180,.91,1],[0,0,0,0,1]],
  // Rabbit: short, short, long, then a pause before the return hops.
  [[0,0,0,0,0],[.11,-11,-5,0,.08],[.24,0,0,0,.15,1],[.34,-10,-5,0,.22,1],[.44,0,0,0,.29,2],[.44,0,0,0,.38,2],[.69,-20,-6,0,.49,2],[.92,0,0,0,.57,2],[1,0,0,180,.65,-8],[.76,-7,4,180,.71,-8,true],[.57,0,0,180,.77,-8,true],[.37,-7,4,180,.83,-8,true],[.22,0,0,180,.89,-8,true],[.08,-5,0,180,.95,-4],[0,0,0,0,1]],
  // Cat: an unhurried circuit around the whole pot.
  [[0,0,0,0,0],[.38,0,0,0,.16,4],[.79,0,0,0,.34,3],[1,0,0,180,.48,-15],[.53,0,0,180,.62,-19,true],[.08,0,0,180,.78,-17,true],[-.12,0,0,180,.86,-13],[0,0,0,0,1]]
];
const gardenWalkDurations=[3150,2400,3100,9000,3800,2500,3950,5200];

// Alternate outings use the same home position as the regular routes.
const alternateGardenWalks=[
  // Ladybug: land at the far edge, crawl behind the pot, then fly back.
  {duration:4400,route:[[0,0,0,0,0],[0,0,0,0,.1],[.32,-12,-6,0,.22],[.93,-9,7,0,.33,36],[.93,0,0,0,.43,48],[.93,0,0,180,.52,48],[.64,0,0,180,.61,48,true],[.38,0,0,180,.69,48,true],[.14,0,0,180,.76,48,true],[-.24,-11,-7,180,.84,22],[-.14,-8,2,0,.9],[0,-3,0,0,.94],[0,0,0,0,.97],[0,0,0,0,1]]},
  // Bumblebee away from its sunflower: fly out and hover, then return to its perch.
  {duration:3900,route:[[0,0,0,0,0],[.26,-13,-5,0,.2],[.92,-5,5,0,.4],[.95,-3,0,0,.52],[.9,-4,-3,0,.61],[.49,-12,-6,0,.77],[.05,-6,0,0,.92],[0,0,0,0,1]]},
  // Pill bug: inspect the base, slip behind the rim of the pot, then scuttle home.
  {duration:3650,route:[[0,0,0,0,0],[.19,0,0,0,.16,-4],[.19,0,0,0,.29,-4],[.42,0,0,0,.39,-13],[.51,0,0,0,.48,-19,true],[.69,0,0,0,.63,-18,true],[.8,0,0,180,.74,1],[.32,0,0,180,.88,3],[0,0,0,0,1]]},
  // Snail: follow the pot's base, pause with its feelers out, then glide home.
  {duration:9800,route:[[0,0,0,0,0],[.21,0,0,0,.18,4],[.57,0,0,0,.34,4],[.57,0,0,0,.52,4],[.93,0,0,0,.63,1],[1,0,0,180,.71,-10,true],[.74,0,0,180,.77,-11,true],[.52,0,0,180,.82,-11,true],[.28,0,0,180,.87,-11,true],[.05,0,0,180,.93,-9,true],[-.08,0,0,180,.96,-4],[0,0,0,0,1]]},
  null,
  // Gecko: dash to the far side, bask, then take the long way home.
  {duration:4350,route:[[0,0,0,0,0],[.52,0,0,0,.15,3],[.93,0,0,0,.27,2],[.93,0,0,0,.51,2],[.99,0,0,180,.62,-12],[.69,0,0,180,.73,-18,true],[.22,0,0,180,.85,-16,true],[0,0,0,180,.94,-6],[0,0,0,0,1]]},
  // Rabbit: hop toward the pot, stop to sniff, then bound home behind the pot.
  {duration:4500,route:[[0,0,0,0,0],[.19,-11,-5,0,.11],[.4,0,0,0,.21,-3],[.4,0,0,0,.45,-3],[.63,-16,-6,0,.55,2],[.84,0,0,0,.65,3],[.93,0,0,180,.72,-8],[.69,-6,4,180,.77,-8,true],[.5,0,0,180,.82,-8,true],[.29,-5,4,180,.87,-8,true],[.16,0,0,180,.92,-8,true],[.07,-5,2,180,.96,-4],[0,0,0,0,1]]},
  // Cat: take a few steps toward the pot, pause, then stroll around its side.
  {duration:6200,route:[[0,0,0,0,0],[.34,0,0,0,.18,4],[.34,0,0,0,.36,4],[.7,0,0,0,.54,4],[.88,0,0,180,.67,-14],[.58,0,0,180,.77,-18,true],[.17,0,0,180,.9,-18,true],[0,0,0,0,1]]}
];
const useAlternateGardenWalk=new WeakMap();
const ladybugFlights=[
  {route:gardenWalks[0],duration:5800,bursts:[[.1,.18,.92,.96]]},
  {route:alternateGardenWalks[0].route,duration:6600,bursts:[[.1,.18,.37,.43],[.76,.83,.94,.97]]},
  // A short crossing between two strawberry leaves, with a pause on each leaf.
  {duration:6100,bursts:[[.13,.22,.37,.43],[.64,.73,.88,.94]],route:[
    [0,0,0,0,0],[0,0,0,0,.13],[.09,-6,-4,0,.23],[.42,-9,4,0,.32],
    [.61,-4,2,0,.38,-3],[.65,0,0,0,.43,-3],[.65,0,0,0,.64,-3],
    [.57,-7,-5,0,.74,-3],[.2,-8,-3,0,.84],[.04,-4,0,0,.9],[0,0,0,0,.94],[0,0,0,0,1]
  ]},
  // A few steps along the home leaf and a low flutter back to the starting spot.
  {duration:5400,bursts:[[.43,.53,.8,.89]],route:[
    [0,0,0,0,0],[0,0,0,0,.12],[.09,0,0,0,.3,3],[.09,0,0,0,.43,3],
    [.18,-6,-5,0,.56],[.14,-8,3,0,.66],[-.07,-5,-2,0,.77],
    [-.035,-3,0,0,.83],[0,0,0,0,.89],[0,0,0,0,1]
  ]}
];
const nextLadybugFlight=new WeakMap();

// Lift off vertically, fly out into open air, hover, then descend feet first.
const sunflowerBeeHoverRoute=[
  [0,0,0,0,0],[0,0,0,0,.09],[.03,-9,-5,0,.17],[.32,-12,-12,0,.27],
  [.84,-4,-5,0,.39],[1,4,5,0,.47],[.97,6,0,0,.53],[1,4,-2,0,.58],
  [.73,-7,8,0,.69],[.27,-12,4,0,.79],[.025,-9,0,0,.86],
  [0,-3,0,0,.91],[0,0,0,0,.95],[0,0,0,0,1]
];

// The earlier wide circuit uses the same final approach and perch.
const sunflowerBeeLoopRoute=[
  [0,0,0,0,0],[0,0,0,0,.09],[.25,-9,-8,0,.21],[.85,0,9,0,.33],
  [1,19,12,0,.43],[.59,33,2,0,.54],[-.52,32,-9,0,.65],
  [-1,17,-10,0,.75],[-.65,-7,4,0,.83],[-.25,-7,1,0,.89],
  [0,0,0,0,.95],[0,0,0,0,1]
];
const sunflowerBeePetalRoute=[
  [0,0,0,0,0],[0,0,0,0,.09],[-.39,-8,-6,0,.23],[-.76,1,-4,0,.35],
  [-.79,7,0,0,.45],[-.7,10,4,0,.53],[-.33,13,4,0,.63],[.43,8,5,0,.74],
  [.28,-8,-2,0,.84],[.04,-6,0,0,.89],[0,0,0,0,.95],[0,0,0,0,1]
];
const sunflowerBeeFlights=[sunflowerBeeLoopRoute,sunflowerBeeHoverRoute,sunflowerBeePetalRoute];
const nextSunflowerBeeFlight=new WeakMap();

function setBeeFlight(wings,feet,time,flight,reach){
  wings.forEach((wing,index)=>{
    const phase=time*78-index*.65;
    const sweep=Math.sin(phase);
    const vertical=1-flight*(.39+.33*Math.cos(phase));
    wing.setAttribute('transform','translate(35 26) rotate('+sweep*16*flight+') scale(1 '+vertical+') translate(-35 -26)');
  });
  if(feet)feet.setAttribute('d','M32 35q'+(-3+4*reach)+' 3 '+(-3+6*reach)+' '+(2+5*reach)+
    'm8 '+(-2-5*reach)+'q'+(-2+3*reach)+' 3 '+(-2+5*reach)+' '+(2+5*reach));
}

// Use real contact points and movement phases for each species.
const treeSparrowRoute=[
  [0,0,0,0,0],[0,0,0,0,.08],[.06,-8,-7,0,.15],[.32,-18,-6,0,.23],
  [.66,-15,-2,0,.32],[.9,-7,5,0,.4],[1,0,0,0,.48,-3],
  [1,0,0,0,.58,-3],[1,0,0,180,.64,-3],[.84,-14,5,180,.72,-3],
  [.44,-16,1,180,.8,-2],[.13,-7,-5,180,.88],[0,0,0,180,.94],[0,0,0,0,1]
];
const groundSparrowRoute=[
  [0,0,0,0,0],[0,0,0,0,.07],[.37,-10,-6,0,.16],[.92,-12,7,0,.27,30],
  [1,0,0,0,.39,55],[1,0,0,0,.47,55],[.98,0,0,180,.53,55],
  [.78,-6,1,180,.57,55],[.62,0,0,180,.62,55],[.62,0,0,180,.69,55],
  [.41,-17,-6,180,.77,36],[.15,-15,-3,180,.86,9],[0,0,0,180,.95],[0,0,0,0,1]
];
const rimSparrowRoute=[
  [0,0,0,0,0],[0,0,0,0,.1],[-.38,-9,-9,0,.2],[-.52,-13,0,0,.31,21],
  [-.16,-9,7,0,.42,31],[.11,0,0,0,.5,36],[.11,0,0,0,.64,36],
  [.49,-14,-8,0,.73,25],[.81,-14,-4,0,.81,7,true],[.45,-10,4,180,.89,1,true],
  [0,0,0,180,.96],[0,0,0,0,1]
];
const sparrowFlights=[
  {route:treeSparrowRoute,duration:4500,twig:[.48,.94],glides:[[.24,.38],[.76,.87]],landings:[.48,.94]},
  {route:groundSparrowRoute,duration:5050,twig:[.95],glides:[[.22,.35],[.81,.88]],landings:[.39,.62,.95]},
  {route:rimSparrowRoute,duration:4700,twig:[.96],glides:[[.29,.42],[.8,.89]],landings:[.5,.96]}
];
const nextSparrowFlight=new WeakMap();

function swayPlantOnLanding(plant){
  return plant.animate([
    {transform:'rotate(0deg)'},
    {transform:'rotate(.55deg)',offset:.2},
    {transform:'rotate(-.24deg)',offset:.46},
    {transform:'rotate(.08deg)',offset:.7},
    {transform:'rotate(0deg)'}
  ],{duration:275,easing:'ease-out'});
}

function drawSparrowWings(wing,farWing,time,t,airborne,flight){
  if(!airborne){
    wing.setAttribute('d','M23 27q9-3 15 2-5 7-14 6Z');
    farWing.removeAttribute('d');
    return;
  }
  const glide=flight?.glides.some(([start,end])=>t>start&&t<end);
  const flare=flight?.landings.some(landing=>t>landing-.07&&t<landing);
  const lift=glide?0:Math.sin(time*42)*(flare?4:9);
  const spread=glide?1:flare?.94:.86;
  const tipX=25-17*spread;
  const tipY=23+lift-(flare?3:0);
  wing.setAttribute('d','M25 28Q17 '+(tipY-4)+' '+tipX+' '+tipY+'Q'+
    (tipX+3)+' '+(tipY+6)+' 18 '+(tipY+8)+'Q23 34 34 31Z');
  farWing.setAttribute('d','M32 27Q38 '+(tipY-7)+' 47 '+(tipY-7)+'Q45 '+tipY+' 36 31Z');
}

// Two destinations in addition to each companion's existing home perch.
const companionRestSpots=[
  [[76,44],[60,55]], // Strawberry leaves
  [[67,26],[49,42]], // Sunflower petal and leaf
  [[46,101],[88,100]], // Fern pot base and soil edge
  [[48,103],[91,102]], // Hydrangea pot base and far side
  [[76,40],[87,98]], // Little tree twig and ground
  [[47,99],[91,97]], // Monstera pot edge and open ground
  [[49,101],[91,103]], // Basil pot side and open ground
  [[54,104],[92,101]] // Maple pot front and far side
];
const outingsSinceRestVisit=new WeakMap();

function companionRestOuting(index,favoritePerch,homeX,homeY,farX){
  const [first,second]=companionRestSpots[index];
  const flyers=index===0||index===1||index===4;
  const stops=flyers&&!favoritePerch?[[47,index===4?100:79],[87,100]]:[first,second];
  const [a,b]=stops.map(([x,y])=>[(x-homeX)/(farX-homeX),y-homeY]);
  const lift=flyers?-13:index===6?-11:0;
  const route=[
    [0,0,0,0,0],[0,0,0,0,.05],
    [a[0]*.5,lift,-3,0,.12,a[1]*.5],[a[0],0,0,0,.2,a[1]],
    [a[0],0,0,0,.37,a[1]],
    [(a[0]+b[0])*.5,lift,3,0,.44,(a[1]+b[1])*.5],[b[0],0,0,0,.52,b[1]],
    [b[0],0,0,0,.68,b[1]],[b[0],0,0,flyers?0:180,.74,b[1]],
    [b[0]*.44,lift,2,flyers?0:180,.83,b[1]*.44],
    [0,0,0,flyers?0:180,.94],[0,0,0,0,1]
  ];
  if(!flyers&&index!==6)for(const point of route)point[2]=0;
  return {
    route,duration:[6800,6300,6900,11200,6900,6600,7000,8600][index],
    bursts:[[.05,.1,.16,.2],[.37,.42,.48,.52],[.74,.8,.9,.94]],
    twig:index===4&&favoritePerch?[.2,.94]:[],
    landings:[.2,.52,.94],glides:[[.12,.16],[.44,.48],[.83,.89]]
  };
}

function setCompanionDepth(button,behind){
  button.classList.toggle('behind-plant',behind);
  button.parentElement?.classList.toggle('behind-plant',behind);
}

function placeCompanionShadow(button,dx=0,dy=0){
  const shadow=button.groundShadow;
  if(!shadow)return;
  const spot=button.parentElement;
  const homeX=Number(spot.dataset.x),homeY=Number(spot.dataset.y);
  const pose=button.groundShadowPose||{x:0,y:0,height:Math.max(0,100-homeY)};
  shadow.style.setProperty('--ground-x',(homeX-60+pose.x)/120);
  shadow.style.setProperty('--ground-y',(homeY+pose.y+pose.height)/120);
  shadow.style.setProperty('--ground-contact',Math.max(0,1-pose.height/12));
  shadow.style.setProperty('--ground-dx',dx+'px');
  shadow.style.setProperty('--ground-dy',dy+'px');
}

function companionBackLane(index,pose){
  // The snail changes layers only at its outside waypoints.
  return index===3?Boolean(pose.from[6]):pose.behind;
}

function companionGroundLane(index,pose,x,homeY){
  const lane=homeY+pose.depth;
  const groundAnimal=index===2||index===3||index>=5;
  if(companionBackLane(index,pose)||(!groundAnimal&&lane<89))return lane;
  // Blend into the floor lane before reaching the pot's side; keep lift separate.
  const approach=Math.max(0,Math.min(1,(33-Math.abs(x-60))/13));
  const weight=approach*approach*(3-2*approach);
  return lane+Math.max(0,102-lane)*weight;
}

function animateCompanionByPlant(button){
  const index=Number(button.dataset.companion);
  const card=button.closest('.garden-plant-card');
  const plant=card.querySelector('img');
  const width=plant.offsetWidth;
  if(!width||!button.animate)return;
  const scale=width/120;
  const art=button.querySelector('svg');
  const restArt=art.cloneNode(true);
  const homeX=Number(button.parentElement.dataset.x);
  const homeY=Number(button.parentElement.dataset.y);
  const plot=card.querySelector('.garden-plot');
  const favoritePerch=hasCompanionPerch(index,plot);
  const sunflowerBee=index===1&&favoritePerch;
  const treeSparrow=index===4&&favoritePerch;
  const ladybugFlightIndex=nextLadybugFlight.get(button)||0;
  const ladybugFlight=index===0?ladybugFlights[ladybugFlightIndex]:null;
  const flightIndex=nextSparrowFlight.get(button)||0;
  const sparrowFlight=treeSparrow?sparrowFlights[flightIndex]:undefined;
  const beeFlightIndex=nextSunflowerBeeFlight.get(button)||0;
  const alternate=!ladybugFlight&&!sunflowerBee&&!sparrowFlight&&useAlternateGardenWalk.get(button)
    ?alternateGardenWalks[index]:null;
  const farX=sunflowerBee?105:treeSparrow?76:index<2?Math.min(94,120-homeX+16):index===4?88:index===3?102:97;
  const outings=outingsSinceRestVisit.get(button)||0;
  const restOuting=outings>=3?companionRestOuting(index,favoritePerch,homeX,homeY,farX):null;
  const selectedRoute=restOuting?.route||(sunflowerBee?sunflowerBeeFlights[beeFlightIndex]
    :ladybugFlight?.route||sparrowFlight?.route||alternate?.route||gardenWalks[index]);
  const route=index===0&&!restOuting?selectedRoute.map(([x,lift,bank,facing,time,depth=0,behind])=>
    [x,lift,bank,facing,time,depth*(94-homeY)/48,behind]):selectedRoute;
  const duration=restOuting?.duration||(sunflowerBee?4100:ladybugFlight?.duration||
    sparrowFlight?.duration||alternate?.duration||gardenWalkDurations[index]);
  const padding=(card.clientWidth-width)/2;
  const artInset=art.getBoundingClientRect().width*.43+2;
  const minX=(artInset-padding)/scale;
  const maxX=120-minX;
  const minY=sunflowerBee?Math.max(9,(art.getBoundingClientRect().width*.5-6)/scale):20;
  const steps=Math.ceil(duration/30);
  const parked=button.companionPosition;
  const distances=[0];
  const shadowFrames=[];
  let previousX=0,previousY=0;
  const path=Array.from({length:steps+1},(_,i)=>{
    const offset=i/steps;
    const pose=sampleGardenRoute(route,offset);
    const join=Math.max(0,1-offset/.19);
    const settle=join*join*(3-2*join);
    const x=Math.max(minX,Math.min(maxX,homeX+(farX-homeX)*pose.across+(parked?.x||0)*settle/scale))-homeX;
    const lane=companionGroundLane(index,pose,homeX+x,homeY);
    const y=Math.min(104-homeY,Math.max(minY-homeY,pose.lift+lane-homeY+(parked?.y||0)*settle/scale));
    if(i)distances.push(distances[i-1]+Math.hypot(x-previousX,pose.depth-previousY));
    previousX=x;
    previousY=pose.depth;
    const flying=index===0||index===1||index===4;
    shadowFrames.push({x,y,height:flying?Math.max(0,100-homeY-y):Math.max(0,-pose.lift)});
    return {offset,transform:'translate('+x*scale+'px,'+y*scale+'px) rotate('+pose.bank+'deg)'};
  });
  button.style.removeProperty('translate');
  art.style.removeProperty('transform');
  delete button.companionPosition;
  button.classList.add('roaming');
  const travel=button.animate(path,{duration});
  outingsSinceRestVisit.set(button,restOuting?0:outings+1);
  if(!restOuting){
    if(sunflowerBee)nextSunflowerBeeFlight.set(button,(beeFlightIndex+1)%sunflowerBeeFlights.length);
    if(ladybugFlight)nextLadybugFlight.set(button,(ladybugFlightIndex+1)%(favoritePerch?ladybugFlights.length:2));
    else if(alternateGardenWalks[index])useAlternateGardenWalk.set(button,!alternate);
    if(treeSparrow)nextSparrowFlight.set(button,(flightIndex+1)%sparrowFlights.length);
  }
  const stopArt=animateCompanionLimbs(art,index,travel,distances,parked,route,duration,plant,
    restOuting||sparrowFlight,restOuting||ladybugFlight,restOuting,shadowFrames);
  const stop=()=>{
    button.classList.remove('roaming');
    setCompanionDepth(button,false);
    delete button.groundShadowPose;
    placeCompanionShadow(button);
    stopArt();
  };
  travel.onfinish=travel.oncancel=stop;
  return {travel,stop,restArt};
}

// Attachment points follow each pet's existing SVG, in its own viewBox units.
const companionFeet={
  2:[[25,38,0],[29,40,1],[34,40,0],[39,40,1],[44,39,0],[48,36,1]],
  4:[[33,39,0],[40,39,0]],
  5:[[27,30,0],[31,34,1],[42,27,1],[45,33,0]],
  6:[[27,38,1],[34,38,1],[43,38,0],[48,37,0]],
  7:[[22,37,0],[28,38,1],[41,38,1],[46,37,0]]
};

function animateCompanionLimbs(art,index,travel,distances,parked,route,duration,plant,sparrowFlight,ladybugFlight,restOuting,shadowFrames){
  const ns='http://www.w3.org/2000/svg';
  const added=[],changed=[];
  const findPath=prefix=>[...art.querySelectorAll('path')].find(node=>node.getAttribute('d').startsWith(prefix));
  function remember(node,attribute){
    if(!node)return;
    const value=node.getAttribute(attribute);
    changed.push(()=>value===null?node.removeAttribute(attribute):node.setAttribute(attribute,value));
  }
  function addPath(parent,before){
    const path=document.createElementNS(ns,'path');
    parent.insertBefore(path,before);
    added.push(path);
    return path;
  }

  const button=art.parentElement;
  const body=art.querySelector('path[fill]:not([fill="none"])');
  const feet=(companionFeet[index]||[]).map(([x,y,phase])=>{
    const node=addPath(art,null);
    node.setAttribute('fill','none');
    node.setAttribute('stroke',index===5?'#71976d':index===2?'#5d6a5f':index===4?'#876a54':body?.getAttribute('fill')||'#a28c77');
    node.setAttribute('stroke-width',index===2?1.15:index===4?1.45:2.15);
    node.setAttribute('stroke-linecap','round');
    return {node,x,y,phase};
  });
  const staticLegs=index===5?findPath('m30 29'):index===2?findPath('M24 41'):null;
  remember(staticLegs,'visibility');
  staticLegs?.setAttribute('visibility','hidden');

  let wing, secondWing, foot, antenna;
  const beeWings=index===1?[findPath('M33 26'),findPath('M35 26')].filter(Boolean):[];
  if(index===0){
    const shell=findPath('M23 32');
    if(shell){
      wing=addPath(shell.parentElement,shell);
      secondWing=addPath(shell.parentElement,shell);
      wing.setAttribute('d','M34 25q-17-12-18-3 1 8 18 7Z');
      secondWing.setAttribute('d','M36 25q17-12 18-3-1 8-18 7Z');
      for(const part of [wing,secondWing]){
        part.setAttribute('fill','#e6d9b9');
        part.setAttribute('opacity','0');
      }
    }
  }else if(index===4){
    wing=findPath('M23 27');
    if(wing){
      secondWing=addPath(wing.parentElement,wing);
      secondWing.setAttribute('fill',wing.getAttribute('fill')||'#806956');
      remember(wing,'d');
    }
  }else if(index===3){
    foot=findPath('M13 39');
    antenna=findPath('m51 27');
    remember(foot,'d');
  }
  remember(wing,'transform');
  const ladybugFeet=art.querySelector('.garden-ladybug-feet');
  remember(ladybugFeet,'d');
  const rabbitNose=index===6?art.querySelector('ellipse[cx="48"][cy="33"]'):null;
  remember(rabbitNose,'transform');
  const beeFeet=art.querySelector('.garden-bee-feet');
  remember(beeFeet,'d');
  beeWings.forEach(part=>remember(part,'transform'));
  remember(antenna,'transform');

  const turnPose=index<2?null:companionTurnPose(art,index);
  const twigLandings=sparrowFlight?.twig||[];
  let landingIndex=0,sway;
  let frame;
  function draw(){
    if(!art.isConnected)return;
    if(travel.playState==='paused'||button.classList.contains('reacting')){
      frame=requestAnimationFrame(draw);
      return;
    }
    const t=Math.max(0,Math.min(1,Number(travel.currentTime)/duration));
    const pose=sampleGardenRoute(route,t);
    if(parked?.facing&&t<.12)turnPose?.draw(180,0,t/.12);
    else turnPose?.draw(pose.from[3],pose.to[3],pose.phase);
    const behind=companionBackLane(index,pose);
    setCompanionDepth(button,behind||Boolean(parked?.behind&&t<.16));
    const shadowSample=t*(shadowFrames.length-1);
    const leftFrame=shadowFrames[Math.floor(shadowSample)];
    const rightFrame=shadowFrames[Math.ceil(shadowSample)];
    const mix=shadowSample-Math.floor(shadowSample);
    button.groundShadowPose={
      x:leftFrame.x+(rightFrame.x-leftFrame.x)*mix,
      y:leftFrame.y+(rightFrame.y-leftFrame.y)*mix,
      height:leftFrame.height+(rightFrame.height-leftFrame.height)*mix
    };
    const shift=button.shadowReturning?getComputedStyle(button).translate.split(' ').map(parseFloat):[];
    placeCompanionShadow(button,shift[0]||0,shift[1]||0);

    const moving=pose.moving;
    const height=pose.lift;
    const airborne=height<-.8;
    if(landingIndex<twigLandings.length&&t>=twigLandings[landingIndex]){
      landingIndex++;
      sway?.cancel();
      sway=swayPlantOnLanding(plant);
    }
    const sample=t*(distances.length-1);
    const left=Math.floor(sample),right=Math.min(left+1,distances.length-1);
    const distance=distances[left]+(distances[right]-distances[left])*(sample-left);
    const stride=distance*Math.PI*2/(index===2?9:index===5?13:16);
    for(const {node,x,y,phase} of feet){
      const cycle=stride+phase*Math.PI+(index===2?(x-25)*.095:0);
      const hop=index===4||index===6;
      const reach=hop?(airborne?(phase? -4:3):0):moving?Math.sin(cycle)*(index===2?2.1:3.6):0;
      const lift=hop?Math.min(4,Math.max(0,-height*.33)):moving?Math.max(0,Math.cos(cycle))*(index===2?1.6:2.6):0;
      node.setAttribute('d','M'+x+' '+y+'q'+reach*.35+' 2 '+reach+' '+(5-lift)+'l2 0');
    }

    const ramp=(start,end)=>Math.max(0,Math.min(1,(t-start)/(end-start)));
    if(index===0&&wing){
      const flight=Math.max(...ladybugFlight.bursts.map(([start,up,down,end])=>
        ramp(start,up)*(1-ramp(down,end))));
      [wing,secondWing].forEach((part,i)=>{
        const phase=t*duration*.108-i*.55;
        const fold=1-flight*(.35+.3*Math.cos(phase));
        part.setAttribute('opacity',flight*.9);
        part.setAttribute('transform','translate(35 26) rotate('+Math.sin(phase)*16*flight+') scale('+fold+' 1) translate(-35 -26)');
      });
      if(ladybugFeet){
        const step=moving?Math.sin(distance*.72)*(1-flight)*2:0;
        const tuck=flight*4;
        ladybugFeet.setAttribute('d','M28 32l'+(-5+step)+' '+(6-tuck)+'M31 37l'+(-3-step)+' '+(5-tuck)+
          'M36 39l'+step+' '+(4-tuck)+'M38 34l'+(5-step)+' '+(4-tuck)+
          'M41 30l'+(6+step)+' '+(3-tuck)+'M42 26l'+(5-step)+' '+(1-tuck));
      }
    }
    if(index===1){
      const landing=sunflowerBeeFlights.includes(route);
      const flight=restOuting?Math.max(...restOuting.bursts.map(([start,up,down,end])=>ramp(start,up)*(1-ramp(down,end)))):landing?Math.min(1,Math.max(0,(t-.09)/.045),Math.max(0,(.96-t)/.045)):1;
      const reach=restOuting?1-flight:landing?Math.max(1-Math.min(1,Math.max(0,(t-.09)/.08)),Math.min(1,Math.max(0,(t-.85)/.08))):0;
      setBeeFlight(beeWings,beeFeet,t*duration/1000,flight,reach);
    }
    if(rabbitNose&&route===alternateGardenWalks[6].route){
      const sniff=t>.22&&t<.44?Math.sin(t*155)*.65:0;
      rabbitNose.setAttribute('transform','translate(0 '+sniff+')');
    }
    if(index===4&&wing)drawSparrowWings(wing,secondWing,t*duration/1000,t,airborne,sparrowFlight);
    if(foot){
      const stretch=moving?Math.sin(t*34)*2.4:0;
      foot.setAttribute('d','M'+(13-stretch)+' 39H41Q43 26 52 26q6 0 '+(6+stretch)+' 8-1 9-14 9H'+(13-stretch)+'Z');
      const inspecting=route===alternateGardenWalks[3].route&&t>.34&&t<.52;
      antenna?.setAttribute('transform','rotate('+(moving||inspecting?Math.sin(t*21)*7:0)+' 54 27)');
    }
    if(t<1)frame=requestAnimationFrame(draw);
  }
  frame=requestAnimationFrame(draw);
  return ()=>{
    cancelAnimationFrame(frame);
    if(travel.playState!=='finished')sway?.cancel();
    turnPose?.remove();
    added.forEach(node=>node.remove());
    changed.forEach(restore=>restore());
  };
}

// A front view bridges the two profiles while the pet is stopped.
const companionFronts={
  2:['M21 37q0-15 13-15t13 15q-1 5-13 5t-13-5Z','M26 38q-2-7 1-13m7 14V22m8 16q2-7-1-13','M30 36h.1m8 0h.1'],
  3:['M20 36q0-17 14-17t14 17q0 6-14 6t-14-6Z','M26 31q0-8 8-8t8 8q0 7-7 7-6 0-6-5m1-9-3-5m11 5 3-5','M31 34h.1m6 0h.1'],
  4:['M24 32q0-8 3-11a8 8 0 0 1 14 0q3 3 3 11 0 10-10 10T24 32Z','M27 29q0 7 3 9m11-9q0 7-3 9m-6-10 2 3 2-3m-6 14-2 2m10-2 2 2','M30 24h.1m8 0h.1'],
  5:['M27 23q7-5 14 0 6 3 3 8-2 3-6 4l-1 7h-6l-1-7q-4-1-6-4-3-5 3-8Z','M28 33l-6 3-2 4m20-7 6 3 2 4m-17-9q3 2 6 0','M28 27h.1m12 0h.1'],
  6:['M26 27q-5-11-4-19 1-5 5 1l5 12h4l5-12q4-6 5-1 1 8-4 19 5 4 4 10-1 5-12 5t-12-5q-1-6 4-10Z','M25 11l4 11m14-11-4 11m-8 13 3 2 3-2m-3 2v2','M29 31h.1m10 0h.1'],
  7:['M23 30l1-12 8 5h4l8-5 1 12q4 11-11 12T23 30Z','M26 25l1-3 4 3m11 0-1-3-4 3m-6 9 3 2 3-2m-3 2v2m-7-4-6-1m20 1 6-1','M29 31h.1m10 0h.1']
};
const companionTurnColors={2:'#859189',3:'#bf946e',4:'#ad8e70',5:'#8aab78',6:'#b8a089',7:'#c5af98'};

function companionTurnPose(art,index){
  const shapes=companionFronts[index];
  if(!shapes)return;
  const profileStyle=art.style.cssText;
  const front=art.cloneNode(false);
  front.classList.add('companion-turn-pose');
  front.style.opacity='0';
  const [outline,details,eyes]=shapes;
  const bodySelector=['path[d^="M23 32"]','ellipse[cx="34"][cy="30"]','path[d^="M18 35"]','path[d^="M20 37"]','path[d^="M19 29"]','path[d^="M24 33"]','path[d^="M22 36"]','path[d^="m34 30"]'][index];
  const color=art.querySelector(bodySelector)?.getAttribute('fill')||companionTurnColors[index];
  front.innerHTML='<g><path fill="'+color+'" d="'+outline+'"/><path fill="none" stroke="#514b43" stroke-opacity=".6" stroke-width="1.15" stroke-linecap="round" d="'+details+'"/><path fill="none" stroke="#413d36" stroke-width="2.15" stroke-linecap="round" d="'+eyes+'"/></g>';
  art.after(front);
  return {
    draw(from,to,progress){
      const turning=from!==to;
      const reveal=turning?Math.min(1,progress*3,(1-progress)*3):0;
      const face=reveal*reveal*(3-2*reveal);
      const facing=turning&&progress>=.5?to:from;
      art.style.transform=facing===180?'scaleX(-1)':'none';
      art.style.opacity=face<.65?1:(1-face)/.35;
      front.style.opacity=face>.65?1:face/.65;
    },
    remove(){
      front.remove();
      art.style.cssText=profileStyle;
    }
  };
}

// Fit a smooth curve through the timed poses without overshooting a landing or a card edge.
function sampleGardenRoute(route,time){
  const upper=route.findIndex(point=>point[4]>time);
  const i=upper<0?route.length-2:Math.max(0,upper-1);
  const from=route[i],to=route[i+1];
  const span=to[4]-from[4];
  const phase=Math.min(1,Math.max(0,(time-from[4])/span));
  function coordinate(axis){
    const value=point=>point[axis]||0;
    const slope=(left,right)=>(value(right)-value(left))/(right[4]-left[4]);
    const blend=(a,b)=>a*b<=0?0:2*a*b/(a+b);
    const delta=slope(from,to);
    const before=i>0?blend(slope(route[i-1],from),delta):0;
    const after=i+2<route.length?blend(delta,slope(to,route[i+2])):0;
    const p2=phase*phase,p3=p2*phase;
    return (2*p3-3*p2+1)*value(from)+(p3-2*p2+phase)*span*before+
      (-2*p3+3*p2)*value(to)+(p3-p2)*span*after;
  }
  return {
    from,to,phase,
    across:coordinate(0),lift:coordinate(1),bank:coordinate(2),depth:coordinate(5),
    moving:time>0&&time<1&&[0,1,5].some(axis=>(from[axis]||0)!==(to[axis]||0)),
    behind:Boolean(from[6]||to[6])
  };
}

(() => {
  const root=$('companion-lookbook');
  const pets=Array.from(root.querySelectorAll('[data-pet-group]'),(group,index)=>{
    const card=group.querySelector('.default-look');
    return {
      name:group.querySelector('.pet-heading strong').textContent,
      price:COMPANION_PRICES[index],
      art:companionPreviewArt(card.querySelector('svg'),index),
      tile:card.style.getPropertyValue('--tile')
    };
  });
  let pet=0, buying=false, purchaseNotice='';
  const pebbles=count=>count+(count===1?' pebble':' pebbles');
  const plotGrid=$('gardenPlots');
  const shopOrder=pets.map((_,index)=>index)
    .sort((a,b)=>COMPANION_FAVORITES[a]-COMPANION_FAVORITES[b]);
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  root.innerHTML=`<div class="compare-content"></div>
    <dialog class="companion-detail-sheet" aria-labelledby="companion-sheet-title">
      <div class="companion-sheet-top">
        <span>Companion details</span>
        <button type="button" class="companion-sheet-close" autofocus>Close ×</button>
      </div>
      <div class="companion-sheet-content"></div>
    </dialog>`;
  const content=root.querySelector('.compare-content');
  const sheet=root.querySelector('.companion-detail-sheet');
  const sheetContent=sheet.querySelector('.companion-sheet-content');
  const details=setupShopSheet(sheet);

  function companionPreviewArt(source,index){
    const art=source.cloneNode(true);
    // Keep the original SVG nodes for the reaction code, but hide the old scene props.
    const props=[[1,2],[1,2],[1],[],[1],[1],[],[]][index];
    for(const child of props)art.children[child]?.classList.add('companion-scene-prop');
    if(index===0){
      const shell=art.querySelector('path[d^="M23 32"]');
      shell?.insertAdjacentHTML('beforebegin','<path class="garden-ladybug-feet" d="M28 32l-5 6m8-1-3 5m8-3v4m2-9 5 4m-2-8 6 3m-5-7 5 1" fill="none" stroke="#55483d" stroke-width="1.2" stroke-linecap="round"/>');
    }
    if(index===5)art.querySelector('path[d^="m30 29"]')?.setAttribute('d',geckoStandingLegs());
    if(index===1){
      const wing=art.querySelector('path[d^="M33 26"]');
      if(wing){
        const farWing=wing.cloneNode(false);
        farWing.setAttribute('d','M35 26q2-13 12-12 6 7-9 13');
        wing.setAttribute('d','M33 26q-14-3-12-13 9-3 14 10');
        wing.before(farWing);
        wing.parentElement.insertAdjacentHTML('beforeend','<path class="garden-bee-feet" d="M32 35q1 3 3 7m5-7q1 3 3 7" fill="none" stroke="#66533e" stroke-width="1.4" stroke-linecap="round"/>');
      }
    }
    if(art.firstElementChild?.localName==='ellipse')art.firstElementChild.setAttribute('visibility','hidden');
    const idleDetail=[
      'path[d^="m31 15"]','path[d^="m45 24"]','path[d^="M22 38"]',
      'path[d^="m51 27"],circle[cx="49"],circle[cx="60"]',
      'circle[cx="43"],circle[cx="46"],path[d^="m49 19"]',
      'path[d^="M34 33"]','path[d^="M42 25"],path[d^="m42 12"]',
      'path[d^="M28 38"]'
    ][index];
    art.querySelectorAll(idleDetail).forEach(part=>part.classList.add('companion-idle-detail'));
    return art.outerHTML;
  }

  const shopSceneDetails={
    3:'<path d="M11 41q-5-1-6-6 5 0 7 4q1-4 5-5-1 5-5 7Z" fill="#94a47d"/>',
    6:'<path d="M53 43q3-3 6-7" fill="none" stroke="#779469" stroke-width="1.2"/><path d="M58 38q-5-2-3-5 3-1 4 3 1-4 4-3 2 3-3 5Z" fill="#9cad83"/>',
    7:'<path d="M7 43q5-4 9-3-3 5-9 3Zm43 0q4-4 9-2-2 4-9 2Z" fill="#a4af8b"/>'
  };
  function shopCompanionArt(art,index){
    const detail=shopSceneDetails[index]||'';
    return `<span class="shop-companion-art">${art.replace('</svg>',detail+'</svg>')}</span>`;
  }
  function render(){
    const completedDays=rewardProgress(state,today).leaves;
    content.innerHTML=`<div class="compare-pets">${shopOrder.map(index=>{
        const entry=pets[index];
        const label=ownsCompanion(state,index)?'Owned':pebbles(entry.price)+(completedDays<companionUnlockDays(index)?' · Locked':'');
        return `<button type="button" data-pet-index="${index}" style="--tile:${entry.tile}">${shopCompanionArt(entry.art,index)}<strong>${entry.name}</strong><span>${label}</span></button>`;
      }).join('')}</div>`;
    if(sheet.open)renderSheet(completedDays);
  }
  function renderSheet(completedDays){
    const current=pets[pet];
    const balance=pebbleBalance(state,today);
    const owned=ownsCompanion(state,pet);
    const shortfall=Math.max(0,current.price-balance);
    const favorite=gardenSpecies[COMPANION_FAVORITES[pet]].name;
    const unlockDays=companionUnlockDays(pet);
    const daysLeft=unlockDays-completedDays;
    const locked=daysLeft>0;
    const unlockNote=locked?`${unlockDays} completed days to fully grow ${favorite} (${daysLeft} ${daysLeft===1?'day':'days'} left).`:'';
    sheetContent.innerHTML=`<div class="compare-feature" style="--tile:${current.tile}">
        ${shopCompanionArt(current.art,pet)}
        <span class="companion-price-badge">${pebbles(current.price)}</span>
      </div>
      <div class="companion-checkout">
        <div class="companion-checkout-row">
          <h2 id="companion-sheet-title">${current.name}</h2>
          <button type="button" class="companion-buy" data-action="purchase"
            aria-label="${owned?'Owned':locked?'Locked':buying?'Purchasing':'Buy '+current.name+' for '+pebbles(current.price)}"
            ${owned||locked||shortfall||buying?'disabled':''}>${owned?'Owned':locked?'Locked':buying?'Purchasing…':'Buy'}</button>
        </div>
        <p class="companion-favorite">Favorite plant <strong>${favorite}</strong></p>
        <p role="status">${purchaseNotice||unlockNote||(!owned&&shortfall?'You need '+pebbles(shortfall)+' more.':'')}</p>
      </div>`;
  }
  const wander = new WeakMap();
  const reactionOffsets=new WeakMap();
  const plotVisibility = new WeakSet();
  const observer = new IntersectionObserver(entries=>{
    for(const {target,isIntersecting} of entries){
      const button=target.querySelector('button.companion-at-plant');
      if(isIntersecting){
        plotVisibility.add(target);
        if(button&&canWander(button)&&!button.classList.contains('reacting'))beginWandering(button);
      }else{
        plotVisibility.delete(target);
        pauseWandering(button);
      }
    }
  });
  function pauseWandering(button){
    const travel=wander.get(button)?.travel;
    if(travel?.playState==='running')travel.pause();
    reactionOffsets.get(button)?.pause();
  }
  function stopWandering(button){
    const move=wander.get(button);
    if(!move)return;
    move.travel.oncancel=null;
    move.travel.cancel();
    move.stop();
    wander.delete(button);
  }
  function renderAssignments(){
    observer.disconnect();
    const homes=companionHomes(state,rewardProgress(state,today).leaves);
    for(const card of plotGrid.children){
      const spot=card.querySelector('.plant-companion');
      if(!spot)continue;
      const plot=card.firstElementChild;
      const index=homes.get(plot.dataset.plot)??-1;
      if(index>=0&&Number(spot.firstElementChild?.dataset.companion)===index){observer.observe(card);continue;}
      stopWandering(spot.firstElementChild);
      card.querySelector('.companion-ground-shadow')?.remove();
      spot.classList.remove('behind-plant');
      if(index<0){spot.replaceChildren();continue;}
      const sample=pets[index];
      const ladybug=index===0;
      const strawberryLadybug=ladybug&&hasCompanionPerch(0,plot);
      spot.classList.toggle('leaf-ladybug',ladybug);
      const sunflowerBee=index===1&&hasCompanionPerch(1,plot);
      const treeSparrow=index===4&&hasCompanionPerch(4,plot);
      spot.classList.toggle('bee-perch',index===1);
      spot.classList.toggle('tree-sparrow',treeSparrow);
      const [x,y]=strawberryLadybug?[44,47]:sunflowerBee?[59,24]:treeSparrow?[42,43]:index<2?[60,79]:[27,100];
      spot.dataset.x=x;
      spot.dataset.y=y;
      spot.style.setProperty('--home-x',((x-60)/120)+'');
      spot.style.setProperty('--home-y',(y/120)+'');
      observer.observe(card);
      spot.innerHTML=`<button type="button" class="companion-at-plant" data-companion="${index}" title="${sample.name}" aria-label="Play ${sample.name}'s reaction by ${card.querySelector('strong').textContent}">${sample.art}</button>`;
      const button=spot.firstElementChild;
      const shadow=document.createElement('span');
      shadow.className='companion-ground-shadow';
      shadow.setAttribute('aria-hidden','true');
      if(ladybug)shadow.classList.add('ladybug-ground-shadow');
      card.append(shadow);
      button.groundShadow=shadow;
      placeCompanionShadow(button);
    }
  }
  function pauseForReaction(button,art){
    pauseWandering(button);
    const move=wander.get(button);
    const offset=getComputedStyle(button).translate.split(' ').map(parseFloat);
    const position={
      x:offset[0]||0,y:offset[1]||0,
      behind:button.classList.contains('behind-plant'),
      facing:art.style.transform==='scaleX(-1)'?180:0
    };
    reactionOffsets.get(button)?.cancel();
    reactionOffsets.delete(button);
    button.shadowReturning=false;
    button.companionPosition=position;
    button.style.translate=position.x+'px '+position.y+'px';
    const svg=(move?.restArt||art).cloneNode(true);
    svg.style.transform=position.facing?'scaleX(-1)':'';
    art.classList.add('companion-motion-art-hidden');
    art.before(svg);
    return {svg,position};
  }
  function startPillBugRoll(button,svg,position){
    const bug=svg.getBoundingClientRect();
    const card=button.closest('.garden-plant-card').getBoundingClientRect();
    const center=bug.left+bug.width/2;
    const radius=bug.width*18/68;
    const left=Math.max(0,center-card.left-radius-2);
    const right=Math.max(0,card.right-center-radius-2);
    const heading=position.facing?-1:1;
    const preferred=bug.width*.59;
    const direction=(heading===1?right:left)>=preferred*.45?heading:-heading;
    const distance=direction*Math.min(preferred,direction===1?right:left);
    const origin=position.x;
    const move=progress=>{
      position.x=origin+distance*progress;
      button.style.translate=position.x+'px '+position.y+'px';
      placeCompanionShadow(button,position.x,position.y);
      return distance*progress*68/bug.width*(position.facing?-1:1);
    };
    move(0);
    return move;
  }
  plotGrid.addEventListener('click',event=>{
    const button=event.target.closest('button.companion-at-plant');
    if(!button)return;
    const species=Number(button.dataset.companion);
    if(reduced.matches||button.classList.contains('reacting'))return;
    const art=button.querySelector('svg');
    const {svg,position}=pauseForReaction(button,art);
    const roll=species===2?startPillBugRoll(button,svg,position):undefined;
    button.classList.add('reacting');
    Promise.resolve().then(()=>companionReaction(svg,species,roll)).finally(()=>{
      svg.remove();
      button.groundShadow.style.removeProperty('--reaction-contact');
      art.classList.remove('companion-motion-art-hidden');
      placeCompanionShadow(button,position.x,position.y);
      button.classList.remove('reacting');
      setCompanionDepth(button,position.behind);
      if(!button.isConnected)return;
      const active=wander.get(button)?.travel;
      if(active?.playState==='paused'){
        if(position.x||position.y){
          const remaining=active.effect.getTiming().duration-Number(active.currentTime);
          const offset=button.animate([{translate:button.style.translate},{translate:'0px 0px'}],
            {duration:Math.max(1,Math.min(720,remaining)),easing:'ease-in-out'});
          if(!canWander(button))offset.pause();
          reactionOffsets.set(button,offset);
          button.shadowReturning=true;
          offset.addEventListener('finish',()=>{button.shadowReturning=false;placeCompanionShadow(button);},{once:true});
          button.style.removeProperty('translate');
        }
        delete button.companionPosition;
      }
      if(canWander(button))beginWandering(button);
    });
  });
  content.onclick=event=>{
    const button=event.target.closest('[data-pet-index]');
    if(!button||sheet.open)return;
    pet=Number(button.dataset.petIndex);
    purchaseNotice='';
    renderSheet(rewardProgress(state,today).leaves);
    details.open(()=>content.querySelector(`[data-pet-index="${pet}"]`));
  };
  sheetContent.onclick=event=>{
    if(!details.isClosing()&&event.target.closest('[data-action="purchase"]'))purchaseCompanion(pet);
  };
  async function purchaseCompanion(index){
    if(buying)return;
    buying=true;
    render();
    const result=await runShopTransaction(saved=>buyCompanion(saved,index,today));
    buying=false;
    if(sheet.open&&pet===index){
      purchaseNotice=result==='error'?'Purchase could not be saved. Your wallet was not charged.'
        :result==='locked'?'The favorite plant needs to be fully grown before purchase.'
        :result==='insufficient'?'Your wallet does not have enough pebbles.':'';
    }
    renderProgress();
  }
  document.addEventListener('app-progress',()=>{
    if(sheet.open&&openShopIndex!==1)details.close();
    render();
    renderAssignments();
  });
  render();renderAssignments();
  function canWander(button){
    return !document.hidden&&!$('gardenView').hidden&&!reduced.matches&&
      plotVisibility.has(button.closest('.garden-plant-card'));
  }
  function beginWandering(button){
    const current=wander.get(button);
    if(current?.travel.playState==='running')return;
    if(current?.travel.playState==='paused'){
      current.travel.play();
      const offset=reactionOffsets.get(button);
      if(offset?.playState==='paused')offset.play();
      return;
    }
    const move=animateCompanionByPlant(button);
    if(!move)return;
    wander.set(button,move);
    move.travel.addEventListener('finish',()=>{
      if(button.isConnected&&canWander(button)&&!button.classList.contains('reacting'))beginWandering(button);
    },{once:true});
  }
  function updateGardenMotion(){
    const buttons=[...plotGrid.querySelectorAll('button.companion-at-plant')];
    if(document.hidden||$('gardenView').hidden||reduced.matches){
      buttons.forEach(pauseWandering);
      return;
    }
    for(const button of buttons){
      if(canWander(button)&&!button.classList.contains('reacting'))beginWandering(button);
    }
  }
  setInterval(updateGardenMotion,250);
})();
