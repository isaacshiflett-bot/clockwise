'use client';
import {useEffect,useState} from 'react';
import {storage} from '@/lib/storage';
import {cleanDepartment,UNASSIGNED_DEPARTMENT} from '@/lib/departments';
import type {User} from '@/lib/types';

export function DepartmentManager({users,refresh}:{users:User[];refresh:()=>Promise<void>}){
 const workers=users.filter(u=>u.role==='worker');
 const [drafts,setDrafts]=useState<Record<string,string>>({});
 const [notice,setNotice]=useState('');
 useEffect(()=>{setDrafts(Object.fromEntries(users.filter(u=>u.role==='worker').map(u=>[u.id,u.department])))},[users]);
 const options=[...new Set(workers.map(u=>u.department).filter(name=>name!==UNASSIGNED_DEPARTMENT))].sort();
 const save=async(user:User)=>{const department=cleanDepartment(drafts[user.id]);await storage.saveUser({...user,department});setNotice(`${user.name} is now in ${department}.`);await refresh()};
 return <section className="card"><h2 className="text-xl font-bold">Departments</h2><p className="muted text-sm mt-1">Assign workers for department productivity. New shifts use the new department; past shifts keep their original assignment.</p>
  <datalist id="department-options">{options.map(name=><option key={name} value={name}/>)}</datalist>
  {workers.length===0?<p className="muted mt-4">No workers yet.</p>:<div className="mt-4 divide-y divide-slate-100">{workers.map(user=><div className="py-3 grid sm:grid-cols-[1fr_1fr_auto] gap-2 items-end" key={user.id}><div><strong>{user.name}</strong><p className="muted text-sm">Current: {user.department}</p></div><div><label className="label" htmlFor={`department-${user.id}`}>Department</label><input className="input" id={`department-${user.id}`} list="department-options" value={drafts[user.id]??user.department} onChange={event=>setDrafts({...drafts,[user.id]:event.target.value})}/></div><button className="btn secondary" onClick={()=>save(user)} disabled={cleanDepartment(drafts[user.id])===user.department}>Save</button></div>)}</div>}
  {notice&&<p className="text-sm text-teal-800 mt-3" role="status">{notice}</p>}
 </section>;
}
