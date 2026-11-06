'use client';

import {useEffect,useState} from 'react';
import Link from 'next/link';
import {useRouter} from 'next/navigation';
import {storage} from '@/lib/storage';
import {hashPin} from '@/lib/storage/localStorage';
import type {Backup,ScheduleAssignment,TaskCategory,TimeEntry,User} from '@/lib/types';
import {WorkerView} from './WorkerView';
import {ManagerView} from './ManagerView';
import {InsightsView} from './InsightsView';
import {CloseoutView} from './CloseoutView';
import {ScheduleView} from './ScheduleView';
import {LeadershipView} from './LeadershipView';

type View='worker'|'manager'|'insights'|'closeout'|'schedule'|'leadership';

export function AppShell({view}:{view:View}){
 const router=useRouter();
 const [ready,setReady]=useState(false),[users,setUsers]=useState<User[]>([]),[user,setUser]=useState<User|null>(null);
 const [entries,setEntries]=useState<TimeEntry[]>([]),[categories,setCategories]=useState<TaskCategory[]>([]);
 const [assignments,setAssignments]=useState<ScheduleAssignment[]>([]);
 const [pin,setPin]=useState(''),[selected,setSelected]=useState(''),[error,setError]=useState('');
 const [loadError,setLoadError]=useState(''),[recoveryFile,setRecoveryFile]=useState<File|null>(null),[confirmRecovery,setConfirmRecovery]=useState(false);

 const refresh=async()=>{
  try{
   const [nextUsers,nextEntries,nextCategories,nextAssignments]=await Promise.all([storage.getUsers(),storage.getEntries(),storage.getTaskCategories(),storage.getAssignments()]);
   setUsers(nextUsers);setEntries(nextEntries);setCategories(nextCategories);setAssignments(nextAssignments);
   const session=await storage.getSession();
   setUser(nextUsers.find(person=>person.id===session?.userId&&person.active)||null);
   setLoadError('');
  }catch(cause){setLoadError(cause instanceof Error?cause.message:'Could not load saved time data. Your browser data was preserved.')}
  finally{setReady(true)}
 };
 useEffect(()=>{void refresh()},[]);
 useEffect(()=>{
  if(!ready)return;
  if(!user&&view!=='worker')router.replace('/');
  else if(user?.role==='worker'&&view!=='worker')router.replace('/');
  else if(user?.role==='manager'&&view==='worker')router.replace('/manager');
 },[ready,user,view,router]);

 const login=async(event:React.FormEvent)=>{
  event.preventDefault();setError('');
  const account=users.find(person=>person.id===selected);
  if(!account||!account.active){setError('Choose an active user.');return}
  if(!/^\d{4,6}$/.test(pin)||await hashPin(pin)!==account.pinHash){setError('Incorrect PIN.');return}
  await storage.saveSession({userId:account.id});setPin('');setUser(account);
  router.push(account.role==='manager'?'/manager':'/');
 };
 const logout=async()=>{await storage.saveSession(null);setUser(null);router.push('/')};
 const restore=async()=>{if(!recoveryFile||!confirmRecovery)return;try{await storage.importAll(JSON.parse(await recoveryFile.text()) as Backup);setRecoveryFile(null);setConfirmRecovery(false);await refresh()}catch(cause){setLoadError(cause instanceof Error?cause.message:'Could not import this backup.')}};

 if(!ready)return <main className="shell min-h-screen grid place-items-center"><div className="card w-full max-w-md text-center"><div className="brand-mark mx-auto mb-4" aria-hidden="true">◷</div><p className="font-bold">Opening Clockwise…</p><p className="muted text-sm mt-1">Loading your local time records.</p></div></main>;
 if(loadError)return <main className="shell min-h-screen grid place-items-center"><div className="card w-full max-w-lg"><p className="eyebrow">Data recovery</p><h1 className="page-title">We could not open your records</h1><p className="error mt-4" role="alert">{loadError}</p><p className="muted text-sm mt-3">The original browser data is still in place. Free up browser storage and retry, or restore a downloaded JSON backup.</p><button className="btn secondary mt-5" onClick={()=>void refresh()}>Retry loading</button><div className="border-t border-[#dfe8e5] mt-6 pt-5"><label className="label" htmlFor="recovery-file">Restore JSON backup</label><input id="recovery-file" className="input" type="file" accept="application/json,.json" onChange={event=>{setRecoveryFile(event.target.files?.[0]||null);setConfirmRecovery(false)}}/>{recoveryFile&&<label className="flex gap-2 items-start mt-4 text-sm"><input type="checkbox" checked={confirmRecovery} onChange={event=>setConfirmRecovery(event.target.checked)}/><span>Replace the current browser data with this backup.</span></label>}<button className="btn mt-4" disabled={!recoveryFile||!confirmRecovery} onClick={restore}>Restore backup</button></div></div></main>;

 if(!user)return <main className="shell min-h-screen grid place-items-center">
  <div className="w-full max-w-5xl grid lg:grid-cols-[1.08fr_1fr] overflow-hidden rounded-[28px] border border-[#dce8e3] bg-white shadow-[0_24px_70px_#163b3520]">
   <div className="hidden lg:flex bg-[#0a4947] text-white p-8 sm:p-11 lg:p-14 flex-col justify-between min-h-[580px]">
    <div><div className="flex items-center gap-3"><span className="brand-mark bg-white/15 shadow-none" aria-hidden="true">◷</span><span className="text-xl font-extrabold tracking-[-.05em]">Clockwise</span></div>
     <div className="mt-12 lg:mt-24"><p className="text-xs font-bold tracking-[.18em] uppercase text-[#a9d8ca]">Shipping operations, made clear</p><h1 className="text-4xl sm:text-5xl font-extrabold tracking-[-.07em] leading-[1.06] mt-4">Know who is on the floor, and where.</h1><p className="text-[#c5e1d9] mt-5 max-w-md">Track time, plan shipping areas, cover callouts, and keep leadership up to date.</p></div>
    </div>
    <p className="text-xs text-[#b7d9d0] mt-10">Local demo · Your data stays in this browser</p>
   </div>
   <div className="p-8 sm:p-11 lg:p-14 flex flex-col justify-center"><div className="flex lg:hidden items-center gap-2.5 mb-10"><span className="brand-mark" aria-hidden="true">◷</span><span className="brand-name">Clockwise</span></div>
    <p className="eyebrow">Welcome back</p><h2 className="page-title mt-3">Sign in</h2><p className="page-intro">Choose your name and enter your PIN to continue.</p>
    <form onSubmit={login} className="grid gap-5 mt-9">
     <div><label className="label" htmlFor="user">Your name</label><select className="input" id="user" value={selected} onChange={event=>setSelected(event.target.value)} required><option value="">Select a name</option>{users.filter(person=>person.active).map(person=><option key={person.id} value={person.id}>{person.name}</option>)}</select></div>
     <div><label className="label" htmlFor="pin">PIN</label><input className="input" id="pin" type="password" inputMode="numeric" autoComplete="current-password" pattern="[0-9]{4,6}" minLength={4} maxLength={6} value={pin} onChange={event=>setPin(event.target.value)} required/></div>
     {error&&<p className="error" role="alert">{error}</p>}
     <button className="btn w-full text-sm min-h-12">Sign in <span aria-hidden="true">→</span></button>
    </form>
    <div className="mt-10 pt-6 border-t border-[#e0eae5]"><p className="eyebrow">Try the demo</p><div className="grid grid-cols-2 gap-x-5 gap-y-3 mt-4 text-sm"><p><strong className="block">Manager</strong><span className="muted">PIN 1234</span></p><p><strong className="block">Alex Rivera</strong><span className="muted">PIN 1111</span></p><p><strong className="block">Jordan Lee</strong><span className="muted">PIN 2222</span></p><p><strong className="block">Sam Patel</strong><span className="muted">PIN 3333</span></p></div></div>
   </div>
  </div>
 </main>;

 if((view!=='worker'&&user.role!=='manager')||(view==='worker'&&user.role==='manager'))return <main className="shell"><div className="card">Redirecting…</div></main>;
 const manager=user.role==='manager';
 return <div>
  <header className="site-header"><div className="shell flex flex-wrap items-center justify-between gap-x-5 gap-y-3">
   <div className="flex items-center gap-7 min-w-0"><Link href={manager?'/manager':'/'} className="flex items-center gap-2.5 shrink-0" aria-label="Clockwise home"><span className="brand-mark" aria-hidden="true">◷</span><span className="brand-name">Clockwise</span></Link>
    {manager&&<nav aria-label="Manager navigation" className="hidden sm:flex gap-1 p-1 rounded-xl bg-[#f4f8f5]"><Link className={'navlink '+(view==='manager'?'active':'')} aria-current={view==='manager'?'page':undefined} href="/manager">Timecards</Link><Link className={'navlink '+(view==='schedule'?'active':'')} aria-current={view==='schedule'?'page':undefined} href="/manager/schedule">Schedule</Link><Link className={'navlink '+(view==='leadership'?'active':'')} aria-current={view==='leadership'?'page':undefined} href="/manager/leadership">Leadership</Link><Link className={'navlink '+(view==='insights'?'active':'')} aria-current={view==='insights'?'page':undefined} href="/manager/insights">Insights</Link><Link className={'navlink '+(view==='closeout'?'active':'')} aria-current={view==='closeout'?'page':undefined} href="/manager/closeout">Closeout</Link></nav>}
   </div>
   <div className="flex items-center gap-3 text-sm"><span className="hidden sm:inline muted">Signed in as <strong className="text-[#183036]">{user.name}</strong></span><button className="btn secondary" onClick={logout}>Log out</button></div>
   {manager&&<nav aria-label="Manager navigation" className="flex sm:hidden gap-1 w-full overflow-x-auto p-1 rounded-xl bg-[#f4f8f5]"><Link className={'navlink '+(view==='manager'?'active':'')} aria-current={view==='manager'?'page':undefined} href="/manager">Timecards</Link><Link className={'navlink '+(view==='schedule'?'active':'')} aria-current={view==='schedule'?'page':undefined} href="/manager/schedule">Schedule</Link><Link className={'navlink '+(view==='leadership'?'active':'')} aria-current={view==='leadership'?'page':undefined} href="/manager/leadership">Leadership</Link><Link className={'navlink '+(view==='insights'?'active':'')} aria-current={view==='insights'?'page':undefined} href="/manager/insights">Insights</Link><Link className={'navlink '+(view==='closeout'?'active':'')} aria-current={view==='closeout'?'page':undefined} href="/manager/closeout">Closeout</Link></nav>}
  </div></header>
  <main className="shell pb-16">
   {entries.some(entry=>entry.note.startsWith('Demo'))&&<p className="mb-6 rounded-xl bg-[#fff7e7] border border-[#efd9a9] px-4 py-3 text-sm text-[#76551c]">Demo shifts are loaded in this browser. Try clocking in or reviewing a pending entry to explore the workflow.</p>}
   {view==='worker'?<WorkerView user={user} entries={entries} categories={categories} assignments={assignments.filter(a=>a.userId===user.id)} refresh={refresh}/>:view==='manager'?<ManagerView user={user} users={users} entries={entries} categories={categories} refresh={refresh}/>:view==='schedule'?<ScheduleView users={users} assignments={assignments} refresh={refresh}/>:view==='leadership'?<LeadershipView users={users} assignments={assignments} entries={entries}/>:view==='insights'?<InsightsView users={users} entries={entries} categories={categories} refresh={refresh}/>:<CloseoutView users={users} entries={entries} refresh={refresh}/>}
  </main>
 </div>;
}

