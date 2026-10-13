import { test,expect } from 'vitest';
import { applyCommand } from '../../packages/domain/src/index';
import { emptyScene } from '../../packages/contracts/src/index';
import { context, command, scene } from '../fixtures/scene';
test('place assigns authenticated owner and duplicate assigns copier',()=>{
  const placed=applyCommand(emptyScene(),command([{op:'place',id:'a',assetId:'chair',position:[2,0,0]}]),context);
  expect(placed.ok&&placed.snapshot.objects.a.owner).toBe('alice');
  const teacher={...context,actor:'teacher',role:'teacher' as const,locks:{a:{owner:'teacher',token:'lease1'}}};
  const copied=applyCommand(scene(),command([{op:'duplicate',id:'a',newId:'b'}],{actor:'teacher',source:'teacher'}),teacher);
  expect(copied.ok&&copied.snapshot.objects.b.owner).toBe('teacher');
  expect(copied.ok&&copied.snapshot.objects.a.owner).toBe('alice');
});
test('rejects duplicate IDs and unavailable assets',()=>{
  expect(applyCommand(scene(),command([{op:'place',id:'a',assetId:'chair',position:[0,0,0]}]),context).ok).toBe(false);
  expect(applyCommand(emptyScene(),command([{op:'place',id:'b',assetId:'secret',position:[0,0,0]}]),context).ok).toBe(false);
});
test('200th asset allowed and 201st refused',()=>{
  const s=scene();for(let i=1;i<199;i++)s.objects['o'+i]={...s.objects.a,id:'o'+i};
  const last=applyCommand(s,command([{op:'place',id:'last',assetId:'chair',position:[0,0,0]}]),context);
  expect(last.ok&&Object.keys(last.snapshot.objects)).toHaveLength(200);
  if(!last.ok)throw Error('200th refused');
  const over=applyCommand(last.snapshot,command([{op:'place',id:'over',assetId:'chair',position:[0,0,0]}]),context);
  expect(over.ok).toBe(false);
});
