'use client';
import {useEffect,useState} from 'react';
import {storage} from '@/lib/storage';
import {DEFAULT_SETTINGS,payPeriodBounds,validSettings} from '@/lib/settings';
import type {AppSettings,Backup,BackupStatus,TimeEntry} from '@/lib/types';

const download=(name:string,content:string)=>{const url=URL.createObjectURL(new Blob([content],{type:'application/json'}));const anchor=document.createElement('a');anchor.href=url;anchor.download=name;anchor.click();URL.revokeObjectURL(url)};

export function ManagerPreferences({entries,refresh}:{entries:TimeEntry[];refresh:()=>Promise<void>}){
 const [settings,setSettings]=useState<AppSettings>(DEFAULT_SETTINGS);
 const [backupStatus,setBackupStatus]=useState<BackupStatus|null>(null);
 const [importFile,setImportFile]=useState<File|null>(null);
 const [confirmImport,setConfirmImport]=useState(false);
 const [backupError,setBackupError]=useState(''),[backupNotice,setBackupNotice]=useState(''),[settingsError,setSettingsError]=useState(''),[settingsNotice,setSettingsNotice]=useState('');
 useEffect(()=>{void Promise.all([storage.getSettings(),storage.getBackupStatus()]).then(([nextSettings,status])=>{setSettings(nextSettings);setBackupStatus(status)})},[entries]);
 const period=validSettings(settings)?payPeriodBounds(new Date(),settings):null;
 const saveSettings=async(event:React.FormEvent)=>{event.preventDefault();setSettingsError('');setSettingsNotice('');try{await storage.saveSettings(settings);setBackupStatus(await storage.getBackupStatus());setSettingsNotice('Pay period saved.')}catch(cause){setSettingsError(cause instanceof Error?cause.message:'Could not save pay period.')}};
 const exportJson=async()=>{setBackupError('');setBackupNotice('');try{const backup=await storage.exportAll();download('timeclock-backup.json',JSON.stringify(backup,null,2));await storage.recordBackupExport(backup.revision);setBackupStatus(await storage.getBackupStatus());setBackupNotice('Backup download started. Save the file somewhere you can find it.')}catch{setBackupError('Could not export the backup.')}};
 const importJson=async()=>{if(!importFile||!confirmImport)return;setBackupError('');setBackupNotice('');try{const data=JSON.parse(await importFile.text()) as Backup;await storage.importAll(data);setImportFile(null);setConfirmImport(false);await refresh();setSettings(await storage.getSettings());setBackupStatus(await storage.getBackupStatus());setBackupNotice('Backup imported. Export a fresh copy after reviewing the data.')}catch{setBackupError('Could not import this backup. Check the JSON file.')}};
 return <div className="grid md:grid-cols-2 gap-5">
  <section className="card" aria-label="Backup status">
   <div className="flex justify-between gap-3"><div><h2 className="text-xl font-bold">Backup</h2><p className="muted text-sm mt-1">Keep a copy outside this browser.</p></div>{backupStatus?.needsBackup&&<span className="pill pending self-start">Backup due</span>}</div>
   {!backupStatus?<p className="muted mt-4">Checking backup status…</p>:<div className={'mt-4 rounded-xl p-3 text-sm '+(backupStatus.needsBackup?'bg-amber-50':'bg-teal-50')}><strong>{backupStatus.needsBackup?'Changes need a backup':'No unexported changes'}</strong><p className="mt-1">Last backup export: {backupStatus.lastBackupAt?new Date(backupStatus.lastBackupAt).toLocaleString():'Never'}</p></div>}
   <div className="flex flex-wrap gap-3 mt-4 items-center"><button className="btn secondary" onClick={exportJson}>Export full JSON</button><label className="text-sm">Import JSON <input className="input mt-1" type="file" accept="application/json,.json" onChange={event=>{setImportFile(event.target.files?.[0]||null);setConfirmImport(false)}}/></label></div>
   {importFile&&<div className="mt-4 bg-amber-50 p-3 rounded-lg"><label className="flex gap-2 items-start text-sm"><input type="checkbox" checked={confirmImport} onChange={event=>setConfirmImport(event.target.checked)}/><span>I understand this will overwrite all local time clock data on this browser.</span></label><button className="btn danger mt-3" disabled={!confirmImport} onClick={importJson}>Import and overwrite</button></div>}
   {backupNotice&&<p className="text-sm text-teal-800 mt-3" role="status">{backupNotice}</p>}
   {backupError&&<p className="error" role="alert">{backupError}</p>}
  </section>
  <section className="card"><h2 className="text-xl font-bold">Pay period</h2><p className="muted text-sm mt-1">Choose the first day of a period and how often it repeats.</p>
   <form onSubmit={saveSettings} className="grid sm:grid-cols-2 gap-3 mt-4 items-end"><div><label className="label" htmlFor="pay-anchor">Period start date</label><input className="input" id="pay-anchor" type="date" required value={settings.payPeriodAnchor} onChange={event=>setSettings({...settings,payPeriodAnchor:event.target.value})}/></div><div><label className="label" htmlFor="pay-weeks">Period length</label><select className="input" id="pay-weeks" value={settings.payPeriodWeeks} onChange={event=>setSettings({...settings,payPeriodWeeks:Number(event.target.value)})}>{[1,2,3,4].map(weeks=><option key={weeks} value={weeks}>{weeks} {weeks===1?'week':'weeks'}</option>)}</select></div><button className="btn sm:col-span-2">Save pay period</button></form>
   <p className="muted text-sm mt-4">{period?`Current period: ${period.start.toLocaleDateString()} – ${new Date(period.end.getTime()-1).toLocaleDateString()}`:'Choose a valid start date.'}</p>
   {settingsNotice&&<p className="text-sm text-teal-800 mt-3" role="status">{settingsNotice}</p>}
   {settingsError&&<p className="error" role="alert">{settingsError}</p>}
  </section>
 </div>;
}
