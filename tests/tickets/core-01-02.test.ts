import { test, expect } from 'vitest';
import { parseCommand } from '../../packages/contracts/src/index';
const student = { actor: 'alice', role: 'student' as const };
const valid = { actor:'alice', source:'gizmo', requestId:'r1', ops:[{op:'list'}] };
test('accepts gizmo and chat requests bound to authenticated actor', () => {
  expect(parseCommand(valid,student).actor).toBe('alice');
  expect(parseCommand({...valid,source:'chat'},student).source).toBe('chat');
  expect(parseCommand({...valid,source:'teacher'},{actor:'alice',role:'teacher'}).source).toBe('teacher');
});
test.each([
  {...valid,actor:'bob'}, {...valid,source:'teacher'}, {...valid,source:'bad'},
  {...valid,ops:[]}, {...valid,requestId:''}, {...valid,version:99},
])('rejects invalid or impersonated envelope %j', input => {
  expect(()=>parseCommand(input,student)).toThrow();
});
