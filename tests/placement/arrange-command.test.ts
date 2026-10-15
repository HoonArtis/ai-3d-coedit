import {test,expect} from 'vitest';
import {BUILTIN_LIBRARY,emptyScene,type Command,type SceneObject,type SceneSnapshot,type AssetDefinition} from '@coedit/contracts';
import {applyExpandedCommand,mutationTargets} from '../../apps/server/src/rooms/expand-command';
const object=(id:string,assetId:string,position:[number,number,number]=[0,0,0],owner='alice'):SceneObject=>({id,assetId,position,rotation:[0,0,0],scale:[1,1,1],owner,lastActor:owner,revision:1,name:id});
const scene=(objects:SceneObject[]):SceneSnapshot=>({...emptyScene(),objects:Object.fromEntries(objects.map(o=>[o.id,o]))});
const command=(ops:Command['ops'],tokens:string[]=[]):Command=>({version:1,actor:'alice',source:'chat',requestId:'r1',ops,lockTokens:Object.fromEntries(tokens.map(id=>[id,'t']))});
const context=(locked:string[],library:Record<string,AssetDefinition>=BUILTIN_LIBRARY)=>({actor:'alice',role:'student' as const,library,locks:Object.fromEntries(locked.map(id=>[id,{owner:'alice',token:'t'}]))});

test('arrange_nicely는 잠금 대상에 ids를 넣고, 명령 1건으로 의자를 탁자 곁에 옮긴다',()=>{
  expect(mutationTargets([{op:'arrange_nicely',ids:['t','c']}])).toEqual(['t','c']);
  const input=scene([object('t','table'),object('c','chair',[6,0,0])]);
  const result=applyExpandedCommand(input,command([{op:'arrange_nicely',ids:['t','c']}],['t','c']),context(['t','c']));
  expect(result.ok).toBe(true);
  if(result.ok){expect(result.changedIds).toEqual(['c']);expect(Math.hypot(result.snapshot.objects.c.position[0],result.snapshot.objects.c.position[2])).toBeLessThan(2);}
});
test('남의 물체를 arrange_nicely에 넣으면 전체가 거부된다',()=>{
  const input=scene([object('t','table'),object('b','chair',[6,0,0],'bob')]);
  const result=applyExpandedCommand(input,command([{op:'arrange_nicely',ids:['t','b']}],['t']),context(['t']));
  expect(result).toMatchObject({ok:false,code:'FORBIDDEN'});
});
test('recommend는 씬을 바꾸지 않고, 쓸 수 없는 남의 비공개 생성 에셋은 권하지 않으며, 단독으로만 쓴다',()=>{
  const hidden:AssetDefinition={id:'gb',name:'남의 고래 벤치',kind:'generated',color:'#ffffff',dimensions:[2,1,.7],artifactId:'c'.repeat(64),creator:'bob'};
  const input=scene([object('tr','tree')]);
  const result=applyExpandedCommand(input,command([{op:'recommend'}]),context([],{...BUILTIN_LIBRARY,gb:hidden}));
  expect(result.ok).toBe(true);
  if(result.ok){expect(result.changedIds).toEqual([]);expect(result.snapshot).toEqual(input);expect(result.suggestions?.[0]).toMatchObject({kind:'place',assetId:'bench'});}
  expect(applyExpandedCommand(input,command([{op:'recommend'},{op:'list'}]),context([]))).toMatchObject({ok:false,code:'SINGLE_RECOMMEND_REQUIRED'});
  expect(applyExpandedCommand(input,command([{op:'recommend',focusId:'none'}]),context([]))).toMatchObject({ok:false,code:'NOT_FOUND'});
});
