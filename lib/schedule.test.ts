import {describe,expect,it} from 'vitest';
import {dateKey,demoAssignments,validateAssignment,weekDates,weekSummary} from './schedule';
import {newEntry} from './time';

const workers=[1,2,3].map(i=>({id:`demo-${i}`,name:`Worker ${i}`,role:'worker' as const,active:true,pinHash:'',createdAt:'2026-01-01T00:00:00Z',department:'Shipping'}));
describe('shipping schedule',()=>{
 it('starts weeks on Monday and leaves one demo worker available each weekday',()=>{const days=weekDates(new Date('2026-11-06T12:00:00'));expect(dateKey(days[0])).toBe('2026-11-02');const samples=demoAssignments(new Date('2026-11-06T12:00:00'),workers);expect(samples).toHaveLength(10);expect(samples.filter(a=>a.date==='2026-11-02')).toHaveLength(2)});
 it('blocks duplicate worker days and invalid shift times',()=>{const sample=demoAssignments(new Date('2026-11-06T12:00:00'),workers)[0];expect(validateAssignment({...sample,id:'new'},[sample],workers)).toMatch(/already/);expect(validateAssignment({...sample,startTime:'17:00',endTime:'08:00'},[],workers)).toMatch(/after/)});
 it('summarizes staffed shifts, callouts, and approved versus pending hours',()=>{const samples=demoAssignments(new Date('2026-11-06T12:00:00'),workers);const callout={...samples[0],status:'callout' as const};const coverage={...samples[0],id:'cover',userId:'demo-3',status:'coverage' as const,replacesId:samples[0].id};const entries=[{...newEntry('demo-1','2026-11-02T13:00:00Z','manual','2026-11-02T21:00:00Z'),status:'approved' as const},{...newEntry('demo-2','2026-11-03T13:00:00Z','manual','2026-11-03T17:00:00Z'),status:'pending' as const}];expect(weekSummary([...samples.slice(1),callout,coverage],entries,'2026-11-02')).toEqual({scheduled:10,callouts:1,covered:1,approvedHours:8,pendingHours:4})});
});
