import {expect,test} from 'vitest';
import {updatePlan} from '../scripts/update-schedule.mjs';
const at=(date)=>Date.parse(`${date}T18:00:00+09:00`);
test('月次はJSTの20日から隔日、月が変われば再開する',()=>{
 for(let d=1;d<=31;d++)expect(updatePlan({event:'schedule',now:at(`2026-10-${String(d).padStart(2,'0')}`)}).run).toBe([20,22,24,26,28,30].includes(d));
 expect(updatePlan({event:'schedule',now:at('2026-10-22'),state:{monthlyCompleted:'2026-10'}}).run).toBe(false);
 expect(updatePlan({event:'schedule',now:at('2026-11-20'),state:{monthlyCompleted:'2026-10'}}).run).toBe(true);
 expect(updatePlan({event:'schedule',now:at('2028-02-28')}).run).toBe(true);
 expect(updatePlan({event:'schedule',now:at('2028-02-29')}).run).toBe(false);
});
test('10月5日は地域のみ、全体取得は手動のみ',()=>{
 expect(updatePlan({event:'schedule',schedule:'0 9 5 10 *',now:at('2026-10-05')})).toEqual({run:true,scope:'regional'});
 expect(updatePlan({event:'schedule',schedule:'0 9 5 10 *',now:at('2026-10-05'),state:{regionalYear:'2026'}}).run).toBe(false);
 expect(updatePlan({event:'schedule',scope:'all',now:at('2026-10-20')})).toEqual({run:true,scope:'monthly'});
 expect(updatePlan({event:'workflow_dispatch',scope:'all',state:{monthlyCompleted:'2026-10'}})).toEqual({run:true,scope:'all'});
});
