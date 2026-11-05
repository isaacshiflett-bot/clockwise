import type {AppSettings,TimeEntry,User} from './types';
import {monday,workedHours} from './time';
import {payPeriodBounds} from './settings';

export type PayrollRow={workerId:string;worker:string;department:string;date:string;weekStart:string;dailyHours:number;weeklyHours:number;shifts:number};
const localKey=(value:string|Date)=>{const d=new Date(value);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`};

export function periodAtOffset(now:Date,settings:AppSettings,offset:number){
 const current=payPeriodBounds(now,settings);
 const start=new Date(current.start),end=new Date(current.end);
 start.setDate(start.getDate()-offset*settings.payPeriodWeeks*7);
 end.setDate(end.getDate()-offset*settings.payPeriodWeeks*7);
 return {start,end};
}

export function payrollRows(entries:TimeEntry[],users:User[],start:string,end:string):PayrollRow[]{
 const approved=entries.filter(e=>e.status==='approved'&&e.clockOut&&e.clockIn>=start&&e.clockIn<end);
 const weeks=new Map<string,number>();
 const days=new Map<string,{workerId:string;worker:string;department:string;date:string;weekStart:string;hours:number;shifts:number}>();
 for(const entry of entries.filter(e=>e.status==='approved'&&e.clockOut)){
  const weekKey=`${entry.userId}|${localKey(monday(new Date(entry.clockIn)))}`;
  weeks.set(weekKey,(weeks.get(weekKey)||0)+workedHours(entry));
 }
 for(const entry of approved){
  const worker=users.find(u=>u.id===entry.userId)?.name||'Unknown';
  const date=localKey(entry.clockIn),weekStart=localKey(monday(new Date(entry.clockIn)));
  const hours=workedHours(entry);
  const dayKey=`${entry.userId}|${date}|${entry.department}`;
  const row=days.get(dayKey)||{workerId:entry.userId,worker,department:entry.department,date,weekStart,hours:0,shifts:0};
  row.hours+=hours;row.shifts++;days.set(dayKey,row);
 }
 return [...days.values()].map(row=>({...row,dailyHours:Number(row.hours.toFixed(2)),weeklyHours:Number((weeks.get(`${row.workerId}|${row.weekStart}`)||0).toFixed(2))})).sort((a,b)=>a.worker.localeCompare(b.worker)||a.date.localeCompare(b.date)||a.department.localeCompare(b.department));
}
