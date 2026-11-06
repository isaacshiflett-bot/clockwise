import {describe,it,expect} from 'vitest';import {correctMissedClockOut,newEntry,overlaps,transition,validateEntry,workedHours} from './time';import {hourlyCoverage,overtimeProjection,unitsPerHour,weekdayOccurrences,sampleEntries} from './insights';import type {TimeEntry} from './types';
const entry=(start:string,end:string):TimeEntry=>({...newEntry('u',start,'manual',end,'test'),id:start});
describe('time calculations',()=>{it('subtracts breaks',()=>{const e=entry('2026-01-05T09:00:00Z','2026-01-05T17:00:00Z');e.breaks=[{start:'2026-01-05T12:00:00Z',end:'2026-01-05T12:30:00Z'}];expect(workedHours(e)).toBe(7.5)});it('keeps midnight crossing on its start date and validates it',()=>{const e=entry('2026-01-05T23:00:00Z','2026-01-06T02:00:00Z');expect(workedHours(e)).toBe(3);expect(validateEntry(e,[])).toBeNull()});it('detects overlaps and rejects long shifts',()=>{const a=entry('2026-01-05T09:00:00Z','2026-01-05T17:00:00Z');const b=entry('2026-01-05T16:00:00Z','2026-01-05T19:00:00Z');expect(overlaps(a,b)).toBe(true);expect(validateEntry(b,[a])).toMatch(/overlap/);expect(validateEntry(entry('2026-01-05T00:00:00Z','2026-01-06T01:00:00Z'),[])).toMatch(/24 hours/)});it('guards status transitions',()=>{const e=entry('2026-01-05T09:00:00Z','2026-01-05T17:00:00Z');expect(transition(e,'approved','m').status).toBe('approved');expect(()=>transition(e,'pending')).toThrow()})});
describe('insights',()=>{it('splits partial hours and breaks across midnight',()=>{const e=entry(new Date(2026,0,5,23,30).toISOString(),new Date(2026,0,6,1,30).toISOString());e.breaks=[{start:new Date(2026,0,6,0,15).toISOString(),end:new Date(2026,0,6,0,45).toISOString()}];const bins=hourlyCoverage([e]);expect(bins[1*24+23].workers).toBe(.5);expect(bins[2*24].workers).toBe(.5);expect(bins[2*24+1].workers).toBe(.5)});it('creates demo shifts with usable productivity data',()=>{const shifts=sampleEntries(['u'],['c'],new Date('2026-02-02T12:00:00Z'));expect(shifts).toHaveLength(20);expect(shifts.every(e=>e.output.length===1&&e.output[0].count>0)).toBe(true);expect(unitsPerHour(shifts,'c')?.shifts).toBe(20)});it('counts weekday occurrences in a range',()=>{expect(weekdayOccurrences('2026-01-05','2026-02-01',1)).toBe(4)});it('requires three shifts for rates',()=>{const e=entry('2026-01-05T09:00:00Z','2026-01-05T10:00:00Z');e.output=[{categoryId:'c',count:10}];expect(unitsPerHour([e,e],'c')).toBeNull();expect(unitsPerHour([e,e,e],'c')).toEqual({rate:10,shifts:3})});it('projects remaining weekdays from four weeks of history',()=>{const now=new Date('2026-01-05T18:00:00Z');const today=entry('2026-01-05T09:00:00Z','2026-01-05T17:00:00Z');const past=entry('2025-12-30T09:00:00Z','2025-12-30T17:00:00Z');expect(overtimeProjection([today,past],'u',now)).toEqual({current:8,projected:10})})});

it('averages coverage by actual weekday occurrences and clips boundary shifts',()=>{
 const starts=[2,9,16].map(day=>new Date(2026,10,day,9));
 const shifts=starts.map((start,index)=>({...entry(start.toISOString(),new Date(start.getTime()+3600000).toISOString()),id:`monday-${index}`}));
 const before=new Date(2026,10,1,23,30);
 shifts.push({...entry(before.toISOString(),new Date(before.getTime()+3600000).toISOString()),id:'crossing'});
 const bins=hourlyCoverage(shifts,{start:new Date(2026,10,2),end:new Date(2026,10,17),occurrences:Array.from({length:7},(_,day)=>weekdayOccurrences('2026-11-02','2026-11-16',day))});
 expect(bins[1*24+9].workers).toBe(1);
 expect(bins[1*24].workers).toBeCloseTo(1/6);
 expect(bins[0*24+23].workers).toBe(0);
});





describe('missed clock-out recovery',()=>{
 const now=new Date('2026-01-08T12:00:00Z');
 it('resubmits an old open shift with its original clock-in',()=>{
  const open=newEntry('u','2026-01-05T09:00:00Z','clock');
  const corrected=correctMissedClockOut(open,'2026-01-05T17:00:00Z','Forgot to clock out',undefined,now);
  expect(corrected.id).toBe(open.id);
  expect(corrected.clockIn).toBe(open.clockIn);
  expect(corrected.clockOut).toBe('2026-01-05T17:00:00Z');
  expect(corrected.status).toBe('pending');
  expect(corrected.source).toBe('manual');
  expect(corrected.note).toBe('Forgot to clock out');
 });
 it('requires an actual end for an open break',()=>{
  const open=newEntry('u','2026-01-05T09:00:00Z','clock');
  open.breaks=[{start:'2026-01-05T12:00:00Z',end:null}];
  expect(()=>correctMissedClockOut(open,'2026-01-05T17:00:00Z','Forgot',undefined,now)).toThrow(/open break/);
  const corrected=correctMissedClockOut(open,'2026-01-05T17:00:00Z','Forgot','2026-01-05T12:30:00Z',now);
  expect(workedHours(corrected)).toBe(7.5);
  expect(()=>correctMissedClockOut(open,'2026-01-05T11:00:00Z','Forgot','2026-01-05T12:30:00Z',now)).toThrow(/inside the shift/);
 });
 it('rejects future, overlong, and unexplained corrections',()=>{
  const open=newEntry('u','2026-01-05T09:00:00Z','clock');
  expect(()=>correctMissedClockOut(open,'2026-01-09T17:00:00Z','Forgot',undefined,now)).toThrow(/future/);
  expect(()=>correctMissedClockOut(open,'2026-01-06T10:00:00Z','Forgot',undefined,now)).toThrow(/24 hours/);
  expect(()=>correctMissedClockOut(open,'2026-01-05T17:00:00Z','  ',undefined,now)).toThrow(/Explain/);
 });
});

