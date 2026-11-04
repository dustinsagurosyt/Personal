import {test} from 'node:test';
import assert from 'node:assert/strict';
import { pebbleBalance,rewardProgress,complete,practiceGoal,videoGoal,monthDates,monthStats,normalizeState,updateRecord,recordFor} from '../model.mjs';
test('gratitude needs writing and completion; video limit stays strictly under 60',()=>{
  for(const value of ['',null,undefined,' ',NaN,false,true,{},-1,60,'60',61,1441])assert.equal(complete({gratitudeDone:true,gratitudeText:'A warm meal',minutes:value}),false,String(value));
  for(const value of [0,'0',20,59,59.5])assert.equal(complete({gratitudeDone:true,gratitudeText:'A warm meal',minutes:value}),true,String(value));
  assert.equal(complete({gratitudeDone:true,gratitudeText:' ',minutes:10}),false);assert.equal(complete({gratitudeDone:false,gratitudeText:'Family',minutes:10}),false);assert.equal(complete(null),false);assert.equal(videoGoal(null),false);
});
test('calendar months retain leap years and year boundaries',()=>{
  assert.equal(monthDates(2028,1).length,29);assert.equal(monthDates(2027,1).length,28);assert.equal(monthDates(2026,11).at(-1),'2026-12-31');assert.equal(monthDates(2027,0)[0],'2027-01-01');
});
test('prior focus achievements survive, but today needs the new gratitude goal',()=>{
  const old={start:'2026-11-01',days:{'2026-11-02':{focus:true,minutes:59,thoughts:'Old private note'},'2026-11-03':{focus:true,minutes:59}}};
  const state=normalizeState(old,'2026-11-03');assert.equal(state.gratitudeSince,'2026-11-03');assert.equal(complete(state.days['2026-11-02'],'2026-11-02',state),true);assert.equal(complete(state.days['2026-11-03'],'2026-11-03',state),false);assert.equal(normalizeState(state,'2026-11-04').gratitudeSince,'2026-11-03');
  const updated=updateRecord(state,'2026-11-03',{gratitudeText:'My friends',gratitudeDone:true},'2026-11-03');assert.equal(complete(updated.days['2026-11-03'],'2026-11-03',updated),true);assert.equal(updated.days['2026-11-02'].thoughts,'Old private note');assert.equal(updated.days['2026-11-02'].gratitudeText,undefined);
  assert.throws(()=>updateRecord(state,'2026-11-04',{gratitudeDone:true},'2026-11-03'));
});
test('monthly statistics combine truthful legacy history and new gratitude days',()=>{
  const state={start:'2026-10-30',gratitudeSince:'2026-11-01',days:{'2026-10-30':{focus:true,minutes:20},'2026-10-31':{focus:true,minutes:59},'2026-11-01':{gratitudeDone:true,gratitudeText:'My family',minutes:60},'2026-11-02':{gratitudeDone:true,gratitudeText:'A quiet morning',minutes:59}}};
  assert.deepEqual(monthStats(state,2026,9,'2026-11-03'),{count:2,best:2,total:2,rate:100});assert.deepEqual(monthStats(state,2026,10,'2026-11-03'),{count:1,best:1,total:3,rate:33.3});assert.deepEqual(monthStats(state,2026,11,'2026-11-03'),{count:0,best:0,total:0,rate:0});
});

test('rewards span months and group distinct completed entries into capsules',()=>{
  const dates=['2026-10-20','2026-10-21','2026-10-22','2026-10-23','2026-10-24','2026-10-25','2026-10-26','2026-11-01','2026-11-02','2026-11-03'];
  const days=Object.fromEntries(dates.map((key,index)=>[key,{gratitudeDone:true,gratitudeText:key,minutes:index<5?59:60}]));
  days['2026-10-31']={gratitudeDone:false,gratitudeText:'Draft',minutes:5};
  days['2026-11-04']={gratitudeDone:true,gratitudeText:'Future',minutes:5};
  assert.deepEqual(rewardProgress({days},'2026-11-03'),{leaves:5,branches:1,entries:10,capsules:[dates[0],dates[5]]});
});

test('pebbles accumulate at 3, 5 and 7 days per streak across month boundaries',()=>{
  const day={gratitudeDone:true,gratitudeText:'A good moment',minutes:20};
  const dates=['2026-10-29','2026-10-30','2026-10-31','2026-11-01','2026-11-02','2026-11-03','2026-11-04','2026-11-05','2026-11-07','2026-11-08','2026-11-09'];
  const state=normalizeState({days:Object.fromEntries(dates.map(key=>[key,day]))},'2026-11-09');
  for(const [date,balance] of [['2026-10-30',0],['2026-10-31',1],['2026-11-02',3],['2026-11-04',6],['2026-11-05',6],['2026-11-06',6],['2026-11-09',7]]){
    assert.equal(pebbleBalance(state,date),balance);
  }
});
