import {describe,it,expect} from 'vitest';
import {preflight,postcheck,requestedCount} from '../../apps/llm/src/guards';
import {ChatAgent} from '../../apps/llm/src/agent';
import {OllamaModel} from '../../apps/llm/src/ollama';
import type {SceneObject,Op} from '../../packages/contracts/src/index';
const object=(id:string,assetId:string,owner='alice',position:[number,number,number]=[0,0,0]):SceneObject=>({id,assetId,name:id,owner,position,rotation:[0,0,0],scale:[1,1,1],revision:1,lastActor:owner});
const context=(selectedId:string|null=null,clarified=false)=>({actor:'alice',selectedId,clarified,cameraCenter:[0,0,-4] as [number,number,number],scene:{version:1 as const,roomId:'r',generation:0,seq:3,objects:{t1:object('t1','table'),c1:object('c1','chair'),p1:object('p1','plant'),b1:object('b1','bench','bob')}}});
const d=(ops:unknown[],summary='할게요')=>({summary,clarification:null,ops:ops as Op[]});

describe('전처리',()=>{
 it('선택 없이 이거/저거를 대상으로 하면 모델 없이 한 번 되묻고, 두 번째는 안내만 한다',()=>{
  expect(preflight('이거 지워줘',context(),'edit')).toMatchObject({ops:[],clarification:expect.any(String)});
  expect(preflight('선택한 거 세 개 복사해',context(),'edit')?.clarification).toBeTruthy();
  expect(preflight('저거 옮겨',context(null,true),'edit')).toEqual({summary:'대상을 선택한 뒤 다시 요청해 주세요.',clarification:null,ops:[]});
 });
 it('선택이 있거나, 대상이 필요 없는 워크플로우거나, 지시어가 아니면 지나간다',()=>{
  expect(preflight('이거 지워줘',context('c1'),'edit')).toBeNull();
  expect(preflight('이거 취소해',context(),'history')).toBeNull();
  expect(preflight('여기 나무 심어줘',context(),'arrange')).toBeNull();
  expect(preflight('그거참 예쁘다',context(),'other')).toBeNull();
 });
});
describe('후검사',()=>{
 it('남의 물체를 바꾸는 op가 하나라도 있으면 전체를 거절하고, 기준(targetId)으로 쓰는 건 허용한다',()=>{
  expect(postcheck(d([{op:'move',id:'c1',value:[1,0,0]},{op:'delete',id:'b1'}]),'다 지워',context(),'edit')).toMatchObject({ops:[],summary:expect.stringContaining('다른 학생')});
  expect(postcheck(d([{op:'arrange_nicely',ids:['c1','b1']}]),'정리해',context(),'arrange').ops).toEqual([]);
  expect(postcheck(d([{op:'face_toward',id:'c1',targetId:'b1'}]),'벤치 보게',context(),'edit').ops).toHaveLength(1);
 });
 it('없는 대상을 가리키면 실행하지 않는다. 같은 요청에서 먼저 만든 물체는 가리킬 수 있다',()=>{
  expect(postcheck(d([{op:'place_on',id:'tr9',targetId:'t1'}]),'올려',context(),'arrange')).toMatchObject({ops:[],summary:expect.stringContaining('찾지 못했어요')});
  const ok=postcheck(d([{op:'place',id:'n1',assetId:'bench',position:[0,0,0],rotation:[0,0,0],scale:[1,1,1]},{op:'face_toward',id:'n1',targetId:'t1'}]),'벤치 놓고 탁자 보게',context(),'arrange');
  expect(ok.ops).toHaveLength(2);
 });
 it('새로 만드는 ID가 기존과 겹치면 새 ID를 주고 뒤따르는 참조도 바꾼다',()=>{
  const out=postcheck(d([{op:'place',id:'c1',assetId:'chair',position:[0,0,0],rotation:[0,0,0],scale:[1,1,1]},{op:'arrange_nicely',ids:['c1']}]),'의자 놓고 알아서',context(),'arrange');
  expect(out.ops).toEqual([expect.objectContaining({op:'place',id:'c1_2'}),{op:'arrange_nicely',ids:['c1_2']}]);
  expect(postcheck(d([{op:'scatter',assetId:'plant',ids:['p1','p9'],min:[-1,0,-1],max:[1,0,1],seed:1}]),'화분 뿌려',context(),'arrange').ops[0]).toMatchObject({ids:['p1_2','p9']});
 });
 it('복사본을 다시 복사하는 체인은 원본 복사로 고친다',()=>{
  const out=postcheck(d([{op:'duplicate',id:'c1',newId:'c3'},{op:'duplicate',id:'c3',newId:'c4'},{op:'duplicate',id:'c4',newId:'c5'}]),'세 개 복사',context('c1'),'edit');
  expect(out.ops.map(o=>'id' in o&&o.id)).toEqual(['c1','c1','c1']);
 });
 it('scatter는 바닥에 두고, "여기/근처"인데 카메라 중심이 범위 밖이면 카메라 중심 ±2m로 옮긴다',()=>{
  const out=postcheck(d([{op:'scatter',assetId:'plant',ids:['f1'],min:[-2,-2,-2],max:[2,2,2],seed:1}]),'이 근처에 화분 뿌려줘',context(),'arrange');
  expect(out.ops[0]).toMatchObject({min:[-2,0,-6],max:[2,0,-2]});
  expect(postcheck(d([{op:'scatter',assetId:'plant',ids:['f1'],min:[-2,-2,-2],max:[2,2,2],seed:1}]),'화분 뿌려줘',context(),'arrange').ops[0]).toMatchObject({min:[-2,0,-2],max:[2,0,2]});
 });
 it('되돌리기의 지어낸 순번을 지우고, "다시/살려"는 redo, "취소/되돌려"는 undo로 맞춘다',()=>{
  expect(postcheck(d([{op:'undo',expectedSeq:1}]),'방금 거 취소',context(),'history').ops).toEqual([{op:'undo'}]);
  expect(postcheck(d([{op:'undo',expectedSeq:1}]),'방금 취소한 거 다시 살려줘',context(),'history').ops).toEqual([{op:'redo'}]);
  expect(postcheck(d([{op:'redo'}]),'되돌려',context(),'history').ops).toEqual([{op:'undo'}]);
 });
 it('새로 만드는 도구에 기존 물체를 넣으면 다시 놓기(arrange_nicely)로 읽는다',()=>{
  expect(postcheck(d([{op:'arrange_around',targetId:'t1',assetId:'chair',ids:['c1','p1'],radius:2}]),'탁자 주변 꾸며줘',context(),'arrange').ops).toEqual([{op:'arrange_nicely',ids:['c1','p1']}]);
  expect(postcheck(d([{op:'arrange_around',targetId:'t1',assetId:'chair',ids:['c1'],radius:2}]),'탁자 둘레에 의자 3개 둘러놔',context(),'arrange').ops[0]).toMatchObject({op:'arrange_around',ids:['c1_2','chair1','chair2']});
  expect(postcheck(d([{op:'scatter',assetId:'plant',ids:['p1'],min:[-1,0,-5],max:[1,0,-3],seed:1}]),'화분 여기저기 놔줘',context(),'arrange').ops[0]).toMatchObject({op:'scatter',ids:['p1_2']});
 });
 it('문장의 개수를 읽어 모자란 생성·복제를 채우고, "두 배"는 개수로 보지 않는다',()=>{
  expect([requestedCount('세 개 복사해'),requestedCount('의자 6개 둘러놔'),requestedCount('나무 두 그루'),requestedCount('두 배로'),requestedCount('하나 더')]).toEqual([3,6,2,null,null]);
  expect(postcheck(d([{op:'scatter',assetId:'plant',ids:['f1'],min:[-1,0,-5],max:[1,0,-3],seed:1}]),'화분 다섯 개 이 근처에 뿌려줘',context(),'arrange').ops[0]).toMatchObject({ids:['f1','plant1','plant2','plant3','plant4']});
  const copies=postcheck(d([{op:'duplicate',id:'c1',newId:'c3'},{op:'duplicate',id:'c3',newId:'c4'}]),'세 개 복사해',context('c1'),'edit').ops;
  expect(copies.map(o=>o.op==='duplicate'&&[o.id,o.newId])).toEqual([['c1','c3'],['c1','c4'],['c1','c1_copy1']]);
 });
 it('금칙어가 든 생성은 모델이 냈어도 거절한다',()=>{
  expect(postcheck(d([{op:'generate',prompt:'야한 그림'}]),'야한 그림 만들어줘',context(),'create')).toMatchObject({ops:[],summary:expect.stringContaining('수업')});
  expect(postcheck(d([{op:'generate',prompt:'피카츄'}]),'피카츄 만들어줘',context(),'create').ops).toHaveLength(1);
 });
});
describe('ChatAgent',()=>{
 const script=(...replies:unknown[])=>{let n=0;return (async()=>Response.json({message:{content:JSON.stringify(replies[n++])}})) as typeof fetch;};
 it('전처리가 답하면 2단계 모델을 부르지 않는다',async()=>{
  let calls=0;const counting=(async()=>{calls++;return Response.json({message:{content:JSON.stringify({category:"edit"})}});}) as typeof globalThis.fetch;
  const out=await new ChatAgent(new OllamaModel({fetch:counting})).chooseTools([{role:"user",content:"이거 지워줘"}],context());
  expect(out.ops).toEqual([]);expect(out.clarification).toBeTruthy();expect(calls).toBe(1);
 });
 it('후검사를 거친 결정을 돌려주고, guards:false면 모델 결정을 그대로 돌려준다',async()=>{
  const decision={summary:'지울게요',clarification:null,ops:[{op:'delete',id:'b1'}]};
  expect((await new ChatAgent(new OllamaModel({fetch:script({category:'edit'},decision)})).chooseTools([{role:'user',content:'b1 지워'}],context())).ops).toEqual([]);
  expect((await new ChatAgent(new OllamaModel({fetch:script({category:'edit'},decision)}),{guards:false}).chooseTools([{role:'user',content:'b1 지워'}],context())).ops).toEqual(decision.ops);
 });
});
