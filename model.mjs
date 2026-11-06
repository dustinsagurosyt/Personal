export const STORAGE_KEY = 'attention-reset-v1';
export const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
export function dateKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
}
export function parseDate(key) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(key || '')) return null;
  const [y,m,d] = key.split('-').map(Number);
  const result = new Date(y,m-1,d,12);
  return dateKey(result) === key ? result : null;
}
export function addDays(key, amount) {
  const date = parseDate(key);
  date.setDate(date.getDate()+amount);
  return dateKey(date);
}
export function videoGoal(record = {}) {
  const raw = record?.minutes;
  if (!['number','string'].includes(typeof raw) || String(raw).trim() === '') return false;
  const value = Number(raw);
  return Number.isFinite(value) && value >= 0 && value < 60;
}
export function practiceGoal(record = {}, key, state = {}) {
  if (typeof record?.gratitudeDone === 'boolean') return record.gratitudeDone && typeof record.gratitudeText === 'string' && !!record.gratitudeText.trim();
  // Keep prior focus-session achievements in their original historical days.
  return !!key && !!state.gratitudeSince && key < state.gratitudeSince && record?.focus === true;
}
export function complete(record = {}, key, state = {}) { return practiceGoal(record,key,state) && videoGoal(record); }
export function currentStreak(state, today) {
  let key = complete(recordFor(state,today),today,state) ? today : addDays(today,-1);
  let count = 0;
  while (complete(recordFor(state,key),key,state)) {
    count++;
    key = addDays(key,-1);
  }
  return count;
}
export const PEBBLE_BONUS_INTERVAL = 5;
export const PEBBLE_STREAK_BONUS = 2;

// Prices are keyed by companion ID, while the shop displays favorite-plant order.
export const COMPANION_PRICES=[40,15,10,30,25,20,45,55];
export const COMPANION_FAVORITES=[12,2,0,7,5,4,14,15];
export const DAYS_PER_PLANT=15;
export const POT_PRICES=[0,3,5,7,9,12,3,3,3,7,7,9,14,14,18];

export function ownsPot(state,index){
  const charge=state.potPurchases?.[index];
  return index===0||(Number.isSafeInteger(charge)&&charge>0);
}

export function equipPot(state,index,plot,today,plotCount){
  const price=POT_PRICES[index];
  if(!Number.isInteger(index)||price===undefined||
    !Number.isInteger(plot)||plot<0||plot>=plotCount)return {status:'unavailable'};
  const owned=ownsPot(state,index);
  if(!owned&&pebbleBalance(state,today)<price)return {status:'insufficient'};
  const equippedPots={...state.equippedPots};
  if(index>0){
    for(const [previous,pot] of Object.entries(equippedPots)){
      if(pot===index)delete equippedPots[previous];
    }
  }
  equippedPots[plot]=index;
  return {status:owned?'equipped':'purchased',state:{
    ...state,
    potPurchases:owned?state.potPurchases:{...state.potPurchases,[index]:price},
    equippedPots
  }};
}

export function companionUnlockDays(index){
  return (COMPANION_FAVORITES[index]+1)*DAYS_PER_PLANT;
}

export function ownsCompanion(state,index){
  const charge=state.companionPurchases?.[index];
  return Number.isSafeInteger(charge)&&charge>0;
}

export function companionHomes(state,completedDays){
  const homes=new Map();
  COMPANION_FAVORITES.forEach((plot,index)=>{
    if(ownsCompanion(state,index)&&completedDays>=companionUnlockDays(index))homes.set(String(plot),index);
  });
  return homes;
}

export function buyCompanion(state,index,today){
  const price=COMPANION_PRICES[index];
  if(!Number.isInteger(index)||!price)return {status:'unavailable'};
  if(ownsCompanion(state,index))return {status:'owned'};
  if(rewardProgress(state,today).leaves<companionUnlockDays(index))return {status:'locked'};
  if(pebbleBalance(state,today)<price)return {status:'insufficient'};
  return {status:'purchased',state:{
    ...state,companionPurchases:{...state.companionPurchases,[index]:price}
  }};
}

export function pebbleBalance(state, today) {
  const completed = Object.keys(state.days)
    .filter(key=>key<=today&&parseDate(key)&&complete(state.days[key],key,state))
    .sort();
  let balance=0, run=0, previous;
  for(const key of completed){
    run=previous&&addDays(previous,1)===key?run+1:1;
    balance+=1;
    if(run%PEBBLE_BONUS_INTERVAL===0)balance+=PEBBLE_STREAK_BONUS;
    previous=key;
  }
  const spent=COMPANION_PRICES.reduce((total,_,index)=>
    total+(ownsCompanion(state,index)?state.companionPurchases[index]:0),0);
  const potSpend=POT_PRICES.reduce((total,_,index)=>
    total+(index>0&&ownsPot(state,index)?state.potPurchases[index]:0),0);
  return Math.max(0,balance-spent-potSpend);
}

export function monthDates(year, month) {
  return Array.from({length:new Date(year,month+1,0).getDate()},(_,i)=>dateKey(new Date(year,month,i+1,12)));
}
export function trackingStart(state, today) {
  const candidates = [state.start,...Object.keys(state.days || {})].filter(key=>parseDate(key) && key <= today);
  return candidates.length ? candidates.sort()[0] : today;
}
export function monthStats(state, year, month, today) {
  const start = trackingStart(state,today);
  const dates = monthDates(year,month).filter(key=>key >= start && key <= today);
  let count=0,best=0,run=0;
  for (const key of dates) {
    if (complete(state.days[key],key,state)) { count++;run++;best=Math.max(best,run); }
    else run=0;
  }
  return {count,best,total:dates.length,rate:dates.length?Math.round(count/dates.length*1000)/10:0};
}
export function normalizeState(value,today) {
  if (!value || typeof value !== 'object' || !value.days || typeof value.days !== 'object' || Array.isArray(value.days)) return {start:today,gratitudeSince:today,days:{}};
  // Keep legacy notes and other saved fields in the backup, without displaying
  // or requiring the removed habits in the everyday interface.
  const state={...value,start:parseDate(value.start)?value.start:today,gratitudeSince:parseDate(value.gratitudeSince)?value.gratitudeSince:today,days:{...value.days}};
  if(value.equippedPots&&typeof value.equippedPots==='object'){
    const seen=new Set();
    state.equippedPots=Object.fromEntries(Object.entries(value.equippedPots).filter(([,pot])=>{
      if(!Number.isInteger(pot)||POT_PRICES[pot]===undefined||!ownsPot(state,pot))return false;
      if(pot===0)return true;
      if(seen.has(pot))return false;
      seen.add(pot);
      return true;
    }));
  }
  return state;
}
export function recordFor(state,key) {
  const record=state.days[key];
  return record && typeof record === 'object' && !Array.isArray(record) ? record : {};
}
export function canEditDate(key,today) {
  return !!parseDate(key) && key >= addDays(today,-2) && key <= today;
}
export function updateRecord(state,key,patch,today) {
  if (!canEditDate(key,today)) throw new Error('Only today and the previous two days can be edited.');
  return {...state,start:state.start && state.start<key?state.start:key,days:{...state.days,[key]:{...recordFor(state,key),...patch}}};
}

export function rewardProgress(state, today) {
  let leaves = 0;
  const gratitudeDates = [];
  for (const [key, record] of Object.entries(state.days)) {
    if (key > today || !parseDate(key)) continue;
    if (complete(record, key, state)) leaves++;
    if (record?.gratitudeDone === true && typeof record.gratitudeText === 'string' && record.gratitudeText.trim()) {
      gratitudeDates.push(key);
    }
  }
  gratitudeDates.sort();
  const capsules = [];
  for (let index = 4; index < gratitudeDates.length; index += 5) {
    capsules.push(gratitudeDates[index - 4]);
  }
  return {leaves, branches: Math.floor(leaves / 5), entries: gratitudeDates.length, capsules};
}

