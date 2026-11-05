import type {TimeEntry} from './types';
export const WEEK_START = 1;
export const SHIFT_BLOCKS = [{name:'Morning',start:6,end:12},{name:'Afternoon',start:12,end:18},{name:'Evening',start:18,end:24}] as const;
export const ms = (s:string) => new Date(s).getTime();
export function workedHours(e:TimeEntry, now=Date.now()):number { const end=e.clockOut?ms(e.clockOut):now; const gross=Math.max(0,end-ms(e.clockIn)); const breaks=e.breaks.reduce((sum,b)=>sum+Math.max(0,Math.min(b.end?ms(b.end):now,end)-Math.max(ms(b.start),ms(e.clockIn))),0); return Math.max(0,(gross-breaks)/3600000); }
export function overlaps(a:TimeEntry,b:TimeEntry):boolean {return a.userId===b.userId && a.id!==b.id && ms(a.clockIn)<(b.clockOut?ms(b.clockOut):Infinity) && ms(b.clockIn)<(a.clockOut?ms(a.clockOut):Infinity);}
export function validateEntry(e:TimeEntry,others:TimeEntry[]):string|null {const start=ms(e.clockIn),end=e.clockOut?ms(e.clockOut):null;if(!Number.isFinite(start)|| (e.clockOut&&!Number.isFinite(end)))return 'Enter valid times.';if(end!==null&&end<=start)return 'Clock out must be after clock in.';if(end!==null&&end-start>24*3600000)return 'Shifts cannot exceed 24 hours.';if(e.breaks.some(b=>!Number.isFinite(ms(b.start))||(b.end!==null&&!Number.isFinite(ms(b.end)))||ms(b.start)<start || (end!==null&&(b.end?ms(b.end):Date.now())>end) || (b.end!==null&&ms(b.end)<=ms(b.start))))return 'Breaks must fall inside the shift.';if(others.some(o=>overlaps(e,o)))return 'This shift overlaps another entry.';return null;}
export function monday(d:Date):Date {const x=new Date(d);x.setHours(0,0,0,0);x.setDate(x.getDate()-((x.getDay()+6)%7));return x;}
export function localDate(s:string){return new Date(s).toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'});}
export function localTime(s:string|null){return s?new Date(s).toLocaleTimeString(undefined,{hour:'numeric',minute:'2-digit'}):'—';}
export function hoursLabel(n:number){return n.toFixed(2);}
export function transition(e:TimeEntry,to:'pending'|'approved'|'rejected',reviewer?:string,comment=''):TimeEntry {if((to==='pending'&&e.status!=='open'&&e.status!=='rejected')||(to!=='pending'&&e.status!=='pending'))throw new Error('Invalid status transition');return {...e,status:to,clockOut:to==='pending'&&e.status==='open'?new Date().toISOString():e.clockOut,reviewedBy:to==='pending'?null:reviewer||null,reviewedAt:to==='pending'?null:new Date().toISOString(),reviewComment:to==='pending'?'':comment,updatedAt:new Date().toISOString()};}
export function correctMissedClockOut(entry:TimeEntry,clockOut:string,note:string,breakEnd?:string,now=new Date()):TimeEntry {
 if(entry.status!=='open')throw new Error('Only an open shift can be corrected.');
 if(!note.trim())throw new Error('Explain the missed clock out.');
 if(!Number.isFinite(ms(clockOut)))throw new Error('Enter a valid clock-out time.');
 if(ms(clockOut)>now.getTime())throw new Error('Clock out cannot be in the future.');
 if(entry.breaks.some(b=>!b.end)&&!breakEnd)throw new Error('Enter when the open break ended.');
 const breaks=entry.breaks.map(b=>b.end?b:{...b,end:breakEnd||null});
 const corrected:TimeEntry={...entry,clockOut,breaks,note:note.trim(),source:'manual',status:'pending',reviewedBy:null,reviewedAt:null,reviewComment:'',updatedAt:now.toISOString()};
 const error=validateEntry(corrected,[]);
 if(error)throw new Error(error);
 return corrected;
}
export function newEntry(userId:string,start:string,source:'clock'|'manual',end:string|null=null,note='',department='Unassigned'):TimeEntry {const now=new Date().toISOString();return {id:crypto.randomUUID(),userId,department,clockIn:start,clockOut:end,breaks:[],note,source,status:end?'pending':'open',reviewedBy:null,reviewedAt:null,reviewComment:'',createdAt:now,updatedAt:now,output:[]};}
