import {sampleEntries} from './insights';
import {DEMO_DEPARTMENTS,UNASSIGNED_DEPARTMENT} from './departments';
import {newEntry} from './time';
import type {CoverageTarget,TaskCategory,TimeEntry} from './types';

const iso = (date:Date) => date.toISOString();

function eveningShift(userId:string,daysAgo:number,status:'pending'|'rejected',now:Date):TimeEntry {
  const start=new Date(now);
  start.setDate(start.getDate()-daysAgo);
  start.setHours(18,30,0,0);
  const end=new Date(start.getTime()+3.5*3600000);
  const entry=newEntry(userId,iso(start),'manual',iso(end),status==='pending'?'Demo: missed clock punch':'Demo: corrected time requested',DEMO_DEPARTMENTS[userId]||UNASSIGNED_DEPARTMENT);
  return {...entry,status,reviewedBy:status==='rejected'?'demo-0':null,reviewedAt:status==='rejected'?iso(end):null,reviewComment:status==='rejected'?'Please confirm the end time.':'',output:[{categoryId:'demo-orders-packed',count:12}]};
}

export function demoData(now=new Date()):{entries:TimeEntry[];categories:TaskCategory[];targets:CoverageTarget[]} {
  const categories:TaskCategory[]=[
    {id:'demo-orders-packed',name:'Orders packed',unit:'orders',active:true},
    {id:'demo-tickets-closed',name:'Tickets closed',unit:'tickets',active:true},
  ];
  const targets:CoverageTarget[]=[];
  for(let dayOfWeek=1;dayOfWeek<=5;dayOfWeek++)for(let hour=8;hour<18;hour++)targets.push({dayOfWeek,hour,headcount:2});
  const entries=sampleEntries(['demo-1','demo-2','demo-3'],categories.map(c=>c.id),now,DEMO_DEPARTMENTS);
  entries.push(eveningShift('demo-1',1,'pending',now));
  entries.push(eveningShift('demo-2',2,'pending',now));
  entries.push(eveningShift('demo-3',3,'rejected',now));
  return {entries,categories,targets};
}
