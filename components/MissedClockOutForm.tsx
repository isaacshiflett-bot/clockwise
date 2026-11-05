'use client';
import {useState} from 'react';
import type {TimeEntry} from '@/lib/types';

const localInput=(value:string)=>{const date=new Date(value);return new Date(date.getTime()-date.getTimezoneOffset()*60000).toISOString().slice(0,16)};

export function MissedClockOutForm({entry,error,onSubmit,onCancel}:{entry:TimeEntry;error:string;onSubmit:(end:string,note:string,breakEnd:string)=>Promise<void>;onCancel:()=>void}){
 const [end,setEnd]=useState(''),[breakEnd,setBreakEnd]=useState(''),[note,setNote]=useState('');
 const openBreak=entry.breaks.find(b=>!b.end);
 return <form className="mt-4 rounded-xl border border-teal-200 bg-teal-50 p-4 grid gap-3" onSubmit={event=>{event.preventDefault();void onSubmit(end,note,breakEnd)}}>
  <div><h3 className="font-bold">Correct a missed clock out</h3><p className="text-sm muted mt-1">Shift started {new Date(entry.clockIn).toLocaleString()}. Your correction will be pending manager approval.</p></div>
  <div><label className="label" htmlFor="correction-end">Actual clock-out date and time</label><input className="input" id="correction-end" type="datetime-local" min={localInput(entry.clockIn)} required value={end} onChange={event=>setEnd(event.target.value)}/></div>
  {openBreak&&<div><label className="label" htmlFor="correction-break-end">When did the open break end?</label><input className="input" id="correction-break-end" type="datetime-local" min={localInput(openBreak.start)} max={end||undefined} required value={breakEnd} onChange={event=>setBreakEnd(event.target.value)}/></div>}
  <div><label className="label" htmlFor="correction-note">Reason for correction</label><textarea className="input" id="correction-note" rows={2} required value={note} onChange={event=>setNote(event.target.value)} placeholder="I forgot to clock out after my shift."/></div>
  {error&&<p className="error" role="alert">{error}</p>}
  <div className="flex gap-2 flex-wrap"><button className="btn" type="submit">Submit for approval</button><button className="btn secondary" type="button" onClick={onCancel}>Cancel</button></div>
 </form>;
}
