import {beforeEach,describe,it,expect} from 'vitest';
import {LocalStorageAdapter,STORAGE_KEY,SCHEMA_VERSION,migrate,hashPin} from './localStorage';
import {newEntry,overlaps} from '../time';

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
    expect((await db.getEntries())).toHaveLength(63);
    expect(entries.some((e,i)=>entries.slice(i+1).some(other=>overlaps(e,other)))).toBe(false);
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

  it('migrates v1 entries with empty output and categories',async()=>{
    const db=new LocalStorageAdapter();
    const old={schemaVersion:1,users:[],entries:[Object.fromEntries(Object.entries(newEntry('u','2026-01-05T09:00:00Z','clock')).filter(([k])=>k!=='output'))],session:null};
    localStorage.setItem(STORAGE_KEY,JSON.stringify(old));
    const e=(await db.getEntries())[0];
    expect(e.output).toEqual([]);
    expect((await db.exportAll()).schemaVersion).toBe(SCHEMA_VERSION);
    expect(migrate(old as never).categories).toEqual([]);
  });
});

