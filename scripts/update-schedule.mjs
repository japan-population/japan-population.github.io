import {readFile,appendFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
export const STATE_PATH='.github/data-update-state.json';
export function updatePlan({event,scope='monthly',schedule,now=Date.now(),state={}}){
 if(event!=='schedule'){
  if(!['monthly','regional','all'].includes(scope))throw Error('Unknown update scope');
  return {run:true,scope};
 }
 const date=new Date(now+9*3600000).toISOString();const month=date.slice(0,7),day=Number(date.slice(8,10));
 if(schedule==='0 9 5 10 *')return {run:state.regionalYear!==date.slice(0,4),scope:'regional'};
 return {run:day>=20&&day%2===0&&state.monthlyCompleted!==month,scope:'monthly'};
}
export async function readUpdateState(){try{return JSON.parse(await readFile(STATE_PATH,'utf8'));}catch(e){if(e.code==='ENOENT')return {};throw e;}}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const plan=updatePlan({event:process.env.UPDATE_EVENT,scope:process.env.UPDATE_SCOPE||'monthly',schedule:process.env.UPDATE_SCHEDULE,state:await readUpdateState()});
 console.log(plan.run?`Update scope: ${plan.scope}`:'Skip: no statistics requests are needed');
 if(process.env.GITHUB_OUTPUT)await appendFile(process.env.GITHUB_OUTPUT,`run=${plan.run}\nscope=${plan.scope}\n`);
}
