import {test,expect} from 'vitest';
import {applyCommand} from '../../packages/domain/src/index';
import {context,command,scene} from '../fixtures/scene';
test('all operations commit with one sequence and one changed-ID set',()=>{
  const result=applyCommand(scene(),command([{op:'move',id:'a',value:[1,0,0]},{op:'rename',id:'a',name:'새 이름'}]),context);
  expect(result.ok&&result.snapshot.seq).toBe(1);
  expect(result.ok&&result.changedIds).toEqual(['a']);
});
test('failure in second operation rolls back first without touching input',()=>{
  const original=scene();const saved=JSON.stringify(original);
  const result=applyCommand(original,command([{op:'move',id:'a',value:[2,0,0]},{op:'delete',id:'absent'}]),context);
  expect(result.ok).toBe(false);expect(JSON.stringify(original)).toBe(saved);
});
