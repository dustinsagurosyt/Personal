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
export function complete(record = {}) { return record?.focus === true && videoGoal(record); }
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
    if (complete(state.days[key])) { count++;run++;best=Math.max(best,run); }
    else run=0;
  }
  return {count,best,total:dates.length,rate:dates.length?Math.round(count/dates.length*1000)/10:0};
}
export function normalizeState(value,today) {
  if (!value || typeof value !== 'object' || !value.days || typeof value.days !== 'object' || Array.isArray(value.days)) return {start:today,days:{}};
  // Keep legacy notes and other saved fields in the backup, without displaying
  // or requiring the removed habits in the everyday interface.
  return {...value,start:parseDate(value.start)?value.start:today,days:{...value.days}};
}
export function recordFor(state,key) {
  const record=state.days[key];
  return record && typeof record === 'object' && !Array.isArray(record) ? record : {};
}
export function updateRecord(state,key,patch,today) {
  if (!parseDate(key) || key > today) throw new Error('Only today and past dates can be edited.');
  return {...state,start:state.start && state.start<key?state.start:key,days:{...state.days,[key]:{...recordFor(state,key),...patch}}};
}
