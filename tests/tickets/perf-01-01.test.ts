import { test, expect } from 'vitest';
import { parseBudgets } from '../../packages/contracts/src/index';
import budgets from '../../packages/contracts/budgets.json';
test('cross-language budget document accepts its supported version', () => {
  expect(parseBudgets(JSON.parse(JSON.stringify(budgets))).roomAssets).toBe(200);
});
test('rejects drifted budgets or unsupported cross-language version', () => {
  expect(()=>parseBudgets({...budgets,version:2})).toThrow();
  expect(()=>parseBudgets({...budgets,roomAssets:201})).toThrow();
});
