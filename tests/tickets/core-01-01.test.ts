import { expect, test } from 'vitest';
import { readConfig } from '../../apps/web/src/config';
test('configuration uses local defaults without secrets', () => {
  expect(readConfig({})).toEqual({ roomId: 'local-room', actor: 'student-local' });
});
test('invalid configured identity reports its setting name', () => {
  expect(() => readConfig({ VITE_ROOM_ID: ' ' })).toThrow('VITE_ROOM_ID');
});
