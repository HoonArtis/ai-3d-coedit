import {test,expect} from 'vitest';
import {applyCommand} from '../../packages/domain/src/index';
import {context,command,scene} from '../fixtures/scene';
test.each([['move','position'],['rotate','rotation'],['scale','scale']])('applies %s without mutating original', (op,key)=>{
  const original=scene();const saved=JSON.stringify(original);
  const result=applyCommand(original,command([{op,id:'a',value:[2,3,4]}]),context);
  expect(result.ok&&result.snapshot.objects.a[key as 'position']).toEqual([2,3,4]);
  expect(JSON.stringify(original)).toBe(saved);
});
test('rejects foreign ownership, missing target, missing or stale lease and viewer writes',()=>{
  const c=command([{op:'move',id:'a',value:[1,0,0]}]);
  const foreign=scene();foreign.objects.a.owner='bob';
  expect(applyCommand(foreign,c,context).ok).toBe(false);
  expect(applyCommand(scene(),command([{op:'move',id:'missing',value:[1,0,0]}]),context).ok).toBe(false);
  expect(applyCommand(scene(),c,{...context,locks:{}}).ok).toBe(false);
  expect(applyCommand(scene(),command([{op:'move',id:'a',value:[1,0,0]}],{lockTokens:{a:'stale'}}),context).ok).toBe(false);
  expect(applyCommand(scene(),c,{...context,role:'viewer'}).ok).toBe(false);
});
