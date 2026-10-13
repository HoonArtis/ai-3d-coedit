import {test,expect} from 'vitest';
import {applyCommand} from '../../packages/domain/src/index';
import {context,command,scene} from '../fixtures/scene';
test('rename and delete use checked command path',()=>{
  const result=applyCommand(scene(),command([{op:'rename',id:'a',name:'파란 의자'}]),context);
  expect(result.ok&&result.snapshot.objects.a.name).toBe('파란 의자');
  const deleted=applyCommand(scene(),command([{op:'delete',id:'a'}]),context);
  expect(deleted.ok&&deleted.snapshot.objects).toEqual({});
});
test('queries do not change scene sequence and missing deletion fails',()=>{
  const input=scene();
  const result=applyCommand(input,command([{op:'find',query:'의자'}]),context);
  expect(result.ok&&result.query).toHaveLength(1);
  expect(result.ok&&result.snapshot.seq).toBe(input.seq);
  expect(applyCommand(input,command([{op:'delete',id:'missing'}]),context).ok).toBe(false);
});
