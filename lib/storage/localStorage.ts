import type {Backup,CoverageTarget,EntryFilters,Session,TaskCategory,TimeEntry,User} from '../types';
import {demoData} from '../demo';
import type {StorageAdapter} from './types';
export const STORAGE_KEY='timeclock:v1';export const SCHEMA_VERSION=3;
export function migrate(data:Partial<Backup>&{schemaVersion?:number}):Backup {return {schemaVersion:SCHEMA_VERSION,users:data.users||[],entries:(data.entries||[]).map(e=>({...e,output:e.output||[]})),categories:data.categories||[],targets:data.targets||[],session:data.session||null};}
export async function hashPin(pin:string):Promise<string>{const bytes=new TextEncoder().encode(pin);const digest=await crypto.subtle.digest('SHA-256',bytes);return Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join('');}
export class LocalStorageAdapter implements StorageAdapter {
 private async read():Promise<Backup>{if(typeof window==='undefined')return migrate({});const raw=window.localStorage.getItem(STORAGE_KEY);if(raw){try{const parsed=JSON.parse(raw);const data=migrate(parsed);const seededUsers=data.users.length===4&&data.users.every((u,i)=>u.id===`demo-${i}`);if(parsed.schemaVersion<SCHEMA_VERSION&&seededUsers&&data.entries.length===0&&data.categories.length===0&&data.targets.length===0){Object.assign(data,demoData());}if(parsed.schemaVersion!==SCHEMA_VERSION)window.localStorage.setItem(STORAGE_KEY,JSON.stringify(data));return data;}catch{window.localStorage.removeItem(STORAGE_KEY);}}
 const pins=['1234','1111','2222','3333'];const names=['Manager','Alex Rivera','Jordan Lee','Sam Patel'];const now=new Date().toISOString();const users=await Promise.all(names.map(async(name,i)=>({id:`demo-${i}`,name,role:i===0?'manager' as const:'worker' as const,pinHash:await hashPin(pins[i]),active:true,createdAt:now})));const data=migrate({users,...demoData()});window.localStorage.setItem(STORAGE_KEY,JSON.stringify(data));return data;}
 private async write(data:Backup){if(typeof window==='undefined')return;window.localStorage.setItem(STORAGE_KEY,JSON.stringify(data));}
 async getUsers(){return (await this.read()).users;}
 async getUser(id:string){return (await this.read()).users.find(u=>u.id===id);}
 async saveUser(user:User){const d=await this.read();d.users=d.users.filter(u=>u.id!==user.id).concat(user);await this.write(d);}
 async getEntries(f:EntryFilters={}){return (await this.read()).entries.filter(e=>(!f.userId||e.userId===f.userId)&&(!f.status||e.status===f.status)&&(!f.from||e.clockIn>=f.from)&&(!f.to||e.clockIn<=f.to)).sort((a,b)=>b.clockIn.localeCompare(a.clockIn));}
 async saveEntry(entry:TimeEntry){const d=await this.read();if(entry.status==='open'&&d.entries.some(e=>e.userId===entry.userId&&e.status==='open'&&e.id!==entry.id))throw new Error('Worker already has an open shift');d.entries=d.entries.filter(e=>e.id!==entry.id).concat(entry);await this.write(d);}
 async deleteEntry(id:string){const d=await this.read();d.entries=d.entries.filter(e=>e.id!==id);await this.write(d);}
 async getSession(){return (await this.read()).session;}
 async saveSession(session:Session|null){const d=await this.read();d.session=session;await this.write(d);}
 async getTaskCategories(){return (await this.read()).categories;}
 async saveTaskCategory(category:TaskCategory){const d=await this.read();d.categories=d.categories.filter(c=>c.id!==category.id).concat(category);await this.write(d);}
 async deleteTaskCategory(id:string){const d=await this.read();d.categories=d.categories.filter(c=>c.id!==id);await this.write(d);}
 async getCoverageTargets(){return (await this.read()).targets;}
 async saveCoverageTarget(target:CoverageTarget){const d=await this.read();d.targets=d.targets.filter(t=>t.dayOfWeek!==target.dayOfWeek||t.hour!==target.hour).concat(target);await this.write(d);}
 async deleteCoverageTarget(dayOfWeek:number,hour:number){const d=await this.read();d.targets=d.targets.filter(t=>t.dayOfWeek!==dayOfWeek||t.hour!==hour);await this.write(d);}
 async exportAll(){return this.read();}
 async importAll(data:Backup){if(!data||!Array.isArray(data.users)||!Array.isArray(data.entries))throw new Error('Invalid backup file');await this.write(migrate(data));}
}
