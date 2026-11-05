import {describe,expect,it} from 'vitest';
import {departmentRates} from './departments';
import {newEntry} from './time';
import type {TaskCategory,TimeEntry} from './types';

const category:TaskCategory={id:'orders',name:'Orders packed',unit:'orders',active:true};
const shift=(department:string,count:number):TimeEntry=>{
 const entry=newEntry('worker','2026-11-02T09:00:00Z','manual','2026-11-02T11:00:00Z','demo',department);
 entry.output=[{categoryId:'orders',count}];
 return entry;
};

describe('department productivity',()=>{
 it('keeps task categories separate and hides groups with fewer than three shifts',()=>{
  const entries=[shift('Fulfillment',10),shift('Fulfillment',12),shift('Fulfillment',14),shift('Support',20),shift('Support',20)];
  expect(departmentRates(entries,[category])).toEqual([{department:'Fulfillment',category:'Orders packed',unit:'orders',rate:6,shifts:3}]);
 });
 it('retains the department recorded on each shift',()=>{
  const oldShift=shift('Fulfillment',10);
  const newShift=shift('Support',10);
  expect(oldShift.department).toBe('Fulfillment');
  expect(newShift.department).toBe('Support');
 });
});
