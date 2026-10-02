import {expect,it} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import {readDataset} from '../scripts/dataset';
import {validatePublication} from '../scripts/validation';
import {Home} from '../src/pages/Home';
import {populationGroups} from '../src/types/statistics';
import {monthStart} from '../src/lib/time';
import {number} from '../src/lib/formatting';

it('公開JSONで全3区分の人口カウンター・過去確定値・ピラミッドを表示できる',async()=>{
 const data=await readDataset('public/data');
 validatePublication(data);
 for(const group of populationGroups){
  const html=renderToStaticMarkup(<Home data={data} group={group} now={monthStart(data.manifest.forecastMonths[0])}/>);
  expect(html).not.toContain('データ更新後に表示します。');
  expect(html).toContain('class="population-number"');
  expect(html).toContain(number(data.national.breakdown!.groups[group].base));
  expect(html).toContain('class="pyramid-chart"');
  expect(data.national.breakdown!.rows.filter(r=>r.group===group)).toHaveLength(66);
 }
 expect(data.national.breakdown!.groups.total.base).toBe(data.national.population.base);
});
