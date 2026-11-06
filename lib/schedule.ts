import type {ScheduleAssignment,ShippingArea,TimeEntry,User} from './types';
import {workedHours} from './time';

export const SHIPPING_AREAS:ShippingArea[]=['Receiving','Picking','Packing','Loading','Dispatch','Returns'];
export const dateKey=(date:Date)=>`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
export function weekDates(date:Date):Date[]{const first=new Date(date.getFullYear(),date.getMonth(),date.getDate());first.setDate(first.getDate()-(first.getDay()+6)%7);return Array.from({length:7},(_,i)=>{const day=new Date(first);day.setDate(first.getDate()+i);return day});}
export function demoAssignments(now:Date,users:User[]):ScheduleAssignment[]{const at=now.toISOString(),workers=users.filter(u=>u.role==='worker'&&u.active);return weekDates(now).slice(0,5).flatMap((day,dayIndex)=>workers.length?Array.from({length:Math.min(2,workers.length)},(_,slot)=>{const u=workers[(dayIndex+slot)%workers.length];return {id:`demo-schedule-${dateKey(day)}-${u.id}`,userId:u.id,date:dateKey(day),area:SHIPPING_AREAS[(dayIndex+slot)%4],startTime:'08:00',endTime:'16:30',status:'planned' as const,replacesId:null,note:'Demo weekly assignment',createdAt:at,updatedAt:at}}):[]);}
export function validateAssignment(item:ScheduleAssignment,all:ScheduleAssignment[],users:User[]):string|null{
 const user=users.find(u=>u.id===item.userId&&u.role==='worker'&&u.active);
 if(!user)return 'Choose an active worker.';
 if(!/^\d{4}-\d{2}-\d{2}$/.test(item.date)||dateKey(new Date(`${item.date}T12:00:00`))!==item.date)return 'Choose a valid date.';
 if(!SHIPPING_AREAS.includes(item.area))return 'Choose a shipping area.';
 if(!/^([01]\d|2[0-3]):[0-5]\d$/.test(item.startTime)||!/^([01]\d|2[0-3]):[0-5]\d$/.test(item.endTime)||item.endTime<=item.startTime)return 'End time must be after start time.';
 if(item.status!=='planned'&&item.status!=='coverage')return 'Only active assignments can be saved.';
 if(all.some(other=>other.id!==item.id&&other.userId===item.userId&&other.date===item.date&&other.status!=='callout'))return `${user.name} already has an assignment on this date.`;
 return null;
}
export function weekSummary(assignments:ScheduleAssignment[],entries:TimeEntry[],weekStart:string){const end=new Date(`${weekStart}T12:00:00`);end.setDate(end.getDate()+7);const to=dateKey(end);const scheduled=assignments.filter(a=>a.date>=weekStart&&a.date<to);const shifts=entries.filter(e=>dateKey(new Date(e.clockIn))>=weekStart&&dateKey(new Date(e.clockIn))<to);return {scheduled:scheduled.filter(a=>a.status!=='callout').length,callouts:scheduled.filter(a=>a.status==='callout').length,covered:scheduled.filter(a=>a.status==='coverage').length,approvedHours:shifts.filter(e=>e.status==='approved').reduce((sum,e)=>sum+workedHours(e),0),pendingHours:shifts.filter(e=>e.status==='pending').reduce((sum,e)=>sum+workedHours(e),0)};}
