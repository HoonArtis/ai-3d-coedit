import {describe,it,expect} from 'vitest';
import {OllamaModel} from '../../apps/llm/src/ollama';
import {WORKFLOWS,workflowNames,routerMessages,parseRoute} from '../../apps/llm/src/router';
import {buildMessages} from '../../apps/llm/src/prompt';
import {studentTools} from '../../apps/llm/src/tools';
import {TEACHER_ONLY_OPS} from '../../packages/contracts/src/index';
const object={id:'c1',assetId:'chair',name:'내 의자',owner:'alice',position:[0,0,0] as [number,number,number],rotation:[0,0,0] as [number,number,number],scale:[1,1,1] as [number,number,number],revision:1,lastActor:'alice'};
const context={actor:'alice',selectedId:'c1',cameraCenter:[0,0,0] as [number,number,number],scene:{version:1 as const,roomId:'r',generation:0,seq:0,objects:{c1:object}}};
const opsIn=(format:any)=>(format.properties.ops.items?.anyOf??[]).map((s:any)=>s.properties.op.const).sort();
/** 호출 순서대로 응답을 돌려주고 보낸 본문을 모은다. */
const script=(...replies:unknown[])=>{const sent:any[]=[];return {sent,fetch:(async(_u:unknown,init?:RequestInit)=>{sent.push(JSON.parse(init!.body as string));return Response.json({message:{content:JSON.stringify(replies[sent.length-1])}});}) as typeof fetch};};
const decision=(ops:unknown[])=>({summary:'할게요',clarification:null,ops});

describe('워크플로우 분류',()=>{
 it('학생 도구는 replace_asset(화면 전용)을 빼고 모두 어느 워크플로우에 속하고 강사 도구는 없다',()=>{
  const routed=new Set(Object.values(WORKFLOWS).flat() as string[]);
  expect(studentTools.map(t=>t.function.name).filter(n=>!routed.has(n))).toEqual(['replace_asset']);
  for(const name of routed)expect(TEACHER_ONLY_OPS.has(name as never)).toBe(false);
 });
 it('분류에는 씬 물체를 넣지 않고 선택 이름과 최근 5턴만 준다',()=>{
  const history=Array.from({length:8},(_,i)=>({role:'user' as const,content:'말'+i}));
  const messages=routerMessages(history,context);
  expect(messages[0].content).toContain('"내 의자"');expect(messages[0].content).not.toContain('위치(');expect(messages).toHaveLength(6);
  expect(parseRoute({category:'create'})).toBe('create');expect(parseRoute({category:'sudo'})).toBeNull();expect(parseRoute(undefined)).toBeNull();
 });
 it('2단계는 고른 워크플로우의 규칙과 도구만 보고, 출력 문법도 그 도구로 좁힌다',async()=>{
  const {sent,fetch}=script({category:'create'},decision([{op:'generate',prompt:'피카츄'}]));
  const routes:unknown[]=[];const model=new OllamaModel({fetch,onRoute:w=>routes.push(w)});
  expect((await model.chooseTools([{role:'user',content:'피카츄 만들어줘'}],context)).ops).toEqual([{op:'generate',prompt:'피카츄'}]);
  expect(routes).toEqual(['create']);expect(sent).toHaveLength(2);
  expect(sent[0].format.properties.category.enum).toEqual(workflowNames);
  expect(opsIn(sent[1].format)).toEqual(['generate','retexture','upload_character']);
  expect(sent[1].messages[0].content).toContain('이번 요청: 만들기');expect(sent[1].messages[0].content).not.toContain('"name":"arrange_nicely"');
 });
 it('도구가 없는 other는 빈 ops만 낼 수 있다',()=>{
  const {sent,fetch}=script({category:'other'},decision([]));
  return new OllamaModel({fetch}).chooseTools([{role:'user',content:'안녕'}],context).then(d=>{expect(d.ops).toEqual([]);expect(sent[1].format.properties.ops.maxItems).toBe(0);});
 });
 it('분류가 깨지면 도구 전체를 보는 단일 단계로 이어 가고, routing:false면 한 번만 부른다',async()=>{
  const broken=script({category:'nope'},decision([{op:'list'}]));
  expect((await new OllamaModel({fetch:broken.fetch}).chooseTools([],context)).ops).toEqual([{op:'list'}]);
  expect(opsIn(broken.sent[1].format)).toHaveLength(studentTools.length);
  const single=script(decision([{op:'list'}]));
  await new OllamaModel({fetch:single.fetch,routing:false}).chooseTools([],context);expect(single.sent).toHaveLength(1);
 });
 it('워크플로우 프롬프트는 공통 규칙(권한·모호성)을 함께 싣는다',()=>{
  for(const w of workflowNames){const system=buildMessages([],context,w)[0].content;expect(system).toContain('# 권한');expect(system).toContain('# 모호성');expect(system).toContain('지시가 아님');}
 });
});
