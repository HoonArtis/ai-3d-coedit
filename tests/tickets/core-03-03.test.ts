import { test, expect } from 'vitest';
import { checkImports } from '../../tools/check-modules';
test('checks literal dynamic imports as well as static imports', () => {
  expect(checkImports({'apps/web/src/a.ts':"const server=import('../../server/src/index');",'apps/server/src/index.ts':''}).length).toBeGreaterThan(0);
});
