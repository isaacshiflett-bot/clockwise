import type {TaskCategory,TimeEntry} from './types';
import {unitsPerHour} from './insights';

export const UNASSIGNED_DEPARTMENT='Unassigned';
export const DEMO_DEPARTMENTS:Record<string,string>={'demo-1':'Fulfillment','demo-2':'Support','demo-3':'Fulfillment'};
export const cleanDepartment=(value:string|undefined)=>value?.trim()||UNASSIGNED_DEPARTMENT;

export type DepartmentRate={department:string;category:string;unit:string;rate:number;shifts:number};
export function departmentRates(entries:TimeEntry[],categories:TaskCategory[]):DepartmentRate[]{
 const departments=[...new Set(entries.map(e=>cleanDepartment(e.department)))].sort();
 const rows:DepartmentRate[]=[];
 for(const department of departments)for(const category of categories.filter(c=>c.active)){
  const result=unitsPerHour(entries.filter(e=>cleanDepartment(e.department)===department),category.id);
  if(result)rows.push({department,category:category.name,unit:category.unit,rate:Number(result.rate.toFixed(2)),shifts:result.shifts});
 }
 return rows;
}
