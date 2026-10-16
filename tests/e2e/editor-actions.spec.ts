import {test,expect} from './fixture';
test('placing, transform numbers, duplicate, undo and redo use server commands',async({page})=>{
  await page.goto('/');
  await expect(page.getByText('서버 연결됨',{exact:true})).toBeVisible();
  await page.getByRole('button',{name:'라운지 의자 배치'}).dblclick();
  await expect(page.getByLabel('에셋 수')).toHaveText('1 / 200');
  await expect(page.getByLabel('위치 X')).toBeEnabled();
  await page.getByLabel('위치 X').fill('200');await page.getByLabel('위치 X').press('Enter');
  await expect(page.getByLabel('위치 X')).toHaveValue('200');
  await page.getByRole('button',{name:'복제',exact:true}).click();
  await expect(page.getByLabel('에셋 수')).toHaveText('2 / 200');
  await page.getByRole('button',{name:'되돌리기',exact:true}).click();
  await expect(page.getByLabel('에셋 수')).toHaveText('1 / 200');
  await page.getByRole('button',{name:'다시하기',exact:true}).click();
  await expect(page.getByLabel('에셋 수')).toHaveText('2 / 200');
});
