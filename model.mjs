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
  return balance;
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
  return {...value,start:parseDate(value.start)?value.start:today,gratitudeSince:parseDate(value.gratitudeSince)?value.gratitudeSince:today,days:{...value.days}};
}
export function recordFor(state,key) {
  const record=state.days[key];
  return record && typeof record === 'object' && !Array.isArray(record) ? record : {};
}
export function updateRecord(state,key,patch,today) {
  if (!parseDate(key) || key > today) throw new Error('Only today and past dates can be edited.');
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
