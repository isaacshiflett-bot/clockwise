import {beforeEach,describe,it,expect,vi} from 'vitest';
import {LocalStorageAdapter,STORAGE_KEY,SCHEMA_VERSION,migrate,hashPin} from './localStorage';
import {monday,newEntry,overlaps} from '../time';
import {sampleEntries} from '../insights';

describe('LocalStorageAdapter',()=>{
  beforeEach(()=>localStorage.clear());

  it('seeds demo users, shifts, output, and targets once',async()=>{
    const db=new LocalStorageAdapter();
    const users=await db.getUsers();
    const entries=await db.getEntries();
    expect(users).toHaveLength(4);
    expect(users[0].pinHash).toBe(await hashPin('1234'));
    expect(users[0].pinHash).not.toBe('1234');
    expect(entries).toHaveLength(63);
    expect(entries.filter(e=>e.status==='pending')).toHaveLength(2);
    expect(entries.filter(e=>e.status==='rejected')).toHaveLength(1);
    expect(entries.filter(e=>e.status==='open')).toHaveLength(0);
    expect(entries.filter(e=>e.status==='approved'&&e.output.length>0)).toHaveLength(60);
    expect(await db.getTaskCategories()).toHaveLength(2);
    expect(await db.getCoverageTargets()).toHaveLength(50);
    expect(await db.getAssignments()).toHaveLength(10);
    expect((await db.getEntries())).toHaveLength(63);
    expect(entries.some((e,i)=>entries.slice(i+1).some(other=>overlaps(e,other)))).toBe(false);
  });

  it('migrates v6 data and keeps schedule assignments in backups',async()=>{
    const db=new LocalStorageAdapter();const backup=await db.exportAll();
    const legacy=Object.fromEntries(Object.entries(backup).filter(([key])=>key!=='assignments'));
    localStorage.setItem(STORAGE_KEY,JSON.stringify({...legacy,schemaVersion:6}));
    expect(await db.getAssignments()).toHaveLength(10);
    expect((await db.exportAll()).schemaVersion).toBe(7);
    await db.importAll(await db.exportAll());
    expect(await db.getAssignments()).toHaveLength(10);
  });

  it('requires a manager and applies emergency coverage atomically',async()=>{
    const db=new LocalStorageAdapter();const original=(await db.getAssignments())[0];
    const assignments=await db.getAssignments();const available=(await db.getUsers()).find(u=>u.role==='worker'&&u.id!==original.userId&&!assignments.some(a=>a.date===original.date&&a.userId===u.id))!;
    await expect(db.createEmergencyCoverage(original.id,available.id,'Sick callout')).rejects.toThrow(/Manager/);
    await db.saveSession({userId:'demo-0'});
    await expect(db.createEmergencyCoverage(original.id,original.userId,'Sick callout')).rejects.toThrow(/different/);
    expect(await db.getAssignments()).toHaveLength(10);
    await db.createEmergencyCoverage(original.id,available.id,'Sick callout');
    const changed=await db.getAssignments();expect(changed).toHaveLength(11);
    expect(changed.find(a=>a.id===original.id)?.status).toBe('callout');
    expect(changed.find(a=>a.replacesId===original.id)).toMatchObject({userId:available.id,status:'coverage',area:original.area,date:original.date});
    await expect(db.deleteAssignment(original.id)).rejects.toThrow(/history/);
  });

  it('rejects a conflicting schedule batch without saving part of it',async()=>{
    const db=new LocalStorageAdapter();await db.saveSession({userId:'demo-0'});
    const original=(await db.getAssignments())[0];const at=new Date().toISOString();
    const freeDay='2030-01-07';const first={...original,id:crypto.randomUUID(),date:freeDay,createdAt:at,updatedAt:at};
    const conflicting={...first,id:crypto.randomUUID(),area:'Packing' as const};
    await expect(db.saveAssignments([first,conflicting])).rejects.toThrow(/already/);
    expect((await db.getAssignments()).some(a=>a.date===freeDay)).toBe(false);
  });

  it('records an uncovered callout and can assign coverage later',async()=>{
    const db=new LocalStorageAdapter();await db.saveSession({userId:'demo-0'});
    const assignments=await db.getAssignments();const original=assignments[0];const available=(await db.getUsers()).find(u=>u.role==='worker'&&!assignments.some(a=>a.date===original.date&&a.userId===u.id))!;
    await db.createEmergencyCoverage(original.id,null,'Absent');
    expect((await db.getAssignments()).find(a=>a.id===original.id)?.status).toBe('callout');
    expect((await db.getAssignments()).some(a=>a.replacesId===original.id)).toBe(false);
    await db.createEmergencyCoverage(original.id,available.id,'Covering absent worker');
    expect((await db.getAssignments()).find(a=>a.replacesId===original.id)?.userId).toBe(available.id);
  });

  it('saves, filters, deletes, exports, and imports entries',async()=>{
    const db=new LocalStorageAdapter();
    const e=newEntry('test-worker','2026-01-05T09:00:00Z','manual','2026-01-05T17:00:00Z');
    await db.saveEntry(e);
    expect(await db.getEntries({userId:'test-worker'})).toHaveLength(1);
    const backup=await db.exportAll();
    await db.deleteEntry(e.id);
    expect(await db.getEntries({userId:'test-worker'})).toHaveLength(0);
    await db.importAll(backup);
    expect(await db.getEntries({userId:'test-worker'})).toHaveLength(1);
  });

  it('persists categories and targets in backups',async()=>{
    const db=new LocalStorageAdapter();
    await db.saveTaskCategory({id:'c',name:'Orders',unit:'orders',active:true});
    await db.saveCoverageTarget({dayOfWeek:1,hour:9,headcount:3});
    expect((await db.exportAll()).categories.some(c=>c.id==='c')).toBe(true);
    expect((await db.exportAll()).targets.find(t=>t.dayOfWeek===1&&t.hour===9)?.headcount).toBe(3);
    await db.deleteTaskCategory('c');
    await db.deleteCoverageTarget(1,9);
    expect((await db.getTaskCategories()).some(c=>c.id==='c')).toBe(false);
    expect((await db.getCoverageTargets()).some(t=>t.dayOfWeek===1&&t.hour===9)).toBe(false);
  });

  it('enforces one open shift per worker',async()=>{
    const db=new LocalStorageAdapter();
    await db.saveEntry(newEntry('test-worker','2026-01-05T09:00:00Z','clock'));
    await expect(db.saveEntry(newEntry('test-worker','2026-01-05T10:00:00Z','clock'))).rejects.toThrow(/open shift/);
  });

  it('reminds after data changes but not after login',async()=>{
    const db=new LocalStorageAdapter();
    expect(await db.getBackupStatus()).toEqual({lastBackupAt:null,needsBackup:true});
    await db.recordBackupExport((await db.exportAll()).revision);
    expect((await db.getBackupStatus()).needsBackup).toBe(false);
    await db.saveSession({userId:'demo-0'});
    expect((await db.getBackupStatus()).needsBackup).toBe(false);
    await db.saveEntry(newEntry('test-worker','2026-01-05T09:00:00Z','clock'));
    expect((await db.getBackupStatus()).needsBackup).toBe(true);
  });

  it('saves pay-period settings and includes them in a full backup',async()=>{
    const db=new LocalStorageAdapter();
    await db.recordBackupExport((await db.exportAll()).revision);
    await db.saveSettings({payPeriodAnchor:'2026-11-02',payPeriodWeeks:1});
    expect(await db.getSettings()).toEqual({payPeriodAnchor:'2026-11-02',payPeriodWeeks:1});
    expect((await db.exportAll()).settings.payPeriodWeeks).toBe(1);
    expect((await db.getBackupStatus()).needsBackup).toBe(true);
    await expect(db.saveSettings({payPeriodAnchor:'2026-11-02',payPeriodWeeks:0})).rejects.toThrow();
  });

  it('keeps the reminder when data changes during a backup download',async()=>{
    const db=new LocalStorageAdapter();
    const exported=await db.exportAll();
    await db.saveEntry(newEntry('test-worker','2026-01-05T09:00:00Z','clock'));
    await db.recordBackupExport(exported.revision);
    expect((await db.getBackupStatus()).needsBackup).toBe(true);
  });

  it('migrates legacy settings and prompts for a new backup after import',async()=>{
    const db=new LocalStorageAdapter();
    const legacy={schemaVersion:3,users:[],entries:[],categories:[],targets:[],session:null};
    localStorage.setItem(STORAGE_KEY,JSON.stringify(legacy));
    expect(await db.getSettings()).toEqual({payPeriodAnchor:'2024-01-01',payPeriodWeeks:2});
    await db.recordBackupExport((await db.exportAll()).revision);
    const backup=await db.exportAll();
    await db.importAll(backup);
    expect((await db.getBackupStatus()).needsBackup).toBe(true);
  });

  it('upgrades an untouched v2 demo browser with placeholder data',async()=>{
    const db=new LocalStorageAdapter();
    const users=await db.getUsers();
    localStorage.setItem(STORAGE_KEY,JSON.stringify({schemaVersion:2,users,entries:[],categories:[],targets:[],session:null}));
    expect(await db.getEntries()).toHaveLength(63);
    expect((await db.exportAll()).schemaVersion).toBe(SCHEMA_VERSION);
  });

  it('preserves existing v2 entries during migration',async()=>{
    const db=new LocalStorageAdapter();
    const users=await db.getUsers();
    const entry=newEntry('demo-2','2026-01-05T09:00:00Z','manual','2026-01-05T17:00:00Z');
    localStorage.setItem(STORAGE_KEY,JSON.stringify({schemaVersion:2,users,entries:[entry],categories:[],targets:[],session:null}));
    expect(await db.getEntries()).toHaveLength(1);
  });

  it('migrates department assignments and keeps past shift snapshots after reassignment',async()=>{
    const db=new LocalStorageAdapter();
    const old=await db.exportAll();
    const users=old.users.map(user=>Object.fromEntries(Object.entries(user).filter(([key])=>key!=='department')));
    const entries=old.entries.map(entry=>Object.fromEntries(Object.entries(entry).filter(([key])=>key!=='department')));
    localStorage.setItem(STORAGE_KEY,JSON.stringify({...old,schemaVersion:4,users,entries}));
    const alex=(await db.getUsers()).find(u=>u.id==='demo-1')!;
    const past=(await db.getEntries({userId:'demo-1'}))[0];
    expect(alex.department).toBe('Fulfillment');
    expect(past.department).toBe('Fulfillment');
    await db.saveUser({...alex,department:'Support'});
    expect((await db.getEntries({userId:'demo-1'}))[0].department).toBe('Fulfillment');
  });

  it('migrates v1 entries with empty output and categories',async()=>{
    const db=new LocalStorageAdapter();
    const old={schemaVersion:1,users:[],entries:[Object.fromEntries(Object.entries(newEntry('u','2026-01-05T09:00:00Z','clock')).filter(([k])=>k!=='output'))],session:null};
    localStorage.setItem(STORAGE_KEY,JSON.stringify(old));
    const e=(await db.getEntries())[0];
    expect(e.output).toEqual([]);
    expect((await db.exportAll()).schemaVersion).toBe(SCHEMA_VERSION);
    expect(migrate(old as never).categories).toEqual([]);
  });

  it('adds empty audit and closeout collections to a v5 backup',async()=>{
    const db=new LocalStorageAdapter();
    const backup=await db.exportAll();
    const legacy=Object.fromEntries(Object.entries(backup).filter(([key])=>key!=='auditEvents'&&key!=='closeouts'));
    localStorage.setItem(STORAGE_KEY,JSON.stringify({...legacy,schemaVersion:5}));
    expect(await db.getAuditEvents()).toEqual([]);
    expect(await db.getCloseouts()).toEqual([]);
    expect((await db.exportAll()).schemaVersion).toBe(SCHEMA_VERSION);
  });

  it('preserves original records if a migration write fails',async()=>{
    const db=new LocalStorageAdapter();
    const backup=await db.exportAll();
    const original=JSON.stringify({...backup,schemaVersion:5});
    localStorage.setItem(STORAGE_KEY,original);
    const write=vi.spyOn(Storage.prototype,'setItem').mockImplementation(()=>{throw new DOMException('Full','QuotaExceededError')});
    try{await expect(db.getEntries()).rejects.toThrow(/preserved/)}finally{write.mockRestore()}
    expect(localStorage.getItem(STORAGE_KEY)).toBe(original);
  });

  it('keeps malformed and newer records for recovery',async()=>{
    const db=new LocalStorageAdapter();
    const backup=await db.exportAll();
    localStorage.setItem(STORAGE_KEY,'{"broken":');
    await expect(db.getEntries()).rejects.toThrow(/preserved/);
    expect(localStorage.getItem(STORAGE_KEY)).toBe('{"broken":');
    await db.importAll(backup);
    expect(await db.getEntries()).toHaveLength(63);
    const newer=JSON.stringify({schemaVersion:SCHEMA_VERSION+1,users:[],entries:[]});
    localStorage.setItem(STORAGE_KEY,newer);
    await expect(db.getEntries()).rejects.toThrow(/newer app version/);
    expect(localStorage.getItem(STORAGE_KEY)).toBe(newer);
    await expect(db.importAll(JSON.parse(newer))).rejects.toThrow(/newer app version/);
    expect(localStorage.getItem(STORAGE_KEY)).toBe(newer);
  });

  it('replaces demo shifts atomically and respects closed periods',async()=>{
    const db=new LocalStorageAdapter();
    await db.saveSession({userId:'demo-0'});
    const samples=sampleEntries(['demo-1','demo-3'],['demo-orders-packed'],new Date());
    await db.replaceSampleData(samples,[]);
    const replaced=await db.getEntries();
    expect(replaced.filter(entry=>entry.id.startsWith('sample-'))).toHaveLength(40);
    expect(replaced).toHaveLength(43);
    expect(replaced.find(entry=>entry.id==='sample-0-0-1')?.userId).toBe('demo-3');
    const start=monday(new Date(samples.find(entry=>entry.id.startsWith('sample-2-'))!.clockIn));const end=new Date(start);end.setDate(end.getDate()+7);
    await db.closePayPeriod(start.toISOString(),end.toISOString());
    const before=JSON.stringify(await db.exportAll());
    await expect(db.replaceSampleData(samples,[])).rejects.toThrow(/closed pay period/);
    expect(JSON.stringify(await db.exportAll())).toBe(before);
  });

  it('records who changed, approved, and deleted a shift with previous values',async()=>{
    const db=new LocalStorageAdapter();
    await db.saveSession({userId:'demo-0'});
    const pending=newEntry('test-worker','2025-01-06T09:00:00Z','manual','2025-01-06T17:00:00Z');
    await db.saveEntry(pending);
    const approved={...pending,status:'approved' as const,reviewedBy:'demo-0',reviewedAt:new Date().toISOString()};
    await db.saveEntry(approved);
    await db.deleteEntry(pending.id);
    const events=(await db.getAuditEvents()).filter(event=>event.entryId===pending.id);
    expect(events.map(event=>event.action).sort()).toEqual(['approved','created','deleted']);
    expect(events.every(event=>event.actorId==='demo-0')).toBe(true);
    expect(events.find(event=>event.action==='approved')?.before?.status).toBe('pending');
    expect(events.find(event=>event.action==='deleted')?.before?.status).toBe('approved');
    expect(events.find(event=>event.action==='deleted')?.after).toBeNull();
  });

  it('requires manager sign-off, resolves exceptions, locks a closed period, and allows reopening',async()=>{
    const db=new LocalStorageAdapter();
    const blank=await db.exportAll();
    await db.importAll({...blank,entries:[],auditEvents:[],closeouts:[]});
    const start='2025-01-06T00:00:00Z',end='2025-01-20T00:00:00Z';
    const pending=newEntry('demo-1','2025-01-06T09:00:00Z','manual','2025-01-06T17:00:00Z');
    await db.saveEntry(pending);
    await expect(db.closePayPeriod(start,end)).rejects.toThrow(/Manager/);
    await db.saveSession({userId:'demo-0'});
    await expect(db.closePayPeriod(start,end)).rejects.toThrow(/Resolve/);
    await db.saveEntry({...pending,status:'approved'});
    const closed=await db.closePayPeriod(start,end);
    expect(closed.closedBy).toBe('demo-0');
    await expect(db.saveEntry(newEntry('demo-1','2025-01-07T09:00:00Z','clock'))).rejects.toThrow(/closed/);
    await expect(db.deleteEntry(pending.id)).rejects.toThrow(/closed/);
    await db.reopenPayPeriod(closed.id);
    expect((await db.getCloseouts()).find(item=>item.id===closed.id)?.reopenedBy).toBe('demo-0');
    await db.saveEntry(newEntry('demo-1','2025-01-07T09:00:00Z','clock'));
  });
});

