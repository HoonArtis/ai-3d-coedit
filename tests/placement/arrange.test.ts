import {test,expect} from 'vitest';
import {BUILTIN_LIBRARY,emptyScene,type SceneObject,type SceneSnapshot,type AssetDefinition} from '@coedit/contracts';
import {arrangeNicely,recommendAssets,planPlacement,boundsOf,overlaps,roleOf} from '../../packages/placement/src/index';
const object=(id:string,assetId:string,position:[number,number,number]=[0,0,0],owner='alice'):SceneObject=>({id,assetId,position,rotation:[0,0,0],scale:[1,1,1],owner,lastActor:owner,revision:1,name:id});
const scene=(objects:SceneObject[]):SceneSnapshot=>({...emptyScene(),objects:Object.fromEntries(objects.map(o=>[o.id,o]))});
const apply=(s:SceneSnapshot,changed:SceneObject[])=>({...s,objects:{...s.objects,...Object.fromEntries(changed.map(o=>[o.id,o]))}});
const pairs=(s:SceneSnapshot)=>{const all=Object.values(s.objects).map(o=>boundsOf(o,BUILTIN_LIBRARY[o.assetId]));let n=0;for(let i=0;i<all.length;i++)for(let j=i+1;j<all.length;j++)if(overlaps(all[i],all[j]))n++;return n;};
const yawToward=(o:SceneObject,t:SceneObject)=>Math.atan2(t.position[0]-o.position[0],t.position[2]-o.position[2]);

test('흩어진 의자는 탁자를 같은 거리로 둘러 탁자를 보고, 결과는 결정적이며 겹치지 않는다',()=>{
  const input=scene([object('t','table'),object('a','chair',[5,0,1]),object('b','chair',[-4,0,3]),object('c','chair',[0,0,-6]),object('d','chair',[2,0,7])]);
  const ids=['t','a','b','c','d'],out=arrangeNicely(ids,input,BUILTIN_LIBRARY);
  expect(out).toEqual(arrangeNicely(ids,input,BUILTIN_LIBRARY));
  const after=apply(input,out),table=after.objects.t;
  expect(table.position).toEqual([0,0,0]);
  const radii=['a','b','c','d'].map(id=>Math.hypot(after.objects[id].position[0],after.objects[id].position[2]));
  for(const r of radii)expect(r).toBeCloseTo(radii[0],5);
  expect(radii[0]).toBeLessThan(2);
  for(const id of ['a','b','c','d'])expect(after.objects[id].rotation[1]).toBeCloseTo(yawToward(after.objects[id],table),5);
  expect(pairs(after)).toBe(0);
});
test('화분은 비어 있는 탁자 위에 오르고, 남은 화분은 곁에 놓인다',()=>{
  const input=scene([object('t','table'),object('p','plant',[3,0,3]),object('q','plant',[-6,0,0])]);
  const after=apply(input,arrangeNicely(['t','p','q'],input,BUILTIN_LIBRARY));
  const onTop=['p','q'].filter(id=>Math.abs(after.objects[id].position[1]-BUILTIN_LIBRARY.table.dimensions[1])<1e-6);
  expect(onTop).toHaveLength(1);expect(pairs(after)).toBe(0);
});
test('벤치는 가까운 나무 앞에서 나무를 보고, 나무는 제자리를 지킨다',()=>{
  const input=scene([object('tr','tree',[10,0,10]),object('bn','bench',[-5,0,-5])]);
  const after=apply(input,arrangeNicely(['tr','bn'],input,BUILTIN_LIBRARY));
  expect(after.objects.tr.position).toEqual([10,0,10]);
  const bench=after.objects.bn;expect(Math.hypot(bench.position[0]-10,bench.position[2]-10)).toBeLessThan(3);
  expect(bench.rotation[1]).toBeCloseTo(yawToward(bench,after.objects.tr),5);expect(pairs(after)).toBe(0);
});
test('겹쳐 있던 물체를 풀고, 남의 물체는 장애물로만 피한다',()=>{
  const input=scene([object('t','table'),object('a','chair',[1.3,0,0]),object('b','chair',[1.4,0,.2]),object('x','cube',[0,0,1.6],'bob')]);
  expect(pairs(input)).toBeGreaterThan(0);
  const out=arrangeNicely(['t','a','b'],input,BUILTIN_LIBRARY);
  expect(out.map(o=>o.id)).not.toContain('x');expect(pairs(apply(input,out))).toBe(0);
});
test('planPlacement는 바뀐 물체만 move/rotate로 풀고, 자리가 없으면 통째로 실패한다',()=>{
  const input=scene([object('t','table'),object('a','chair',[3,0,0])]);
  const result=planPlacement({op:'arrange_nicely',ids:['t','a']},input,BUILTIN_LIBRARY);
  expect(result.ok).toBe(true);if(result.ok){expect(result.ops.every(o=>(o.op==='move'||o.op==='rotate')&&o.id==='a')).toBe(true);}
  const walls=Array.from({length:21},(_,i)=>Array.from({length:21},(_,j)=>object(`w${i}_${j}`,'cube',[i-10,0,j-10],'bob'))).flat();
  const crowded=scene([...walls,object('c','chair',[30,0,30])]);crowded.objects.c.position=[0,0,0];
  expect(planPlacement({op:'arrange_nicely',ids:['c']},crowded,BUILTIN_LIBRARY)).toEqual({ok:false,code:'NO_SPACE'});
});
test('생성 에셋은 이름으로 역할을 짐작하고 모르면 장식으로 둔다',()=>{
  const generated=(name:string):AssetDefinition=>({id:'g',name,kind:'generated',color:'#ffffff',dimensions:[1,1,1],artifactId:'a'.repeat(64)});
  expect(roleOf(generated('고래 모양 벤치'))).toBe('bench');expect(roleOf(generated('피카츄'))).toBe('decor');
});
test('추천은 빠진 짝을 라이브러리에서 먼저 권하고 모자라면 생성 아이디어로 채운다',()=>{
  const table=recommendAssets(scene([object('t','table')]),BUILTIN_LIBRARY);
  expect(table.map(s=>s.kind==='place'?s.assetId:'generate')).toEqual(['chair','plant','generate']);
  expect(table[0]).toMatchObject({nearId:'t'});
  expect(recommendAssets(scene([object('tr','tree',[5,0,5])]),BUILTIN_LIBRARY)[0]).toMatchObject({kind:'place',assetId:'bench'});
  const empty=recommendAssets(emptyScene(),BUILTIN_LIBRARY);
  expect(empty).toHaveLength(2);expect(empty.at(-1)).toMatchObject({kind:'generate'});
  const focused=recommendAssets(scene([object('t','table'),object('c','chair',[10,0,10])]),BUILTIN_LIBRARY,'c');
  expect(focused[0]).toMatchObject({kind:'place',assetId:'table',nearId:'c'});
  expect(()=>recommendAssets(emptyScene(),BUILTIN_LIBRARY,'none')).toThrow('NOT_FOUND');
});
test('추천은 쓸 수 없는 에셋을 권하지 않고, 같은 역할이면 학생 생성 에셋을 먼저 권한다',()=>{
  const mine:AssetDefinition={id:'gb',name:'고래 벤치',kind:'generated',color:'#ffffff',dimensions:[2,1,.7],artifactId:'b'.repeat(64),creator:'alice'};
  const library={...BUILTIN_LIBRARY,gb:mine},input=scene([object('tr','tree')]);
  expect(recommendAssets(input,library)[0]).toMatchObject({assetId:'gb'});
  expect(recommendAssets(input,library,undefined,a=>a.id!=='gb')[0]).toMatchObject({assetId:'bench'});
});
