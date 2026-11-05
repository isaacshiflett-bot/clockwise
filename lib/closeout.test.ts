import {describe,expect,it} from 'vitest';
import {payrollRows,periodAtOffset} from './closeout';
import {newEntry} from './time';
import type {TimeEntry,User} from './types';

const approved=(start:string,end:string,department='Fulfillment'):TimeEntry=>({...newEntry('u',start,'manual',end,'demo',department),status:'approved'});
const worker:User={id:'u',name:'Alex',role:'worker',pinHash:'',active:true,createdAt:'2025-01-01T00:00:00Z',department:'Fulfillment'};

describe('pay-period closeout totals',()=>{
 it('selects a completed period by calendar weeks',()=>{
  const period=periodAtOffset(new Date(2025,0,22),{payPeriodAnchor:'2025-01-06',payPeriodWeeks:2},1);
  expect(period.start.getDate()).toBe(6);
  expect(period.end.getDate()).toBe(20);
 });
 it('groups approved hours by shift start day and workweek',()=>{
  const entries=[approved('2025-01-06T23:00:00Z','2025-01-07T02:00:00Z'),approved('2025-01-07T03:00:00Z','2025-01-07T05:00:00Z')];
  const rows=payrollRows(entries,[worker],'2025-01-06T00:00:00Z','2025-01-20T00:00:00Z');
  expect(rows.reduce((sum,row)=>sum+row.dailyHours,0)).toBe(5);
  expect(rows[0].weeklyHours).toBe(5);
  expect(rows[0].department).toBe('Fulfillment');
 });
 it('includes approved hours outside the pay period in the same workweek',()=>{
  const entries=[approved('2025-01-06T12:00:00Z','2025-01-06T16:00:00Z'),approved('2025-01-08T12:00:00Z','2025-01-08T16:00:00Z')];
  const rows=payrollRows(entries,[worker],'2025-01-08T00:00:00Z','2025-01-15T00:00:00Z');
  expect(rows).toHaveLength(1);
  expect(rows[0].dailyHours).toBe(4);
  expect(rows[0].weeklyHours).toBe(8);
 });
});
