import {test,expect} from './fixture';
test('Delete removes the selected object through commands and undo restores it; typing and dialogs stay safe',async({page})=>{
 await page.goto('/');await expect(page.getByText('서버 연결됨',{exact:true})).toBeVisible();
 await page.getByRole('button',{name:'라운지 의자 배치'}).dblclick();await expect(page.getByLabel('위치 X')).toBeEnabled();
 await page.keyboard.press('Delete');await expect(page.getByLabel('에셋 수')).toHaveText('0 / 200');
 await page.keyboard.press('Control+z');await expect(page.getByLabel('에셋 수')).toHaveText('1 / 200');
 await page.getByRole('button',{name:'라운지 의자 선택',exact:true}).click();await expect(page.getByLabel('위치 X')).toBeEnabled();
 await page.getByLabel('AI에게 요청').fill('hello');await page.getByLabel('AI에게 요청').press('Home');await page.getByLabel('AI에게 요청').press('Delete');await expect(page.getByLabel('AI에게 요청')).toHaveValue('ello');await expect(page.getByLabel('에셋 수')).toHaveText('1 / 200');
 await page.getByLabel('위치 X').focus();await page.keyboard.press('Delete');await expect(page.getByLabel('에셋 수')).toHaveText('1 / 200');
 await page.getByRole('button',{name:'History · 만든 에셋'}).click();await page.keyboard.press('Delete');await expect(page.getByLabel('에셋 수')).toHaveText('1 / 200');await page.getByRole('button',{name:'History 닫기'}).click();
 await page.keyboard.press('Delete');await expect(page.getByLabel('에셋 수')).toHaveText('0 / 200');
});
