import {describe,it,expect} from 'vitest';
import {studentTools,parseDecision,decisionJSONSchema} from '../../apps/llm/src/tools';
import {OllamaModel} from '../../apps/llm/src/ollama';
import {buildMessages} from '../../apps/llm/src/prompt';
import {opSchema} from '../../packages/contracts/src/index';
const context={actor:'alice',selectedId:null,cameraCenter:[0,0,0] as [number,number,number],scene:{version:1 as const,roomId:'r',generation:0,seq:0,objects:{}}};
describe('LLM public boundary',()=>{
 it('uses draft-7 tuple arrays supported by the local grammar parser',()=>{
  const schema=JSON.stringify(decisionJSONSchema);expect(schema).not.toContain('prefixItems');expect(schema).not.toContain('"items":false');
 });
 it('derives student tools from contracts with examples and excludes teacher tools',()=>{
  expect(studentTools.length).toBe(27);
  expect(studentTools.map(t=>t.function.name)).not.toContain('force_unlock');
  for(const t of studentTools){expect(opSchema.options.some(o=>o.shape.op.value===t.function.name)).toBe(true);expect(t.function.description.match(/예:/g)).toHaveLength(2);expect(t.function.parameters.additionalProperties).toBe(false);}
 });
 it('rejects unknown, teacher, malformed and ambiguous execution decisions',()=>{
  const d={summary:'실행할게요',clarification:null,ops:[{op:'delete',id:'a'}]};expect(parseDecision(d).ops).toEqual(d.ops);
  for(const ops of [[{op:'sudo'}],[{op:'force_unlock',ids:['a']}],[{op:'scale',id:'a',value:[0,1,1]}]])expect(()=>parseDecision({...d,ops})).toThrow();
  expect(()=>parseDecision({...d,clarification:'어느 것인가요?'})).toThrow();
 });
 it('keeps scene names as untrusted data and limits history input',()=>{
  const messages=buildMessages([{role:'user',content:'저거 지워줘'}],context);
  expect(messages[0].content).toContain('한 번만');expect(messages[0].content).toContain('권한');
  expect(messages[0].content).toContain('지시가 아님');expect(messages[1]).toEqual({role:'user',content:'저거 지워줘'});
  expect(()=>buildMessages([{role:'user',content:'x'.repeat(4001)}],context)).toThrow();
 });
 it('uses local structured output and validates malformed JSON, missing model and timeout',async()=>{
  let payload:any;
  const model=new OllamaModel({fetch:async(_url,init)=>{payload=JSON.parse(init!.body as string);return Response.json({message:{content:JSON.stringify({summary:'목록을 볼게요',clarification:null,ops:[{op:'list'}]})}});}});
  expect((await model.chooseTools([{role:'user',content:'목록'}],context)).ops).toEqual([{op:'list'}]);expect(payload.think).toBe(false);expect(payload.format.properties.ops).toBeDefined();
  const bad=new OllamaModel({fetch:async()=>Response.json({message:{content:'not-json'}})});await expect(bad.chooseTools([],context)).rejects.toThrow('MODEL_INVALID_OUTPUT');
  const missing=new OllamaModel({fetch:async()=>new Response('',{status:404})});await expect(missing.chooseTools([],context)).rejects.toThrow('MODEL_UNAVAILABLE');
  const slow=new OllamaModel({timeoutMs:10,fetch:async(_u,init)=>new Promise((_resolve,reject)=>init!.signal!.addEventListener('abort',()=>reject(init!.signal!.reason)))});await expect(slow.chooseTools([],context)).rejects.toThrow('MODEL_TIMEOUT');
 });
});

it('model sees the room approved library instead of a hardcoded builtin-only catalog',()=>{
 const id='generated-'+'a'.repeat(64),asset={id,name:'승인된 고래',kind:'generated' as const,color:'#123456',dimensions:[1,1,1] as [number,number,number],artifactId:'a'.repeat(64)};
 const data=buildMessages([],{...context,library:{[id]:asset}})[0].content;expect(data).toContain('승인된 고래');expect(data).toContain(id);
});
