import { test, expect } from 'vitest';
import { checkImports } from '../../tools/check-modules';
test('reports direct and indirect module cycles', () => {
  const files={'packages/domain/src/a.ts':"export * from './b';",'packages/domain/src/b.ts':"export * from './c';",'packages/domain/src/c.ts':"import './a';"};
  expect(checkImports(files).some(v=>v.reason.includes('cycle'))).toBe(true);
  expect(checkImports({'packages/domain/src/a.ts':"import './a';"}).some(v=>v.reason.includes('cycle'))).toBe(true);
});
