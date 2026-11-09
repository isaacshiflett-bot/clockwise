'use client';

import {useEffect,useState} from 'react';
import Link from 'next/link';
import {storage} from '@/lib/storage';
import {availablePeriods,payrollRows} from '@/lib/closeout';
import {localDate,localTime,workedHours} from '@/lib/time';
import type {AppSettings,AuditEvent,PayPeriodCloseout,TimeEntry,User} from '@/lib/types';

const csv=(rows:string[][])=>rows.map(row=>row.map(value=>`"${value.replaceAll('"','""')}"`).join(',')).join('\r\n');
const download=(name:string,content:string)=>{const url=URL.createObjectURL(new Blob([content],{type:'text/csv'}));const anchor=document.createElement('a');anchor.href=url;anchor.download=name;anchor.click();URL.revokeObjectURL(url)};
const entrySummary=(entry:TimeEntry|null)=>entry?`${localDate(entry.clockIn)} ${localTime(entry.clockIn)}–${localTime(entry.clockOut)} · ${workedHours(entry).toFixed(2)} h · ${entry.status} · ${entry.department} · ${entry.breaks.length} break(s) · Note: ${entry.note||'None'}`:'None';

export function CloseoutView({users,entries,refresh}:{users:User[];entries:TimeEntry[];refresh:()=>Promise<void>}){
 const [settings,setSettings]=useState<AppSettings|null>(null);
 const [closeouts,setCloseouts]=useState<PayPeriodCloseout[]>([]);
 const [events,setEvents]=useState<AuditEvent[]>([]);
 const [loading,setLoading]=useState(true);
 const [busy,setBusy]=useState(false);
 const [periodKey,setPeriodKey]=useState('');
 const [auditWorker,setAuditWorker]=useState('');
 const [error,setError]=useState('');
 const [notice,setNotice]=useState('');
 const name=(id:string)=>users.find(user=>user.id===id)?.name||'Unknown';
 const load=async()=>{const [nextSettings,nextCloseouts,nextEvents]=await Promise.all([storage.getSettings(),storage.getCloseouts(),storage.getAuditEvents()]);setSettings(nextSettings);setCloseouts(nextCloseouts);setEvents(nextEvents);setLoading(false)};
 useEffect(()=>{void load()},[]);
 if(loading||!settings)return <div className="card" role="status">Loading pay periods and activity…</div>;

 const periods=availablePeriods(new Date(),settings,entries,closeouts);
 const period=periods.find(item=>item.key===periodKey)||periods[0];
 if(!period)return <div className="card">No completed pay periods yet.</div>;
 const start=period.start.toISOString(),end=period.end.toISOString();
 const periodEntries=entries.filter(entry=>entry.clockIn>=start&&entry.clockIn<end);
 const unresolved=periodEntries.filter(entry=>entry.status!=='approved');
 const approved=periodEntries.length-unresolved.length;
 const rows=payrollRows(entries,users,start,end);
 const closed=closeouts.find(item=>!item.reopenedAt&&new Date(item.start).getTime()===period.start.getTime()&&new Date(item.end).getTime()===period.end.getTime());
 const canClose=!closed&&period.end.getTime()<=Date.now()&&periodEntries.length>0&&unresolved.length===0;
 const status=closed?'Closed':unresolved.length?'Needs review':periodEntries.length?'Ready to sign off':'No shifts';
 const statusClass=closed?'approved':unresolved.length?'pending':periodEntries.length?'approved':'open';
 const visibleEvents=events.filter(event=>!auditWorker||event.userId===auditWorker).slice(0,50);

 const close=async()=>{setError('');setNotice('');setBusy(true);try{await storage.closePayPeriod(start,end);await load();await refresh();setNotice('Period signed off. Its time entries are locked.')}catch(cause){setError(cause instanceof Error?cause.message:'Could not close this period.')}finally{setBusy(false)}};
 const reopen=async()=>{if(!closed)return;setError('');setNotice('');setBusy(true);try{await storage.reopenPayPeriod(closed.id);await load();await refresh();setNotice('Period reopened. Corrections are allowed again.')}catch(cause){setError(cause instanceof Error?cause.message:'Could not reopen this period.')}finally{setBusy(false)}};
 const exportCsv=()=>{if(!closed)return;download(`payroll-${period.start.toLocaleDateString('en-CA')}.csv`,csv([['Worker ID','Worker','Department','Work date','Week starting','Approved daily hours','Approved weekly hours','Shifts'],...rows.map(row=>[row.workerId,row.worker,row.department,row.date,row.weekStart,row.dailyHours.toFixed(2),row.weeklyHours.toFixed(2),String(row.shifts)])]));};

 return <div className="grid gap-5">
  <header><p className="eyebrow">Manager workspace</p><h1 className="page-title">Close out a pay period</h1><p className="page-intro">Review exceptions and approved hours before locking a period for payroll.</p></header>

  <section className="card" aria-labelledby="period-heading">
   <div className="flex flex-wrap items-end justify-between gap-4">
    <div className="w-full sm:w-auto sm:min-w-72"><h2 id="period-heading" className="card-title mb-3">1. Choose a period</h2><label className="label" htmlFor="closeout-period">Completed pay period</label><select className="input" id="closeout-period" value={period.key} onChange={event=>{setPeriodKey(event.target.value);setError('');setNotice('')}}>{periods.map(item=><option key={item.key} value={item.key}>{item.start.toLocaleDateString()} – {new Date(item.end.getTime()-1).toLocaleDateString()}</option>)}</select></div>
    <span className={'pill '+statusClass}>{status}</span>
   </div>
   <p className="muted text-sm mt-4">{approved} approved shift{approved===1?'':'s'} · {unresolved.length} needing review</p>
   {closed&&<p className="text-sm mt-4">Signed off by {name(closed.closedBy)} on {new Date(closed.closedAt).toLocaleString()}. Entries in this period are locked.</p>}
   {!closed&&unresolved.length>0&&<div className="mt-5 rounded-xl border border-[#efd9a9] bg-[#fff8e9] p-4"><h3 className="font-bold text-[#76551c]">Shifts to resolve</h3><ul className="grid gap-2 mt-3 text-sm">{unresolved.map(entry=><li key={entry.id} className="flex flex-wrap justify-between gap-2"><span>{name(entry.userId)} · {localDate(entry.clockIn)}</span><span className={'pill '+entry.status}>{entry.status}</span></li>)}</ul><Link href="/manager" className="inline-block mt-3 font-bold text-sm text-teal-800 underline">Go to timecard approvals →</Link></div>}
   {!closed&&periodEntries.length===0&&<p className="muted text-sm mt-4">No shifts in this period. Choose another period to review.</p>}
   {notice&&<p role="status" className="text-sm text-teal-800 mt-4">{notice}</p>}{error&&<p role="alert" className="error">{error}</p>}
  </section>

  <section className="card" aria-labelledby="hours-heading"><div className="flex flex-wrap justify-between items-start gap-2"><div><h2 id="hours-heading" className="card-title">2. Review approved hours</h2><p className="muted text-sm mt-1">Breaks are excluded. Overnight shifts count on their start day.</p></div><span className="muted text-sm">{rows.length} timesheet row{rows.length===1?'':'s'}</span></div>
   {rows.length===0?<p className="muted mt-5">No approved hours in this period.</p>:<div className="tablewrap mt-5"><table><thead><tr><th>Worker</th><th>Work date</th><th>Daily hours</th><th>Weekly hours</th><th>Shifts</th></tr></thead><tbody>{rows.map(row=><tr key={`${row.workerId}-${row.date}-${row.department}`}><td><strong>{row.worker}</strong><br/><span className="muted">{row.department}</span></td><td>{row.date}<br/><span className="muted">Week of {row.weekStart}</span></td><td className="font-bold">{row.dailyHours.toFixed(2)}</td><td>{row.weeklyHours.toFixed(2)}</td><td>{row.shifts}</td></tr>)}</tbody></table></div>}
  </section>

  <section className="card" aria-labelledby="signoff-heading"><h2 id="signoff-heading" className="card-title">3. Finish the period</h2><p className="muted text-sm mt-1">Sign off when every shift is approved. A signed-off period can be exported or reopened for corrections.</p><div className="flex flex-wrap gap-2 mt-5">{closed?<><button className="btn" onClick={exportCsv}>Download payroll CSV</button><button className="btn secondary" onClick={reopen} disabled={busy}>Reopen period</button></>:<button className="btn" onClick={close} disabled={!canClose||busy}>Sign off and lock</button>}</div>{!closed&&!canClose&&<p className="muted text-xs mt-3">{unresolved.length?'Resolve the shifts above before signing off.':'A period needs approved shifts before it can be signed off.'}</p>}</section>

  <details className="card"><summary className="cursor-pointer"><span className="card-title">Shift change history</span><span className="block muted text-sm mt-1">Review who changed a timecard and what changed. {events.length} recorded event{events.length===1?'':'s'}.</span></summary><div className="mt-5 border-t border-[#dfe8e5] pt-5"><label className="label" htmlFor="audit-worker">Filter by worker</label><select className="input max-w-xs" id="audit-worker" value={auditWorker} onChange={event=>setAuditWorker(event.target.value)}><option value="">All workers</option>{users.filter(user=>user.role==='worker').map(user=><option key={user.id} value={user.id}>{user.name}</option>)}</select>{visibleEvents.length===0?<p className="muted mt-5">No changes recorded for this worker yet.</p>:<div className="mt-4 divide-y divide-slate-100">{visibleEvents.map(event=><details key={event.id} className="py-3"><summary className="cursor-pointer text-sm"><strong className="capitalize">{event.action}</strong> · {name(event.userId)} · {new Date(event.at).toLocaleString()} <span className="muted">by {users.find(user=>user.id===event.actorId)?.name||event.actorId}</span></summary><div className="grid sm:grid-cols-2 gap-3 mt-3 text-sm"><div className="bg-slate-50 rounded-lg p-3"><strong>Before</strong><p className="mt-1">{entrySummary(event.before)}</p></div><div className="bg-teal-50 rounded-lg p-3"><strong>After</strong><p className="mt-1">{entrySummary(event.after)}</p></div></div></details>)}</div>}{events.length>50&&<p className="muted text-xs mt-3">Showing up to 50 events. The full history is included in JSON backups.</p>}</div></details>

  {closeouts.length>0&&<details className="card"><summary className="cursor-pointer"><span className="card-title">Past closeouts</span><span className="block muted text-sm mt-1">{closeouts.length} sign-off record{closeouts.length===1?'':'s'}, including reopened periods.</span></summary><div className="tablewrap mt-5"><table><thead><tr><th>Period</th><th>Signed off by</th><th>When</th><th>Status</th></tr></thead><tbody>{closeouts.map(item=><tr key={item.id}><td>{localDate(item.start)} – {new Date(new Date(item.end).getTime()-1).toLocaleDateString()}</td><td>{name(item.closedBy)}</td><td>{new Date(item.closedAt).toLocaleString()}</td><td>{item.reopenedAt?`Reopened ${new Date(item.reopenedAt).toLocaleString()}`:'Closed'}</td></tr>)}</tbody></table></div></details>}
 </div>;
}
