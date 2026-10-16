import {test,expect} from './fixture';
test('renders procedural assets and manipulator in the viewport',async({page})=>{
  await page.setViewportSize({width:1440,height:950});
  await page.goto('/');
  await expect(page.getByText('서버 연결됨',{exact:true})).toBeVisible();
  await page.getByRole('button',{name:'둥근 테이블 배치'}).dblclick();
  await expect(page.getByLabel('에셋 수')).toHaveText('1 / 200');
  await page.getByRole('button',{name:'둥근 나무 배치'}).dblclick();
  await page.getByLabel('위치 X').fill('-300');await page.getByLabel('위치 X').press('Enter');
  await expect(page.getByLabel('위치 X')).toHaveValue('-300');
  await page.getByRole('button',{name:'라운지 의자 배치'}).dblclick();
  await page.getByLabel('위치 X').fill('200');await page.getByLabel('위치 X').press('Enter');
  await expect(page.getByLabel('위치 X')).toHaveValue('200');
  await page.screenshot({path:'docs/evidence/editor-preview.png'});
});
