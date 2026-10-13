import { test, expect } from 'vitest';
import { checkImports } from '../../tools/check-modules';
test('allows domain to depend on public contracts', () => {
  expect(checkImports({'packages/domain/src/index.ts':"import {x} from '../../contracts/src/index';",'packages/contracts/src/index.ts':'export const x=1;'})).toEqual([]);
});
test('rejects application dependencies and private imports', () => {
  const violations=checkImports({
    'packages/domain/src/index.ts':"import {x} from '../../../apps/web/src/config'; import {y} from '../../contracts/src/private';",
    'packages/contracts/src/index.ts':"import x from '../../../apps/web/src/config';",
    'apps/web/src/config.ts':'export const x=1;',
    'packages/contracts/src/private.ts':'export const y=1;',
  });
  expect(violations.some(v=>v.reason.includes('direction'))).toBe(true);
  expect(violations.some(v=>v.reason.includes('private'))).toBe(true);
});
