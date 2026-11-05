import {describe,expect,it} from 'vitest';
import {DEFAULT_SETTINGS,payPeriodBounds,validSettings} from './settings';

describe('pay-period settings',()=>{
 it('keeps the original two-week Monday schedule by default',()=>{
  const first=payPeriodBounds(new Date(2024,0,10),DEFAULT_SETTINGS);
  expect(first.start.getFullYear()).toBe(2024);
  expect(first.start.getMonth()).toBe(0);
  expect(first.start.getDate()).toBe(1);
  expect(first.end.getDate()).toBe(15);
  const next=payPeriodBounds(new Date(2024,0,15),DEFAULT_SETTINGS);
  expect(next.start.getDate()).toBe(15);
 });
 it('supports a custom anchor and crosses daylight-saving changes by calendar day',()=>{
  const period=payPeriodBounds(new Date(2024,2,12),{payPeriodAnchor:'2024-03-04',payPeriodWeeks:1});
  expect(period.start.getDate()).toBe(11);
  expect(period.end.getDate()).toBe(18);
 });
 it('rejects invalid dates and lengths',()=>{
  expect(validSettings({payPeriodAnchor:'2024-02-30',payPeriodWeeks:2})).toBe(false);
  expect(validSettings({payPeriodAnchor:'2024-01-01',payPeriodWeeks:5})).toBe(false);
 });
});
