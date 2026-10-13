import {test,expect} from './fixture';
test('empty editor has a real 3D canvas and usable side panels',async({page})=>{
  await page.goto('/');
  await expect(page.getByRole('heading',{name:'에셋 라이브러리'})).toBeVisible();
  await expect(page.getByRole('heading',{name:'속성'})).toBeVisible();
  await expect(page.getByRole('heading',{name:'AI 도우미'})).toBeVisible();
  await expect(page.locator('canvas')).toBeVisible();
  await expect(page.getByText('서버 연결됨',{exact:true})).toBeVisible();
  await page.getByPlaceholder('어떤 에셋을 찾으세요?').fill('no matching asset');
  await expect(page.locator('canvas')).toBeVisible();
  await page.setViewportSize({width:1100,height:760});
  expect(await page.locator('canvas').evaluate(el=>el.getBoundingClientRect().width)).toBeGreaterThan(400);
});
