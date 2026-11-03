import {test} from 'node:test';
import assert from 'node:assert/strict';
import {complete,videoGoal,monthDates,monthStats,normalizeState,updateRecord,recordFor} from '../model.mjs';
test('both goals are required and the video limit is strictly under 60',()=>{
  for(const value of ['',null,undefined,' ',NaN,false,true,{},-1,60,'60',61,1441])assert.equal(complete({focus:true,minutes:value}),false,String(value));
  for(const value of [0,'0',20,59,59.5])assert.equal(complete({focus:true,minutes:value}),true,String(value));
  assert.equal(complete({focus:false,minutes:10}),false);assert.equal(complete(null),false);assert.equal(videoGoal(null),false);
});
test('calendar months handle leap years and year boundaries',()=>{
  assert.equal(monthDates(2028,1).length,29);assert.equal(monthDates(2027,1).length,28);assert.equal(monthDates(2026,11).at(-1),'2026-12-31');assert.equal(monthDates(2027,0)[0],'2027-01-01');
});
test('monthly history and best streak stay intact after missed days',()=>{
  const state={start:'2026-10-30',days:{'2026-10-30':{focus:true,minutes:20},'2026-10-31':{focus:true,minutes:59},'2026-11-01':{focus:true,minutes:60},'2026-11-02':{focus:true,minutes:59}}};
  assert.deepEqual(monthStats(state,2026,9,'2026-11-03'),{count:2,best:2,total:2,rate:100});
  assert.deepEqual(monthStats(state,2026,10,'2026-11-03'),{count:1,best:1,total:3,rate:33.3});
  assert.deepEqual(monthStats(state,2026,11,'2026-11-03'),{count:0,best:0,total:0,rate:0});
});
test('legacy saved history survives the redesign and later edits',()=>{
  const old={start:'2026-11-01',days:{'2026-11-01':{focus:true,minutes:59,thoughts:'Keep this old note',parked:true,checked:true}}};
  const state=normalizeState(old,'2026-11-03'),updated=updateRecord(state,'2026-11-01',{minutes:'60'},'2026-11-03');
  assert.equal(complete(recordFor(state,'2026-11-01')),true);assert.equal(complete(recordFor(updated,'2026-11-01')),false);assert.equal(updated.days['2026-11-01'].thoughts,'Keep this old note');assert.equal(state.days['2026-11-01'].minutes,59);
  assert.throws(()=>updateRecord(state,'2026-11-04',{focus:true},'2026-11-03'));
});
