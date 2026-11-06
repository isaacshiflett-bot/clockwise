import type {AppSettings,Backup,CoverageTarget,EntryFilters,PayPeriodCloseout,Session,TaskCategory,TimeEntry,User} from '../types';
import {demoData} from '../demo';
import {cleanDepartment,DEMO_DEPARTMENTS} from '../departments';
import {DEFAULT_SETTINGS,validSettings} from '../settings';
import {validateEntry} from '../time';
import type {StorageAdapter} from './types';
export const STORAGE_KEY='timeclock:v1';export const SCHEMA_VERSION=6;
export function migrate(data:Partial<Backup>&{schemaVersion?:number}):Backup {const users=(data.users||[]).map(u=>({...u,department:cleanDepartment(u.department||DEMO_DEPARTMENTS[u.id])}));return {schemaVersion:SCHEMA_VERSION,users,entries:(data.entries||[]).map(e=>({...e,department:cleanDepartment(e.department||users.find(u=>u.id===e.userId)?.department),output:e.output||[]})),categories:data.categories||[],targets:data.targets||[],auditEvents:data.auditEvents||[],closeouts:data.closeouts||[],session:data.session||null,settings:data.settings&&validSettings(data.settings)?data.settings:{...DEFAULT_SETTINGS},revision:typeof data.revision==='number'&&Number.isSafeInteger(data.revision)&&data.revision>=0?data.revision:0,lastBackupRevision:typeof data.lastBackupRevision==='number'&&Number.isSafeInteger(data.lastBackupRevision)&&data.lastBackupRevision>=0?data.lastBackupRevision:null,lastBackupAt:data.lastBackupAt||null};}
export async function hashPin(pin:string):Promise<string>{const bytes=new TextEncoder().encode(pin);const digest=await crypto.subtle.digest('SHA-256',bytes);return Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join('');}
export class LocalStorageAdapter implements StorageAdapter {
 private async read():Promise<Backup>{
  if(typeof window==='undefined')return migrate({});
  const raw=window.localStorage.getItem(STORAGE_KEY);
  if(raw){
   let parsed:Partial<Backup>&{schemaVersion?:number};
   try{parsed=JSON.parse(raw)}catch{throw new Error('Saved time data is unreadable. Your browser data was preserved; restore a valid JSON backup before continuing.')}
   if(!parsed||typeof parsed!=='object'||!Array.isArray(parsed.users)||!Array.isArray(parsed.entries))throw new Error('Saved time data has an invalid structure. Your browser data was preserved.');
   if(typeof parsed.schemaVersion==='number'&&parsed.schemaVersion>SCHEMA_VERSION)throw new Error('Saved time data is from a newer app version. Your browser data was preserved.');
   let data:Backup;
   try{data=migrate(parsed)}catch{throw new Error('Saved time data could not be migrated. Your browser data was preserved.')}
   const seededUsers=data.users.length===4&&data.users.every((u,i)=>u.id===`demo-${i}`);
   if((parsed.schemaVersion||0)<3&&seededUsers&&data.entries.length===0&&data.categories.length===0&&data.targets.length===0)Object.assign(data,demoData());
   if(parsed.schemaVersion!==SCHEMA_VERSION){
    try{window.localStorage.setItem(STORAGE_KEY,JSON.stringify(data))}catch{throw new Error('Could not save the upgraded time data. Your original browser data was preserved; free storage space or export a backup before retrying.')}
   }
   return data;
  }
 const pins=['1234','1111','2222','3333'];const names=['Manager','Alex Rivera','Jordan Lee','Sam Patel'];const now=new Date().toISOString();const users=await Promise.all(names.map(async(name,i)=>({id:`demo-${i}`,name,role:i===0?'manager' as const:'worker' as const,pinHash:await hashPin(pins[i]),active:true,createdAt:now,department:cleanDepartment(DEMO_DEPARTMENTS[`demo-${i}`])})));const data=migrate({users,...demoData()});window.localStorage.setItem(STORAGE_KEY,JSON.stringify(data));return data;}
 private async write(data:Backup,trackChange=true){if(typeof window==='undefined')return;if(trackChange)data.revision++;window.localStorage.setItem(STORAGE_KEY,JSON.stringify(data));}
 async getUsers(){return (await this.read()).users;}
 async getUser(id:string){return (await this.read()).users.find(u=>u.id===id);}
 async saveUser(user:User){const d=await this.read();d.users=d.users.filter(u=>u.id!==user.id).concat(user);await this.write(d);}
 async getEntries(f:EntryFilters={}){return (await this.read()).entries.filter(e=>(!f.userId||e.userId===f.userId)&&(!f.status||e.status===f.status)&&(!f.from||e.clockIn>=f.from)&&(!f.to||e.clockIn<=f.to)).sort((a,b)=>b.clockIn.localeCompare(a.clockIn));}
 async saveEntry(entry:TimeEntry){const d=await this.read();const before=d.entries.find(e=>e.id===entry.id)||null;if(entry.status==='open'&&d.entries.some(e=>e.userId===entry.userId&&e.status==='open'&&e.id!==entry.id))throw new Error('Worker already has an open shift');if(d.closeouts.some(c=>!c.reopenedAt&&((entry.clockIn>=c.start&&entry.clockIn<c.end)||(before&&before.clockIn>=c.start&&before.clockIn<c.end))))throw new Error('This pay period is closed. Ask a manager to reopen it.');const action=before===null?'created':before.status==='pending'&&entry.status==='approved'?'approved':before.status==='pending'&&entry.status==='rejected'?'rejected':'updated';d.entries=d.entries.filter(e=>e.id!==entry.id).concat(entry);d.auditEvents.push({id:crypto.randomUUID(),entryId:entry.id,userId:entry.userId,actorId:d.session?.userId||'system',action,at:new Date().toISOString(),before,after:entry});await this.write(d);}
 async deleteEntry(id:string){const d=await this.read();const before=d.entries.find(e=>e.id===id);if(!before)return;if(d.closeouts.some(c=>!c.reopenedAt&&before.clockIn>=c.start&&before.clockIn<c.end))throw new Error('This pay period is closed. Ask a manager to reopen it.');d.entries=d.entries.filter(e=>e.id!==id);d.auditEvents.push({id:crypto.randomUUID(),entryId:id,userId:before.userId,actorId:d.session?.userId||'system',action:'deleted',at:new Date().toISOString(),before,after:null});await this.write(d);}
 async replaceSampleData(samples:TimeEntry[],categories:TaskCategory[]){
  const d=await this.read();
  const actor=d.users.find(user=>user.id===d.session?.userId&&user.role==='manager'&&user.active);
  if(!actor)throw new Error('Manager sign-in required.');
  const oldSamples=d.entries.filter(entry=>entry.id.startsWith('sample-'));
  const kept=d.entries.filter(entry=>!entry.id.startsWith('sample-'));
  const ids=new Set<string>();
  for(const entry of samples){
   if(!entry.id.startsWith('sample-')||ids.has(entry.id))throw new Error('Invalid demo shift IDs.');
   ids.add(entry.id);
  }
  if([...oldSamples,...samples].some(entry=>d.closeouts.some(period=>!period.reopenedAt&&entry.clockIn>=period.start&&entry.clockIn<period.end)))throw new Error('A demo shift is in a closed pay period. Reopen that period before replacing sample data.');
  const accepted:TimeEntry[]=[];
  for(const entry of samples){
   const error=validateEntry(entry,[...kept,...accepted]);
   if(error)throw new Error(`Demo shift could not be loaded: ${error}`);
   accepted.push(entry);
  }
  const at=new Date().toISOString();
  for(const before of oldSamples.filter(entry=>!ids.has(entry.id)))d.auditEvents.push({id:crypto.randomUUID(),entryId:before.id,userId:before.userId,actorId:actor.id,action:'deleted',at,before,after:null});
  for(const after of samples){const before=oldSamples.find(entry=>entry.id===after.id)||null;d.auditEvents.push({id:crypto.randomUUID(),entryId:after.id,userId:after.userId,actorId:actor.id,action:before?'updated':'created',at,before,after});}
  d.entries=kept.concat(samples);
  for(const category of categories)d.categories=d.categories.filter(existing=>existing.id!==category.id).concat(category);
  await this.write(d);
 }
 async getAuditEvents(){return (await this.read()).auditEvents.slice().sort((a,b)=>b.at.localeCompare(a.at));}
 async getCloseouts(){return (await this.read()).closeouts.slice().sort((a,b)=>b.closedAt.localeCompare(a.closedAt));}
 async closePayPeriod(start:string,end:string):Promise<PayPeriodCloseout>{const d=await this.read();const actor=d.users.find(u=>u.id===d.session?.userId&&u.role==='manager'&&u.active);if(!actor)throw new Error('Manager sign-in required.');const startTime=new Date(start).getTime(),endTime=new Date(end).getTime();if(!Number.isFinite(startTime)||!Number.isFinite(endTime)||endTime<=startTime||endTime>Date.now())throw new Error('Choose a completed pay period.');if(d.closeouts.some(c=>!c.reopenedAt&&start<c.end&&c.start<end))throw new Error('This period overlaps an already closed period.');const periodEntries=d.entries.filter(e=>e.clockIn>=start&&e.clockIn<end);if(!periodEntries.length)throw new Error('There are no shifts in this period.');if(periodEntries.some(e=>e.status!=='approved'))throw new Error('Resolve open, pending, and rejected shifts before closing.');const closeout={id:crypto.randomUUID(),start,end,closedAt:new Date().toISOString(),closedBy:actor.id,reopenedAt:null,reopenedBy:null};d.closeouts.push(closeout);await this.write(d);return closeout;}
 async reopenPayPeriod(id:string){const d=await this.read();const actor=d.users.find(u=>u.id===d.session?.userId&&u.role==='manager'&&u.active);if(!actor)throw new Error('Manager sign-in required.');const closeout=d.closeouts.find(c=>c.id===id&&!c.reopenedAt);if(!closeout)throw new Error('Closed period not found.');closeout.reopenedAt=new Date().toISOString();closeout.reopenedBy=actor.id;await this.write(d);}
 async getSession(){return (await this.read()).session;}
 async saveSession(session:Session|null){const d=await this.read();d.session=session;await this.write(d,false);}
 async getTaskCategories(){return (await this.read()).categories;}
 async saveTaskCategory(category:TaskCategory){const d=await this.read();d.categories=d.categories.filter(c=>c.id!==category.id).concat(category);await this.write(d);}
 async deleteTaskCategory(id:string){const d=await this.read();d.categories=d.categories.filter(c=>c.id!==id);await this.write(d);}
 async getCoverageTargets(){return (await this.read()).targets;}
 async saveCoverageTarget(target:CoverageTarget){const d=await this.read();d.targets=d.targets.filter(t=>t.dayOfWeek!==target.dayOfWeek||t.hour!==target.hour).concat(target);await this.write(d);}
 async deleteCoverageTarget(dayOfWeek:number,hour:number){const d=await this.read();d.targets=d.targets.filter(t=>t.dayOfWeek!==dayOfWeek||t.hour!==hour);await this.write(d);}
 async getSettings(){return (await this.read()).settings;}
 async saveSettings(settings:AppSettings){if(!validSettings(settings))throw new Error('Choose a valid start date and 1–4 week period.');const d=await this.read();d.settings={...settings};await this.write(d);}
 async getBackupStatus(){const d=await this.read();return {lastBackupAt:d.lastBackupAt,needsBackup:d.lastBackupRevision===null||d.revision>d.lastBackupRevision};}
 async recordBackupExport(revision:number){const d=await this.read();if(!Number.isSafeInteger(revision)||revision<0||revision>d.revision)throw new Error('Invalid backup revision');d.lastBackupAt=new Date().toISOString();d.lastBackupRevision=revision;await this.write(d,false);}
 async exportAll(){return this.read();}
 async importAll(data:Backup){if(!data||!Array.isArray(data.users)||!Array.isArray(data.entries))throw new Error('Invalid backup file');if(data.schemaVersion>SCHEMA_VERSION)throw new Error('This backup is from a newer app version.');const restored=migrate(data);restored.lastBackupAt=null;restored.lastBackupRevision=null;await this.write(restored);}
}
