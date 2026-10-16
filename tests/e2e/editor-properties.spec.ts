import {test,expect} from './fixture';
test('invalid property edits restore authoritative display and floor snap is a server command',async({page})=>{
  await page.goto('/');await expect(page.getByText('서버 연결됨',{exact:true})).toBeVisible();
  await page.getByRole('button',{name:'컬러 블록 배치'}).dblclick();
  await expect(page.getByLabel('회전 X')).toBeEnabled();
  await page.getByLabel('회전 X').fill('90');await page.getByLabel('회전 X').press('Enter');
  await expect(page.getByLabel('회전 X')).toHaveValue('90');
  await page.getByLabel('회전 X').fill('');await page.getByLabel('회전 X').press('Enter');
  await expect(page.getByLabel('회전 X')).toHaveValue('90');
  await page.getByLabel('크기 Y').fill('0');await page.getByLabel('크기 Y').press('Enter');
  await expect(page.getByLabel('크기 Y')).toHaveValue('1');
  await page.getByLabel('에셋 이름').fill('');await page.getByLabel('에셋 이름').press('Enter');
  await expect(page.getByLabel('에셋 이름')).toHaveValue('컬러 블록');
  await page.getByLabel('에셋 이름').fill('내 조각');await page.getByLabel('에셋 이름').press('Enter');
  await expect(page.getByRole('button',{name:'내 조각 선택'})).toBeVisible();
  await page.getByLabel('위치 Z').fill('300');await page.getByLabel('위치 Z').press('Enter');
  await page.getByRole('button',{name:'바닥에 붙이기'}).click();
  await expect(page.getByLabel('위치 Z')).toHaveValue('50');
});
