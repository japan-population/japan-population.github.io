import type {National,PopulationGroup} from '../types/statistics';
export type OfficialSelection = number | 'latest';
export function officialView(national:National,group:PopulationGroup,selection:OfficialSelection){
  if(selection!=='latest'){
    const snapshot=national.archive?.censuses.find(c=>c.year===selection);
    const population=snapshot?.groups[group];
    return {derivation:population?.derivation,referenceNote:population?.referenceNote,nationalities:snapshot?.nationalities,date:snapshot?.date??`${selection}-10-01`,population:population?.population,
      male:population?.male,female:population?.female,rows:population?.rows??[],
      source:population?.source,ageSource:population?.ageSource??population?.source,total:snapshot?.groups.total?.population,
      annual:national.archive?.annual.find(a=>a.year===selection)};
  }
  const b=national.breakdown,p=b?.groups[group]??(group==='total'?national.population:undefined);
  const rows=b&&b.source.sourcePeriod===p?.source.sourcePeriod?b.rows.filter(r=>r.group===group):[];
  const exact=b?.exactSex?.source.sourcePeriod===p?.source.sourcePeriod?b?.exactSex?.groups[group]:undefined;
  const total=b?.groups.total??national.population;
  return {derivation:undefined,referenceNote:undefined,nationalities:national.nationalities,date:p?.baseDate.slice(0,10)??national.population.baseDate.slice(0,10),population:p?.base,
    male:exact?.male??rows.find(r=>r.age==='総数'&&r.sex==='男')?.value,
    female:exact?.female??rows.find(r=>r.age==='総数'&&r.sex==='女')?.value,
    rows,source:p?.source,ageSource:b?.source,total:p?.baseDate===total.baseDate?total.base:undefined,
    annual:national.archive?.annual.reduce((a,b)=>a.year>b.year?a:b)};
}
