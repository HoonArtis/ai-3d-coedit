import { expect, test } from './fixture';
test('editor application loads without a page error', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto('/');
  await expect(page.getByRole('heading', {name:'AI 공간 꾸미기'})).toBeVisible();
  expect(errors).toEqual([]);
});
