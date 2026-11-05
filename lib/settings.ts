import type {AppSettings} from './types';

export const DEFAULT_SETTINGS:AppSettings={payPeriodAnchor:'2024-01-01',payPeriodWeeks:2};

export function validSettings(value:AppSettings):boolean {
 if(!/^\d{4}-\d{2}-\d{2}$/.test(value.payPeriodAnchor)||!Number.isInteger(value.payPeriodWeeks)||value.payPeriodWeeks<1||value.payPeriodWeeks>4)return false;
 const date=new Date(`${value.payPeriodAnchor}T00:00:00`);
 return Number.isFinite(date.getTime())&&date.getFullYear()===Number(value.payPeriodAnchor.slice(0,4))&&date.getMonth()+1===Number(value.payPeriodAnchor.slice(5,7))&&date.getDate()===Number(value.payPeriodAnchor.slice(8,10));
}

export function payPeriodBounds(now:Date,settings:AppSettings):{start:Date;end:Date} {
 const anchor=new Date(`${settings.payPeriodAnchor}T00:00:00`);
 const calendarDays=Math.floor((Date.UTC(now.getFullYear(),now.getMonth(),now.getDate())-Date.UTC(anchor.getFullYear(),anchor.getMonth(),anchor.getDate()))/86400000);
 const periods=Math.floor(calendarDays/(settings.payPeriodWeeks*7));
 const start=new Date(anchor);
 start.setDate(anchor.getDate()+periods*settings.payPeriodWeeks*7);
 const end=new Date(start);
 end.setDate(start.getDate()+settings.payPeriodWeeks*7);
 return {start,end};
}
