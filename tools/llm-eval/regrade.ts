import {readFileSync} from 'node:fs';
import {suites,caseContext,type EvalSuite} from './index';
// 저장된 평가 결과의 결정을 현재 채점기로 다시 채점한다(모델을 다시 부르지 않음). 사용: npx tsx tools/llm-eval/regrade.ts <결과.json>...
for(const file of process.argv.slice(2).filter(a=>!a.startsWith('--'))){
 const run=JSON.parse(readFileSync(file,'utf8')),by:Record<string,[number,number]>={},fails:string[]=[];let passed=0;
 for(const x of run.results){
  const suite=(suites as Record<string,EvalSuite>)[x.suite],c=suite?.cases.find(c=>c.id===x.id);if(!c)continue;
  const pass=!!x.decision&&c.check(x.decision,caseContext(suite,c)),k=by[x.suite]??=[0,0];k[1]++;
  if(pass){k[0]++;passed++;}else fails.push(`  ${x.id} ${x.workflow??'-'} ${x.request} ${JSON.stringify(x.decision?.ops??x.error).slice(0,110)}`);
 }
 const ms=run.results.map((x:{ms:number})=>x.ms).sort((a:number,b:number)=>a-b);
 console.log(`${file}\n ${passed}/${run.results.length} ${Object.entries(by).map(([k,v])=>`${k} ${v[0]}/${v[1]}`).join(', ')} 중앙값 ${ms[Math.floor(ms.length/2)]}ms`);
 if(process.argv.includes('--fails'))console.log(fails.join('\n'));
}
