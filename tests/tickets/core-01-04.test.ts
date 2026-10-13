import { test, expect } from 'vitest';
import { parseSnapshot, parseServerEvent } from '../../packages/contracts/src/index';
const snapshot = {version:1,roomId:'room',generation:0,seq:0,objects:{}};
test('snapshot event preserves sequence and generation', () => {
  expect(parseServerEvent({type:'snapshot',snapshot})).toEqual({type:'snapshot',snapshot});
});
test('unknown versions and invalid event types fail at boundary', () => {
  expect(()=>parseSnapshot({...snapshot,version:2})).toThrow();
  expect(()=>parseSnapshot({...snapshot,seq:-1})).toThrow();
  expect(()=>parseServerEvent({type:'secret',snapshot})).toThrow();
});
