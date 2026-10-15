import {describe,it,expect} from 'vitest';
import {suites,refDecision,caseContext} from '../../tools/llm-eval/index';
import {parseDecision} from '../../apps/llm/src/tools';
// 평가 문항 자체의 검증: 모범 결정은 계약을 통과하고 채점기가 맞다고 해야 하며, 아무것도 안 한 결정은 실행 문항에서 틀려야 한다.
const noop={summary:'확인했어요.',clarification:null,ops:[]};
describe('LLM 평가 문항',()=>{
 for(const suite of Object.values(suites))describe(suite.name,()=>{
  it('문항 ID가 겹치지 않는다',()=>{const ids=suite.cases.map(c=>c.id);expect(new Set(ids).size).toBe(ids.length);});
  for(const c of suite.cases)it(`${c.id} ${c.text}`,()=>{
   const ref=parseDecision(refDecision(c));
   const ctx=caseContext(suite,c);
   expect(c.check(ref,ctx)).toBe(true);
   if(Array.isArray(c.ref)&&c.ref.length&&c.kind!=='안전'&&!c.noopOk)expect(c.check(noop,ctx)).toBe(false);
   const known=new Set(Object.keys(ctx.scene.objects));
   for(const o of ref.ops){if('id' in o&&!['place','duplicate'].includes(o.op))expect([...known]).toContain(o.id);if(o.op==='place')known.add(o.id);if(o.op==='duplicate')known.add(o.newId);}
   if(c.selected)expect(ctx.scene.objects[c.selected]?.owner).toBe(ctx.actor);
  });
 });
 it('basic은 서버 PC 기준 20문항을 유지한다',()=>{expect(suites.basic.cases).toHaveLength(20);});
});
