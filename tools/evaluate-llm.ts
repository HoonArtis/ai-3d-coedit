import {writeFileSync,mkdirSync} from 'node:fs';
import {dirname} from 'node:path';
import {execFileSync} from 'node:child_process';
import {OllamaModel} from '../apps/llm/src/ollama';
import type {ModelDecision} from '../apps/llm/src/tools';
import {suites,caseContext,type EvalSuite} from './llm-eval/cases';
// 사용: npx tsx tools/evaluate-llm.ts [--suite basic|student|all] [--out 경로] [--model qwen3:4b] [--force]
// 기본 결과 경로는 docs/evidence/llm-eval-runs/<suite>-<시각>.json. 기존 증거 파일을 덮어쓰지 않는다.
const arg=(name:string)=>{const i=process.argv.indexOf('--'+name);return i>0?process.argv[i+1]:undefined;};
const suiteName=arg('suite')??'all',modelName=arg('model')??process.env.OLLAMA_MODEL??'qwen3:4b';
const chosen:EvalSuite[]=suiteName==='all'?Object.values(suites):[suites[suiteName as keyof typeof suites]].filter(Boolean);
if(!chosen.length)throw Error('알 수 없는 suite: '+suiteName);
// 같은 GPU에서 이미지·텍스처 작업이 돌고 있으면 시작하지 않는다(qwen3:4b 16k 컨텍스트는 약 5.1GB).
if(!process.argv.includes('--force')){
 try{
  const [used,total]=execFileSync('nvidia-smi',['--query-gpu=memory.used,memory.total','--format=csv,noheader,nounits'],{encoding:'utf8'}).split('\n')[0].split(',').map(Number);
  if(total-used<6000){console.error(`GPU 여유 ${total-used}MiB < 6000MiB. 다른 GPU 작업이 끝난 뒤 실행하거나 --force.`);process.exit(2);}
 }catch{/* nvidia-smi 없음: 확인 생략 */}
}
const stamp=new Date().toISOString().replace(/[:.]/g,'-');
const out=arg('out')??`docs/evidence/llm-eval-runs/${suiteName}-${stamp}.json`;mkdirSync(dirname(out),{recursive:true});
const model=new OllamaModel({url:process.env.OLLAMA_URL,model:modelName});
const total=chosen.reduce((n,s)=>n+s.cases.length,0);
const results:{suite:string;id:string;kind:string;request:string;pass:boolean;ms:number;decision?:ModelDecision;error?:string}[]=[];
const save=()=>{
 const bySuite=Object.fromEntries(chosen.map(s=>{const r=results.filter(x=>x.suite===s.name);return [s.name,{passed:r.filter(x=>x.pass).length,run:r.length,total:s.cases.length}];}));
 const byKind:Record<string,{passed:number;run:number}>={};for(const r of results){const k=byKind[r.kind]??={passed:0,run:0};k.run++;if(r.pass)k.passed++;}
 writeFileSync(out,JSON.stringify({model:modelName,date:new Date().toISOString(),complete:results.length===total,passed:results.filter(r=>r.pass).length,total,bySuite,byKind,results},null,2));
};
for(const suite of chosen)for(const c of suite.cases){
 const start=performance.now();let decision:ModelDecision|undefined,error:string|undefined,pass=false;
 try{decision=await model.chooseTools([{role:'user',content:c.text}],caseContext(suite,c));pass=c.check(decision);}catch(e){error=String(e);}
 results.push({suite:suite.name,id:c.id,kind:c.kind,request:c.text,pass,ms:Math.round(performance.now()-start),decision,error});save();
 console.log(c.id,pass?'PASS':'FAIL',results.at(-1)!.ms+'ms',error??JSON.stringify(decision));
}
console.log(`${results.filter(r=>r.pass).length}/${total} → ${out}`);
