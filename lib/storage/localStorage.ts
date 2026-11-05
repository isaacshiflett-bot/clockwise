import type {AppSettings,Backup,CoverageTarget,EntryFilters,Session,TaskCategory,TimeEntry,User} from '../types';
import {demoData} from '../demo';
import {cleanDepartment,DEMO_DEPARTMENTS} from '../departments';
import {DEFAULT_SETTINGS,validSettings} from '../settings';
import type {StorageAdapter} from './types';
export const STORAGE_KEY='timeclock:v1';export const SCHEMA_VERSION=5;
export function migrate(data:Partial<Backup>&{schemaVersion?:number}):Backup {const users=(data.users||[]).map(u=>({...u,department:cleanDepartment(u.department||DEMO_DEPARTMENTS[u.id])}));return {schemaVersion:SCHEMA_VERSION,users,entries:(data.entries||[]).map(e=>({...e,department:cleanDepartment(e.department||users.find(u=>u.id===e.userId)?.department),output:e.output||[]})),categories:data.categories||[],targets:data.targets||[],session:data.session||null,settings:data.settings&&validSettings(data.settings)?data.settings:{...DEFAULT_SETTINGS},revision:typeof data.revision==='number'&&Number.isSafeInteger(data.revision)&&data.revision>=0?data.revision:0,lastBackupRevision:typeof data.lastBackupRevision==='number'&&Number.isSafeInteger(data.lastBackupRevision)&&data.lastBackupRevision>=0?data.lastBackupRevision:null,lastBackupAt:data.lastBackupAt||null};}
export async function hashPin(pin:string):Promise<string>{const bytes=new TextEncoder().encode(pin);const digest=await crypto.subtle.digest('SHA-256',bytes);return Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join('');}
export class LocalStorageAdapter implements StorageAdapter {
 private async read():Promise<Backup>{if(typeof window==='undefined')return migrate({});const raw=window.localStorage.getItem(STORAGE_KEY);if(raw){try{const parsed=JSON.parse(raw);const data=migrate(parsed);const seededUsers=data.users.length===4&&data.users.every((u,i)=>u.id===`demo-${i}`);if(parsed.schemaVersion<3&&seededUsers&&data.entries.length===0&&data.categories.length===0&&data.targets.length===0){Object.assign(data,demoData());}if(parsed.schemaVersion!==SCHEMA_VERSION)window.localStorage.setItem(STORAGE_KEY,JSON.stringify(data));return data;}catch{window.localStorage.removeItem(STORAGE_KEY);}}
 const pins=['1234','1111','2222','3333'];const names=['Manager','Alex Rivera','Jordan Lee','Sam Patel'];const now=new Date().toISOString();const users=await Promise.all(names.map(async(name,i)=>({id:`demo-${i}`,name,role:i===0?'manager' as const:'worker' as const,pinHash:await hashPin(pins[i]),active:true,createdAt:now,department:cleanDepartment(DEMO_DEPARTMENTS[`demo-${i}`])})));const data=migrate({users,...demoData()});window.localStorage.setItem(STORAGE_KEY,JSON.stringify(data));return data;}
 private async write(data:Backup,trackChange=true){if(typeof window==='undefined')return;if(trackChange)data.revision++;window.localStorage.setItem(STORAGE_KEY,JSON.stringify(data));}
 async getUsers(){return (await this.read()).users;}
 async getUser(id:string){return (await this.read()).users.find(u=>u.id===id);}
 async saveUser(user:User){const d=await this.read();d.users=d.users.filter(u=>u.id!==user.id).concat(user);await this.write(d);}
 async getEntries(f:EntryFilters={}){return (await this.read()).entries.filter(e=>(!f.userId||e.userId===f.userId)&&(!f.status||e.status===f.status)&&(!f.from||e.clockIn>=f.from)&&(!f.to||e.clockIn<=f.to)).sort((a,b)=>b.clockIn.localeCompare(a.clockIn));}
 async saveEntry(entry:TimeEntry){const d=await this.read();if(entry.status==='open'&&d.entries.some(e=>e.userId===entry.userId&&e.status==='open'&&e.id!==entry.id))throw new Error('Worker already has an open shift');d.entries=d.entries.filter(e=>e.id!==entry.id).concat(entry);await this.write(d);}
 async deleteEntry(id:string){const d=await this.read();d.entries=d.entries.filter(e=>e.id!==id);await this.write(d);}
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
 async importAll(data:Backup){if(!data||!Array.isArray(data.users)||!Array.isArray(data.entries))throw new Error('Invalid backup file');const restored=migrate(data);restored.lastBackupAt=null;restored.lastBackupRevision=null;await this.write(restored);}
}
